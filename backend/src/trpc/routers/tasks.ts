import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, max, sql } from "drizzle-orm";
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
  users,
} from "../../db/schema.js";
import { trySeedMilestonesForTask } from "../../lib/milestone-seeder.js";

const TASK_STATUS = [
  "not_started",
  "in_progress",
  "completed",
  "deferred",
  "filed_extension",
  "overdue",
  "not_applicable",
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
        reviewerUserId: r.task.reviewerUserId,
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
        assignedUserId: r.task.assignedUserId,
        reviewerUserId: r.task.reviewerUserId,
        notApplicableReason: r.task.notApplicableReason,
        notApplicableAt: r.task.notApplicableAt?.toISOString() ?? null,
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
      // not_applicable has its own dedicated mutation (carries a reason).
      // Block the generic path so we never write the status without one.
      if (input.status === "not_applicable") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "use_mark_not_applicable",
        });
      }
      const result = await db
        .update(tasks)
        .set({
          status: input.status,
          completedAt: input.status === "completed" ? new Date() : null,
          completedByUserId: input.status === "completed" ? ctx.dbUser.id : null,
          // Clear NA bookkeeping if we transition out of it.
          notApplicableReason: null,
          notApplicableAt: null,
          updatedAt: sql`now()`,
        })
        .where(and(eq(tasks.id, input.id), eq(tasks.firmId, ctx.firmId)));
      if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true as const };
    }),

  /**
   * Reassign preparer / reviewer. Either field is optional; passing
   * `null` un-assigns. Promotes the v0.7 "assign reviewer" stub to a
   * real Phase-1 mutation. Anyone in the firm is allowed for either
   * role — admin-only roles ship with the role-aware UI.
   */
  assign: firmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        // `undefined` = leave unchanged; `null` = un-assign; uuid = set.
        preparerUserId: z.string().uuid().nullable().optional(),
        reviewerUserId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await db.query.tasks.findFirst({
        where: and(eq(tasks.id, input.id), eq(tasks.firmId, ctx.firmId)),
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      // Validate any non-null assignment targets are in this firm.
      const targets = [
        input.preparerUserId,
        input.reviewerUserId,
      ].filter((v): v is string => typeof v === "string");
      if (targets.length > 0) {
        const found = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.firmId, ctx.firmId));
        const allowed = new Set(found.map((r) => r.id));
        for (const t of targets) {
          if (!allowed.has(t)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "user_not_in_firm",
            });
          }
        }
      }

      const patch: {
        assignedUserId?: string | null;
        reviewerUserId?: string | null;
        updatedAt: ReturnType<typeof sql>;
      } = { updatedAt: sql`now()` };
      if (input.preparerUserId !== undefined) {
        patch.assignedUserId = input.preparerUserId;
      }
      if (input.reviewerUserId !== undefined) {
        patch.reviewerUserId = input.reviewerUserId;
      }

      await db.transaction(async (tx) => {
        await tx
          .update(tasks)
          .set(patch)
          .where(eq(tasks.id, input.id));
        const desc: string[] = [];
        if (input.preparerUserId !== undefined) {
          desc.push(
            input.preparerUserId
              ? `Preparer reassigned`
              : `Preparer un-assigned`,
          );
        }
        if (input.reviewerUserId !== undefined) {
          desc.push(
            input.reviewerUserId
              ? `Reviewer assigned`
              : `Reviewer un-assigned`,
          );
        }
        if (desc.length > 0) {
          await tx.insert(activityEvents).values({
            firmId: ctx.firmId,
            taskId: input.id,
            eventType: "task_reassigned",
            actorKind: "user",
            actorUserId: ctx.dbUser.id,
            description: `${ctx.dbUser.displayName ?? ctx.dbUser.email}: ${desc.join(", ")}`,
          });
        }
      });
      return { ok: true as const };
    }),

  /**
   * Defer the working date — Task-level wrapper that cascades to the
   * underlying deadline (deadline-as-field per v0.8 §1.5 collapse).
   * `officialDueDate` stays put: the jurisdiction's hard date is
   * immutable; only the firm's working date moves.
   */
  defer: firmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await db.query.tasks.findFirst({
        where: and(eq(tasks.id, input.id), eq(tasks.firmId, ctx.firmId)),
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      await db.transaction(async (tx) => {
        await tx
          .update(deadlines)
          .set({
            status: "deferred",
            adjustedDueDate: input.newDate,
            updatedAt: sql`now()`,
          })
          .where(eq(deadlines.id, task.deadlineId));
        await tx
          .update(tasks)
          .set({
            status: "deferred",
            notApplicableReason: null,
            notApplicableAt: null,
            updatedAt: sql`now()`,
          })
          .where(eq(tasks.id, input.id));
        await tx.insert(activityEvents).values({
          firmId: ctx.firmId,
          taskId: input.id,
          eventType: "task_deferred",
          actorKind: "user",
          actorUserId: ctx.dbUser.id,
          description: `${ctx.dbUser.displayName ?? ctx.dbUser.email}: deferred to ${input.newDate}${input.reason ? ` — ${input.reason}` : ""}`,
        });
      });
      return { ok: true as const };
    }),

  /**
   * Mark an extension filed at the Task level. Cascades to the deadline.
   * Phase-1 promotion of `deadlines.fileExtension`.
   */
  fileExtension: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const task = await db.query.tasks.findFirst({
        where: and(eq(tasks.id, input.id), eq(tasks.firmId, ctx.firmId)),
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      await db.transaction(async (tx) => {
        await tx
          .update(deadlines)
          .set({ status: "filed_extension", updatedAt: sql`now()` })
          .where(eq(deadlines.id, task.deadlineId));
        await tx
          .update(tasks)
          .set({
            status: "filed_extension",
            notApplicableReason: null,
            notApplicableAt: null,
            updatedAt: sql`now()`,
          })
          .where(eq(tasks.id, input.id));
        await tx.insert(activityEvents).values({
          firmId: ctx.firmId,
          taskId: input.id,
          eventType: "task_extension_filed",
          actorKind: "user",
          actorUserId: ctx.dbUser.id,
          description: `${ctx.dbUser.displayName ?? ctx.dbUser.email}: extension filed`,
        });
      });
      return { ok: true as const };
    }),

  /**
   * Mark the task not applicable. Distinct from `deferred` (push) — this
   * is a kill: client fired, entity dissolved, switched filing status.
   * Reason is required (audit trail). The underlying deadline is NOT
   * cascaded — the official date is still real for any future picture
   * of "what was due"; the task layer just records that we stopped
   * working it.
   */
  markNotApplicable: firmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await db.query.tasks.findFirst({
        where: and(eq(tasks.id, input.id), eq(tasks.firmId, ctx.firmId)),
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      await db.transaction(async (tx) => {
        await tx
          .update(tasks)
          .set({
            status: "not_applicable",
            notApplicableReason: input.reason,
            notApplicableAt: new Date(),
            completedAt: null,
            completedByUserId: null,
            updatedAt: sql`now()`,
          })
          .where(eq(tasks.id, input.id));
        await tx.insert(activityEvents).values({
          firmId: ctx.firmId,
          taskId: input.id,
          eventType: "task_not_applicable",
          actorKind: "user",
          actorUserId: ctx.dbUser.id,
          description: `${ctx.dbUser.displayName ?? ctx.dbUser.email}: marked not applicable — ${input.reason}`,
        });
      });
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

  /**
   * All checklist items across all tasks for one client. Yuqi audit
   * 2026-05-06: the client detail's "Still waiting on client" section
   * was reading from todoItems.list (a different aggregation that
   * only surfaces active chase loops). For a client whose items are
   * still `not_requested` or whose tasks aren't in any urgency
   * bucket, todoItems returned empty even though the underlying
   * checklist items existed — the task page then disagreed with the
   * client page ("1 of 1 items waiting" vs "Nothing waiting").
   *
   * This endpoint joins checklist_items → tasks → deadlines → clients
   * so the FE can read the canonical per-client checklist directly,
   * with each row tagged with its task identity for grouping.
   */
  listForClient: firmProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select({
          item: checklistItems,
          taskId: tasks.id,
          taskFormType: deadlines.formType,
          taskJurisdiction: deadlines.jurisdiction,
          taskOfficialDueDate: deadlines.officialDueDate,
        })
        .from(checklistItems)
        .innerJoin(tasks, eq(tasks.id, checklistItems.taskId))
        .innerJoin(deadlines, eq(deadlines.id, tasks.deadlineId))
        .where(
          and(
            eq(checklistItems.firmId, ctx.firmId),
            eq(deadlines.clientId, input.clientId),
          ),
        )
        .orderBy(asc(deadlines.adjustedDueDate), asc(checklistItems.sortOrder));
      return rows.map((r) => ({
        ...r.item,
        taskId: r.taskId,
        taskFormType: r.taskFormType,
        taskJurisdiction: r.taskJurisdiction,
        taskOfficialDueDate: r.taskOfficialDueDate,
      }));
    }),

  /**
   * Add a custom checklist item to a task. Records the author in
   * `addedByUserId` so the row is identifiably user-added (and thus
   * deletable via `deleteCustom`). Sort order goes to the end.
   */
  addCustom: firmProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        label: z.string().min(1).max(200),
        itemType: z.string().min(1).max(60).default("custom"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await db.query.tasks.findFirst({
        where: and(eq(tasks.id, input.taskId), eq(tasks.firmId, ctx.firmId)),
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      const [{ next } = { next: 0 }] = await db
        .select({ next: max(checklistItems.sortOrder) })
        .from(checklistItems)
        .where(eq(checklistItems.taskId, input.taskId));
      const nextOrder = (next ?? 0) + 1;

      const [row] = await db
        .insert(checklistItems)
        .values({
          firmId: ctx.firmId,
          taskId: input.taskId,
          label: input.label,
          itemType: input.itemType,
          sortOrder: nextOrder,
          state: "not_requested",
          stateChangedByKind: "user",
          stateChangedByUserId: ctx.dbUser.id,
          addedByUserId: ctx.dbUser.id,
        })
        .returning();
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.insert(activityEvents).values({
        firmId: ctx.firmId,
        taskId: input.taskId,
        eventType: "checklist_item_added",
        actorKind: "user",
        actorUserId: ctx.dbUser.id,
        description: `${ctx.dbUser.displayName ?? ctx.dbUser.email}: added "${input.label}"`,
        relatedChecklistItemId: row.id,
      });
      return { id: row.id };
    }),

  /**
   * Delete a checklist item. Only user-added rows are deletable
   * (`addedByUserId IS NOT NULL`) — template/system items must stay so
   * the audit trail of "what we asked for" is intact.
   */
  deleteCustom: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const item = await db.query.checklistItems.findFirst({
        where: and(
          eq(checklistItems.id, input.id),
          eq(checklistItems.firmId, ctx.firmId),
        ),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      if (!item.addedByUserId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "template_items_not_deletable",
        });
      }
      await db.transaction(async (tx) => {
        await tx
          .delete(checklistItems)
          .where(eq(checklistItems.id, input.id));
        await tx.insert(activityEvents).values({
          firmId: ctx.firmId,
          taskId: item.taskId,
          eventType: "checklist_item_removed",
          actorKind: "user",
          actorUserId: ctx.dbUser.id,
          description: `${ctx.dbUser.displayName ?? ctx.dbUser.email}: removed "${item.label}"`,
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

  /**
   * Firm-wide activity feed — every event across every task in the firm,
   * ordered newest-first. Joins client + task labels so the FE renders
   * "Sarah Mitchell · 1040 NY · email_sent" without follow-up lookups.
   *
   * Powers the /activity page (Audit-trail surface, IA v0.7 §3.x). Cursor-
   * paginated by createdAt to keep response sizes bounded.
   */
  list: firmProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(200).default(100),
          // Pagination cursor — pass the createdAt of the last row from the
          // previous page to fetch older events.
          beforeCreatedAt: z.string().optional(),
          // Optional filters — narrow by event type (e.g. "email_sent")
          // or by client.
          eventType: z.string().optional(),
          clientId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 100;
      const beforeCreatedAt = input?.beforeCreatedAt;
      const eventType = input?.eventType;
      const clientId = input?.clientId;
      const conditions = [eq(activityEvents.firmId, ctx.firmId)];
      if (beforeCreatedAt) {
        conditions.push(
          sql`${activityEvents.createdAt} < ${new Date(beforeCreatedAt)}`,
        );
      }
      if (eventType) {
        conditions.push(eq(activityEvents.eventType, eventType));
      }
      if (clientId) {
        conditions.push(eq(deadlines.clientId, clientId));
      }
      const rows = await db
        .select({
          id: activityEvents.id,
          firmId: activityEvents.firmId,
          taskId: activityEvents.taskId,
          eventType: activityEvents.eventType,
          actorKind: activityEvents.actorKind,
          actorUserId: activityEvents.actorUserId,
          description: activityEvents.description,
          payload: activityEvents.payload,
          relatedChecklistItemId: activityEvents.relatedChecklistItemId,
          relatedEmailDraftId: activityEvents.relatedEmailDraftId,
          createdAt: activityEvents.createdAt,
          clientId: clients.id,
          clientName: clients.name,
          taskFormType: deadlines.formType,
          taskJurisdiction: deadlines.jurisdiction,
        })
        .from(activityEvents)
        .innerJoin(tasks, eq(tasks.id, activityEvents.taskId))
        .innerJoin(deadlines, eq(deadlines.id, tasks.deadlineId))
        .innerJoin(clients, eq(clients.id, deadlines.clientId))
        .where(and(...conditions))
        .orderBy(desc(activityEvents.createdAt))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore
        ? items[items.length - 1]?.createdAt.toISOString()
        : null;
      return { items, nextCursor };
    }),
});
