import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, publicProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import { firms, users } from "../../db/schema.js";
import { ALL_STATES } from "../../lib/states.js";

export const authRouter = router({
  /**
   * Returns the authenticated user + their firm. Frontend calls this on app
   * load to populate SessionProvider. Shape matches the FE contract in
   * `src/lib/api/router.ts` `auth.session`: `{ user, firm, tier } | null`.
   *
   * Returns null (not 401) when the JWT is missing/invalid OR when the JWT
   * is valid but no firm row has been provisioned yet — the FE uses null
   * to route to /login or /onboarding/firm without surfacing an error.
   */
  session: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
    });
    if (!dbUser) return null;
    const firm = await db.query.firms.findFirst({
      where: eq(firms.id, dbUser.firmId),
    });
    if (!firm) return null;
    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        displayName: dbUser.displayName,
        role: dbUser.role,
        timezone: dbUser.timezone,
        lastActiveAt: dbUser.lastActiveAt
          ? dbUser.lastActiveAt.toISOString()
          : null,
      },
      firm: {
        id: firm.id,
        name: firm.name,
        primaryStates: firm.primaryStates,
        logoStorageKey: firm.logoStorageKey,
        branding: firm.branding as {
          primaryColor?: string;
          emailSignature?: string;
        } | null,
        tier: firm.tier,
        subscriptionStatus: firm.subscriptionStatus,
        trialEndsAt: firm.trialEndsAt ? firm.trialEndsAt.toISOString() : null,
        seatLimit: firm.seatLimit,
        clientLimit: firm.clientLimit,
      },
      // Mirror at the top level — several `useFeatureFlags()` call sites
      // read `session.tier` directly.
      tier: firm.tier,
    };
  }),

  /**
   * Health probe that doesn't require auth. Used by Fly health checks
   * and the frontend to differentiate "backend down" from "auth bad".
   */
  health: publicProcedure.query(() => ({
    ok: true,
    serverTime: new Date().toISOString(),
  })),

  /**
   * Touch the user's lastActiveAt. Cheap; safe to fire on app focus.
   */
  ping: firmProcedure.mutation(async ({ ctx }) => {
    await db
      .update(users)
      .set({ lastActiveAt: new Date() })
      .where(eq(users.id, ctx.dbUser.id));
    return { ok: true as const };
  }),

  /**
   * One-shot provisioning: creates a firm + public.users row for a freshly
   * signed-up Supabase user. Called by /onboarding/firm after Supabase
   * email/password signup completes.
   *
   * Idempotent — if the user already has a firm, returns that firm and
   * does nothing else.
   */
  bootstrap: publicProcedure
    .input(
      z.object({
        firmName: z.string().min(1).max(120),
        primaryStates: z.array(z.enum(ALL_STATES)).min(1),
        displayName: z.string().min(1).max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      // Idempotency: if the user already has a firm, return it.
      const existing = await db.query.users.findFirst({
        where: eq(users.id, ctx.user.id),
      });
      if (existing) {
        return { firmId: existing.firmId, alreadyProvisioned: true as const };
      }
      const result = await db.transaction(async (tx) => {
        const [firm] = await tx
          .insert(firms)
          .values({
            name: input.firmName,
            primaryStates: input.primaryStates,
            tier: "solo",
            subscriptionStatus: "trialing",
            seatLimit: 1,
            clientLimit: 50,
            trialEndsAt: new Date(Date.now() + 30 * 86_400_000),
          })
          .returning();
        if (!firm) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }
        await tx.insert(users).values({
          id: ctx.user!.id,
          firmId: firm.id,
          email: ctx.user!.email,
          displayName: input.displayName ?? null,
          role: "owner",
        });
        return { firmId: firm.id };
      });
      return { firmId: result.firmId, alreadyProvisioned: false as const };
    }),
});
