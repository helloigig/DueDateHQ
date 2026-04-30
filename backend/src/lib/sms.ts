/**
 * SMS chase channel — provider-agnostic send. Twilio is the default
 * adapter; the abstraction is here so MessageBird / Bandwidth can
 * swap in without touching call sites.
 *
 * SMS dramatically lifts response rate for clients who don't read
 * email regularly (ranges 5-10x in CPA studies). Gated by tier
 * (Pro/Team only) because it has per-message cost (~$0.008 each).
 *
 * Phase 1 implementation. Without TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN
 * + TWILIO_FROM in env, sendSms() throws — the FE reads `isSmsConfigured`
 * to gate UI affordances honestly.
 */

import { db } from "../db/client.js";
import { activityEvents, tasks } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { log, captureException } from "./observability.js";

export interface SendSmsInput {
  firmId: string;
  /** E.164 destination number — "+15551234567" */
  to: string;
  body: string;
  /** Optional task association — logs an activity event */
  taskId?: string;
}

export interface SendSmsResult {
  ok: true;
  provider: "twilio";
  providerMessageId: string;
}

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM,
  );
}

/**
 * Send an SMS via Twilio. Throws when the provider isn't configured;
 * caller should check isSmsConfigured() first.
 *
 * SMS bodies are auto-truncated to 160 chars to avoid multi-segment
 * billing surprises. The FE renders a counter when composing.
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  if (!isSmsConfigured()) {
    throw new Error(
      "twilio_not_configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM in env",
    );
  }
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const fromNumber = process.env.TWILIO_FROM!;

  const body = input.body.slice(0, 160);
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const params = new URLSearchParams({
    From: fromNumber,
    To: input.to,
    Body: body,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`twilio_send_failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { sid?: string };
  const result: SendSmsResult = {
    ok: true,
    provider: "twilio",
    providerMessageId: json.sid ?? `twilio-${Date.now()}`,
  };

  // Log activity if task associated
  if (input.taskId) {
    try {
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, input.taskId),
      });
      if (task) {
        await db.insert(activityEvents).values({
          firmId: input.firmId,
          taskId: input.taskId,
          eventType: "sms_sent",
          actorKind: "user",
          description: body,
          payload: {
            provider: "twilio",
            providerMessageId: result.providerMessageId,
            to: input.to,
          },
        });
      }
    } catch (err) {
      captureException(err, { ctx: "sms.log_activity" });
    }
  }

  log.info("sms.sent", {
    firmId: input.firmId,
    taskId: input.taskId,
    bodyLength: body.length,
    truncated: body.length < input.body.length,
  });
  return result;
}

/**
 * Compose a chase SMS — short, action-oriented. Auto-truncated to 160
 * chars by sendSms but we aim for ~120 to leave headroom.
 */
export function composeChaseSms(args: {
  clientFirstName: string;
  cpaName: string;
  formType: string;
  missingItem?: string;
  forwardingEmail: string;
}): string {
  const item = args.missingItem ?? "tax docs";
  return `Hi ${args.clientFirstName} — ${args.cpaName} here. Still need ${item} for your ${args.formType}. Reply with photo or email ${args.forwardingEmail}. Thanks!`;
}
