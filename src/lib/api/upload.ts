/**
 * Signed-URL upload pattern. Client requests an upload URL from the API,
 * then PUTs the file directly to object storage (Supabase Storage on the
 * real backend). Returns the storageKey that downstream procedures consume.
 *
 * In mock mode the URL is a `data:mock/...` sentinel; the upload step is a
 * no-op so the rest of the wizard can run end-to-end.
 */
import { trpcClientUntyped } from "./client";
import { env } from "../../config";

export type UploadKind =
  | "firm_logo"
  | "avatar"
  | "inbound_attachment"
  | "prior_year_return"
  | "client_doc";

export interface SignedUpload {
  uploadUrl: string;
  storageKey: string;
}

export async function requestUploadUrl(opts: {
  kind: UploadKind;
  filename: string;
  contentType: string;
}): Promise<SignedUpload> {
  // Mock mode shortcut so we don't need a server round-trip.
  if (env.useMockApi) {
    return {
      uploadUrl: `data:mock/${opts.kind};${encodeURIComponent(opts.filename)}`,
      storageKey: `${opts.kind}/${Date.now()}-${opts.filename}`,
    };
  }
  return trpcClientUntyped.uploads.requestUrl.mutate(opts);
}

export async function uploadToSignedUrl(
  url: string,
  file: File
): Promise<void> {
  if (url.startsWith("data:mock/")) {
    // Pretend the upload took a beat so the UI shows progress honestly.
    await new Promise((r) => setTimeout(r, 200));
    return;
  }
  const res = await fetch(url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
}

/**
 * Convenience wrapper: request URL + upload + return storageKey.
 */
export async function uploadFile(
  kind: UploadKind,
  file: File
): Promise<{ storageKey: string }> {
  const { uploadUrl, storageKey } = await requestUploadUrl({
    kind,
    filename: file.name,
    contentType: file.type || "application/octet-stream",
  });
  await uploadToSignedUrl(uploadUrl, file);
  return { storageKey };
}
