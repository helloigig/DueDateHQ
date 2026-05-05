import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import { integrations } from "../../db/schema.js";
import {
  isConfigured,
  startConnect as startOauthConnect,
  type ProviderKind,
} from "../../lib/oauth.js";
import { pollMethodBOnce } from "../../lib/method-b-poller.js";
import { syncFirm as qboSyncFirm } from "../../lib/sync/qbo.js";

const KIND = ["qbo", "xero", "gmail", "outlook", "stripe"] as const;
const OAUTH_KIND = [
  "qbo",
  "xero",
  "gmail",
  "outlook",
  "google_calendar",
] as const;

export const integrationsRouter = router({
  list: firmProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        id: integrations.id,
        kind: integrations.kind,
        status: integrations.status,
        externalAccountId: integrations.externalAccountId,
        scope: integrations.scope,
        lastSyncedAt: integrations.lastSyncedAt,
        lastError: integrations.lastError,
        expiresAt: integrations.expiresAt,
      })
      .from(integrations)
      .where(eq(integrations.firmId, ctx.firmId));
    // Annotate each row with whether the BE has client credentials
    // configured — the FE renders "Reconnect" vs "Coming soon" based on it.
    return rows.map((r) => ({
      ...r,
      configured: OAUTH_KIND.includes(r.kind as (typeof OAUTH_KIND)[number])
        ? isConfigured(r.kind as ProviderKind)
        : false,
    }));
  }),

  /**
   * Returns the per-kind configurability so the FE Settings → Integrations
   * page can render every supported provider with the correct CTA. Kinds
   * without env credentials show "Coming soon" instead of a Connect button
   * that throws.
   */
  catalog: firmProcedure.query(() => {
    return KIND.map((k) => ({
      kind: k,
      configured: OAUTH_KIND.includes(k as (typeof OAUTH_KIND)[number])
        ? isConfigured(k as ProviderKind)
        : false,
    }));
  }),

  /**
   * Generates the OAuth authorize URL for a provider. The FE opens this
   * in a popup or redirect; the provider returns to /oauth/callback,
   * which exchanges the code, persists tokens, and redirects to
   * `redirectTo`.
   *
   * Throws BAD_REQUEST when the provider's client credentials aren't
   * in env — the FE reads `catalog`/`list[i].configured` to avoid this.
   */
  startConnect: firmProcedure
    .input(
      z.object({
        kind: z.enum(OAUTH_KIND),
        redirectTo: z.string().url(),
      }),
    )
    .mutation(({ ctx, input }) => {
      try {
        const result = startOauthConnect({
          firmId: ctx.firmId,
          userId: ctx.dbUser.id,
          provider: input.kind,
          redirectAfter: input.redirectTo,
        });
        return result;
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "oauth_setup_failed",
        });
      }
    }),

  disconnect: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(integrations)
        .set({
          status: "disconnected",
          // Clear ciphertext on disconnect — the user revoked consent.
          accessTokenCiphertext: null,
          refreshTokenCiphertext: null,
        })
        .where(
          and(
            eq(integrations.id, input.id),
            eq(integrations.firmId, ctx.firmId),
          ),
        );
      return { ok: true as const };
    }),

  /**
   * Method B on-demand poll — useful when the CPA wants to check for
   * new client emails right now rather than wait for the next 5min
   * tick. Returns counts so the FE can render "Found 3 new docs from
   * 2 clients" feedback.
   */
  pollMethodB: firmProcedure
    .input(z.object({ provider: z.enum(["gmail", "outlook"]) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await pollMethodBOnce({
          firmId: ctx.firmId,
          provider: input.provider,
        });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "method_b_poll_failed",
        });
      }
    }),

  /**
   * Sync now — on-demand pull of QBO Customers (or Xero contacts)
   * into the firm's Clients. The scheduled job runs every 30
   * minutes; this lets the CPA force-refresh after they edit a
   * customer in QBO and want to see it in DDD.
   *
   * First-sync after OAuth connect is automatic (fired by the
   * oauth callback). This procedure is for refreshes thereafter.
   */
  syncNow: firmProcedure
    .input(z.object({ provider: z.enum(["qbo", "xero"]) }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (input.provider === "qbo") {
          return await qboSyncFirm(ctx.firmId);
        }
        // Xero mirrors the QBO pattern; not yet implemented in this
        // commit. Returning the stable shape with zeros lets the FE
        // render the same "synced" toast without branching.
        return {
          fetched: 0,
          inserted: 0,
          updated: 0,
          skipped: 0,
          errors: 0,
        };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "sync_failed",
        });
      }
    }),

  /**
   * Calendar push — on-demand. Drives the Settings → Integrations
   * "Sync now" button for Google Calendar. Walks all open deadlines
   * regardless of `calendar_synced_at` (forces re-push); the cron
   * version uses `onlyStale: true`.
   */
  syncCalendarNow: firmProcedure.mutation(async ({ ctx }) => {
    try {
      const { syncFirmToGoogleCalendar } = await import(
        "../../lib/calendar-sync.js"
      );
      return await syncFirmToGoogleCalendar(ctx.firmId, { onlyStale: false });
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: err instanceof Error ? err.message : "calendar_sync_failed",
      });
    }
  }),

  /**
   * Calendar status — drives the Settings card's "X of Y deadlines
   * synced" counter without making the FE compute it from a list query.
   */
  calendarStatus: firmProcedure.query(async ({ ctx }) => {
    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.firmId, ctx.firmId),
        eq(integrations.kind, "google_calendar"),
      ),
    });
    if (!integration) {
      return {
        connected: false as const,
        connectedAt: null,
        lastSyncedAt: null,
        lastError: null,
        syncedCount: 0,
        totalOpen: 0,
      };
    }
    const [counts] = (await db.execute(sql`
      SELECT
        COUNT(*) FILTER (
          WHERE calendar_event_id IS NOT NULL
        )::int AS synced,
        COUNT(*) FILTER (
          WHERE status NOT IN ('completed', 'filed_extension')
        )::int AS open_total
      FROM deadlines
      WHERE firm_id = ${ctx.firmId}
    `)) as unknown as Array<{ synced: number; open_total: number }>;
    return {
      connected: integration.status === "connected",
      connectedAt: integration.createdAt.toISOString(),
      lastSyncedAt: integration.lastSyncedAt?.toISOString() ?? null,
      lastError: integration.lastError,
      syncedCount: counts?.synced ?? 0,
      totalOpen: counts?.open_total ?? 0,
    };
  }),
});
