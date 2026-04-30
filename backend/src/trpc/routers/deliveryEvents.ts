/**
 * DeliveryEvents router — per PRD §5.8 + §9.6 + IA v0.7 §3.8 Mail Issues tab.
 *
 * Read access for outbound delivery monitoring. Write access lives in the
 * Hono webhook routes (SES + Postmark bounce/complaint webhooks).
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import { deliveryEvents, emailDrafts } from "../../db/schema.js";

const EVENT_TYPE = [
  "submitted",
  "accepted",
  "delivered",
  "opened",
  "replied",
  "bounced",
  "complained",
  "unsubscribed",
] as const;

export const deliveryEventsRouter = router({
  /** Mail Issues tab — bounces + complaints + unsubscribes for the firm.
   *  Default joins emailDraft to surface client + task context. */
  issues: firmProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select({
          ev: deliveryEvents,
          draft: emailDrafts,
        })
        .from(deliveryEvents)
        .innerJoin(emailDrafts, eq(deliveryEvents.emailDraftId, emailDrafts.id))
        .where(
          and(
            eq(deliveryEvents.firmId, ctx.firmId),
            inArray(deliveryEvents.eventType, [
              "bounced",
              "complained",
              "unsubscribed",
            ]),
          ),
        )
        .orderBy(desc(deliveryEvents.eventAt))
        .limit(input?.limit ?? 50);
      return rows;
    }),

  /** All events for a single email_draft (Outbox row click → drill in). */
  forDraft: firmProcedure
    .input(z.object({ emailDraftId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(deliveryEvents)
        .where(
          and(
            eq(deliveryEvents.firmId, ctx.firmId),
            eq(deliveryEvents.emailDraftId, input.emailDraftId),
          ),
        )
        .orderBy(desc(deliveryEvents.eventAt));
      return rows;
    }),

  /** Mark an address suppressed after a bounce (CPA action from re-send
   *  modal per IA §3.8). */
  suppressEvent: firmProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(deliveryEvents)
        .set({ suppressedAt: new Date() })
        .where(
          and(
            eq(deliveryEvents.id, input.id),
            eq(deliveryEvents.firmId, ctx.firmId),
          ),
        )
        .returning();
      return updated ?? null;
    }),
});
