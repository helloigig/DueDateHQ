import { z } from "zod";
import { firmProcedure, router } from "../init.js";

/**
 * AI Insights router — backs the `<AiInsightsPanel>` on Client Detail
 * (Mode B/C/E surfacing per PRD §4.7). The eval pipeline that produces
 * these inferences (Mode B classifier → confidence-gated insertion)
 * lands in Phase 1; the router exists in Phase 0 so the FE call doesn't
 * 404 the moment `VITE_USE_MOCK_API=false`. Empty array is the correct
 * Phase 0 answer — there are no real inferences yet.
 *
 * When Phase 1 wires the eval service, this file gains a `generated`
 * mutation + a `dismiss` mutation alongside `listForClient`. The
 * `ai_inferences` table already exists in schema.ts; this router will
 * become the surface for *anomaly* + *advisory* inferences specifically
 * (rate-change estimates already have their own surface).
 */
export const aiInsightsRouter = router({
  listForClient: firmProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async () => {
      return [] as Array<{
        id: string;
        clientId: string;
        mode: "B" | "C" | "E";
        title: string;
        detail: string;
        actions: Array<
          "ask_client" | "schedule_advisory" | "mark_known" | "snooze"
        >;
        status: "open" | "resolved" | "snoozed";
        createdAt: string;
      }>;
    }),
});
