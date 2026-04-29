import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";

/**
 * Presigned URL minting for direct-to-bucket uploads (avatars, firm logos,
 * inbound attachments). Phase 0 returns NOT_IMPLEMENTED — Phase 1 wires
 * Supabase Storage via `@supabase/storage-js` with per-firm path scoping
 * (`avatars/{firmId}/...`, `inbound/{firmId}/{taskId}/...` per arch §4.6).
 *
 * The FE's `src/lib/api/upload.ts` already handles the mock path; real-mode
 * callers will get a clean error rather than a network black hole.
 */
export const uploadsRouter = router({
  requestUrl: firmProcedure
    .input(
      z.object({
        purpose: z.enum(["firm_logo", "avatar", "inbound_attachment"]),
        filename: z.string().min(1).max(200),
        contentType: z.string().min(1).max(100),
      }),
    )
    .mutation(() => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "supabase_storage_phase1",
      });
    }),
});
