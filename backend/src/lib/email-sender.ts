/**
 * Outbound email transport — Resend.
 *
 * Why Resend (not raw SMTP, not SES inline): Resend has a sane TS SDK,
 * webhooks for bounces/complaints (already wired at
 * `/api/delivery/resend/:secret`), and a free tier that covers the
 * Phase-1 scale we expect. AWS SES is the long-term choice once volume
 * justifies the IAM dance; Postmark inbound (`duedatehq.space` MX) lives
 * alongside this on a different provider — outbound and inbound don't
 * have to share one vendor.
 *
 * Behavior:
 *   - When RESEND_API_KEY is missing → returns `{ skipped: true }` and
 *     logs a warning. The caller still flips the draft to `sent` so the
 *     UI proceeds; production must set the key.
 *   - On success → returns `{ providerId }` from Resend's response.
 *   - On error → throws. Caller decides whether to roll the draft back
 *     to `draft` or keep it `sent` with bounceReason set.
 *
 * From address: built per-firm so the recipient sees the CPA's brand,
 * not DueDateHQ. Display name = firm.name; local part = slug(firm.name);
 * domain stays duedatehq.space. Per `forever_no` — DueDateHQ is
 * invisible to the CPA's clients. Phase 3: per-firm verified domains.
 */

import { Resend } from "resend";
import { log } from "./observability.js";

const FROM_FALLBACK = "DueDateHQ <noreply@duedatehq.space>";

/**
 * Build the From line for a firm. Display name = firm name, local part
 * = ASCII slug derived from it. Examples:
 *   "Mitchell CPA"          → "Mitchell CPA <mitchell-cpa@duedatehq.space>"
 *   "Yan Jing & Associates" → "Yan Jing & Associates <yan-jing-associates@duedatehq.space>"
 */
export function fromAddressForFirm(firmName: string): string {
  const slug =
    firmName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "firm";
  // Display name needs comma-stripping so Resend doesn't misinterpret
  // it as a separator between multiple addresses.
  const display = firmName.replace(/[",<>]/g, "").trim() || "DueDateHQ";
  return `${display} <${slug}@duedatehq.space>`;
}

let _client: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_client) _client = new Resend(key);
  return _client;
}

export interface SendEmailInput {
  to: string;
  cc?: string | null;
  subject: string;
  body: string;
  /**
   * Reply-To header. Per-task forwarding addresses live at
   * `<token>@duedatehq.space` and route inbound replies back to the
   * matching task via Postmark.
   */
  replyTo?: string;
  /** Optional override; defaults to noreply@duedatehq.space. */
  from?: string;
}

export interface SendEmailResult {
  /** True when the send was skipped (no API key configured). */
  skipped?: boolean;
  /** Resend's message id, when the call succeeded. */
  providerId?: string;
}

/**
 * Sends a single email via Resend. Plaintext body — Resend accepts that
 * as `text` and renders it in clients without HTML wrapping. Phase 2
 * adds `html` rendering from a template.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getClient();
  if (!client) {
    log.warn("email_sender.no_api_key", {
      to: input.to,
      subject: input.subject.slice(0, 60),
    });
    return { skipped: true };
  }

  const { data, error } = await client.emails.send({
    from: input.from ?? FROM_FALLBACK,
    to: input.to,
    cc: input.cc ?? undefined,
    replyTo: input.replyTo,
    subject: input.subject,
    text: input.body,
  });

  if (error) {
    log.error("email_sender.resend_error", {
      to: input.to,
      message: error.message,
      name: error.name,
    });
    throw new Error(`Resend send failed: ${error.message}`);
  }

  log.info("email_sender.sent", {
    to: input.to,
    providerId: data?.id,
  });

  return { providerId: data?.id };
}
