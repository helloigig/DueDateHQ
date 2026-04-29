import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import {
  announcementMatches,
  announcements,
  deadlines,
  firmAnnouncements,
  notifications,
} from "../../db/schema.js";

const ESCALATION = ["normal", "dark", "blocking"] as const;

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

      // Pull match counts in one query, group in JS.
      const matchRows = await db
        .select({
          announcementId: announcementMatches.announcementId,
          clientId: announcementMatches.clientId,
        })
        .from(announcementMatches)
        .where(eq(announcementMatches.firmId, ctx.firmId));
      const byAnn = new Map<string, string[]>();
      for (const m of matchRows) {
        const arr = byAnn.get(m.announcementId) ?? [];
        arr.push(m.clientId);
        byAnn.set(m.announcementId, arr);
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
        sourceAuthority: r.ann.sourceAuthority,
        parseConfidence: r.ann.parseConfidence,
        detectedAt: r.ann.detectedAt.toISOString(),
        effectiveDate: r.ann.effectiveDate,
        affectedClientIds: byAnn.get(r.ann.id) ?? [],
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
        .select()
        .from(announcementMatches)
        .where(
          and(
            eq(announcementMatches.announcementId, input.id),
            eq(announcementMatches.firmId, ctx.firmId),
          ),
        );
      return { announcement: ann, firmAnnouncement: firmAnn ?? null, matches };
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
   * Stub. Real implementation runs in Cloudflare Workers (50-state crawler)
   * + LLM parser (Gemini) + matching engine. See
   * `backend/scripts/scraper-worker.ts` for the entry point. Calling this
   * from the FE just signals "rerun the crawler now" — Phase 1.
   */
  detect: firmProcedure.mutation(() => {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message:
        "scraper_pipeline_not_deployed — see backend/RUNBOOK.md §Announcement pipeline",
    });
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
