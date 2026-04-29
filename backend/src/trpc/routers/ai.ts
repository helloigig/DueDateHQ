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
});
