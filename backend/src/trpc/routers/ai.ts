/**
 * AI tRPC procedures — thin wrappers around lib/ai.ts.
 *
 * All AI calls are tenant-scoped via firmProcedure (firmId comes from
 * the JWT, not the input — we never trust the FE to declare its own
 * firm). Each procedure returns the inferenceId so the FE can call
 * aiInferences.recordAcceptance once the CPA acts on the output.
 *
 * Surfaces:
 *   - ai.classifyDocument: Mode A. Called from the inbound webhook
 *     server-side and (in real mode) from the FE simulate-inbound flow.
 *   - ai.draftEmail: Mode D. Called from EmailDraftModal in real mode.
 *   - ai.status: returns whether ANTHROPIC_API_KEY is configured, so
 *     the FE can render "AI not yet wired" honestly when missing.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import {
  classifyDocument,
  draftEmail,
  isAiConfigured,
  predictArrivalTiming,
  detectAnomaly,
  generateCrossYearInsights,
} from "../../lib/ai.js";

export const aiRouter = router({
  status: firmProcedure.query(() => {
    return { configured: isAiConfigured() };
  }),

  classifyDocument: firmProcedure
    .input(
      z.object({
        filename: z.string().min(1),
        itemType: z.string().optional(),
        textPreview: z.string().optional(),
        taskContext: z
          .object({
            formType: z.string(),
            clientName: z.string(),
            pendingItems: z.array(
              z.object({ itemType: z.string(), label: z.string() }),
            ),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAiConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "ai_not_configured",
        });
      }
      return classifyDocument({ firmId: ctx.firmId, ...input });
    }),

  draftEmail: firmProcedure
    .input(
      z.object({
        client: z.object({ name: z.string() }),
        task: z.object({ formType: z.string() }),
        itemLabel: z.string().optional(),
        itemType: z.string().optional(),
        context: z.string().optional(),
        tone: z.enum(["warm", "neutral", "urgent"]),
        cpaSignature: z.string(),
        forwardingEmail: z.string(),
        methodBConnected: z.boolean().optional(),
        voiceSamples: z.array(z.string()).optional(),
        missingDocs: z
          .array(
            z.object({
              itemType: z.string(),
              label: z.string(),
              lastYearArrival: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAiConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "ai_not_configured",
        });
      }
      return draftEmail({ firmId: ctx.firmId, ...input });
    }),

  /**
   * Mode B — predict when a client is likely to send a doc, based on
   * their prior arrival history. Used by the chase scheduler to time
   * reminders ("don't bug them yet — they typically send by March 12").
   */
  predictArrivalTiming: firmProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        itemType: z.string(),
        priorArrivals: z.array(z.string()),
        today: z.string(),
        cohortWindow: z
          .object({ start: z.string(), end: z.string() })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!isAiConfigured()) return null;
      return predictArrivalTiming({ firmId: ctx.firmId, ...input });
    }),

  /**
   * Mode C — anomaly detection on financial values. Statistical
   * thresholds are pre-filtered server-side (skip LLM if swing <15%
   * with ≥3 priors); the LLM call lifts contextual judgment ("income
   * jumped but client mentioned a stock sale — explain why").
   */
  detectAnomaly: firmProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        fieldLabel: z.string(),
        currentValue: z.number(),
        priorValues: z.array(z.number()),
        context: z.string().optional(),
        entityType: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAiConfigured()) return null;
      return detectAnomaly({ firmId: ctx.firmId, ...input });
    }),

  /**
   * Mode E — cross-year insights. Walks 2+ years of facts + current
   * checklist; surfaces missing items, election opportunities, credit
   * eligibility, structural changes, regression risk. The advisory
   * lever — Year-1 efficiency buyers convert to Year-3 retention via
   * the strength of these.
   */
  generateCrossYearInsights: firmProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        clientName: z.string(),
        entityType: z.string(),
        primaryState: z.string(),
        yearlyFacts: z.array(
          z.object({
            year: z.number(),
            items: z.array(
              z.object({
                itemType: z.string(),
                value: z.number().optional(),
                label: z.string().optional(),
              }),
            ),
          }),
        ),
        currentChecklist: z.array(
          z.object({
            itemType: z.string(),
            label: z.string(),
            state: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAiConfigured()) return null;
      return generateCrossYearInsights({ firmId: ctx.firmId, ...input });
    }),
});
