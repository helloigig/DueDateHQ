import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, publicProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import { firms, teamInvites, users } from "../../db/schema.js";
import { ALL_STATES } from "../../lib/states.js";
import { seedDemoFirm } from "../../db/seed-demo-firm.js";
import { supabaseAdmin } from "../../auth/supabase.js";

const DEMO_EMAIL = "demo@duedatehq.com";
const DEMO_FIRM_NAME = "Mitchell CPA (demo)";

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

  /**
   * Demo workspace bootstrap. Called by Login.tsx's "Try the demo
   * workspace" button after the user signs in via Supabase magic link
   * to demo@duedatehq.com.
   *
   * Behaviour:
   *   1. The caller MUST be authenticated as demo@duedatehq.com — any
   *      other email gets FORBIDDEN. This guards the demo seed against
   *      being accidentally written into a real customer firm.
   *   2. If the user has no firm row yet, create a fresh "Mitchell CPA
   *      (demo)" firm and link the user as owner (mirrors the standard
   *      `bootstrap` path).
   *   3. Idempotently seed the firm with the 51-client roster +
   *      deadlines (see `seedDemoFirm`).
   *   4. Returns the firm id and seed counts so the FE can show a
   *      one-line "demo populated" toast.
   *
   * Idempotent end-to-end: re-running this on an already-seeded firm
   * inserts 0 new rows. Safe to call from a post-signin auth bridge
   * that doesn't know whether it's the user's first or 50th login.
   */
  /**
   * Mints a one-click sign-in URL for the demo workspace. The Login
   * page calls this BEFORE any auth — the browser then navigates to
   * the returned URL, Supabase processes the embedded token, signs the
   * user in as demo@duedatehq.com, and redirects back to /. The
   * SupabaseAuthBridge picks up SIGNED_IN, sees the pending flag, and
   * calls bootstrapDemo to populate the firm.
   *
   * Why server-side: Supabase's client-side `signInWithOtp` requires a
   * deliverable email (MX records, validation rules). demo@duedatehq.com
   * is a synthetic address with no inbox, so the OTP path errors out
   * with "Email address ... is invalid". `auth.admin.generateLink`
   * bypasses email sending entirely and returns the action URL directly
   * — exactly what we want for a public demo button.
   *
   * Idempotent on the user side: re-calling creates a fresh link each
   * time but the user row is reused (createUser is upsert-y when the
   * email already exists, returning the existing user).
   */
  createDemoSession: publicProcedure.mutation(async () => {
    // Step 1: check whether the demo user already exists. Earlier
    // version called createUser unconditionally and tried to
    // recognise the duplicate-error response by message regex —
    // brittle (Supabase's exact wording varies between versions:
    // "User already registered" vs "A user with this email address
    // has already been registered" vs "email_exists"). Pre-checking
    // existence sidesteps the entire error-classification problem.
    const list = await supabaseAdmin.auth.admin.listUsers();
    if (list.error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `listUsers_failed: ${list.error.message}`,
      });
    }
    const existing = list.data.users.find(
      (u) => (u.email ?? "").toLowerCase() === DEMO_EMAIL,
    );

    if (!existing) {
      // First-ever call on this Supabase project — provision the
      // demo user. email_confirm: true skips the confirmation flow
      // so we can immediately mint a magic link below.
      const created = await supabaseAdmin.auth.admin.createUser({
        email: DEMO_EMAIL,
        email_confirm: true,
        user_metadata: { full_name: "Sarah Mitchell" },
      });
      if (created.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `createUser_failed: ${created.error.message}`,
        });
      }
    }

    // Step 2: generate a magic-link URL the FE can navigate to. The
    // `redirectTo` lands the user back on the dashboard root after
    // Supabase processes the token; our SupabaseAuthBridge will pick
    // up SIGNED_IN and call bootstrapDemo from there.
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: DEMO_EMAIL,
      options: {
        redirectTo: process.env.PUBLIC_APP_URL
          ? `${process.env.PUBLIC_APP_URL}/`
          : undefined,
      },
    });
    if (error || !data?.properties?.action_link) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `generateLink_failed: ${error?.message ?? "no_action_link"}`,
      });
    }
    return { actionLink: data.properties.action_link };
  }),

  bootstrapDemo: publicProcedure
    .input(
      z
        .object({
          // When true, deletes every client in the demo firm (cascades
          // through deadlines → tasks → milestones / checklists / drafts)
          // before re-seeding. Use to force a stale demo firm to pick up
          // new seed content without manual Supabase surgery. The seed
          // itself is idempotent and re-runs on every login, but it only
          // INSERTs — it never UPDATEs existing rows, so additive seed
          // changes (new label, new status mix) won't reach a firm that
          // was already populated under the old version.
          reseed: z.boolean().optional().default(false),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      if (ctx.user.email.toLowerCase() !== DEMO_EMAIL) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "demo_endpoint_requires_demo_email",
        });
      }
      const reseed = input?.reseed ?? false;

      // Resolve-or-create the firm + user row in one transaction.
      const firmId = await db.transaction(async (tx) => {
        const existingUser = await tx.query.users.findFirst({
          where: eq(users.id, ctx.user!.id),
        });
        if (existingUser) {
          return existingUser.firmId;
        }
        const [firm] = await tx
          .insert(firms)
          .values({
            name: DEMO_FIRM_NAME,
            primaryStates: ["CA"],
            tier: "pro",
            subscriptionStatus: "trialing",
            seatLimit: 5,
            // Demo firm has no client cap — the seed inserts 51, well past
            // the solo-tier 50 cap, and we don't want the next prospect's
            // import to bounce off a hard limit.
            clientLimit: null,
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
          displayName: "Sarah Mitchell",
          role: "owner",
        });
        return firm.id;
      });

      // Seed (idempotent on insert; UPDATEs internal_target_date on
      // existing deadlines as a one-shot backfill so a firm seeded
      // before that field shipped picks it up). Outside the transaction
      // so a partial seed doesn't roll back the firm creation.
      //
      // reseed=true: cascade-deletes every client in the firm (firms +
      // user rows stay so the Supabase auth session keeps working
      // through the reset), then runs the full seed from clean state.
      // Restricted to the demo email at the top of this handler.
      const seedResult = await seedDemoFirm({ db, firmId, reseed });

      return {
        firmId,
        reseed,
        ...seedResult,
      };
    }),

  /**
   * Sibling of `team.acceptInvite` exposed under the `auth` namespace
   * because the FE's invite-acceptance page lives in the auth flow
   * (`/accept-invite`). Accepts the same token but also captures the
   * invitee's chosen display name from the form.
   *
   * Assumes the invitee has already created a Supabase Auth account
   * with the invite email (the FE handles signup before calling this).
   * Password is accepted in the input but ignored here — Supabase has
   * already stored it. Phase 1 may move to a server-side signup so
   * the password becomes load-bearing.
   */
  acceptInvite: publicProcedure
    .input(
      z.object({
        token: z.string().min(20).max(64),
        password: z.string().min(8).max(128).optional(),
        userName: z.string().min(1).max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const invite = await db.query.teamInvites.findFirst({
        where: and(
          eq(teamInvites.token, input.token),
          eq(teamInvites.status, "pending"),
        ),
      });
      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "invalid_token" });
      }
      if (invite.expiresAt.getTime() < Date.now()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "expired",
        });
      }
      if (invite.email !== ctx.user.email.toLowerCase()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "invite_email_mismatch",
        });
      }
      await db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: ctx.user!.id,
          firmId: invite.firmId,
          email: ctx.user!.email,
          displayName: input.userName ?? null,
          role: invite.role,
        });
        await tx
          .update(teamInvites)
          .set({ status: "accepted", acceptedAt: new Date() })
          .where(eq(teamInvites.id, invite.id));
      });
      return { ok: true as const, firmId: invite.firmId };
    }),
});
