import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import {
  ensureBucket,
  getDownloadUrl,
  isStorageConfigured,
  requestUploadUrl,
  type UploadKind,
} from "../../lib/storage.js";

/**
 * File upload pipeline — Supabase Storage signed URLs.
 *
 * Pattern:
 *   1. FE calls uploads.requestUrl with {kind, filename, contentType}
 *   2. BE validates, mints a signed PUT URL, returns the URL + storageKey
 *   3. FE PUTs bytes directly to Supabase (saves BE bandwidth)
 *   4. FE calls a follow-up procedure (e.g. imports.parsePriorYearReturn)
 *      with the storageKey for processing
 *
 * Phase 1: real Supabase Storage, per-firm path scoping, RLS-protected.
 * Without env config (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY), the
 * request throws PRECONDITION_FAILED so the FE can render "Upload
 * not yet wired" cleanly instead of network black-holing.
 */
const KIND_VALUES = [
  "firm_logo",
  "avatar",
  "inbound_attachment",
  "prior_year_return",
  "client_doc",
] as const;

export const uploadsRouter = router({
  status: firmProcedure.query(() => {
    return { configured: isStorageConfigured() };
  }),

  requestUrl: firmProcedure
    .input(
      z.object({
        kind: z.enum(KIND_VALUES),
        filename: z.string().min(1).max(200),
        contentType: z.string().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isStorageConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "supabase_storage_not_configured",
        });
      }
      // Idempotent — only runs the first time the BE handles a
      // storage request after boot.
      await ensureBucket();
      try {
        const result = await requestUploadUrl({
          firmId: ctx.firmId,
          kind: input.kind as UploadKind,
          filename: input.filename,
          contentType: input.contentType,
        });
        return result;
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            err instanceof Error ? err.message : "upload_url_failed",
        });
      }
    }),

  /**
   * Sign a fresh download URL for an existing storage key. Used when
   * the FE wants to render an inline preview of a previously-uploaded
   * file (e.g. last year's W-2 thumbnail in this year's chase email).
   */
  downloadUrl: firmProcedure
    .input(
      z.object({
        storageKey: z.string().min(1),
        ttlSeconds: z.number().int().min(60).max(86400).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!isStorageConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "supabase_storage_not_configured",
        });
      }
      // Tenant safety — storage key must start with the caller's firm
      // id. RLS enforces this at the bucket level too, but checking
      // here means we can fail fast with a clearer error.
      if (!input.storageKey.startsWith(`${ctx.firmId}/`)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "storage_key_outside_firm",
        });
      }
      try {
        const url = await getDownloadUrl(
          input.storageKey,
          input.ttlSeconds,
        );
        return { url };
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            err instanceof Error ? err.message : "download_url_failed",
        });
      }
    }),
});
