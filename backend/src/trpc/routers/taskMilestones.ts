/**
 * TaskMilestones router — per PRD §9.4.1 + IA v0.7 §3.4 + §3.9a.
 *
 * The mini-timeline data model. Powers Task detail header visualization +
 * Timeline destination cross-client stack. Mode B can propose target_dates
 * (yellow zone); Mode E can propose status=blocked (yellow); AI cannot
 * mark status=done (mirrors §5.3 invariant for ChecklistItem).
 */

import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import {
  taskMilestones,
  taskMilestoneEvents,
  tasks,
} from "../../db/schema.js";

const MILESTONE_TYPE = [
  "initial_meeting",
  "collect_materials",
  "prepare_workpapers",
  "internal_review",
  "client_review",
  "file",
  "pay",
] as const;

const MILESTONE_STATUS = [
  "not_started",
  "in_progress",
  "blocked",
  "done",
  "overdue",
] as const;

export const taskMilestonesRouter = router({
  /** All milestones for a task, ordered by display_order. */
  listForTask: firmProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify task ownership before exposing milestones (RLS belt + braces).
      const [task] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, input.taskId), eq(tasks.firmId, ctx.firmId)));
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      const rows = await db
        .select()
        .from(taskMilestones)
        .where(
          and(
            eq(taskMilestones.firmId, ctx.firmId),
            eq(taskMilestones.taskId, input.taskId),
          ),
        )
        .orderBy(asc(taskMilestones.displayOrder));
      return rows;
    }),

  /** Cross-client stack for the Timeline destination (IA §3.9a). */
  fleetStack: firmProcedure
    .input(
      z
        .object({
          waitingOnly: z.boolean().default(true), // gap-over-fill default
          limit: z.number().min(1).max(500).default(200),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 200;
      const rows = await db
        .select()
        .from(taskMilestones)
        .where(eq(taskMilestones.firmId, ctx.firmId))
        .limit(limit);
      return rows;
    }),

  /** CPA edits a milestone — set target_date / status / notes / mark done. */
  update: firmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        targetDate: z.string().optional(),
        completedDate: z.string().optional(),
        status: z.enum(MILESTONE_STATUS).optional(),
        blockerReason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(taskMilestones)
        .where(
          and(
            eq(taskMilestones.id, input.id),
            eq(taskMilestones.firmId, ctx.firmId),
          ),
        );
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      // Status transition audit trail (§9.4.1 TaskMilestoneEvent).
      if (input.status && input.status !== existing.status) {
        await db.insert(taskMilestoneEvents).values({
          firmId: ctx.firmId,
          milestoneId: input.id,
          fromStatus: existing.status,
          toStatus: input.status,
          actorKind: "user",
          actorUserId: ctx.user.id,
        });
      }

      const [updated] = await db
        .update(taskMilestones)
        .set({
          targetDate: input.targetDate ?? existing.targetDate,
          completedDate: input.completedDate ?? existing.completedDate,
          status: input.status ?? existing.status,
          blockerReason: input.blockerReason ?? existing.blockerReason,
          updatedAt: new Date(),
        })
        .where(eq(taskMilestones.id, input.id))
        .returning();
      return updated;
    }),

  /** Add a custom milestone (P2 firm-custom milestone types per §9.4.1). */
  add: firmProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        milestoneType: z.enum(MILESTONE_TYPE),
        customLabel: z.string().optional(),
        targetDate: z.string().optional(),
        displayOrder: z.number().default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [task] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, input.taskId), eq(tasks.firmId, ctx.firmId)));
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      const [m] = await db
        .insert(taskMilestones)
        .values({
          firmId: ctx.firmId,
          taskId: input.taskId,
          milestoneType: input.milestoneType,
          customLabel: input.customLabel ?? null,
          targetDate: input.targetDate ?? null,
          displayOrder: input.displayOrder,
          proposedBy: "user",
        })
        .returning();
      return m;
    }),
});
