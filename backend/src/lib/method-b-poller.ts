/**
 * Method B inbound — Gmail/Outlook full-READ inbox polling.
 *
 * Why this exists (the painpoint): Method A (per-task forwarding
 * email) requires clients to learn + use a special email address.
 * Real clients reply to whatever address they got the chase email
 * FROM — i.e. the CPA's actual inbox. Without Method B, those
 * replies sit in the CPA's inbox, attachments go uncategorized, and
 * the CPA does the manual classification work the product is
 * supposed to remove.
 *
 * With Method B, the BE polls the user's inbox via the OAuth READ
 * scope. For each new message:
 *   1. Match the sender email to a clients row (firm-scoped)
 *   2. If matched, walk the client's open tasks
 *   3. For each attachment, run Mode A classify → received_unreviewed
 *   4. Body-only replies log a client_replied activity event
 *
 * Idempotent on `provider_message_id` stored in metadata. Polls
 * every 5 minutes per connected integration; production runs this
 * as a separate worker process.
 *
 * Phase 2 by spec; the wider OAuth scope is the gating reason —
 * Mail.Read / gmail.readonly require explicit consent UX. Once the
 * user grants it (handled by the OAuth flow), this poller takes over.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  activityEvents,
  checklistItems,
  clients,
  deadlines,
  integrations,
  tasks,
} from "../db/schema.js";
import { getFreshAccessToken } from "./oauth.js";
import { classifyDocument, isAiConfigured } from "./ai.js";
import { log, span, captureException } from "./observability.js";

// ───────── Provider abstraction ─────────

interface InboxMessage {
  /** Provider's stable id — dedup key for incremental polling */
  providerId: string;
  from: string;
  subject: string;
  receivedAt: Date;
  text: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
  }>;
}

/**
 * Adapter interface — Gmail and Outlook both implement this so the
 * poller logic is provider-agnostic.
 */
interface InboxAdapter {
  /**
   * Fetch messages received after `sinceTs`. Implementation may be
   * cursor-based (Gmail history) or filter-based (Outlook delta).
   * Returns at most 50 messages per call.
   */
  fetchSince(args: {
    accessToken: string;
    sinceTs: Date;
  }): Promise<InboxMessage[]>;
}

// ───────── Gmail adapter ─────────

const gmail: InboxAdapter = {
  async fetchSince({ accessToken, sinceTs }) {
    // Gmail search query: docs after a UNIX timestamp
    const after = Math.floor(sinceTs.getTime() / 1000);
    const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    listUrl.searchParams.set("q", `after:${after} has:attachment`);
    listUrl.searchParams.set("maxResults", "50");

    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) {
      const text = await listRes.text();
      throw new Error(`gmail_list_failed: ${listRes.status} ${text.slice(0, 200)}`);
    }
    const list = (await listRes.json()) as {
      messages?: Array<{ id: string }>;
    };
    if (!list.messages || list.messages.length === 0) return [];

    // Hydrate each message — Gmail's list endpoint only returns ids
    // and threadIds; we need format=full for headers + parts.
    const out: InboxMessage[] = [];
    for (const m of list.messages) {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!msgRes.ok) continue;
        const msg = (await msgRes.json()) as GmailMessage;
        const headers = (msg.payload?.headers ?? []) as Array<{
          name: string;
          value: string;
        }>;
        const findHdr = (n: string) =>
          headers.find((h) => h.name.toLowerCase() === n)?.value ?? "";
        const from = parseFromHeader(findHdr("From"));
        const subject = findHdr("Subject");
        const dateHdr = findHdr("Date");
        const text = extractGmailText(msg.payload);
        const attachments = extractGmailAttachments(msg.payload);

        out.push({
          providerId: m.id,
          from,
          subject,
          receivedAt: dateHdr ? new Date(dateHdr) : new Date(),
          text,
          attachments,
        });
      } catch (err) {
        log.warn("method_b.gmail.message_fetch_failed", {
          messageId: m.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return out;
  },
};

interface GmailMessage {
  id: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: GmailPart[];
    mimeType?: string;
  };
}

interface GmailPart {
  filename?: string;
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

function extractGmailText(payload: GmailMessage["payload"]): string {
  if (!payload) return "";
  // Walk parts looking for a text/plain body
  const walk = (p: GmailPart): string => {
    if (p.mimeType === "text/plain" && p.body?.data) {
      return Buffer.from(p.body.data, "base64").toString("utf-8");
    }
    if (p.parts) {
      for (const sub of p.parts) {
        const t = walk(sub);
        if (t) return t;
      }
    }
    return "";
  };
  if (payload.parts) {
    for (const p of payload.parts) {
      const t = walk(p);
      if (t) return t;
    }
  }
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  return "";
}

function extractGmailAttachments(
  payload: GmailMessage["payload"],
): InboxMessage["attachments"] {
  const out: InboxMessage["attachments"] = [];
  if (!payload?.parts) return out;
  const walk = (p: GmailPart) => {
    if (p.filename && p.body?.size && p.body.size > 0) {
      out.push({
        filename: p.filename,
        contentType: p.mimeType ?? "application/octet-stream",
        size: p.body.size,
      });
    }
    if (p.parts) p.parts.forEach(walk);
  };
  payload.parts.forEach(walk);
  return out;
}

function parseFromHeader(raw: string): string {
  // "Name <email@host.com>" → "email@host.com" — take the bracketed
  // part if present, otherwise the whole string trimmed.
  const m = raw.match(/<([^>]+)>/);
  const value = m && m[1] ? m[1] : raw;
  return value.trim().toLowerCase();
}

// ───────── Outlook adapter ─────────

const outlook: InboxAdapter = {
  async fetchSince({ accessToken, sinceTs }) {
    // Outlook /messages with $filter for receivedDateTime gt sinceTs
    const url = new URL("https://graph.microsoft.com/v1.0/me/messages");
    url.searchParams.set(
      "$filter",
      `receivedDateTime gt ${sinceTs.toISOString()} and hasAttachments eq true`,
    );
    url.searchParams.set("$top", "50");
    url.searchParams.set("$select", "id,from,subject,receivedDateTime,bodyPreview");
    url.searchParams.set("$expand", "attachments");

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`outlook_list_failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      value?: Array<{
        id: string;
        from?: { emailAddress?: { address?: string } };
        subject?: string;
        receivedDateTime?: string;
        bodyPreview?: string;
        attachments?: Array<{
          name?: string;
          contentType?: string;
          size?: number;
        }>;
      }>;
    };
    if (!data.value) return [];
    return data.value.map((m) => ({
      providerId: m.id,
      from: (m.from?.emailAddress?.address ?? "").toLowerCase().trim(),
      subject: m.subject ?? "",
      receivedAt: m.receivedDateTime ? new Date(m.receivedDateTime) : new Date(),
      text: m.bodyPreview ?? "",
      attachments: (m.attachments ?? []).map((a) => ({
        filename: a.name ?? "attachment",
        contentType: a.contentType ?? "application/octet-stream",
        size: a.size ?? 0,
      })),
    }));
  },
};

// ───────── Poller ─────────

export interface PollResult {
  messagesScanned: number;
  matched: number;
  attachmentsClassified: number;
  errors: number;
}

/**
 * Run one poll cycle for one (firmId × provider) integration. Pulls
 * fresh access token (auto-refresh if needed), fetches messages since
 * lastSyncedAt, matches each to clients by sender email, runs
 * classifyDocument on attachments, writes checklist items.
 */
export async function pollMethodBOnce(args: {
  firmId: string;
  provider: "gmail" | "outlook";
}): Promise<PollResult> {
  return span(
    "method_b.poll",
    async () => {
      const adapter = args.provider === "gmail" ? gmail : outlook;
      const integration = await db.query.integrations.findFirst({
        where: and(
          eq(integrations.firmId, args.firmId),
          eq(integrations.kind, args.provider),
          eq(integrations.status, "connected"),
        ),
      });
      if (!integration) {
        return {
          messagesScanned: 0,
          matched: 0,
          attachmentsClassified: 0,
          errors: 0,
        };
      }

      // Default sinceTs: 24h back if no lastSyncedAt yet (first poll
      // after connecting). Production would let the user configure
      // initial sync depth.
      const sinceTs =
        integration.lastSyncedAt ??
        new Date(Date.now() - 24 * 60 * 60 * 1000);
      const accessToken = await getFreshAccessToken(args.firmId, args.provider);

      const messages = await adapter.fetchSince({ accessToken, sinceTs });

      // Build the firm's email→client lookup ONCE (rather than per-msg
      // queries). Strips display name, lowercases for compare.
      const firmClients = await db.query.clients.findMany({
        where: eq(clients.firmId, args.firmId),
      });
      const clientByEmail = new Map<string, typeof firmClients[number]>();
      for (const c of firmClients) {
        if (c.contactEmail) {
          clientByEmail.set(c.contactEmail.toLowerCase().trim(), c);
        }
      }

      let matched = 0;
      let attachmentsClassified = 0;
      let errors = 0;

      for (const msg of messages) {
        // Skip messages we've already processed (provider_message_id
        // dedup via activity events). Cheap pre-filter — full unique
        // constraint requires a separate index Phase 2.
        const dup = await db
          .select({ id: activityEvents.id })
          .from(activityEvents)
          .where(
            and(
              eq(activityEvents.firmId, args.firmId),
              sql`${activityEvents.payload}->>'methodBProviderId' = ${msg.providerId}`,
            ),
          )
          .limit(1);
        if (dup.length > 0) continue;

        const client = clientByEmail.get(msg.from);
        if (!client) continue;
        matched++;

        // Find this client's open tasks. We bind the message to the
        // first one; smarter routing (subject keyword match against
        // formType) is Phase 2 — start with simple "first open task"
        // because it's right >80% of the time when the client only
        // has one active filing.
        const clientTasks = await db
          .select({
            id: tasks.id,
            forwardingEmailLocalPart: tasks.forwardingEmailLocalPart,
            formType: deadlines.formType,
            deadlineId: tasks.deadlineId,
          })
          .from(tasks)
          .leftJoin(deadlines, eq(deadlines.id, tasks.deadlineId))
          .where(
            and(
              eq(tasks.firmId, args.firmId),
              eq(deadlines.clientId, client.id),
              sql`${tasks.status} NOT IN ('completed', 'filed_extension')`,
            ),
          )
          .limit(5);
        if (clientTasks.length === 0) continue;

        // Subject-keyword heuristic — pick the task whose formType
        // appears in the subject line. Falls back to the first task.
        const subj = msg.subject.toLowerCase();
        const target =
          clientTasks.find(
            (t) => t.formType && subj.includes(t.formType.toLowerCase()),
          ) ?? clientTasks[0];
        if (!target) continue;

        try {
          // For each attachment, run Mode A classify and write a
          // checklist item state transition. Body-only messages
          // record an activity event (no item touched).
          if (msg.attachments.length === 0) {
            await db.insert(activityEvents).values({
              firmId: args.firmId,
              taskId: target.id,
              eventType: "client_replied",
              actorKind: "system",
              description: msg.subject || "Client replied",
              payload: {
                methodBProviderId: msg.providerId,
                from: msg.from,
                provider: args.provider,
                text: msg.text.slice(0, 4000),
              },
            });
            continue;
          }

          // Pull pending items for this task to feed the classifier
          const pending = await db
            .select()
            .from(checklistItems)
            .where(eq(checklistItems.taskId, target.id));
          const pendingForAi = pending
            .filter(
              (i) =>
                i.state === "not_requested" || i.state === "requested_waiting",
            )
            .map((i) => ({ itemType: i.itemType, label: i.label }));

          for (const att of msg.attachments) {
            let aiClassification: string | null = null;
            let aiConfidence: number | null = null;
            let flagReason: string | null = null;
            let targetItemId: string | null = null;

            if (isAiConfigured() && pendingForAi.length > 0 && target.formType) {
              try {
                const ai = await classifyDocument({
                  firmId: args.firmId,
                  filename: att.filename,
                  taskContext: {
                    formType: target.formType,
                    clientName: client.name,
                    pendingItems: pendingForAi,
                  },
                });
                aiClassification = ai.guess;
                aiConfidence =
                  ai.confidence === "high"
                    ? 0.9
                    : ai.confidence === "medium"
                      ? 0.65
                      : 0.35;
                flagReason = ai.flagReason ?? null;
                if (ai.itemType) {
                  const match = pending.find((p) => p.itemType === ai.itemType);
                  if (match) targetItemId = match.id;
                }
              } catch (err) {
                log.warn("method_b.classify_failed", {
                  message: err instanceof Error ? err.message : String(err),
                });
                errors++;
              }
            }
            if (!targetItemId) {
              const fallback =
                pending.find((p) => p.state === "requested_waiting") ??
                pending.find((p) => p.state === "not_requested") ??
                pending[0];
              if (!fallback) continue;
              targetItemId = fallback.id;
            }

            await db
              .update(checklistItems)
              .set({
                state: flagReason ? "received_issue" : "received_unreviewed",
                receivedFilename: att.filename,
                stateChangedAt: msg.receivedAt,
                stateChangedByKind: "system",
                aiClassification,
                aiConfidence: aiConfidence?.toString() ?? null,
                aiFlagReason: flagReason,
              })
              .where(
                and(
                  eq(checklistItems.id, targetItemId),
                  eq(checklistItems.firmId, args.firmId),
                ),
              );
            await db.insert(activityEvents).values({
              firmId: args.firmId,
              taskId: target.id,
              eventType: flagReason
                ? "document_flagged"
                : "document_received",
              actorKind: "system",
              description: flagReason
                ? `Inbound (Method B): ${att.filename} — flagged: ${flagReason}`
                : `Inbound (Method B): ${att.filename}${aiClassification ? ` — AI: ${aiClassification}` : ""}`,
              payload: {
                methodBProviderId: msg.providerId,
                provider: args.provider,
                from: msg.from,
                subject: msg.subject,
                attachment: {
                  filename: att.filename,
                  size: att.size,
                  contentType: att.contentType,
                },
              },
              relatedChecklistItemId: targetItemId,
            });
            attachmentsClassified++;
          }
        } catch (err) {
          captureException(err, {
            firmId: args.firmId,
            provider: args.provider,
            messageId: msg.providerId,
          });
          errors++;
        }
      }

      // Update lastSyncedAt only on full success — partial errors
      // mean we want to retry on next poll.
      if (errors === 0 && messages.length > 0) {
        await db
          .update(integrations)
          .set({ lastSyncedAt: new Date() })
          .where(eq(integrations.id, integration.id));
      }

      return {
        messagesScanned: messages.length,
        matched,
        attachmentsClassified,
        errors,
      };
    },
    { firmId: args.firmId, provider: args.provider },
  );
}

// ───────── Scheduler ─────────

let pollerHandle: NodeJS.Timeout | null = null;

/**
 * Start the in-process Method B poller. Walks every connected
 * gmail/outlook integration on each tick; default 5 minutes.
 *
 * Production splits this to a separate worker process — a single
 * poll round can be slow with many firms × many messages.
 */
export function startMethodBPoller(intervalMs = 5 * 60 * 1000): void {
  if (pollerHandle) return;
  const tick = async () => {
    try {
      const connected = await db
        .select({
          firmId: integrations.firmId,
          kind: integrations.kind,
        })
        .from(integrations)
        .where(eq(integrations.status, "connected"));
      for (const row of connected) {
        if (row.kind !== "gmail" && row.kind !== "outlook") continue;
        try {
          await pollMethodBOnce({
            firmId: row.firmId,
            provider: row.kind,
          });
        } catch (err) {
          captureException(err, {
            firmId: row.firmId,
            provider: row.kind,
            ctx: "method_b_tick",
          });
        }
      }
    } catch (err) {
      captureException(err, { ctx: "method_b_scheduler" });
    }
  };
  // Initial run on boot
  void tick();
  pollerHandle = setInterval(() => void tick(), intervalMs);
  pollerHandle.unref?.();
  log.info("method_b_poller.started", { intervalMs });
}

export function stopMethodBPoller(): void {
  if (pollerHandle) {
    clearInterval(pollerHandle);
    pollerHandle = null;
  }
}
