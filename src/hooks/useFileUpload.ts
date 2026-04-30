/**
 * File upload helper — orchestrates the three-step flow:
 *   1. uploads.requestUrl  → BE returns signed PUT URL + storageKey
 *   2. PUT bytes directly to Supabase Storage (saves BE bandwidth)
 *   3. Caller invokes a follow-up procedure with the storageKey
 *
 * Mock mode is detected via the synthetic `data:mock/*` URL scheme;
 * the upload PUT is skipped, the storageKey is returned immediately
 * so callers can exercise the post-upload pathway without real
 * storage configured.
 */
import { useState } from "react";
import { trpc } from "../lib/api/client";
import { env } from "../config";

export type UploadKind =
  | "firm_logo"
  | "avatar"
  | "inbound_attachment"
  | "prior_year_return"
  | "client_doc";

interface UploadProgress {
  state: "idle" | "requesting" | "uploading" | "done" | "failed";
  /** 0-100 — only meaningful while state="uploading" */
  pct: number;
  storageKey?: string;
  error?: string;
}

export function useFileUpload() {
  const requestUrl = trpc.uploads.requestUrl.useMutation();
  const [progress, setProgress] = useState<UploadProgress>({
    state: "idle",
    pct: 0,
  });

  const upload = async (args: {
    file: File;
    kind: UploadKind;
  }): Promise<{ storageKey: string }> => {
    setProgress({ state: "requesting", pct: 0 });
    try {
      const signed = await requestUrl.mutateAsync({
        kind: args.kind,
        filename: args.file.name,
        contentType: args.file.type || "application/octet-stream",
      });

      // Mock mode shortcut — the BE returns a `data:mock/...` URL we
      // recognize and skip. Real mode does a real PUT to Supabase.
      const isMockUrl = signed.uploadUrl.startsWith("data:mock/");
      if (isMockUrl || env.useMockData) {
        setProgress({
          state: "done",
          pct: 100,
          storageKey: signed.storageKey,
        });
        return { storageKey: signed.storageKey };
      }

      setProgress({ state: "uploading", pct: 0 });
      // Use XMLHttpRequest for upload progress events (fetch's
      // streaming upload is still gated behind a flag in most browsers
      // as of 2025).
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (!e.lengthComputable) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          setProgress({ state: "uploading", pct });
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(
              new Error(
                `upload_failed: ${xhr.status} ${xhr.statusText.slice(0, 100)}`,
              ),
            );
          }
        });
        xhr.addEventListener("error", () =>
          reject(new Error("upload_network_error")),
        );
        xhr.open("PUT", signed.uploadUrl);
        xhr.setRequestHeader(
          "Content-Type",
          args.file.type || "application/octet-stream",
        );
        xhr.send(args.file);
      });

      setProgress({
        state: "done",
        pct: 100,
        storageKey: signed.storageKey,
      });
      return { storageKey: signed.storageKey };
    } catch (err) {
      const error = err instanceof Error ? err.message : "upload_failed";
      setProgress({ state: "failed", pct: 0, error });
      throw err;
    }
  };

  const reset = () => setProgress({ state: "idle", pct: 0 });

  return { upload, progress, reset };
}

/** Status query for whether storage is wired at the BE level. */
export function useUploadStatus() {
  return trpc.uploads.status.useQuery(undefined, {
    refetchInterval: 5 * 60_000,
  });
}
