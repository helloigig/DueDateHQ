import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import {
  activityEvents,
  emailDrafts,
  reminderTemplates,
  tasks,
} from "../../db/schema.js";

const TONES = ["formal", "casual", "urgent", "apologetic", "default"] as const;
const RECALL_WINDOW_MS = 60_000; // 1 minute soft recall

export const emailsRouter = router({
  /** Persist a draft. AI-generated body comes from Mode D (Phase 1) — for
   *  now the FE supplies the body and we just store it. */
  saveDraft: firmProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        taskId: z.string().uuid(),
        checklistItemId: z.string().uuid().optional(),
        templateId: z.string().uuid().optional(),
        toAddress: z.string().email(),
        ccAddress: z.string().optional().nullable(),
        subject: z.string().min(1).max(300),
        body: z.string().min(1).max(20_000),
        tone: z.enum(TONES).default("default"),
        aiSources: z.unknown().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the task belongs to this firm.
      const task = await db.query.tasks.findFirst({
        where: and(eq(tasks.id, input.taskId), eq(tasks.firmId, ctx.firmId)),
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.id) {
        const existing = await db.query.emailDrafts.findFirst({
          where: and(
            eq(emailDrafts.id, input.id),
            eq(emailDrafts.firmId, ctx.firmId),
          ),
        });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        if (existing.status !== "draft") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `cannot_edit_${existing.status}`,
          });
        }
        await db
          .update(emailDrafts)
          .set({
            subject: input.subject,
            body: input.body,
            tone: input.tone,
            toAddress: input.toAddress,
            ccAddress: input.ccAddress ?? null,
            aiSources: (input.aiSources ?? {}) as object,
          })
          .where(eq(emailDrafts.id, input.id));
        return { id: input.id };
      }
      const [row] = await db
        .insert(emailDrafts)
        .values({
          firmId: ctx.firmId,
          taskId: input.taskId,
          checklistItemId: input.checklistItemId ?? null,
          templateId: input.templateId ?? null,
          toAddress: input.toAddress,
          ccAddress: input.ccAddress ?? null,
          subject: input.subject,
          body: input.body,
          tone: input.tone,
          aiSources: (input.aiSources ?? {}) as object,
        })
        .returning();
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { id: row.id };
    }),

  /**
   * Send a draft. Phase 0 marks the draft as sent and writes an activity
   * row; the actual SMTP transmission goes through Resend in Phase 1
   * (`backend/src/lib/email/send.ts`). Surfaces the recall window so the
   * FE can offer "Undo send" for the next minute.
   */
  send: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await db.query.emailDrafts.findFirst({
        where: and(
          eq(emailDrafts.id, input.id),
          eq(emailDrafts.firmId, ctx.firmId),
        ),
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.status !== "draft") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `cannot_send_${draft.status}`,
        });
      }
      const sentAt = new Date();
      await db.transaction(async (tx) => {
        await tx
          .update(emailDrafts)
          .set({
            status: "sent",
            sendMethod: "cpa_send",
            sentAt,
            sentByUserId: ctx.dbUser.id,
            recallWindowExpiresAt: new Date(sentAt.getTime() + RECALL_WINDOW_MS),
          })
          .where(eq(emailDrafts.id, input.id));
        await tx.insert(activityEvents).values({
          firmId: ctx.firmId,
          taskId: draft.taskId,
          eventType: "email_sent",
          actorKind: "user",
          actorUserId: ctx.dbUser.id,
          description: `${ctx.dbUser.displayName ?? ctx.dbUser.email} sent: ${draft.subject}`,
          relatedEmailDraftId: input.id,
        });
      });
      // TODO Phase 1: enqueue email-outbound BullMQ job that submits to
      // Resend. For now, the row is `sent` but no actual email leaves.
      return {
        id: input.id,
        sentAt: sentAt.toISOString(),
        recallWindowExpiresAt: new Date(
          sentAt.getTime() + RECALL_WINDOW_MS,
        ).toISOString(),
      };
    }),

  /** Soft recall — only valid inside the recall window. */
  recall: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await db.query.emailDrafts.findFirst({
        where: and(
          eq(emailDrafts.id, input.id),
          eq(emailDrafts.firmId, ctx.firmId),
        ),
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.status !== "sent" || !draft.recallWindowExpiresAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "not_in_recall_window",
        });
      }
      if (draft.recallWindowExpiresAt.getTime() < Date.now()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "recall_window_expired",
        });
      }
      await db
        .update(emailDrafts)
        .set({ status: "recalled" })
        .where(eq(emailDrafts.id, input.id));
      return { ok: true as const };
    }),

  discard: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(emailDrafts)
        .set({ status: "discarded" })
        .where(
          and(
            eq(emailDrafts.id, input.id),
            eq(emailDrafts.firmId, ctx.firmId),
          ),
        );
      return { ok: true as const };
    }),

  listForTask: firmProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return db
        .select()
        .from(emailDrafts)
        .where(
          and(
            eq(emailDrafts.taskId, input.taskId),
            eq(emailDrafts.firmId, ctx.firmId),
          ),
        )
        .orderBy(desc(emailDrafts.createdAt));
    }),
});

export const reminderTemplatesRouter = router({
  /** All templates visible to this firm: system templates + custom. */
  list: firmProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(reminderTemplates)
      .where(
        and(
          eq(reminderTemplates.active, true),
          // System (firm_id NULL) OR firm-owned.
          // (No ORM helper for nullable equality — hand-rolled or use raw.)
        ),
      )
      .orderBy(asc(reminderTemplates.name))
      .then((rows) =>
        rows.filter(
          (r) => r.firmId === null || r.firmId === ctx.firmId,
        ),
      );
  }),
});
