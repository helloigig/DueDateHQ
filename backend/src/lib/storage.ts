/**
 * Supabase Storage — file upload + retrieval.
 *
 * Three callers depend on this:
 *   1. FE direct-upload flow — Settings → upload firm logo, prior-year
 *      return upload, attachment of cover sheets to chases. Pattern:
 *      FE calls uploads.requestUrl → BE returns a signed upload URL
 *      → FE PUTs bytes directly to Supabase (saves BE bandwidth).
 *   2. Inbound email attachments — webhook arrives with bytes inline
 *      (Postmark base64); BE saves to storage + records the storageKey
 *      on the matching checklist item.
 *   3. PDF extraction (prior-year returns) — BE downloads bytes from
 *      storage, sends to Claude with structured-output prompt.
 *
 * Bucket layout — single bucket `client-docs` with per-firm path
 * prefixing: `{firmId}/{kind}/{ulid}-{filename}`. RLS is firm-scoped
 * via Supabase row-level policies so even with a leaked URL another
 * firm can't read these.
 *
 * Without SUPABASE_SERVICE_ROLE_KEY, all functions throw — the FE
 * reads `isStorageConfigured()` and surfaces "Upload not yet wired"
 * rather than letting the request hang.
 */

import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { log, span } from "./observability.js";

// ───────── Client + config ─────────

const BUCKET = "client-docs";
const URL_TTL_SECONDS = 60 * 60; // 1 hour

let _client: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "supabase_storage_not_configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

// ───────── Storage key + validation ─────────

/**
 * MIME types we accept for upload. Tax docs are predominantly PDF +
 * common image formats (phone photos of W-2s) + occasional Word/Excel.
 * Reject everything else to keep the bucket from becoming a dumping
 * ground.
 */
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/heic",
  "image/heif",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/**
 * Per-upload size cap. 50MB covers a multi-page scanned return
 * comfortably. Real production gates by tier (Solo/Pro/Team) and
 * per-firm quota.
 */
const MAX_BYTES = 50 * 1024 * 1024;

export type UploadKind =
  | "firm_logo"
  | "avatar"
  | "inbound_attachment"
  | "prior_year_return"
  | "client_doc";

/**
 * Build a storage key — per-firm path prefix + kind subfolder + a
 * short ulid + the original filename. The ulid prevents collisions
 * when two clients send the same filename on the same day; the
 * filename is preserved so downloads land with a recognizable name.
 *
 * Example: `<firmId>/prior_year_return/01HX...-2024_W2_chen.pdf`
 */
export function buildStorageKey(args: {
  firmId: string;
  kind: UploadKind;
  filename: string;
}): string {
  const safe = args.filename
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 80);
  // ULID-ish — sortable random bytes, no deps
  const ulid =
    Date.now().toString(36) + "-" + randomBytes(4).toString("hex");
  return `${args.firmId}/${args.kind}/${ulid}-${safe}`;
}

function validateUpload(args: {
  contentType: string;
  size?: number;
}): void {
  if (!ALLOWED_TYPES.has(args.contentType)) {
    throw new Error(
      `unsupported_content_type:${args.contentType} — allowed: ${[...ALLOWED_TYPES].join(", ")}`,
    );
  }
  if (args.size !== undefined && args.size > MAX_BYTES) {
    throw new Error(
      `file_too_large: ${args.size} bytes (max ${MAX_BYTES})`,
    );
  }
}

// ───────── Direct-upload signed URLs ─────────

export interface UploadUrlResult {
  /** The PUT URL the FE uploads to directly. Embeds a short-lived token. */
  uploadUrl: string;
  /** Stable path the BE references in checklistItems / metadata. */
  storageKey: string;
  /** When the URL expires — FE should request a fresh one if it
   *  hasn't started uploading by then. */
  expiresAt: Date;
}

/**
 * Mint a signed upload URL for direct-to-storage upload from the FE.
 * Saves BE bandwidth — large PDFs go straight to Supabase rather than
 * round-tripping through the API server.
 */
export async function requestUploadUrl(args: {
  firmId: string;
  kind: UploadKind;
  filename: string;
  contentType: string;
}): Promise<UploadUrlResult> {
  return span(
    "storage.request_upload_url",
    async () => {
      validateUpload({ contentType: args.contentType });
      const storageKey = buildStorageKey({
        firmId: args.firmId,
        kind: args.kind,
        filename: args.filename,
      });
      const { data, error } = await client()
        .storage.from(BUCKET)
        .createSignedUploadUrl(storageKey);
      if (error) {
        throw new Error(
          `supabase_signed_upload_url_failed: ${error.message}`,
        );
      }
      return {
        uploadUrl: data.signedUrl,
        storageKey,
        expiresAt: new Date(Date.now() + URL_TTL_SECONDS * 1000),
      };
    },
    { firmId: args.firmId, kind: args.kind },
  );
}

// ───────── Backend-side save (for inbound email attachments) ─────────

/**
 * Save bytes from the BE — used by the inbound email handler when the
 * webhook payload contains base64 attachments inline. Skips the
 * direct-upload signed-URL dance because the bytes are already in
 * BE memory.
 */
export async function saveBytes(args: {
  firmId: string;
  kind: UploadKind;
  filename: string;
  bytes: Buffer | Uint8Array;
  contentType: string;
}): Promise<{ storageKey: string }> {
  return span(
    "storage.save_bytes",
    async () => {
      validateUpload({ contentType: args.contentType, size: args.bytes.byteLength });
      const storageKey = buildStorageKey({
        firmId: args.firmId,
        kind: args.kind,
        filename: args.filename,
      });
      const { error } = await client()
        .storage.from(BUCKET)
        .upload(storageKey, args.bytes, {
          contentType: args.contentType,
          upsert: false,
        });
      if (error) {
        throw new Error(`supabase_upload_failed: ${error.message}`);
      }
      log.info("storage.saved", {
        firmId: args.firmId,
        kind: args.kind,
        bytes: args.bytes.byteLength,
      });
      return { storageKey };
    },
    { firmId: args.firmId, kind: args.kind, bytes: args.bytes.byteLength },
  );
}

// ───────── Retrieval ─────────

/**
 * Sign a download URL — caller passes to FE for direct GET. TTL is
 * intentionally short (1h) so leaked URLs don't grant long-term access.
 */
export async function getDownloadUrl(
  storageKey: string,
  ttlSeconds = URL_TTL_SECONDS,
): Promise<string> {
  const { data, error } = await client()
    .storage.from(BUCKET)
    .createSignedUrl(storageKey, ttlSeconds);
  if (error) {
    throw new Error(`supabase_signed_download_url_failed: ${error.message}`);
  }
  return data.signedUrl;
}

/**
 * Download bytes server-side — used by the prior-year PDF parser
 * to feed the file into Claude. Returns a Buffer suitable for
 * passing as a base64 attachment to messages.create.
 */
export async function getBytes(storageKey: string): Promise<Buffer> {
  return span(
    "storage.get_bytes",
    async () => {
      const { data, error } = await client()
        .storage.from(BUCKET)
        .download(storageKey);
      if (error) {
        throw new Error(`supabase_download_failed: ${error.message}`);
      }
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    },
    { storageKey },
  );
}

/** Hard-delete an object — used by retention/undo flows. */
export async function deleteObject(storageKey: string): Promise<void> {
  const { error } = await client()
    .storage.from(BUCKET)
    .remove([storageKey]);
  if (error) {
    throw new Error(`supabase_delete_failed: ${error.message}`);
  }
}

/**
 * Idempotent bucket setup — called once on first storage request
 * per process. Avoids the chicken-and-egg of needing to manually
 * create the bucket in the Supabase dashboard before the app works.
 *
 * No-op when already created. Logs the result so ops can verify.
 */
let bucketEnsured = false;
export async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  if (!isStorageConfigured()) return;
  try {
    const { data: existing } = await client().storage.getBucket(BUCKET);
    if (existing) {
      bucketEnsured = true;
      return;
    }
    const { error } = await client().storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: [...ALLOWED_TYPES],
    });
    if (error && !/already exists/i.test(error.message)) {
      throw error;
    }
    bucketEnsured = true;
    log.info("storage.bucket_created", { bucket: BUCKET });
  } catch (err) {
    log.warn("storage.bucket_ensure_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
