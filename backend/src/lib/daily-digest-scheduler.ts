/**
 * Daily AM digest — scheduler + dispatcher.
 *
 * Runs in-process every 15 minutes. On each tick, it walks every user
 * who has the digest enabled, computes the user's local hour, and
 * fires the digest when:
 *   1. Local hour matches the user's configured `sendHour`
 *   2. Local weekday is in the user's configured `days` list
 *   3. We haven't already sent today (UNIQUE on (user_id, local_date))
 *
 * 15-minute granularity is the right tradeoff: we get firing windows of
 * up to 15 minutes after the configured hour (e.g. 7:14am for a 7am
 * preference), which is invisible to users; and the table-level UNIQUE
 * constraint guarantees idempotency even if two ticks fire concurrently.
 *
 * On a fresh deploy, every user with `enabled=true` gets considered on
 * the first tick after the relevant local hour passes. The dedupe
 * gate prevents the cold-start flood from sending an old digest at an
 * unintended time — see `localDateFor` in daily-digest.ts.
 *
 * Production gating: set `DAILY_DIGEST_DISABLED=1` to suppress all
 * sends without redeploying (e.g. during a Resend incident).
 */

import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, dailyDigestRuns } from "../db/schema.js";
import type { UserPreferences } from "../db/schema.js";
import { sendEmail } from "./email-out.js";
import { generateDigest, isQuietDay, localDateFor } from "./daily-digest.js";
import { renderDailyDigest } from "./daily-digest-renderer.js";
import { env } from "../env.js";
import { captureException, log } from "./observability.js";

const TICK_MS = 15 * 60 * 1000;
const WEEKDAY_MAP: Record<number, "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

let handle: NodeJS.Timeout | null = null;

export function startDailyDigestScheduler(intervalMs = TICK_MS): void {
  if (handle) return;
  // Cold start: don't fire immediately. The first tick happens
  // `intervalMs` later — gives the rest of the boot path room to
  // finish migrations + scraper warmup before we touch the email
  // provider.
  handle = setInterval(() => {
    void runDigestTick().catch((err) =>
      captureException(err, { ctx: "daily_digest.tick" }),
    );
  }, intervalMs);
  handle.unref?.();
}

export function stopDailyDigestScheduler(): void {
  if (handle) {
    clearInterval(handle);
    handle = null;
  }
}

/**
 * One tick of the scheduler. Public for the tRPC `dailyDigest.tickNow`
 * admin procedure (so ops can force a manual run for debugging).
 */
export async function runDigestTick(asOf: Date = new Date()): Promise<{
  considered: number;
  sent: number;
  skippedQuiet: number;
  skippedNotDue: number;
  failed: number;
}> {
  if (process.env.DAILY_DIGEST_DISABLED === "1") {
    return { considered: 0, sent: 0, skippedQuiet: 0, skippedNotDue: 0, failed: 0 };
  }

  const candidates = await db.select().from(users);

  let sent = 0;
  let skippedQuiet = 0;
  let skippedNotDue = 0;
  let failed = 0;

  for (const u of candidates) {
    const prefs = (u.preferences as UserPreferences | null)?.dailyDigest;
    if (!prefs?.enabled) continue;
    if (!isLocalSendWindow(asOf, u.timezone, prefs)) {
      skippedNotDue++;
      continue;
    }
    try {
      const dispatched = await dispatchDigestForUser(
        {
          userId: u.id,
          firmId: u.firmId,
          email: u.email,
          displayName: u.displayName,
          timezone: u.timezone,
        },
        asOf,
      );
      if (dispatched === "sent") sent++;
      else if (dispatched === "skipped_quiet") skippedQuiet++;
    } catch (err) {
      failed++;
      captureException(err, {
        ctx: "daily_digest.dispatch",
        userId: u.id,
      });
    }
  }

  log.info("daily_digest.tick", {
    considered: candidates.length,
    sent,
    skippedQuiet,
    skippedNotDue,
    failed,
  });
  return {
    considered: candidates.length,
    sent,
    skippedQuiet,
    skippedNotDue,
    failed,
  };
}

/**
 * Send (or deliberately skip) one user's digest. Caller-facing entry
 * point used by both the scheduler tick and the `previewMyDigest`
 * tRPC procedure (which sets `force=true` to bypass the dedupe gate).
 *
 * Returns the disposition string written to `daily_digest_runs.status`.
 */
export async function dispatchDigestForUser(
  args: {
    userId: string;
    firmId: string;
    email: string;
    displayName: string | null;
    timezone: string;
  },
  asOf: Date = new Date(),
  options: { force?: boolean; subjectPrefix?: string } = {},
): Promise<"sent" | "skipped_quiet" | "skipped_disabled" | "failed"> {
  const localDate = localDateFor(asOf, args.timezone);

  // Belt-and-suspenders dedupe: even if the cron logic somehow misses,
  // the UNIQUE constraint catches us. Skip the entire dispatch when a
  // run already exists today, unless forced (preview path).
  if (!options.force) {
    const [todayRow] = await db
      .select({ id: dailyDigestRuns.id })
      .from(dailyDigestRuns)
      .where(
        and(
          eq(dailyDigestRuns.userId, args.userId),
          eq(dailyDigestRuns.localDate, localDate),
        ),
      )
      .limit(1);
    if (todayRow) return "skipped_quiet"; // already handled today; treat as no-op
  }

  const payload = await generateDigest({
    userId: args.userId,
    firmId: args.firmId,
    timezone: args.timezone,
    displayName: args.displayName,
    asOf,
  });

  if (isQuietDay(payload) && !options.force) {
    await db
      .insert(dailyDigestRuns)
      .values({
        userId: args.userId,
        firmId: args.firmId,
        localDate,
        urgentCount: 0,
        alertsCount: 0,
        repliesCount: 0,
        status: "skipped_quiet",
      })
      .onConflictDoNothing();
    return "skipped_quiet";
  }

  const rendered = renderDailyDigest(payload, env.PUBLIC_BASE_URL);
  const subject = options.subjectPrefix
    ? `${options.subjectPrefix} ${rendered.subject}`
    : rendered.subject;

  try {
    const result = await sendEmail({
      firmId: args.firmId,
      to: args.email,
      preferProvider: "resend",
      from: "DueDateHQ <digest@duedatehq.space>",
      subject,
      body: rendered.text,
      htmlBody: rendered.html,
    });
    await db
      .insert(dailyDigestRuns)
      .values({
        userId: args.userId,
        firmId: args.firmId,
        localDate,
        urgentCount: payload.urgent.length,
        alertsCount: payload.alerts.length,
        repliesCount: payload.replies.length,
        status: "sent",
        emailId: result.providerMessageId ?? null,
      })
      .onConflictDoNothing();
    return "sent";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .insert(dailyDigestRuns)
      .values({
        userId: args.userId,
        firmId: args.firmId,
        localDate,
        urgentCount: payload.urgent.length,
        alertsCount: payload.alerts.length,
        repliesCount: payload.replies.length,
        status: "failed",
        errorMessage: message,
      })
      .onConflictDoNothing();
    throw err;
  }
}

/**
 * True when `asOf` (in the user's tz) is a sendHour-and-day match. We
 * accept the entire 15-minute tick window starting at sendHour:00, so
 * a 7am preference fires at any tick between 7:00 and 7:14 local.
 */
function isLocalSendWindow(
  asOf: Date,
  timezone: string,
  prefs: NonNullable<UserPreferences["dailyDigest"]>,
): boolean {
  // Hour + weekday in the user's tz. Intl.DateTimeFormat does the work.
  const partsFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = partsFmt.formatToParts(asOf);
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minuteStr = parts.find((p) => p.type === "minute")?.value ?? "00";
  const hour = Number.parseInt(hourStr === "24" ? "00" : hourStr, 10);
  const minute = Number.parseInt(minuteStr, 10);

  if (hour !== prefs.sendHour) return false;
  if (minute >= 15) return false; // outside the 15-min tick window

  // Weekday gate
  const dow = asOf.toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const dowKey = dow.toLowerCase().slice(0, 3) as keyof typeof WEEKDAY_MAP & string;
  const allowed = (prefs.days ?? ["mon", "tue", "wed", "thu", "fri"]).map((d) =>
    d.toLowerCase(),
  );
  return allowed.includes(dowKey);
}
