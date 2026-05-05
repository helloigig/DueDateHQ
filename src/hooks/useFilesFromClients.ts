/**
 * Hooks for the files-from-clients channels — digest, SMS, cover sheet.
 *
 * Each one wraps a BE procedure. Mock mode dispatches via mock-adapter
 * (returns synthesized data from the local store); real mode hits the
 * BE which calls Anthropic + Twilio + the export worker.
 */
import { useEffect, useState } from "react";
import { trpc } from "../lib/api/client";

// ───────── Digest ─────────

export function useDigestForClient() {
  return trpc.filesFromClients.digestForClient.useMutation();
}

export function useDigestForFirm() {
  return trpc.filesFromClients.digestForFirm.useMutation();
}

// ───────── SMS ─────────

export function useSmsStatus() {
  return trpc.filesFromClients.smsStatus.useQuery(undefined, {
    refetchInterval: 5 * 60_000,
  });
}

export function useSendChaseSms() {
  return trpc.filesFromClients.sendChaseSms.useMutation();
}

export function useComposeChaseSms() {
  // The compose helper is a pure query — wrap it so the FE can
  // generate a draft body before showing the confirm dialog. We use
  // a manual trigger pattern via fetchQuery.
  const utils = trpc.useUtils();
  return async (input: {
    clientFirstName: string;
    cpaName: string;
    formType: string;
    missingItem?: string;
    forwardingEmail: string;
  }) => {
    const result = await utils.filesFromClients.composeChaseSms.fetch(input);
    return result.body;
  };
}

// ───────── Cover sheet ─────────

/**
 * Request a per-task cover sheet PDF, poll until ready, return the
 * download URL. The export worker writes the artifact to disk and
 * exposes it at /exports/<id>.pdf; the URL returned is server-relative.
 *
 * Returns one of:
 *   { state: "idle" }
 *   { state: "queued" }
 *   { state: "ready", url }
 *   { state: "failed", error }
 */
type CoverSheetState =
  | { state: "idle" }
  | { state: "queued"; exportId: string }
  | { state: "ready"; url: string }
  | { state: "failed"; error: string };

export function useCoverSheet() {
  const request = trpc.exports.request.useMutation();
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<CoverSheetState>({ state: "idle" });
  const [exportId, setExportId] = useState<string | null>(null);

  // Poll status when we have an active exportId
  useEffect(() => {
    if (!exportId) return;
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      if (cancelled) return;
      attempts++;
      const r = await utils.exports.status.fetch({ id: exportId });
      if (cancelled) return;
      if (!r) return;
      if (r.status === "ready" && r.url) {
        setStatus({ state: "ready", url: r.url });
      } else if (r.status === "failed") {
        setStatus({
          state: "failed",
          error: "Export failed",
        });
      } else if (attempts < 20) {
        setTimeout(tick, 1000);
      } else {
        setStatus({ state: "failed", error: "Timed out waiting for PDF" });
      }
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [exportId, utils]);

  const generate = async (taskId: string) => {
    setStatus({ state: "queued", exportId: "" });
    const result = await request.mutateAsync({
      kind: "audit_trail_pdf",
      scope: { taskId, sheet: "cover" },
    });
    setExportId(result.exportId);
    setStatus({ state: "queued", exportId: result.exportId });
  };

  const reset = () => {
    setExportId(null);
    setStatus({ state: "idle" });
  };

  return { status, generate, reset };
}
