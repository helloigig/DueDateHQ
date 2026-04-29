import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import { integrations } from "../../db/schema.js";

const KIND = ["qbo", "xero", "gmail", "outlook", "stripe"] as const;

export const integrationsRouter = router({
  list: firmProcedure.query(async ({ ctx }) => {
    return db
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
  }),

  /**
   * Generates the OAuth authorize URL for a provider. The BE doesn't host
   * its own OAuth flow yet (Phase 1 — `backend/src/lib/oauth/<provider>.ts`).
   * This procedure surfaces the right URL so the FE can open a popup; the
   * provider redirects back to the BE callback (currently NOT_IMPLEMENTED).
   */
  startConnect: firmProcedure
    .input(
      z.object({
        kind: z.enum(KIND),
        redirectTo: z.string().url(),
      }),
    )
    .mutation(({ input }) => {
      // TODO Phase 1 — this is a placeholder so the FE Settings → Integrations
      // can render the button + handle the no-op gracefully. Real impl
      // builds the provider-specific authorize URL with state token.
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: `oauth_${input.kind}_not_configured`,
      });
    }),

  disconnect: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(integrations)
        .set({ status: "disconnected" })
        .where(
          and(
            eq(integrations.id, input.id),
            eq(integrations.firmId, ctx.firmId),
          ),
        );
      return { ok: true as const };
    }),
});
