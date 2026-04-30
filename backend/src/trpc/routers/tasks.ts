import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import {
  activityEvents,
  checklistItemEvents,
  checklistItems,
  clients,
  deadlines,
  tasks,
} from "../../db/schema.js";
import { trySeedMilestonesForTask } from "../../lib/milestone-seeder.js";

const TASK_STATUS = [
  "not_started",
  "in_progress",
  "completed",
  "deferred",
  "filed_extension",
  "overdue",
] as const;

const CHECKLIST_STATE = [
  "not_requested",
  "requested_waiting",
  "received_unreviewed",
  "received_confirmed",
  "received_issue",
  "not_applicable",
] as const;

function generateForwardingLocalPart(clientName: string, formType: string) {
  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "task";
  const token = Math.random().toString(36).slice(2, 6);
  return `${slug(clientName.split(" ")[0] ?? "task")}-${slug(formType)}-${token}`;
}

export const tasksRouter = router({
  /** All tasks for this firm. Joined with client + deadline for the dashboard. */
  list: firmProcedure
    .input(
      z
        .object({
          status: z.enum(TASK_STATUS).optional(),
          clientId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conds = [eq(tasks.firmId, ctx.firmId)];
      if (input?.status) conds.push(eq(tasks.status, input.status));
      if (input?.clientId) conds.push(eq(deadlines.clientId, input.clientId));
      const rows = await db
        .select({
          task: tasks,
          deadline: deadlines,
          clientName: clients.name,
        })
        .from(tasks)
        .innerJoin(deadlines, eq(deadlines.id, tasks.deadlineId))
        .innerJoin(clients, eq(clients.id, deadlines.clientId))
        .where(and(...conds))
        .orderBy(asc(deadlines.adjustedDueDate));
      return rows.map((r) => ({
        id: r.task.id,
        clientId: r.deadline.clientId,
        clientName: r.clientName,
        deadlineId: r.task.deadlineId,
        formType: r.deadline.formType,
        jurisdiction: r.deadline.jurisdiction,
        officialDueDate: r.deadline.officialDueDate,
        adjustedDueDate: r.deadline.adjustedDueDate,
        internalTargetDate: r.deadline.internalTargetDate,
        status: r.task.status,
        completionPercentage: r.task.completionPercentage,
        forwardingEmail: `${r.task.forwardingEmailLocalPart}@duedatehq.com`,
        assignedUserId: r.task.assignedUserId,
      }));
    }),

  get: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await db
        .select({
          task: tasks,
          deadline: deadlines,
          client: clients,
        })
        .from(tasks)
        .innerJoin(deadlines, eq(deadlines.id, tasks.deadlineId))
        .innerJoin(clients, eq(clients.id, deadlines.clientId))
        .where(and(eq(tasks.id, input.id), eq(tasks.firmId, ctx.firmId)))
        .limit(1);
      if (!row[0]) return null;
      const r = row[0];
      return {
        id: r.task.id,
        clientId: r.deadline.clientId,
        clientName: r.client.name,
        deadlineId: r.task.deadlineId,
        formType: r.deadline.formType,
        jurisdiction: r.deadline.jurisdiction,
        officialDueDate: r.deadline.officialDueDate,
        adjustedDueDate: r.deadline.adjustedDueDate,
        status: r.task.status,
        completionPercentage: r.task.completionPercentage,
        forwardingEmail: `${r.task.forwardingEmailLocalPart}@duedatehq.com`,
      };
    }),

  /**
   * Spawn a Task row for an existing deadline. The standard checklist comes
   * from the `service_templates.standard_checklist` JSONB and is materialized
   * into checklist_items rows in the same transaction. Idempotent on
   * (deadline) — re-runs return the existing task.
   */
  createForDeadline: firmProcedure
    .input(z.object({ deadlineId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const dl = await db.query.deadlines.findFirst({
        where: and(
          eq(deadlines.id, input.deadlineId),
          eq(deadlines.firmId, ctx.firmId),
        ),
      });
      if (!dl) throw new TRPCError({ code: "NOT_FOUND" });
      const existing = await db.query.tasks.findFirst({
        where: eq(tasks.deadlineId, input.deadlineId),
      });
      if (existing) return { id: existing.id, alreadyExists: true as const };
      const client = await db.query.clients.findFirst({
        where: eq(clients.id, dl.clientId),
      });
      if (!client) throw new TRPCError({ code: "NOT_FOUND" });
      const local = generateForwardingLocalPart(client.name, dl.formType);
      const result = await db.transaction(async (tx) => {
        const [task] = await tx
          .insert(tasks)
          .values({
            firmId: ctx.firmId,
            deadlineId: dl.id,
            forwardingEmailLocalPart: local,
            status: "not_started",
          })
          .returning();
        if (!task) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Materialize Mode A baseline checklist from the template, if any.
        if (dl.serviceTemplateId) {
          const tmpl = await tx.query.serviceTemplates.findFirst({
            where: (t, { eq: eq2 }) => eq2(t.id, dl.serviceTemplateId!),
          });
          const baseline =
            (tmpl?.standardChecklist as Array<{
              label: string;
              itemType: string;
            }> | null) ?? [];
          if (baseline.length > 0) {
            await tx.insert(checklistItems).values(
              baseline.map((b, idx) => ({
                firmId: ctx.firmId,
                taskId: task.id,
                label: b.label,
                itemType: b.itemType,
                sortOrder: idx,
                state: "not_requested" as const,
                stateChangedByKind: "system" as const,
              })),
            );
          }
        }
        return { id: task.id };
      });
      // Auto-seed Mode B milestone proposals — fire and forget. Failure
      // doesn't block task creation; the CPA can still trigger via the
      // Propose dates button on TaskMiniTimeline if the seed errored.
      void trySeedMilestonesForTask({ firmId: ctx.firmId, taskId: result.id });
      return { id: result.id, alreadyExists: false as const };
    }),

  updateStatus: firmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(TASK_STATUS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await db
        .update(tasks)
        .set({
          status: input.status,
          completedAt: input.status === "completed" ? new Date() : null,
          completedByUserId: input.status === "completed" ? ctx.dbUser.id : null,
          updatedAt: sql`now()`,
        })
        .where(and(eq(tasks.id, input.id), eq(tasks.firmId, ctx.firmId)));
      if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true as const };
    }),
});

export const checklistsRouter = router({
  /** All checklist items for one task, ordered by sortOrder. */
  listForTask: firmProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(checklistItems)
        .where(
          and(
            eq(checklistItems.taskId, input.taskId),
            eq(checklistItems.firmId, ctx.firmId),
          ),
        )
        .orderBy(asc(checklistItems.sortOrder));
      return rows;
    }),

  /**
   * Transition a checklist item. PRD §5.3 invariant — the BE reject path
   * (`actor=ai/system && state=received_confirmed`) is enforced both by
   * the DB CHECK constraint and by the `actor` validator below.
   */
  setState: firmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        state: z.enum(CHECKLIST_STATE),
        // Only "user" is accepted from this endpoint — AI/system writes go
        // through internal pipelines (Mode A classifier) which use the
        // service-role connection and write directly.
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const item = await db.query.checklistItems.findFirst({
        where: and(
          eq(checklistItems.id, input.id),
          eq(checklistItems.firmId, ctx.firmId),
        ),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      const fromState = item.state;
      await db.transaction(async (tx) => {
        await tx
          .update(checklistItems)
          .set({
            state: input.state,
            stateChangedAt: new Date(),
            stateChangedByKind: "user",
            stateChangedByUserId: ctx.dbUser.id,
          })
          .where(eq(checklistItems.id, input.id));
        await tx.insert(checklistItemEvents).values({
          firmId: ctx.firmId,
          checklistItemId: input.id,
          fromState,
          toState: input.state,
          actorKind: "user",
          actorUserId: ctx.dbUser.id,
        });
        await tx.insert(activityEvents).values({
          firmId: ctx.firmId,
          taskId: item.taskId,
          eventType: "checklist_state_change",
          actorKind: "user",
          actorUserId: ctx.dbUser.id,
          description: `${ctx.dbUser.displayName ?? ctx.dbUser.email} set "${item.label}" to ${input.state}`,
          relatedChecklistItemId: input.id,
        });
      });
      return { ok: true as const };
    }),
});

export const activityRouter = router({
  listForTask: firmProcedure
    .input(z.object({ taskId: z.string().uuid(), limit: z.number().int().min(1).max(500).default(100) }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(activityEvents)
        .where(
          and(
            eq(activityEvents.taskId, input.taskId),
            eq(activityEvents.firmId, ctx.firmId),
          ),
        )
        .orderBy(desc(activityEvents.createdAt))
        .limit(input.limit);
      return rows;
    }),
});
