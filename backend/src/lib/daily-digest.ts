/**
 * Daily AM digest — generator.
 *
 * Computes the morning summary payload for one user. Returns null when
 * the day is "quiet" (zero items meeting the urgency bar) so the caller
 * can skip sending entirely. Quiet-day suppression is the single most
 * important property of this digest: an email that arrives only when
 * something is actually pending earns standing in the inbox.
 *
 * Sections (in priority order):
 *   1. URGENT TODAY — tasks overdue or due today (jurisdiction-adjusted)
 *   2. NEW STATE ALERTS — announcements detected since last digest
 *      with at least one of the firm's clients matched
 *   3. CLIENT REPLIES — inbound replies awaiting CPA action
 *   4. YESTERDAY WRAP — counts of chases sent / docs received / tasks
 *      closed in the prior 24h (informational, never gates send)
 *
 * The first 3 are gating: at least one must be non-empty for the email
 * to fire. YESTERDAY WRAP is decoration — it appears only alongside
 * a non-empty primary section, never alone.
 *
 * See `daily-digest-renderer.ts` for the email body rendering and
 * `daily-digest-scheduler.ts` for the cron tick that calls this.
 */

import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  announcementMatches,
  announcements,
  clients,
  dailyDigestRuns,
  deadlines,
  inboundReplies,
  tasks,
} from "../db/schema.js";

export interface DigestUrgentItem {
  taskId: string;
  clientName: string;
  formType: string;
  jurisdiction: string;
  /** ISO YYYY-MM-DD — already weekend-shifted via adjustedDueDate. */
  dueDate: string;
  /** Negative = overdue (days past), 0 = today, positive = future. */
  daysFromToday: number;
}

export interface DigestAlertItem {
  announcementId: string;
  stateCode: string;
  authority: string;
  title: string;
  /** Number of the firm's clients matched against this announcement. */
  affectedClientCount: number;
}

export interface DigestReplyItem {
  inboundReplyId: string;
  fromAddress: string;
  /** Best-effort client name (resolved via task → client). */
  clientName: string | null;
  subject: string | null;
  /** ISO timestamp. */
  receivedAt: string;
}

export interface DigestWrapStats {
  chasesSent: number;
  docsReceived: number;
  tasksClosed: number;
}

export interface DigestPayload {
  userId: string;
  firmId: string;
  /** User's local date the digest is FOR (today, in their tz). */
  localDate: string;
  /** Display name for greeting; null if user hasn't set one. */
  displayName: string | null;
  urgent: DigestUrgentItem[];
  alerts: DigestAlertItem[];
  replies: DigestReplyItem[];
  /** Always present, but only rendered when ≥1 of {urgent, alerts, replies}. */
  wrap: DigestWrapStats;
}

/**
 * Whether this payload is worth emailing. False when all three primary
 * sections are empty regardless of the wrap stats — quiet days don't
 * earn an email just because three docs got received.
 */
export function isQuietDay(p: DigestPayload): boolean {
  return p.urgent.length === 0 && p.alerts.length === 0 && p.replies.length === 0;
}

const DAY_MS = 86_400_000;

/**
 * ISO YYYY-MM-DD for the user's "today." We compute it from the local
 * components in the user's tz so a CPA in NY at 11pm EST and one in LA
 * at 8pm PST get different localDate values for the same UTC moment —
 * which is correct for dedupe keying.
 */
export function localDateFor(now: Date, timezone: string): string {
  // Intl.DateTimeFormat's en-CA locale yields YYYY-MM-DD natively.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now);
}

/**
 * Generate the digest payload for one user as of `asOf`. Read-only;
 * does not write `daily_digest_runs`. Caller is responsible for
 * persisting the run row after dispatch (so we capture send/skip
 * status in the same row).
 */
export async function generateDigest(args: {
  userId: string;
  firmId: string;
  /** User's IANA tz, e.g. "America/Los_Angeles". */
  timezone: string;
  /** Display name for greeting, defaults to email local-part if absent. */
  displayName: string | null;
  /** Reference time. Defaults to now; injected for tests. */
  asOf?: Date;
}): Promise<DigestPayload> {
  const asOf = args.asOf ?? new Date();
  const localDate = localDateFor(asOf, args.timezone);

  const [urgent, alerts, replies, wrap] = await Promise.all([
    fetchUrgent(args.firmId, localDate),
    fetchNewAlerts(args.firmId, args.userId, asOf),
    fetchPendingReplies(args.firmId),
    fetchYesterdayWrap(args.firmId, asOf),
  ]);

  return {
    userId: args.userId,
    firmId: args.firmId,
    localDate,
    displayName: args.displayName,
    urgent,
    alerts,
    replies,
    wrap,
  };
}

// ---------- Section fetchers ----------

/**
 * Tasks whose deadline is overdue or due today, gated by deadline
 * status (we exclude completed / filed-extension). Sorted by adjusted
 * due date ascending so the most-overdue items render first.
 *
 * Cap at 10 rows — we'd rather link to the action queue than fill the
 * email with a wall of names.
 */
async function fetchUrgent(
  firmId: string,
  localDateIso: string,
): Promise<DigestUrgentItem[]> {
  const rows = await db
    .select({
      taskId: tasks.id,
      clientName: clients.name,
      formType: deadlines.formType,
      jurisdiction: deadlines.jurisdiction,
      dueDate: deadlines.adjustedDueDate,
    })
    .from(tasks)
    .innerJoin(deadlines, eq(deadlines.id, tasks.deadlineId))
    .innerJoin(clients, eq(clients.id, deadlines.clientId))
    .where(
      and(
        eq(tasks.firmId, firmId),
        lte(deadlines.adjustedDueDate, localDateIso),
        // Drop deadlines we've already closed out
        sql`${deadlines.status} NOT IN ('completed', 'filed_extension')`,
      ),
    )
    .orderBy(deadlines.adjustedDueDate)
    .limit(10);

  const today = parseLocalIso(localDateIso);
  return rows.map((r) => ({
    taskId: r.taskId,
    clientName: r.clientName,
    formType: r.formType,
    jurisdiction: r.jurisdiction,
    dueDate: r.dueDate,
    daysFromToday: Math.round(
      (parseLocalIso(r.dueDate).getTime() - today.getTime()) / DAY_MS,
    ),
  }));
}

/**
 * Announcements detected since the last digest we sent this user. If
 * we've never sent one, fall back to "last 24h" so a brand-new user
 * doesn't get blasted with the entire backlog on first send.
 *
 * Filtered by announcement_matches so we only surface alerts where at
 * least one of the firm's clients is affected.
 */
async function fetchNewAlerts(
  firmId: string,
  userId: string,
  asOf: Date,
): Promise<DigestAlertItem[]> {
  // When was this user's last successful digest? Anchor "new" off that.
  const [lastRun] = await db
    .select({ sentAt: dailyDigestRuns.sentAt })
    .from(dailyDigestRuns)
    .where(
      and(
        eq(dailyDigestRuns.userId, userId),
        eq(dailyDigestRuns.status, "sent"),
      ),
    )
    .orderBy(sql`${dailyDigestRuns.sentAt} DESC`)
    .limit(1);
  const since =
    lastRun?.sentAt ?? new Date(asOf.getTime() - DAY_MS); // 24h fallback

  const rows = await db
    .select({
      announcementId: announcements.id,
      stateCode: announcements.stateCode,
      authority: announcements.authority,
      title: announcements.title,
      detectedAt: announcements.detectedAt,
      affectedClientCount: sql<number>`count(distinct ${announcementMatches.clientId})`,
    })
    .from(announcements)
    .innerJoin(
      announcementMatches,
      and(
        eq(announcementMatches.announcementId, announcements.id),
        eq(announcementMatches.firmId, firmId),
      ),
    )
    .where(gte(announcements.detectedAt, since))
    .groupBy(
      announcements.id,
      announcements.stateCode,
      announcements.authority,
      announcements.title,
      announcements.detectedAt,
    )
    .orderBy(sql`${announcements.detectedAt} DESC`)
    .limit(5);

  return rows.map((r) => ({
    announcementId: r.announcementId,
    stateCode: r.stateCode,
    authority: r.authority,
    title: r.title,
    affectedClientCount: Number(r.affectedClientCount),
  }));
}

/**
 * Inbound client replies awaiting CPA action — classified but not
 * yet actioned by the CPA. We use `actionedAt IS NULL` as the gate
 * (the FE's Mark-actioned button writes this column).
 */
async function fetchPendingReplies(firmId: string): Promise<DigestReplyItem[]> {
  const rows = await db
    .select({
      inboundReplyId: inboundReplies.id,
      fromAddress: inboundReplies.fromAddress,
      subject: inboundReplies.subject,
      receivedAt: inboundReplies.receivedAt,
      taskId: inboundReplies.taskId,
    })
    .from(inboundReplies)
    .where(
      and(
        eq(inboundReplies.firmId, firmId),
        isNull(inboundReplies.cpaActionedAt),
        // Only show replies that have been classified — unclassified
        // ones are still in the Mode A pipeline and may be misrouted.
        sql`${inboundReplies.classifiedAt} IS NOT NULL`,
      ),
    )
    .orderBy(sql`${inboundReplies.receivedAt} DESC`)
    .limit(5);

  if (rows.length === 0) return [];

  // Best-effort client-name resolution via task → client. Some inbound
  // rows have a null taskId (misrouted); leave clientName null in that
  // case so the renderer falls back to the from-address local-part.
  const taskIds = rows
    .map((r) => r.taskId)
    .filter((id): id is string => id !== null);
  const clientByTask = new Map<string, string>();
  if (taskIds.length > 0) {
    const joined = await db
      .select({
        taskId: tasks.id,
        clientName: clients.name,
      })
      .from(tasks)
      .innerJoin(deadlines, eq(deadlines.id, tasks.deadlineId))
      .innerJoin(clients, eq(clients.id, deadlines.clientId))
      .where(or(...taskIds.map((id) => eq(tasks.id, id)))!);
    for (const r of joined) clientByTask.set(r.taskId, r.clientName);
  }

  return rows.map((r) => ({
    inboundReplyId: r.inboundReplyId,
    fromAddress: r.fromAddress,
    clientName: r.taskId ? clientByTask.get(r.taskId) ?? null : null,
    subject: r.subject,
    receivedAt: r.receivedAt.toISOString(),
  }));
}

/**
 * Coarse "what got done yesterday" stats. Phase 1 reads from
 * `deadlines.status` transitions (proxy for tasks closed) — full
 * activity-event sourcing comes when the activity feed is wired
 * into a separate aggregator. For MVP, the count is "deadlines that
 * moved to completed in the last 24h" which approximates closed
 * work close enough to feel real.
 */
async function fetchYesterdayWrap(
  firmId: string,
  asOf: Date,
): Promise<DigestWrapStats> {
  const yesterday = new Date(asOf.getTime() - DAY_MS);

  const closedRows = (await db
    .select({
      tasksClosed: sql<number>`count(*)`,
    })
    .from(deadlines)
    .where(
      and(
        eq(deadlines.firmId, firmId),
        eq(deadlines.status, "completed"),
        gte(deadlines.updatedAt, yesterday),
      ),
    )) as Array<{ tasksClosed: number }>;
  const tasksClosed = closedRows[0]?.tasksClosed ?? 0;

  // Phase 1 proxy: chases-sent and docs-received aren't in a table we
  // can cheaply aggregate without a join through activity_events. Set
  // to zero for now — the wrap section renders only when ≥1 stat is
  // non-zero, and tasksClosed is the most user-meaningful of the three.
  return {
    chasesSent: 0,
    docsReceived: 0,
    tasksClosed: Number(tasksClosed),
  };
}

// ---------- Internals ----------

function parseLocalIso(iso: string): Date {
  // "YYYY-MM-DD" — interpret as UTC midnight for diff math.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}
