import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import {
  activityEvents,
  announcementMatches,
  announcements,
  clients,
  deadlines,
  emailDrafts,
  firmAnnouncements,
  firms,
  notifications,
  tasks,
} from "../../db/schema.js";
import { sendEmail, fromAddressForFirm } from "../../lib/email-sender.js";
import { captureException } from "../../lib/observability.js";

const ESCALATION = ["normal", "dark", "blocking"] as const;

// Roll a list of per-client match confidences up to a single
// announcement-level chip. "high" wins so the FE shows the strongest
// signal the matcher had on at least one client. Defaults to "medium"
// when the firm has no matches yet — same default as the schema.
function rollupConfidence(confs: string[]): "high" | "medium" | "low" {
  if (confs.includes("high")) return "high";
  if (confs.includes("low") && !confs.includes("medium")) return "low";
  return "medium";
}

type AnnouncementRow = typeof announcements.$inferSelect;
type FirmAnnouncementRow = typeof firmAnnouncements.$inferSelect;

function projectAnnouncement(
  ann: AnnouncementRow,
  firmAnn: FirmAnnouncementRow | null,
  affectedClientIds: string[],
  matchConfidence: "high" | "medium" | "low",
) {
  return {
    id: ann.id,
    stateCode: ann.stateCode,
    authority: ann.authority,
    title: ann.title,
    summary: ann.summary,
    type: ann.type,
    taxType: ann.taxType,
    retroactive: ann.retroactive,
    counties: ann.counties,
    entityTypes: ann.entityTypes,
    taxTypes: ann.taxTypes,
    oldDeadline: ann.oldDeadline,
    newDeadline: ann.newDeadline,
    sourceUrl: ann.sourceUrl,
    sourceAuthority: ann.sourceAuthority,
    parseConfidence: ann.parseConfidence,
    matchConfidence,
    detectedAt: ann.detectedAt.toISOString(),
    issuanceDate: (ann.publishedAt ?? ann.detectedAt).toISOString(),
    effectiveDate: ann.effectiveDate,
    affectedClientIds,
    // No cross-reference data source yet (Phase 1) — return [] so the FE's
    // "RELATED ALERTS" section collapses cleanly instead of crashing.
    relatedAnnouncementIds: [] as string[],
    // Per-firm overlay
    read: firmAnn?.acknowledgedAt != null,
    dismissed: firmAnn?.dismissedAt != null,
    snoozedUntil: firmAnn?.snoozedUntil?.toISOString() ?? null,
    escalationLevel: firmAnn?.escalationLevel ?? "normal",
    batchAdjustedAt: firmAnn?.batchAdjustedAt?.toISOString() ?? null,
  };
}

export const announcementsRouter = router({
  /**
   * Per-firm view of state announcements: joins the system-wide
   * `announcements` rows with this firm's per-row state (ack/snooze/dismiss).
   * `activeOnly` filters out dismissed and out-of-snooze items — the
   * default behavior for the bell + banner + /alerts list.
   */
  list: firmProcedure
    .input(z.object({ activeOnly: z.boolean().default(false) }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select({
          ann: announcements,
          firmAnn: firmAnnouncements,
        })
        .from(announcements)
        .leftJoin(
          firmAnnouncements,
          and(
            eq(firmAnnouncements.announcementId, announcements.id),
            eq(firmAnnouncements.firmId, ctx.firmId),
          ),
        )
        .where(
          input?.activeOnly
            ? and(
                isNull(firmAnnouncements.dismissedAt),
                sql`(${firmAnnouncements.snoozedUntil} IS NULL OR ${firmAnnouncements.snoozedUntil} < now())`,
              )!
            : undefined,
        )
        .orderBy(desc(announcements.detectedAt));

      const matchRows = await db
        .select({
          announcementId: announcementMatches.announcementId,
          clientId: announcementMatches.clientId,
          matchConfidence: announcementMatches.matchConfidence,
        })
        .from(announcementMatches)
        .where(eq(announcementMatches.firmId, ctx.firmId));
      const clientsByAnn = new Map<string, string[]>();
      const confsByAnn = new Map<string, string[]>();
      for (const m of matchRows) {
        const cs = clientsByAnn.get(m.announcementId) ?? [];
        cs.push(m.clientId);
        clientsByAnn.set(m.announcementId, cs);
        const fs = confsByAnn.get(m.announcementId) ?? [];
        fs.push(m.matchConfidence);
        confsByAnn.set(m.announcementId, fs);
      }

      return rows.map((r) => ({
        id: r.ann.id,
        stateCode: r.ann.stateCode,
        authority: r.ann.authority,
        title: r.ann.title,
        summary: r.ann.summary,
        type: r.ann.type,
        taxType: r.ann.taxType,
        retroactive: r.ann.retroactive,
        counties: r.ann.counties,
        entityTypes: r.ann.entityTypes,
        taxTypes: r.ann.taxTypes,
        oldDeadline: r.ann.oldDeadline,
        newDeadline: r.ann.newDeadline,
        sourceUrl: r.ann.sourceUrl,
        relatedSourceUrls: r.ann.relatedSourceUrls,
        sourceAuthority: r.ann.sourceAuthority,
        parseConfidence: r.ann.parseConfidence,
        detectedAt: r.ann.detectedAt.toISOString(),
        effectiveDate: r.ann.effectiveDate,
        affectedClientIds: clientsByAnn.get(r.ann.id) ?? [],
        // Per-firm overlay
        read: r.firmAnn?.acknowledgedAt != null,
        dismissed: r.firmAnn?.dismissedAt != null,
        snoozedUntil: r.firmAnn?.snoozedUntil?.toISOString() ?? null,
        escalationLevel: r.firmAnn?.escalationLevel ?? "normal",
        batchAdjustedAt: r.firmAnn?.batchAdjustedAt?.toISOString() ?? null,
      }));
    }),

  get: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ann = await db.query.announcements.findFirst({
        where: eq(announcements.id, input.id),
      });
      if (!ann) return null;
      const firmAnn = await db.query.firmAnnouncements.findFirst({
        where: and(
          eq(firmAnnouncements.announcementId, input.id),
          eq(firmAnnouncements.firmId, ctx.firmId),
        ),
      });
      const matches = await db
        .select({
          clientId: announcementMatches.clientId,
          matchConfidence: announcementMatches.matchConfidence,
        })
        .from(announcementMatches)
        .where(
          and(
            eq(announcementMatches.announcementId, input.id),
            eq(announcementMatches.firmId, ctx.firmId),
          ),
        );
      return projectAnnouncement(
        ann,
        firmAnn ?? null,
        matches.map((m) => m.clientId),
        rollupConfidence(matches.map((m) => m.matchConfidence)),
      );
    }),

  /** Mark this announcement as acknowledged (clears the banner + bell badge). */
  acknowledge: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(firmAnnouncements)
        .values({
          announcementId: input.id,
          firmId: ctx.firmId,
          acknowledgedAt: new Date(),
          acknowledgedByUserId: ctx.dbUser.id,
        })
        .onConflictDoUpdate({
          target: [firmAnnouncements.announcementId, firmAnnouncements.firmId],
          set: {
            acknowledgedAt: new Date(),
            acknowledgedByUserId: ctx.dbUser.id,
          },
        });
      return { ok: true as const };
    }),

  snooze: firmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        until: z.string().datetime(),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(firmAnnouncements)
        .values({
          announcementId: input.id,
          firmId: ctx.firmId,
          snoozedUntil: new Date(input.until),
          snoozeReason: input.reason ?? null,
        })
        .onConflictDoUpdate({
          target: [firmAnnouncements.announcementId, firmAnnouncements.firmId],
          set: {
            snoozedUntil: new Date(input.until),
            snoozeReason: input.reason ?? null,
          },
        });
      return { ok: true as const };
    }),

  dismiss: firmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(firmAnnouncements)
        .values({
          announcementId: input.id,
          firmId: ctx.firmId,
          dismissedAt: new Date(),
          dismissedReason: input.reason ?? null,
        })
        .onConflictDoUpdate({
          target: [firmAnnouncements.announcementId, firmAnnouncements.firmId],
          set: {
            dismissedAt: new Date(),
            dismissedReason: input.reason ?? null,
          },
        });
      return { ok: true as const };
    }),

  markRead: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(firmAnnouncements)
        .values({
          announcementId: input.id,
          firmId: ctx.firmId,
          acknowledgedAt: new Date(),
          acknowledgedByUserId: ctx.dbUser.id,
        })
        .onConflictDoUpdate({
          target: [firmAnnouncements.announcementId, firmAnnouncements.firmId],
          set: { acknowledgedAt: new Date(), acknowledgedByUserId: ctx.dbUser.id },
        });
      return { ok: true as const };
    }),

  /**
   * Apply this announcement's `newDeadline` to every affected client's
   * matching deadline. Yellow-zone (PRD §4.5) — requires a CPA-initiated
   * call. Records `batchAdjustedAt` so the FE can hide the "Apply" CTA.
   */
  batchAdjustDeadlines: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ann = await db.query.announcements.findFirst({
        where: eq(announcements.id, input.id),
      });
      if (!ann) throw new TRPCError({ code: "NOT_FOUND" });
      if (!ann.newDeadline) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "announcement_has_no_new_deadline",
        });
      }

      // Find affected deadlines: clients matched + form/jurisdiction
      // matches the announcement's tax types.
      const matches = await db
        .select({ clientId: announcementMatches.clientId })
        .from(announcementMatches)
        .where(
          and(
            eq(announcementMatches.announcementId, input.id),
            eq(announcementMatches.firmId, ctx.firmId),
          ),
        );
      let updated = 0;
      for (const m of matches) {
        const r = await db
          .update(deadlines)
          .set({
            adjustedDueDate: ann.newDeadline,
            updatedAt: sql`now()`,
          })
          .where(
            and(
              eq(deadlines.firmId, ctx.firmId),
              eq(deadlines.clientId, m.clientId),
              eq(deadlines.jurisdiction, ann.stateCode.toLowerCase()),
            ),
          );
        updated += r.count;
      }
      await db
        .insert(firmAnnouncements)
        .values({
          announcementId: input.id,
          firmId: ctx.firmId,
          batchAdjustedAt: new Date(),
          acknowledgedAt: new Date(),
          acknowledgedByUserId: ctx.dbUser.id,
        })
        .onConflictDoUpdate({
          target: [firmAnnouncements.announcementId, firmAnnouncements.firmId],
          set: {
            batchAdjustedAt: new Date(),
            acknowledgedAt: new Date(),
            acknowledgedByUserId: ctx.dbUser.id,
          },
        });
      return { ok: true as const, deadlinesUpdated: updated };
    }),

  /**
   * Manual escalation update — used by the cron worker (Phase 1) to
   * promote `normal → dark → blocking` based on hours-without-ack. Exposed
   * here so the FE can simulate it during demos.
   */
  setEscalation: firmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        level: z.enum(ESCALATION),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(firmAnnouncements)
        .values({
          announcementId: input.id,
          firmId: ctx.firmId,
          escalationLevel: input.level,
        })
        .onConflictDoUpdate({
          target: [firmAnnouncements.announcementId, firmAnnouncements.firmId],
          set: { escalationLevel: input.level },
        });
      return { ok: true as const };
    }),

  /**
   * Trigger an on-demand scrape + match cycle for this firm. The
   * scheduled scraper runs hourly in the background; this mutation lets
   * the FE force-refresh after a known state authority publishes a
   * notice. Returns counts so the UI can show "X new alerts found".
   */
  detect: firmProcedure.mutation(async ({ ctx }) => {
    const { runScraperCycle, matchFirm } = await import(
      "../../lib/scraper.js"
    );
    const cycle = await runScraperCycle();
    const matched = await matchFirm(ctx.firmId);
    return { ...cycle, matchedForFirm: matched };
  }),

  /**
   * Reviewer queue — low-confidence scraped notices awaiting human
   * approval before they project to firms (PRD §11.5 / arch §6.4
   * "human review queue"). Phase 1 surface; lives at /settings/alerts
   * in the FE.
   */
  reviewerQueue: firmProcedure.query(async () => {
    const rows = await db
      .select()
      .from(announcements)
      .where(eq(announcements.parseConfidence, "low"))
      .orderBy(desc(announcements.detectedAt))
      .limit(50);
    return rows;
  }),

  /**
   * Approve a low-confidence scraped notice, optionally with corrected
   * fields. Bumps parse_confidence to "high" so it projects to firms on
   * the next match cycle.
   */
  approveScraped: firmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().optional(),
        summary: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await db
        .update(announcements)
        .set({
          parseConfidence: "high",
          ...(input.title ? { title: input.title } : {}),
          ...(input.summary ? { summary: input.summary } : {}),
        })
        .where(eq(announcements.id, input.id));
      return { ok: true as const };
    }),

  /** Reject a scraped notice (false positive / not relevant). */
  rejectScraped: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(announcements).where(eq(announcements.id, input.id));
      return { ok: true as const };
    }),

  /**
   * Send a bulletin email to each affected client. The Alerts co-pilot pane
   * generates per-client subject + body in the FE; this procedure persists
   * each as an email_drafts row tied to the client's earliest open task in
   * the announcement's jurisdiction (FK requirement on email_drafts), then
   * sends through the standard email pipeline. Clients without an
   * applicable open task or email address are returned in `skipped`.
   */
  sendBulletinEmails: firmProcedure
    .input(
      z.object({
        announcementId: z.string().uuid(),
        recipients: z
          .array(
            z.object({
              clientId: z.string().uuid(),
              subject: z.string().min(1).max(300),
              body: z.string().min(1).max(20_000),
            }),
          )
          .min(1)
          .max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ann = await db.query.announcements.findFirst({
        where: eq(announcements.id, input.announcementId),
      });
      if (!ann) throw new TRPCError({ code: "NOT_FOUND" });

      const clientIds = input.recipients.map((r) => r.clientId);
      const clientRows = await db
        .select()
        .from(clients)
        .where(
          and(eq(clients.firmId, ctx.firmId), inArray(clients.id, clientIds)),
        );
      const clientById = new Map(clientRows.map((c) => [c.id, c]));

      const [firmRow] = await db
        .select({ name: firms.name })
        .from(firms)
        .where(eq(firms.id, ctx.firmId));
      const fromAddr = firmRow ? fromAddressForFirm(firmRow.name) : undefined;

      const sent: Array<{ clientId: string; draftId: string }> = [];
      const skipped: Array<{ clientId: string; reason: string }> = [];

      for (const r of input.recipients) {
        const c = clientById.get(r.clientId);
        if (!c) {
          skipped.push({ clientId: r.clientId, reason: "client_not_in_firm" });
          continue;
        }
        if (!c.contactEmail) {
          skipped.push({ clientId: r.clientId, reason: "no_email" });
          continue;
        }
        // Pick this client's earliest open deadline in the announcement's
        // jurisdiction; fall back to any open deadline. The email_drafts
        // FK to tasks needs a real task — Mode F state alerts are firm-
        // wide, but the bulletin still references each client's filing.
        const jurisdiction = ann.stateCode.toLowerCase();
        const dlRows = await db
          .select({ taskId: tasks.id, dueDate: deadlines.adjustedDueDate })
          .from(deadlines)
          .innerJoin(tasks, eq(tasks.deadlineId, deadlines.id))
          .where(
            and(
              eq(deadlines.firmId, ctx.firmId),
              eq(deadlines.clientId, r.clientId),
              eq(deadlines.jurisdiction, jurisdiction),
            ),
          )
          .orderBy(asc(deadlines.adjustedDueDate))
          .limit(1);
        let taskId = dlRows[0]?.taskId;
        if (!taskId) {
          const fallback = await db
            .select({ id: tasks.id })
            .from(tasks)
            .innerJoin(deadlines, eq(deadlines.id, tasks.deadlineId))
            .where(
              and(
                eq(tasks.firmId, ctx.firmId),
                eq(deadlines.clientId, r.clientId),
              ),
            )
            .orderBy(asc(deadlines.adjustedDueDate))
            .limit(1);
          taskId = fallback[0]?.id;
        }
        if (!taskId) {
          skipped.push({ clientId: r.clientId, reason: "no_task" });
          continue;
        }

        const replyToRow = await db
          .select({ forwardingLocal: tasks.forwardingEmailLocalPart })
          .from(tasks)
          .where(eq(tasks.id, taskId));
        const replyTo = replyToRow[0]?.forwardingLocal
          ? `${replyToRow[0].forwardingLocal}@duedatehq.space`
          : undefined;

        let providerId: string | null = null;
        let skippedSend = false;
        try {
          const result = await sendEmail({
            to: c.contactEmail,
            cc: null,
            subject: r.subject,
            body: r.body,
            replyTo,
            from: fromAddr,
          });
          providerId = result.providerId ?? null;
          skippedSend = !!result.skipped;
        } catch (err) {
          captureException(err, {
            ctx: "announcements.sendBulletinEmails",
            announcementId: input.announcementId,
            clientId: r.clientId,
            firmId: ctx.firmId,
          });
          skipped.push({ clientId: r.clientId, reason: "send_failed" });
          continue;
        }

        const sentAt = new Date();
        const [draft] = await db
          .insert(emailDrafts)
          .values({
            firmId: ctx.firmId,
            taskId,
            toAddress: c.contactEmail,
            ccAddress: null,
            subject: r.subject,
            body: r.body,
            tone: "default",
            aiSources: { announcementId: input.announcementId } as object,
            status: "sent",
            sendMethod: "cpa_send",
            sentAt,
            sentByUserId: ctx.dbUser.id,
            recallWindowExpiresAt: new Date(sentAt.getTime() + 60_000),
          })
          .returning();
        if (!draft) continue;
        await db.insert(activityEvents).values({
          firmId: ctx.firmId,
          taskId,
          eventType: "email_sent",
          actorKind: "user",
          actorUserId: ctx.dbUser.id,
          description: `${ctx.dbUser.displayName ?? ctx.dbUser.email} sent bulletin: ${r.subject}`,
          relatedEmailDraftId: draft.id,
          payload: {
            announcementId: input.announcementId,
            providerSkipped: skippedSend,
            providerId,
          },
        });
        sent.push({ clientId: r.clientId, draftId: draft.id });
      }

      return {
        sentCount: sent.length,
        skippedCount: skipped.length,
        sent,
        skipped,
      };
    }),
});

export const notificationsRouter = router({
  list: firmProcedure
    .input(z.object({ unreadOnly: z.boolean().default(false) }).optional())
    .query(async ({ ctx, input }) => {
      const conds = [eq(notifications.firmId, ctx.firmId)];
      // Per-user filter — show only mine + firm-wide (userId IS NULL).
      conds.push(
        sql`(${notifications.userId} IS NULL OR ${notifications.userId} = ${ctx.dbUser.id})`,
      );
      if (input?.unreadOnly) conds.push(isNull(notifications.readAt));
      const rows = await db
        .select()
        .from(notifications)
        .where(and(...conds))
        .orderBy(desc(notifications.createdAt))
        .limit(200);
      return rows;
    }),

  markRead: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.firmId, ctx.firmId),
          ),
        );
      return { ok: true as const };
    }),

  markAllRead: firmProcedure.mutation(async ({ ctx }) => {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.firmId, ctx.firmId),
          isNull(notifications.readAt),
          sql`(${notifications.userId} IS NULL OR ${notifications.userId} = ${ctx.dbUser.id})`,
        ),
      );
    return { ok: true as const };
  }),

  dismiss: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(notifications)
        .set({ dismissedAt: new Date() })
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.firmId, ctx.firmId),
          ),
        );
      return { ok: true as const };
    }),

  /** Stored on `firms.branding` JSONB — keep simple for Phase 0. */
  updatePreferences: firmProcedure
    .input(
      z.object({
        digestMode: z.enum(["digest_8am", "per_alert", "off"]),
      }),
    )
    .mutation(() => {
      // Phase 1 — wire to firms.branding.digestMode or a per-user prefs table.
      return { ok: true as const };
    }),
});
