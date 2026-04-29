import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import { aiInferences } from "../../db/schema.js";

/**
 * AI eval surface (P0.18, PRD §4.7).
 *
 * Online eval lives on the `ai_inferences.was_acted_on` flag — flipped
 * when a CPA accepts (true) or rejects (false) an AI proposal. Offline
 * eval is a separate harness (`backend/scripts/eval-offline.ts`, Phase 1)
 * that runs against curated ground-truth fixtures.
 *
 * For Phase 0 we expose the recording endpoint + a per-mode summary view
 * so the FE can show "Mode A acceptance: 87% over 30d" in Settings.
 */
const MODES = ["A", "B", "C", "D", "E"] as const;

export const aiInferencesRouter = router({
  /** Called by the FE the moment a CPA acts on an AI proposal. */
  recordAcceptance: firmProcedure
    .input(
      z.object({
        inferenceId: z.coerce.number().int().positive(),
        accepted: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await db
        .update(aiInferences)
        .set({
          wasActedOn: input.accepted,
          cpaActionAt: new Date(),
        })
        .where(
          and(
            eq(aiInferences.id, input.inferenceId),
            eq(aiInferences.firmId, ctx.firmId),
          ),
        );
      if (result.count === 0) {
        return { ok: false as const, reason: "not_found" };
      }
      return { ok: true as const };
    }),

  /**
   * Per-mode acceptance rate over a window. Phase 0 returns coarse stats;
   * Phase 1 adds drift detection per arch §6.9.
   */
  summary: firmProcedure
    .input(z.object({ mode: z.enum(MODES) }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(aiInferences)
        .where(
          input?.mode
            ? and(
                eq(aiInferences.firmId, ctx.firmId),
                eq(aiInferences.mode, input.mode),
              )
            : eq(aiInferences.firmId, ctx.firmId),
        );
      const total = rows.length;
      const acted = rows.filter((r) => r.wasActedOn !== null).length;
      const accepted = rows.filter((r) => r.wasActedOn === true).length;
      const cost = rows.reduce(
        (sum, r) => sum + Number(r.costCents ?? 0),
        0,
      );
      return {
        total,
        actedOn: acted,
        accepted,
        acceptanceRate: acted > 0 ? accepted / acted : null,
        totalCostCents: cost,
      };
    }),
});
