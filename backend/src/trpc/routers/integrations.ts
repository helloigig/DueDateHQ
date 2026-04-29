import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import { integrations } from "../../db/schema.js";
import {
  isConfigured,
  startConnect as startOauthConnect,
  type ProviderKind,
} from "../../lib/oauth.js";

const KIND = ["qbo", "xero", "gmail", "outlook", "stripe"] as const;
const OAUTH_KIND = ["qbo", "xero", "gmail", "outlook"] as const;

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
});
