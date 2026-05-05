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
import { taskNotes, tasks, users } from "../../db/schema.js";

export const taskNotesRouter = router({
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
