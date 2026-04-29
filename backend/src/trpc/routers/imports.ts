import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";

/**
 * Import / file-format detection. Phase 0 keeps the FE's existing
 * client-side CSV parser (`src/data/csvParser.ts`) authoritative — it
 * already detects File In Time / TaxDome / Drake / QBO / Excel formats
 * and field mappings via heuristics. The BE's role here is metadata:
 * persist commit history, surface to other team members, support undo.
 *
 * Phase 1 wires `suggestFieldMapping` to Gemini for ambiguous CSVs. The
 * server-side detector matches the client-side one for now so behavior
 * is consistent if the FE switches to BE detection.
 */
export const importsRouter = router({
  detectFormat: firmProcedure
    .input(z.object({ headerRow: z.array(z.string()) }))
    .mutation(({ input }) => {
      const headers = input.headerRow.map((h) => h.toLowerCase().trim());
      // Cheap heuristic — same shape as src/data/csvParser.ts:detectSource.
      const has = (s: string) => headers.some((h) => h.includes(s));
      let source: "taxdome" | "drake" | "proconnect" | "quickbooks" | "file_in_time" | "excel" =
        "excel";
      let confidence: "high" | "low" | "ignore" = "low";
      if (has("client number")) {
        source = "drake";
        confidence = "high";
      } else if (has("entity") && has("primary state")) {
        source = "taxdome";
        confidence = "high";
      } else if (has("client name") && has("ein")) {
        source = "proconnect";
        confidence = "high";
      } else if (has("display name") && has("currency")) {
        source = "quickbooks";
        confidence = "high";
      } else if (has("name") && has("state")) {
        source = "excel";
        confidence = "low";
      }
      return { source, confidence };
    }),

  suggestFieldMapping: firmProcedure
    .input(z.object({ headerRow: z.array(z.string()) }))
    .mutation(() => {
      // Phase 1 — Gemini call for ambiguous columns. For now the FE keeps
      // doing this client-side; we just ack the request shape so the FE
      // doesn't 404 in real mode.
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "ai_field_mapping_phase1",
      });
    }),

  /** Phase 1 — preview/commit/undo route through here. The FE can keep
   *  its current local-only flow until then. */
  preview: firmProcedure.input(z.unknown()).mutation(() => {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "import_pipeline_phase1",
    });
  }),
  commit: firmProcedure.input(z.unknown()).mutation(() => {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "import_pipeline_phase1",
    });
  }),
  listHistory: firmProcedure.query(() => {
    return [];
  }),
  undo: firmProcedure.input(z.unknown()).mutation(() => {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "import_pipeline_phase1",
    });
  }),
});
