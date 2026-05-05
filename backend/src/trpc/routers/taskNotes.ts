/**
 * Task notes — per-task append-only note feed. Distinct from client
 * notes (which live on the client spine and capture cross-engagement
 * context). A task note is judgment scoped to a specific filing —
 * "client says K-1 will arrive late", "extension OK if WSP doesn't
 * respond by Friday".
 *
 * Mirrors the `clients.notes*` API shape so the FE can reuse the same
 * panel UX (pinned-first, author attribution, hard-delete with FE-side
 * <24h safety net).
 */
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import { deadlines, taskNotes, tasks, users } from "../../db/schema.js";

export const taskNotesRouter = router({
  /**
   * Aggregate task notes across every task belonging to one client.
   * Yuqi audit 2026-05-06: the client detail Notes tab used to show
   * only client-spine notes — task-level judgment ("K-1 will be late
   * for this 1040") was buried inside each task page, invisible from
   * the client overview. This endpoint joins task_notes → tasks →
   * deadlines so the client page can render a unified Notes feed
   * (client-level + per-task) without N+1 queries.
   */
  listForClient: firmProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select({
          note: taskNotes,
          authorName: users.displayName,
          authorEmail: users.email,
          taskFormType: deadlines.formType,
          taskJurisdiction: deadlines.jurisdiction,
          taskOfficialDueDate: deadlines.officialDueDate,
        })
        .from(taskNotes)
        .innerJoin(tasks, eq(tasks.id, taskNotes.taskId))
        .innerJoin(deadlines, eq(deadlines.id, tasks.deadlineId))
        .leftJoin(users, eq(users.id, taskNotes.authorUserId))
        .where(
          and(
            eq(taskNotes.firmId, ctx.firmId),
            eq(deadlines.clientId, input.clientId),
          ),
        )
        .orderBy(desc(taskNotes.pinned), desc(taskNotes.createdAt));
      return rows.map((r) => ({
        id: r.note.id,
        taskId: r.note.taskId,
        body: r.note.body,
        pinned: r.note.pinned,
        authorUserId: r.note.authorUserId,
        authorName: r.authorName ?? r.authorEmail ?? "Unknown",
        createdAt: r.note.createdAt.toISOString(),
        taskFormType: r.taskFormType,
        taskJurisdiction: r.taskJurisdiction,
        taskOfficialDueDate: r.taskOfficialDueDate,
      }));
    }),

  listForTask: firmProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select({
          note: taskNotes,
          authorName: users.displayName,
          authorEmail: users.email,
        })
        .from(taskNotes)
        .leftJoin(users, eq(users.id, taskNotes.authorUserId))
        .where(
          and(
            eq(taskNotes.taskId, input.taskId),
            eq(taskNotes.firmId, ctx.firmId),
          ),
        )
        .orderBy(desc(taskNotes.pinned), asc(taskNotes.createdAt));
      return rows.map((r) => ({
        id: r.note.id,
        taskId: r.note.taskId,
        body: r.note.body,
        pinned: r.note.pinned,
        authorUserId: r.note.authorUserId,
        authorName: r.authorName ?? r.authorEmail ?? "Unknown",
        createdAt: r.note.createdAt.toISOString(),
      }));
    }),

  add: firmProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        body: z.string().min(1).max(2000),
        pinned: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Confirm task is in this firm — keeps RLS-style scoping honest
      // and avoids creating notes against tasks the caller can't see.
      const task = await db.query.tasks.findFirst({
        where: and(eq(tasks.id, input.taskId), eq(tasks.firmId, ctx.firmId)),
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      const [row] = await db
        .insert(taskNotes)
        .values({
          firmId: ctx.firmId,
          taskId: input.taskId,
          authorUserId: ctx.dbUser.id,
          body: input.body,
          pinned: input.pinned,
        })
        .returning();
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { id: row.id };
    }),

  togglePin: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const note = await db.query.taskNotes.findFirst({
        where: and(eq(taskNotes.id, input.id), eq(taskNotes.firmId, ctx.firmId)),
      });
      if (!note) throw new TRPCError({ code: "NOT_FOUND" });
      await db
        .update(taskNotes)
        .set({ pinned: !note.pinned })
        .where(eq(taskNotes.id, input.id));
      return { ok: true as const, pinned: !note.pinned };
    }),

  delete: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await db
        .delete(taskNotes)
        .where(
          and(eq(taskNotes.id, input.id), eq(taskNotes.firmId, ctx.firmId)),
        );
      if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true as const };
    }),
});
