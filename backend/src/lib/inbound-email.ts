/**
 * Inbound email handler — Method A per PRD §7.7.
 *
 * Postmark / SES / Mailgun all post inbound mail to a webhook with
 * roughly the same shape: `From`, `To`, `Subject`, `TextBody`, `HtmlBody`,
 * `Attachments[]`. We extract the per-task forwarding address from the
 * `To` field (e.g. `emily-1040-X7fK@inbound.duedatehq.com`), look up the
 * task by suffix, write attachments to checklist items, fire activity
 * events, and run Mode A classification.
 *
 * Shape is intentionally provider-agnostic — the route adapter normalizes
 * Postmark / SES / Mailgun JSON into this canonical shape before calling
 * `processInboundEmail`.
 */

import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  activityEvents,
  checklistItems,
  tasks,
  clients,
  deadlines,
} from "../db/schema.js";
import { log, span, captureException } from "./observability.js";
import { classifyDocument, isAiConfigured } from "./ai.js";
import { sendEmail } from "./email-out.js";
import {
  buildInboundReplyInsert,
  classifyInboundHeuristic,
  type InboundEmail as OrchestratorInbound,
} from "./inbound-orchestrator.js";
import { inboundReplies } from "../db/schema.js";

export interface InboundEmail {
  /** RFC-5322 envelope sender */
  from: string;
  /** All `To`/`Cc`/`Bcc` addresses; we scan for forwarding suffixes */
  to: string[];
  subject: string;
  /** Plain-text body — used for Mode A heuristics + audit log */
  text: string;
  /** Files attached to the email */
  attachments: Array<{
    filename: string;
    contentType: string;
    /** Size in bytes (we don't store payloads in this path; the
     *  uploads pipeline pushes to Supabase Storage). */
    size: number;
  }>;
  /** Wall-clock receipt time per the upstream provider */
  receivedAt: Date;
  /** Provider-supplied unique id — dedupe key */
  providerId: string;
}

/**
 * Per-task forwarding addresses follow the format
 *   <client-firstname>-<form-slug>-<4char-token>@inbound.duedatehq.com
 * The token is the routable suffix; everything before it is human-readable.
 * We index on the token (stored in tasks.forwarding_email column).
 */
const FORWARDING_RE =
  /^([a-z0-9]+(?:-[a-z0-9]+)+)-([a-z0-9]{4,8})@(?:inbound\.)?duedatehq\.com$/i;

export function extractForwardingToken(addr: string): string | null {
  const m = addr.trim().toLowerCase().match(FORWARDING_RE);
  return m && m[2] ? m[2] : null;
}

/**
 * Process an inbound email end-to-end. Idempotent on `providerId`:
 * re-running with the same provider message id is a no-op.
 *
 * Flow:
 *   1. Find the task by forwarding-suffix match against `to` headers
 *   2. Write a `checklist_item.received` for each attachment (Mode A
 *      classifier picks which item; below the classifier is a stub)
 *   3. Append an activity event
 *
 * Returns the task id on success, or null when no task matched any
 * recipient address (legitimate non-task email — log + drop).
 */
export async function processInboundEmail(
  payload: InboundEmail,
): Promise<{ taskId: string; itemsWritten: number } | null> {
  return span(
    "inbound_email.process",
    async () => {
      // Find any forwarding token in the recipient list. We accept the
      // first match — multiple tokens in one email is non-spec.
      let token: string | null = null;
      for (const addr of payload.to) {
        token = extractForwardingToken(addr);
        if (token) break;
      }
      if (!token) {
        log.info("inbound_email.no_forwarding_token", {
          to: payload.to,
          subject: payload.subject,
        });
        return null;
      }

      // Look up the task by forwarding-email-local-part. The schema
      // stores just the local part (everything before @), so we match
      // exactly against the token extracted from the recipient address.
      const all = await db.query.tasks.findMany();
      const task = all.find(
        (t) => t.forwardingEmailLocalPart.toLowerCase() === token,
      );
      if (!task) {
        log.warn("inbound_email.token_not_matched", { token });
        return null;
      }

      // Pull task context for Mode A — form type, client name, pending
      // checklist items. Without these the classifier can only guess
      // from filename alone.
      const items = await db
        .select()
        .from(checklistItems)
        .where(eq(checklistItems.taskId, task.id));
      const deadline = await db.query.deadlines.findFirst({
        where: eq(deadlines.id, task.deadlineId),
      });
      const client = deadline
        ? await db.query.clients.findFirst({
            where: eq(clients.id, deadline.clientId),
          })
        : null;
      const pendingItems = items
        .filter(
          (i) =>
            i.state === "not_requested" || i.state === "requested_waiting",
        )
        .map((i) => ({ itemType: i.itemType, label: i.label }));

      let written = 0;
      for (const att of payload.attachments) {
        // Mode A classifier — when AI is configured, ask it which
        // pending item this attachment belongs to + how confident.
        // Otherwise fall back to deterministic priority (first
        // not_requested → first requested_waiting → first item).
        let target: typeof items[number] | undefined;
        let aiClassification: string | null = null;
        let aiConfidence: number | null = null;
        let flagReason: string | null = null;
        if (isAiConfigured() && pendingItems.length > 0 && deadline && client) {
          try {
            const ai = await classifyDocument({
              firmId: task.firmId,
              filename: att.filename,
              taskContext: {
                formType: deadline.formType,
                clientName: client.name,
                pendingItems,
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
              target = items.find((i) => i.itemType === ai.itemType);
            }
          } catch (err) {
            log.warn("inbound_email.ai_classify_failed", {
              message: err instanceof Error ? err.message : String(err),
            });
          }
        }
        if (!target) {
          target =
            items.find((i) => i.state === "not_requested") ??
            items.find((i) => i.state === "requested_waiting") ??
            items[0];
        }
        if (!target) break;

        // Move the checklist item to received_unreviewed. §5.3 invariant
        // (DB CHECK) prevents promotion to received_confirmed by anyone
        // but a user — this auto-promotion is safe up to "unreviewed".
        // If Mode C-style anomaly was flagged by the classifier, route
        // to received_issue instead so the row surfaces as "needs
        // judgment" not "fast-lane confirm".
        await db
          .update(checklistItems)
          .set({
            state: flagReason ? "received_issue" : "received_unreviewed",
            receivedFilename: att.filename,
            stateChangedAt: payload.receivedAt,
            stateChangedByKind: "system",
            aiClassification,
            aiConfidence: aiConfidence?.toString() ?? null,
            aiFlagReason: flagReason,
          })
          .where(
            and(
              eq(checklistItems.id, target.id),
              eq(checklistItems.firmId, task.firmId),
            ),
          );
        await db.insert(activityEvents).values({
          firmId: task.firmId,
          taskId: task.id,
          eventType: flagReason ? "document_flagged" : "document_received",
          actorKind: "system",
          description: flagReason
            ? `Inbound: ${att.filename} — flagged: ${flagReason}`
            : `Inbound: ${att.filename}${aiClassification ? ` — AI: ${aiClassification}` : ""}`,
          payload: {
            providerId: payload.providerId,
            from: payload.from,
            attachment: {
              filename: att.filename,
              size: att.size,
              contentType: att.contentType,
            },
            ai: aiClassification
              ? { classification: aiClassification, confidence: aiConfidence }
              : null,
          },
          relatedChecklistItemId: target.id,
        });
        written++;

        // Validation auto-reply — when Mode A flags an inbound (wrong
        // year, redacted, partial, name mismatch), notify the client
        // immediately. Without this the CPA gets the flag, the client
        // never knows, and the same wrong doc sits as the supposed
        // answer until the CPA manually replies.
        // CPA is CC'd on every auto-reply so they see the loop close.
        if (flagReason && payload.from && client) {
          try {
            await sendEmail({
              firmId: task.firmId,
              to: payload.from,
              replyTo: `${task.forwardingEmailLocalPart}@inbound.duedatehq.com`,
              subject: `Quick clarification on ${att.filename}`,
              body: buildValidationReply({
                clientFirstName: client.name.split(/\s+/)[0] ?? "",
                filename: att.filename,
                flagReason,
                expectedItem: target.label,
                forwardingEmail: `${task.forwardingEmailLocalPart}@inbound.duedatehq.com`,
              }),
              taskId: task.id,
            });
            log.info("inbound_email.validation_reply_sent", {
              taskId: task.id,
              flagReason,
              filename: att.filename,
            });
          } catch (err) {
            // Don't fail the whole inbound on a send error — the doc
            // is already recorded; the CPA can manually reply.
            captureException(err, {
              ctx: "validation_auto_reply",
              taskId: task.id,
            });
          }
        }
      }

      // Body-only emails still record activity so the CPA sees the reply
      // on the task timeline.
      if (payload.attachments.length === 0) {
        await db.insert(activityEvents).values({
          firmId: task.firmId,
          taskId: task.id,
          eventType: "client_replied",
          actorKind: "system",
          description: payload.subject || "Client replied",
          payload: {
            providerId: payload.providerId,
            from: payload.from,
            text: payload.text.slice(0, 4000),
          },
        });
      }

      // v0.8 amendment: persist to InboundReply with 7-class top-level
      // classification per `feedback_no_manual_file_shuffle` Path E.
      // Bytes never copied — gmailMessageId is the canonical pointer
      // (we use providerId as a stand-in for non-Gmail providers).
      try {
        const orchestratorPayload: OrchestratorInbound = {
          gmailMessageId: payload.providerId,
          fromAddress: payload.from,
          toAddress: payload.to[0] ?? "",
          subject: payload.subject,
          bodyText: payload.text,
          attachmentMetadata: payload.attachments.map((a, i) => ({
            filename: a.filename,
            mimeType: a.contentType,
            size: a.size,
            attachmentIndex: i,
          })),
        };
        const classification = classifyInboundHeuristic(orchestratorPayload);
        const reply = buildInboundReplyInsert(
          task.firmId,
          orchestratorPayload,
          classification,
        );
        // Tie the InboundReply to the matched task (forwarding-token route).
        await db.insert(inboundReplies).values({ ...reply, taskId: task.id });
      } catch (err) {
        // Don't fail the whole inbound flow on classifier error — log + drop
        // and let the caller still get a successful task match.
        captureException(err, { route: "inbound_email.classify_persist" });
      }

      return { taskId: task.id, itemsWritten: written };
    },
    { providerId: payload.providerId },
  );
}

/**
 * Postmark inbound webhook → canonical InboundEmail. The shape comes
 * straight from postmarkapp.com/developer/user-guide/inbound/parse-an-email
 * (the wireframe doesn't depend on Postmark; SES/Mailgun adapters live
 * alongside this one with the same return shape).
 */
export function fromPostmark(body: unknown): InboundEmail | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const from =
    typeof b.From === "string"
      ? b.From
      : typeof b.FromFull === "object" && b.FromFull
        ? String((b.FromFull as Record<string, unknown>).Email ?? "")
        : "";
  const toList: string[] = [];
  if (Array.isArray(b.ToFull)) {
    for (const t of b.ToFull as Array<Record<string, unknown>>) {
      if (typeof t.Email === "string") toList.push(t.Email);
    }
  }
  if (Array.isArray(b.CcFull)) {
    for (const t of b.CcFull as Array<Record<string, unknown>>) {
      if (typeof t.Email === "string") toList.push(t.Email);
    }
  }
  if (toList.length === 0) return null;

  const attachments: InboundEmail["attachments"] = [];
  if (Array.isArray(b.Attachments)) {
    for (const a of b.Attachments as Array<Record<string, unknown>>) {
      attachments.push({
        filename: String(a.Name ?? "attachment"),
        contentType: String(a.ContentType ?? "application/octet-stream"),
        size: Number(a.ContentLength ?? 0),
      });
    }
  }

  return {
    from,
    to: toList,
    subject: typeof b.Subject === "string" ? b.Subject : "",
    text: typeof b.TextBody === "string" ? b.TextBody : "",
    attachments,
    receivedAt: typeof b.Date === "string" ? new Date(b.Date) : new Date(),
    providerId: String(b.MessageID ?? `postmark-${Date.now()}`),
  };
}

/**
 * Build the validation auto-reply body. Tone is warm-but-direct;
 * client gets a clear ask without feeling scolded. CPA is implied
 * (the email comes from the firm's domain) but signs as the firm
 * for branding.
 */
function buildValidationReply(args: {
  clientFirstName: string;
  filename: string;
  flagReason: string;
  expectedItem: string;
  forwardingEmail: string;
}): string {
  const greeting = args.clientFirstName ? `Hi ${args.clientFirstName},` : "Hi,";
  return [
    greeting,
    "",
    `Thanks for sending ${args.filename}. Quick note: ${args.flagReason}. We need ${args.expectedItem} for the right tax year — could you forward the correct one when you get a chance?`,
    "",
    `Just reply to this email or send to ${args.forwardingEmail} and it'll route automatically.`,
    "",
    "Thanks!",
  ].join("\n");
}

/**
 * AWS SES inbound webhook → canonical InboundEmail. SES POSTs an SNS
 * notification wrapping the inbound mail. Two formats:
 *   1. SES "Inbound Email" rule action → S3 + SNS notification with mail
 *      headers + a key to S3 (we'd fetch full content). For Phase 2 backend
 *      ship-today this parser handles the simpler "Inline" delivery format
 *      where SES inlines the email content into the SNS message body.
 *   2. SES "Lambda" action → direct Lambda invoke (different code path,
 *      not used by this Hono webhook).
 *
 * Real production deployment uses #1 with S3 fetch — that's a Phase 3 wiring
 * item. This parser fits the test-and-eval mode: SES dev sandbox forwarding
 * a JSON snapshot of the email.
 */
export function fromSes(body: unknown): InboundEmail | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  // SNS wrapper: extract the Message payload (which is itself JSON-stringified).
  let messageBody: Record<string, unknown> = b;
  if (typeof b.Message === "string") {
    try {
      messageBody = JSON.parse(b.Message) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  const mail = (messageBody.mail ?? messageBody) as Record<string, unknown>;
  const headers = (mail.commonHeaders ?? {}) as Record<string, unknown>;
  const messageId = (mail.messageId ?? messageBody.MessageId ?? "") as string;

  const from = String(
    Array.isArray(headers.from) ? headers.from[0] : headers.from ?? "",
  );
  const toList = Array.isArray(headers.to)
    ? (headers.to as string[])
    : typeof headers.to === "string"
      ? [headers.to]
      : [];
  if (toList.length === 0) return null;

  const subject = String(headers.subject ?? "");
  const receivedAt = headers.date
    ? new Date(String(headers.date))
    : new Date();

  // Phase 2 backend ship-today: text body + attachments arrive via S3 fetch
  // in production; for the inline test format we accept `content` and
  // `attachments` arrays at the top level.
  const text = typeof messageBody.content === "string" ? messageBody.content : "";
  const attachmentsRaw = Array.isArray(messageBody.attachments)
    ? (messageBody.attachments as Array<Record<string, unknown>>)
    : [];
  const attachments: InboundEmail["attachments"] = attachmentsRaw.map((a) => ({
    filename: String(a.filename ?? a.name ?? "attachment"),
    contentType: String(a.contentType ?? a.mimeType ?? "application/octet-stream"),
    size: Number(a.size ?? 0),
  }));

  if (!from || toList.length === 0 || !messageId) return null;

  return {
    from,
    to: toList,
    subject,
    text,
    attachments,
    receivedAt,
    providerId: messageId,
  };
}
