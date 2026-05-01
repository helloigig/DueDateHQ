import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import {
  activityEvents,
  clients,
  deadlines,
  deliveryEvents,
  emailDrafts,
  firms,
  inboundReplies,
  reminderTemplates,
  tasks,
} from "../../db/schema.js";
import { sendEmail, fromAddressForFirm } from "../../lib/email-sender.js";
import { captureException, log } from "../../lib/observability.js";

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
      // Resolve the per-task forwarding address — used as Reply-To so
      // client replies route back to Postmark inbound, get classified
      // by Method A, and update the matching ChecklistItem.
      const [taskRow] = await db
        .select({ forwardingLocal: tasks.forwardingEmailLocalPart })
        .from(tasks)
        .where(
          and(eq(tasks.id, draft.taskId), eq(tasks.firmId, ctx.firmId)),
        );
      const replyTo = taskRow?.forwardingLocal
        ? `${taskRow.forwardingLocal}@duedatehq.space`
        : undefined;

      // From address: firm name as display, slug as local part. Tax
      // clients should see "Mitchell CPA <mitchell-cpa@...>", not
      // "DueDateHQ <noreply@...>" — DueDateHQ stays invisible to the
      // CPA's clients per `forever_no`.
      const [firmRow] = await db
        .select({ name: firms.name })
        .from(firms)
        .where(eq(firms.id, ctx.firmId));
      const fromAddr = firmRow ? fromAddressForFirm(firmRow.name) : undefined;

      // Send through Resend BEFORE flipping the row. If Resend errors,
      // the row stays `draft` and the CPA can retry. If Resend is
      // skipped (no API key in dev), we log and proceed — the UI still
      // needs to advance even when the dev box has no email vendor.
      let providerId: string | null = null;
      let skipped = false;
      try {
        const result = await sendEmail({
          to: draft.toAddress,
          cc: draft.ccAddress ?? null,
          subject: draft.subject,
          body: draft.body,
          replyTo,
          from: fromAddr,
        });
        providerId = result.providerId ?? null;
        skipped = !!result.skipped;
      } catch (err) {
        captureException(err, {
          ctx: "emails.send",
          draftId: input.id,
          firmId: ctx.firmId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            err instanceof Error
              ? `send_failed: ${err.message}`
              : "send_failed",
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
        // DeliveryEvent row records that Resend accepted the message
        // for sending. Actual delivery / bounce / complaint events come
        // back via the Resend webhook at /api/delivery/resend/:secret
        // and INSERT additional rows referencing the same draft. Stash
        // the provider id in rawProviderPayload so the webhook can
        // correlate when the message id arrives.
        if (providerId) {
          await tx.insert(deliveryEvents).values({
            firmId: ctx.firmId,
            emailDraftId: input.id,
            eventType: "submitted",
            eventAt: sentAt,
            rawProviderPayload: { provider: "resend", messageId: providerId },
          });
        }
      });

      if (skipped) {
        log.warn("emails.send.no_provider", {
          draftId: input.id,
          firmId: ctx.firmId,
        });
      }

      return {
        id: input.id,
        sentAt: sentAt.toISOString(),
        recallWindowExpiresAt: new Date(
          sentAt.getTime() + RECALL_WINDOW_MS,
        ).toISOString(),
        providerSkipped: skipped,
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

  /**
   * Sent reminders that haven't been replied to yet — powers the Mail
   * page's "Reminders out, awaiting reply" surface (gap-over-fill).
   * Joins through tasks → deadlines → clients so the FE renders real
   * names ("Emily Hartfield · 1040 NY") instead of UUIDs. A draft is
   * considered awaiting-reply when it's `sent` and no inbound reply
   * has been written against the same task since the send time.
   */
  awaitingReply: firmProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(20) })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const rows = await db
        .select({
          id: emailDrafts.id,
          taskId: emailDrafts.taskId,
          subject: emailDrafts.subject,
          toAddress: emailDrafts.toAddress,
          sentAt: emailDrafts.sentAt,
          clientId: clients.id,
          clientName: clients.name,
          formType: deadlines.formType,
          jurisdiction: deadlines.jurisdiction,
        })
        .from(emailDrafts)
        .innerJoin(tasks, eq(tasks.id, emailDrafts.taskId))
        .innerJoin(deadlines, eq(deadlines.id, tasks.deadlineId))
        .innerJoin(clients, eq(clients.id, deadlines.clientId))
        .where(
          and(
            eq(emailDrafts.firmId, ctx.firmId),
            eq(emailDrafts.status, "sent"),
          ),
        )
        .orderBy(desc(emailDrafts.sentAt))
        .limit(limit);
      // Filter out drafts whose task already has a fresher inbound
      // reply. Doing this in two queries keeps the SQL simpler than a
      // correlated subquery; the volume here is small (firm-scope, top
      // N sent in chase windows). The set is the same per-task
      // dedup the Mail page would otherwise do client-side.
      const taskIds = Array.from(new Set(rows.map((r) => r.taskId)));
      let repliedTaskIds = new Set<string>();
      if (taskIds.length > 0) {
        const replies = await db
          .select({
            taskId: inboundReplies.taskId,
            receivedAt: inboundReplies.receivedAt,
          })
          .from(inboundReplies)
          .where(
            and(
              eq(inboundReplies.firmId, ctx.firmId),
              inArray(inboundReplies.taskId, taskIds),
            ),
          );
        const sentByTask = new Map<string, Date>();
        for (const r of rows) {
          if (!r.sentAt) continue;
          const prev = sentByTask.get(r.taskId);
          if (!prev || r.sentAt > prev) sentByTask.set(r.taskId, r.sentAt);
        }
        for (const reply of replies) {
          if (!reply.taskId || !reply.receivedAt) continue;
          const sent = sentByTask.get(reply.taskId);
          if (sent && reply.receivedAt > sent) {
            repliedTaskIds.add(reply.taskId);
          }
        }
      }
      return rows
        .filter((r) => !repliedTaskIds.has(r.taskId))
        .map((r) => ({
          id: r.id,
          taskId: r.taskId,
          clientId: r.clientId,
          clientName: r.clientName,
          taskLabel:
            r.formType || r.jurisdiction
              ? [r.formType, r.jurisdiction].filter(Boolean).join(" · ")
              : "task",
          subject: r.subject,
          toAddress: r.toAddress,
          sentAt: r.sentAt?.toISOString() ?? null,
          daysSent:
            r.sentAt != null
              ? Math.floor(
                  (Date.now() - r.sentAt.getTime()) / (24 * 60 * 60 * 1000),
                )
              : null,
        }));
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
