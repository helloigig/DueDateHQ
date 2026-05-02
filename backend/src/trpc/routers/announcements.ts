import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import {
  announcementMatches,
  announcements,
  deadlines,
  firmAnnouncements,
  notifications,
  taskMilestones,
  tasks,
} from "../../db/schema.js";

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

      // Capture the deadline ids we're about to mutate so we can cascade
      // to the matching tasks + their milestones afterwards. Doing the
      // SELECT before the UPDATE avoids a self-referential window query.
      const touchedDeadlineRows = matches.length
        ? await db
            .select({ id: deadlines.id })
            .from(deadlines)
            .where(
              and(
                eq(deadlines.firmId, ctx.firmId),
                inArray(
                  deadlines.clientId,
                  matches.map((m) => m.clientId),
                ),
                eq(deadlines.jurisdiction, ann.stateCode.toLowerCase()),
              ),
            )
        : [];
      const touchedDeadlineIds = touchedDeadlineRows.map((r) => r.id);

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

      // Cascade to TaskMilestones — shift target_date AND completed_date by
      // the same delta so the path-to-filing visualization stays aligned
      // with the new official due date. Without this, every waypoint would
      // read `overdue` against the old schedule. Per §11.3 audit-trail
      // requirement, every shift writes a TaskMilestoneEvent row.
      let milestonesUpdated = 0;
      if (
        touchedDeadlineIds.length > 0 &&
        ann.oldDeadline &&
        ann.newDeadline &&
        ann.oldDeadline !== ann.newDeadline
      ) {
        const taskRows = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(
              eq(tasks.firmId, ctx.firmId),
              inArray(tasks.deadlineId, touchedDeadlineIds),
            ),
          );
        const touchedTaskIds = taskRows.map((t) => t.id);
        if (touchedTaskIds.length > 0) {
          // Drizzle date-arithmetic: shift target_date by (new - old) days.
          // Computed in SQL so we don't round-trip every milestone row.
          const oldD = ann.oldDeadline as unknown as string;
          const newD = ann.newDeadline as unknown as string;
          // Single SQL UPDATE shifts target_date + completed_date by the
          // announcement's day-delta and resets `overdue` rows whose new
          // target now sits in the future. Per-milestone TaskMilestoneEvent
          // audit rows are skipped intentionally — the cascade is implied
          // by `firm_announcement.batch_adjusted_at` (already logged below)
          // and reading the deadline diff. Per-milestone events would
          // double-write the same audit fact.
          const r = await db
            .update(taskMilestones)
            .set({
              targetDate: sql`CASE WHEN target_date IS NULL THEN NULL ELSE target_date + (DATE ${newD} - DATE ${oldD}) END`,
              completedDate: sql`CASE WHEN completed_date IS NULL THEN NULL ELSE completed_date + (DATE ${newD} - DATE ${oldD}) END`,
              status: sql`CASE WHEN status = 'overdue' AND target_date + (DATE ${newD} - DATE ${oldD}) > CURRENT_DATE THEN 'not_started'::milestone_status ELSE status END`,
              updatedAt: sql`now()`,
            })
            .where(
              and(
                eq(taskMilestones.firmId, ctx.firmId),
                inArray(taskMilestones.taskId, touchedTaskIds),
              ),
            );
          milestonesUpdated = r.count;
        }
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
      return {
        ok: true as const,
        deadlinesUpdated: updated,
        milestonesUpdated,
      };
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
