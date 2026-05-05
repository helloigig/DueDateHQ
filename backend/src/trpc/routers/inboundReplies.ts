/**
 * InboundReplies router — per PRD §5.8 + IA v0.7 §3.8 Mail / §3.4 Task detail.
 *
 * Read access for the Mail surface (cross-client Inbox tab + Task detail
 * inbound conversation surface). Write access lives in the Hono webhook
 * routes (SES inbound forward + Method B Gmail OAuth pull) — not here.
 */

import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import {
  deadlines,
  inboundReplies,
  tasks,
} from "../../db/schema.js";

const TOP_LEVEL_CLASS = [
  "client_document",
  "client_reply_intent",
  "agency_correspondence",
  "third_party_data",
  "payment_confirm",
  "vendor_notification",
  "spam",
] as const;

const REPLY_INTENT = [
  "document_provided",
  "timeline_pushback",
  "question_asked",
  "off_topic",
  "mismatched_attachment",
  "acknowledgment",
] as const;

export const inboundRepliesRouter = router({
  /** Cross-client Inbox view (Mail sidebar §3.8). Sorted by intent priority
   *  then receivedAt desc. */
  list: firmProcedure
    .input(
      z
        .object({
          taskId: z.string().uuid().optional(),
          topLevelClass: z.enum(TOP_LEVEL_CLASS).optional(),
          replyIntent: z.enum(REPLY_INTENT).optional(),
          limit: z.number().min(1).max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conds = [eq(inboundReplies.firmId, ctx.firmId)];
      if (input?.taskId) conds.push(eq(inboundReplies.taskId, input.taskId));
      if (input?.topLevelClass)
        conds.push(eq(inboundReplies.topLevelClass, input.topLevelClass));
      if (input?.replyIntent)
        conds.push(eq(inboundReplies.replyIntent, input.replyIntent));
      // Left-join through tasks → deadlines so the FE Mail row can
      // deep-link to /clients/:clientId/tasks/:taskId without an N+1
      // resolution loop. Unmatched inbound (no taskId yet) returns
      // clientId=null and the FE renders it as un-routable.
      const rows = await db
        .select({
          inbound: inboundReplies,
          clientId: deadlines.clientId,
        })
        .from(inboundReplies)
        .leftJoin(tasks, eq(tasks.id, inboundReplies.taskId))
        .leftJoin(deadlines, eq(deadlines.id, tasks.deadlineId))
        .where(and(...conds))
        .orderBy(desc(inboundReplies.receivedAt))
        .limit(input?.limit ?? 50);
      return rows.map((r) => ({
        ...r.inbound,
        clientId: r.clientId,
      }));
    }),

  /** Acknowledge / mark CPA-actioned. */
  markActioned: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(inboundReplies)
        .set({ cpaActionedAt: new Date() })
        .where(
          and(
            eq(inboundReplies.id, input.id),
            eq(inboundReplies.firmId, ctx.firmId),
          ),
        )
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  /** Manually re-link an unmatched inbound to a specific task (CPA action
   *  from Task.unmatched_inbound tray per §5.8). */
  linkToTask: firmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        taskId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(inboundReplies)
        .set({ taskId: input.taskId })
        .where(
          and(
            eq(inboundReplies.id, input.id),
            eq(inboundReplies.firmId, ctx.firmId),
          ),
        )
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),
});
