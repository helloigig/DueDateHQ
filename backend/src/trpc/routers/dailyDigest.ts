/**
 * Daily AM digest — tRPC router. Surfaces:
 *
 *   getSettings       — read this user's `users.preferences.dailyDigest`
 *   updateSettings    — toggle / cadence / sendHour write
 *   previewMyDigest   — render the digest for *now* and dispatch via Resend
 *                       with a `[Preview]` subject prefix; bypasses dedupe
 *   listRecentRuns    — last 14 days of `daily_digest_runs` for this user
 *
 * The cron-firing path is in `backend/src/lib/daily-digest-scheduler.ts`
 * and runs in-process; the router is for the Settings → Notifications
 * card and an admin-style "send me one now" affordance.
 */

import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import { dailyDigestRuns, users } from "../../db/schema.js";
import type { UserPreferences } from "../../db/schema.js";
import { dispatchDigestForUser } from "../../lib/daily-digest-scheduler.js";

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const dailyDigestSettings = z.object({
  enabled: z.boolean(),
  sendHour: z.number().int().min(0).max(23),
  days: z.array(z.enum(DAYS)).min(1),
});

/**
 * Default settings for users who haven't touched their preferences. The
 * scheduler also reads this fallback (see daily-digest-scheduler.ts) so
 * the on-by-default behavior is consistent whether the user has visited
 * Settings → Notifications or not.
 *
 * Decision (2026-05-04): default ON. The morning digest is the most
 * load-bearing "AI is working for me" surface — gating it behind an
 * opt-in toggle nobody clicks would mean nobody gets it. Users who
 * actively dislike the email can disable in Settings; that's a one-
 * click off, vs the zero-click-on we'd otherwise need to sell.
 */
const DEFAULT_SETTINGS: z.infer<typeof dailyDigestSettings> = {
  enabled: true,
  sendHour: 7,
  days: ["mon", "tue", "wed", "thu", "fri"],
};

export const dailyDigestRouter = router({
  /**
   * Read this user's digest preferences. Returns DEFAULT_SETTINGS shape
   * so the FE always has a known schema to bind to (no need to handle
   * "preferences object exists but dailyDigest key doesn't").
   */
  getSettings: firmProcedure.query(async ({ ctx }) => {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, ctx.dbUser.id),
    });
    const stored = (dbUser?.preferences as UserPreferences | null)?.dailyDigest;
    return stored ?? DEFAULT_SETTINGS;
  }),

  /**
   * Persist this user's digest preferences. Merges into the existing
   * `users.preferences` jsonb so future user-scoped prefs (notification
   * volume, mail-density) don't get clobbered.
   */
  updateSettings: firmProcedure
    .input(dailyDigestSettings)
    .mutation(async ({ ctx, input }) => {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, ctx.dbUser.id),
      });
      const next: UserPreferences = {
        ...((dbUser?.preferences as UserPreferences | null) ?? {}),
        dailyDigest: input,
      };
      await db
        .update(users)
        .set({ preferences: next })
        .where(eq(users.id, ctx.dbUser.id));
      return { ok: true as const };
    }),

  /**
   * Send a digest to the calling user *right now*. Used by the
   * "Send a preview now" button on Settings → Notifications. Bypasses
   * the cron's local-hour gate AND the (user_id, local_date) dedupe so
   * the user can fire it as many times as they want. Subject is
   * prefixed `[Preview]` so the user knows it's not the scheduled one.
   *
   * Never writes a `sent` row — uses `force: true` and short-circuits
   * the dedupe path entirely. The Resend message id is returned so
   * the FE can show "Sent — message id ..." for confidence.
   */
  previewMyDigest: firmProcedure.mutation(async ({ ctx }) => {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, ctx.dbUser.id),
    });
    if (!dbUser) throw new TRPCError({ code: "NOT_FOUND" });
    const status = await dispatchDigestForUser(
      {
        userId: dbUser.id,
        firmId: dbUser.firmId,
        email: dbUser.email,
        displayName: dbUser.displayName,
        timezone: dbUser.timezone,
      },
      new Date(),
      { force: true, subjectPrefix: "[Preview]" },
    );
    return { status };
  }),

  /**
   * Last 14 days of run history for this user. Drives a "recent sends"
   * sub-table inside the Settings card so the user can verify the
   * scheduler is working without opening their inbox.
   */
  listRecentRuns: firmProcedure.query(async ({ ctx }) => {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select()
      .from(dailyDigestRuns)
      .where(
        and(
          eq(dailyDigestRuns.userId, ctx.dbUser.id),
          gte(dailyDigestRuns.sentAt, since),
        ),
      )
      .orderBy(desc(dailyDigestRuns.sentAt))
      .limit(20);
    return rows.map((r) => ({
      id: r.id,
      localDate: r.localDate,
      sentAt: r.sentAt.toISOString(),
      status: r.status,
      urgentCount: r.urgentCount,
      alertsCount: r.alertsCount,
      repliesCount: r.repliesCount,
      errorMessage: r.errorMessage,
    }));
  }),
});
