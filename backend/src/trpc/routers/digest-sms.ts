/**
 * Client digest + SMS chase + cover sheet — three procedures that
 * collectively close the "files from clients" loop on multiple
 * channels: consolidated email per client, SMS for fast-response
 * clients, printable cover sheet for offline mail.
 */

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import { firms } from "../../db/schema.js";
import {
  generateClientDigest,
  generateFirmDigests,
} from "../../lib/digest.js";
import { isSmsConfigured, sendSms, composeChaseSms } from "../../lib/sms.js";

export const filesFromClientsRouter = router({
  /** Generate a digest for one client (preview before send). */
  digestForClient: firmProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        cpaSignature: z.string(),
        tone: z.enum(["warm", "neutral", "urgent"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await generateClientDigest({
        firmId: ctx.firmId,
        clientId: input.clientId,
        cpaSignature: input.cpaSignature,
        tone: input.tone,
      });
      return result;
    }),

  /** Generate digests for every client with pending chases. */
  digestForFirm: firmProcedure
    .input(
      z.object({
        cpaSignature: z.string(),
        tone: z.enum(["warm", "neutral", "urgent"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return generateFirmDigests({
        firmId: ctx.firmId,
        cpaSignature: input.cpaSignature,
        tone: input.tone,
      });
    }),

  /** Whether SMS is configured at the BE level (env vars present). */
  smsStatus: firmProcedure.query(() => {
    return { configured: isSmsConfigured() };
  }),

  /** Send a chase SMS. Tier-gated — Pro/Team only. */
  sendChaseSms: firmProcedure
    .input(
      z.object({
        to: z.string().min(8), // E.164 minimum
        body: z.string().min(1).max(160),
        taskId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Tier check — solo firms don't get SMS (per-message cost gate)
      const firm = await db.query.firms.findFirst({
        where: eq(firms.id, ctx.firmId),
      });
      if (firm?.tier === "solo") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "sms_requires_pro_or_team",
        });
      }
      try {
        return await sendSms({
          firmId: ctx.firmId,
          to: input.to,
          body: input.body,
          taskId: input.taskId,
        });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            err instanceof Error ? err.message : "sms_send_failed",
        });
      }
    }),

  /** Compose-helper — returns a draft SMS string for the FE to show
   *  in a confirmation dialog before send. Pure function, no side
   *  effects. Lives BE-side so the wording stays consistent across
   *  any future channel additions (MessageBird, etc.). */
  composeChaseSms: firmProcedure
    .input(
      z.object({
        clientFirstName: z.string(),
        cpaName: z.string(),
        formType: z.string(),
        missingItem: z.string().optional(),
        forwardingEmail: z.string(),
      }),
    )
    .query(({ input }) => {
      return { body: composeChaseSms(input) };
    }),
});
