/**
 * Delivery event webhook handler — per PRD §5.8 + IA v0.7 §3.8.
 *
 * Accepts bounce / complaint / unsubscribe webhooks from SES (via SNS) and
 * Postmark and persists DeliveryEvent rows. The Mode A action queue
 * (todoItems router) reads these and surfaces them as bounce TodoItems
 * for the CPA to fix or suppress.
 *
 * Note on bytes: webhooks carry ONLY the delivery metadata, never the
 * email body itself. Path E posture preserved.
 */

import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  deliveryEvents,
  emailDrafts,
  type DeliveryEventInsert,
} from "../db/schema.js";
import { log, captureException } from "./observability.js";

type ProviderEvent = {
  emailDraftId: string;
  eventType:
    | "delivered"
    | "opened"
    | "bounced"
    | "complained"
    | "unsubscribed";
  bounceReason?: DeliveryEventInsert["bounceReason"];
  diagnosticText?: string;
  rawProviderPayload: unknown;
  occurredAt: Date;
};

/**
 * SES bounce/complaint SNS notification → ProviderEvent.
 *
 * SES wraps notifications in an SNS envelope: `{Type, Message}` where
 * Message is JSON-stringified. The inner shape carries `notificationType`
 * ('Bounce' / 'Complaint' / 'Delivery') + provider details.
 *
 * AWS docs: https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html
 */
export function fromSesNotification(body: unknown): ProviderEvent | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  let inner: Record<string, unknown>;
  if (typeof b.Message === "string") {
    try {
      inner = JSON.parse(b.Message) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else {
    inner = b;
  }

  const notifType = String(inner.notificationType ?? inner.eventType ?? "");
  const mail = (inner.mail ?? {}) as Record<string, unknown>;
  // SES message tags carry the email_draft_id we stamped on send. If the
  // tag isn't present, we can't tie the event to a draft — drop with log.
  const tagsRaw = (mail.tags ?? {}) as Record<string, string[] | string>;
  const draftIdTag = tagsRaw["email_draft_id"];
  const emailDraftId = Array.isArray(draftIdTag)
    ? draftIdTag[0]
    : (draftIdTag as string | undefined);
  if (!emailDraftId) return null;

  if (notifType === "Bounce" || notifType === "Bounce Notification") {
    const bounce = (inner.bounce ?? {}) as Record<string, unknown>;
    const bounceType = String(bounce.bounceType ?? "");
    const reason: DeliveryEventInsert["bounceReason"] =
      bounceType === "Permanent"
        ? "hard_bounce"
        : bounceType === "Transient"
          ? "soft_bounce"
          : "unknown";
    return {
      emailDraftId,
      eventType: "bounced",
      bounceReason: reason,
      diagnosticText: String(
        ((bounce.bouncedRecipients as Array<Record<string, unknown>>)?.[0]
          ?.diagnosticCode ?? ""),
      ),
      rawProviderPayload: inner,
      occurredAt: new Date(String(inner.timestamp ?? mail.timestamp ?? Date.now())),
    };
  }

  if (notifType === "Complaint" || notifType === "Complaint Notification") {
    return {
      emailDraftId,
      eventType: "complained",
      bounceReason: "complaint",
      rawProviderPayload: inner,
      occurredAt: new Date(String(inner.timestamp ?? mail.timestamp ?? Date.now())),
    };
  }

  if (notifType === "Delivery" || notifType === "Delivery Notification") {
    return {
      emailDraftId,
      eventType: "delivered",
      rawProviderPayload: inner,
      occurredAt: new Date(String(inner.timestamp ?? mail.timestamp ?? Date.now())),
    };
  }

  return null;
}

/**
 * Postmark bounce webhook → ProviderEvent. Postmark sends a single JSON
 * with `Type` ("HardBounce" / "SoftBounce" / "SpamComplaint" / etc.) +
 * `Email` + `Description` + `MessageID` + custom metadata in `Metadata`.
 */
export function fromPostmarkDelivery(body: unknown): ProviderEvent | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const meta = (b.Metadata ?? {}) as Record<string, unknown>;
  const emailDraftId =
    typeof meta["email_draft_id"] === "string"
      ? (meta["email_draft_id"] as string)
      : null;
  if (!emailDraftId) return null;

  const type = String(b.Type ?? b.RecordType ?? "");
  if (type === "HardBounce") {
    return {
      emailDraftId,
      eventType: "bounced",
      bounceReason: "hard_bounce",
      diagnosticText: String(b.Description ?? ""),
      rawProviderPayload: b,
      occurredAt: new Date(String(b.BouncedAt ?? b.ReceivedAt ?? Date.now())),
    };
  }
  if (type === "SoftBounce") {
    return {
      emailDraftId,
      eventType: "bounced",
      bounceReason: "soft_bounce",
      diagnosticText: String(b.Description ?? ""),
      rawProviderPayload: b,
      occurredAt: new Date(String(b.BouncedAt ?? b.ReceivedAt ?? Date.now())),
    };
  }
  if (type === "SpamComplaint" || type === "SpamNotification") {
    return {
      emailDraftId,
      eventType: "complained",
      bounceReason: "complaint",
      rawProviderPayload: b,
      occurredAt: new Date(String(b.BouncedAt ?? b.ReceivedAt ?? Date.now())),
    };
  }
  if (type === "Delivery") {
    return {
      emailDraftId,
      eventType: "delivered",
      rawProviderPayload: b,
      occurredAt: new Date(String(b.DeliveredAt ?? Date.now())),
    };
  }
  if (type === "Open") {
    return {
      emailDraftId,
      eventType: "opened",
      rawProviderPayload: b,
      occurredAt: new Date(String(b.ReceivedAt ?? Date.now())),
    };
  }
  if (type === "SubscriptionChange") {
    return {
      emailDraftId,
      eventType: "unsubscribed",
      rawProviderPayload: b,
      occurredAt: new Date(String(b.ChangedAt ?? Date.now())),
    };
  }
  return null;
}

/**
 * Resend webhook → ProviderEvent. Resend POSTs `{type, created_at, data}`
 * with the tag we stamped at send time embedded in `data.tags`. Resend
 * event types: email.sent / email.delivered / email.bounced / email.complained
 * / email.delivery_delayed / email.opened / email.clicked.
 *
 * Docs: https://resend.com/docs/dashboard/webhooks/event-types
 */
export function fromResend(body: unknown): ProviderEvent | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const data = (b.data ?? {}) as Record<string, unknown>;
  const tags = Array.isArray(data.tags)
    ? (data.tags as Array<Record<string, string>>)
    : [];
  const draftIdTag = tags.find((t) => t.name === "email_draft_id");
  const emailDraftId = draftIdTag?.value;
  if (!emailDraftId) return null;

  const type = String(b.type ?? "");
  const createdAt = b.created_at
    ? new Date(String(b.created_at))
    : new Date();

  if (type === "email.bounced") {
    const bounce = (data.bounce ?? {}) as Record<string, unknown>;
    const subType = String(bounce.subType ?? bounce.type ?? "");
    const reason: DeliveryEventInsert["bounceReason"] =
      subType === "Permanent" || subType === "hardBounce"
        ? "hard_bounce"
        : subType === "Transient" || subType === "softBounce"
          ? "soft_bounce"
          : subType === "MailboxFull"
            ? "mailbox_full"
            : "unknown";
    return {
      emailDraftId,
      eventType: "bounced",
      bounceReason: reason,
      diagnosticText: String(bounce.message ?? bounce.diagnosticCode ?? ""),
      rawProviderPayload: b,
      occurredAt: createdAt,
    };
  }
  if (type === "email.complained") {
    return {
      emailDraftId,
      eventType: "complained",
      bounceReason: "complaint",
      rawProviderPayload: b,
      occurredAt: createdAt,
    };
  }
  if (type === "email.delivered") {
    return {
      emailDraftId,
      eventType: "delivered",
      rawProviderPayload: b,
      occurredAt: createdAt,
    };
  }
  if (type === "email.opened") {
    return {
      emailDraftId,
      eventType: "opened",
      rawProviderPayload: b,
      occurredAt: createdAt,
    };
  }
  return null;
}

export async function persistDeliveryEvent(
  ev: ProviderEvent,
): Promise<{ ok: boolean; reason?: string }> {
  // Verify the email draft exists + look up firmId for tenancy.
  const [draft] = await db
    .select({ id: emailDrafts.id, firmId: emailDrafts.firmId })
    .from(emailDrafts)
    .where(eq(emailDrafts.id, ev.emailDraftId));
  if (!draft) {
    return { ok: false, reason: "draft_not_found" };
  }

  try {
    await db.insert(deliveryEvents).values({
      firmId: draft.firmId,
      emailDraftId: draft.id,
      eventType: ev.eventType,
      eventAt: ev.occurredAt,
      rawProviderPayload: ev.rawProviderPayload,
      bounceReason: ev.bounceReason ?? null,
      diagnosticText: ev.diagnosticText ?? null,
    });
    log.info("delivery_event.persisted", {
      eventType: ev.eventType,
      draftId: draft.id,
    });
    return { ok: true };
  } catch (err) {
    captureException(err, { route: "persistDeliveryEvent" });
    return { ok: false, reason: "insert_failed" };
  }
}
