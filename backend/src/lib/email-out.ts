/**
 * Outbound email — provider-agnostic send. Currently supports Resend
 * (transactional) and Gmail-via-OAuth as the two paths. The SDK-less
 * implementation keeps the backend dep-light; both providers expose
 * REST APIs that work fine with native fetch.
 *
 * When `RESEND_API_KEY` is set, transactional emails (validation
 * auto-replies, digest emails the CPA reviews) flow through Resend.
 * When the firm has Gmail/Outlook OAuth connected with send scope,
 * the CPA's actual address can be used instead — preserves brand
 * voice + reply-to.
 *
 * Phase 1 implementation. Phase 2 adds Postmark + DNS configuration
 * for the inbound address.
 */

import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { activityEvents, integrations, tasks } from "../db/schema.js";
import { getFreshAccessToken } from "./oauth.js";
import { log, captureException } from "./observability.js";

export interface SendEmailInput {
  firmId: string;
  to: string;
  /** When set, takes precedence over Resend — uses the firm's
   *  connected Gmail/Outlook to send from the CPA's actual address. */
  preferProvider?: "gmail" | "outlook" | "resend";
  from?: string;
  /** Reply-to — typically the per-task forwarding address so client
   *  replies route back into the system. */
  replyTo?: string;
  subject: string;
  /** Plain-text body. HTML is wrapped automatically; if you need full
   *  HTML control, pass htmlBody too. */
  body: string;
  htmlBody?: string;
  /** Optional task association — logs an activity event. */
  taskId?: string;
  /** Cc the CPA so they see the auto-replies. PRD §7.2. */
  cc?: string[];
  /** Optional EmailDraft id — stamped as a provider-side tag/header so
   *  bounce + complaint webhooks (PRD §5.8) can correlate back to the
   *  draft for DeliveryEvent persistence. Resend uses `tags`; SES uses
   *  message tags via SDK; Gmail/Outlook OAuth use a custom header
   *  (DSN bounces come back through the inbound classifier — see
   *  `feedback_no_manual_file_shuffle` for the architecture). */
  emailDraftId?: string;
}

export interface SendEmailResult {
  ok: true;
  provider: "gmail" | "outlook" | "resend";
  providerMessageId: string;
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  // Resolve provider preference — try the firm's connected OAuth first,
  // fall back to Resend transactional.
  const preferred = input.preferProvider;

  if (preferred !== "resend") {
    // Try Gmail / Outlook if connected
    for (const provider of ["gmail", "outlook"] as const) {
      if (preferred && preferred !== provider) continue;
      const integration = await db.query.integrations.findFirst({
        where: and(
          eq(integrations.firmId, input.firmId),
          eq(integrations.kind, provider),
          eq(integrations.status, "connected"),
        ),
      });
      if (!integration) continue;
      try {
        const result = await sendViaOauth(provider, input);
        await maybeLogActivity(input, result);
        return result;
      } catch (err) {
        log.warn("email_out.oauth_send_failed", {
          provider,
          message: err instanceof Error ? err.message : String(err),
        });
        // Fall through to Resend
      }
    }
  }

  // Resend fallback
  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "no_send_provider_configured — set RESEND_API_KEY or connect Gmail/Outlook",
    );
  }
  const result = await sendViaResend(input);
  await maybeLogActivity(input, result);
  return result;
}

async function sendViaOauth(
  provider: "gmail" | "outlook",
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const accessToken = await getFreshAccessToken(input.firmId, provider);

  if (provider === "gmail") {
    // Gmail send accepts a base64url-encoded RFC 5322 message
    const rfc822 = buildRfc822(input);
    const body = JSON.stringify({
      raw: Buffer.from(rfc822).toString("base64url"),
    });
    const res = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body,
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`gmail_send_failed: ${res.status} ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as { id: string };
    return { ok: true, provider, providerMessageId: json.id };
  }

  // Outlook — Graph API /me/sendMail
  // Custom header X-DueDateHQ-Email-Draft-Id stamps the draft id for DSN
  // bounce attribution (parsed inbound side via the classifier when a
  // postmaster bounce DSN comes back through the firm's mailbox).
  const headers = [
    { name: "Reply-To", value: input.replyTo ?? "" },
    {
      name: "X-DueDateHQ-Email-Draft-Id",
      value: input.emailDraftId ?? "",
    },
  ].filter((h) => h.value);
  const res = await fetch(
    "https://graph.microsoft.com/v1.0/me/sendMail",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: input.subject,
          body: {
            contentType: input.htmlBody ? "HTML" : "Text",
            content: input.htmlBody ?? input.body,
          },
          toRecipients: [{ emailAddress: { address: input.to } }],
          ccRecipients: (input.cc ?? []).map((addr) => ({
            emailAddress: { address: addr },
          })),
          internetMessageHeaders: headers,
        },
        saveToSentItems: true,
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`outlook_send_failed: ${res.status} ${text.slice(0, 300)}`);
  }
  // Graph sendMail doesn't return a message id; synthesize one
  return {
    ok: true,
    provider: "outlook",
    providerMessageId: `outlook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

async function sendViaResend(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY!;
  const fromAddr =
    input.from ??
    process.env.RESEND_FROM ??
    "DueDateHQ <noreply@duedatehq.com>";
  // Stamp email_draft_id as a Resend tag so the bounce/complaint webhook
  // (POST /api/delivery/resend/{secret}) can correlate the event back to
  // the EmailDraft for DeliveryEvent persistence. Resend tag values must
  // be ASCII alnum + _-; UUIDs satisfy that.
  const tags = input.emailDraftId
    ? [{ name: "email_draft_id", value: input.emailDraftId }]
    : undefined;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddr,
      to: input.to,
      cc: input.cc,
      subject: input.subject,
      text: input.body,
      html: input.htmlBody,
      reply_to: input.replyTo,
      tags,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`resend_send_failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { id?: string };
  return {
    ok: true,
    provider: "resend",
    providerMessageId: json.id ?? `resend-${Date.now()}`,
  };
}

function buildRfc822(input: SendEmailInput): string {
  const lines = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
  ];
  if (input.from) lines.push(`From: ${input.from}`);
  if (input.replyTo) lines.push(`Reply-To: ${input.replyTo}`);
  if (input.cc?.length) lines.push(`Cc: ${input.cc.join(", ")}`);
  // Custom header for Gmail/Outlook OAuth bounce attribution. DSN bounces
  // come back via the inbound classifier path; the header lets us tie a
  // bounce DSN's In-Reply-To / References back to a specific EmailDraft.
  if (input.emailDraftId) {
    lines.push(`X-DueDateHQ-Email-Draft-Id: ${input.emailDraftId}`);
  }
  if (input.htmlBody) {
    lines.push("Content-Type: text/html; charset=UTF-8", "", input.htmlBody);
  } else {
    lines.push("Content-Type: text/plain; charset=UTF-8", "", input.body);
  }
  return lines.join("\r\n");
}

async function maybeLogActivity(
  input: SendEmailInput,
  result: SendEmailResult,
) {
  if (!input.taskId) return;
  try {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, input.taskId),
    });
    if (!task) return;
    await db.insert(activityEvents).values({
      firmId: input.firmId,
      taskId: input.taskId,
      eventType: "email_sent",
      actorKind: "system",
      description: input.subject,
      payload: {
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        to: input.to,
      },
    });
  } catch (err) {
    captureException(err, { ctx: "email_out.log_activity" });
  }
}
