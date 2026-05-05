/**
 * Bulk + per-client CSV export trigger.
 *
 * One button, one click, one download. No scope-picker modal — the
 * filters passed in are whatever the caller is currently showing the
 * user. Mental model: "export what I'm looking at."
 *
 * Used from:
 *  - Clients page header — bulk export with the current filter set
 *  - ClientDetail header — single-client export (pass `clientId`)
 *
 * Why no modal: per `feedback_make_calls`, don't pre-empt with options.
 * If the CPA wants a different cut, they change the filters on the
 * page and click again. CSV is the universal pivot input — Excel
 * handles every cut downstream.
 */

import { useState } from "react";
import { Download } from "lucide-react";
import { trpc } from "../lib/api/client";
import { env } from "../config";

interface BulkFilters {
  search?: string;
  state?: string[];
  entityType?: string[];
  status?: string[];
  tier?: string[];
}

type Props =
  | ({ filters: BulkFilters; visibleCount: number; clientId?: undefined } & {
      compact?: boolean;
    })
  | ({ clientId: string; filters?: undefined; visibleCount?: undefined } & {
      compact?: boolean;
    });

export function ExportClientsButton(props: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FE router types may lag the BE; cast through any to call the new
  // `clients.exportCsv` endpoint until the next type regen lands.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const utils = trpc.useUtils() as any;

  const onClick = async () => {
    if (env.useMockData) {
      setError("Export needs a live backend (mock mode is FE-only).");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const input = props.clientId
        ? { clientId: props.clientId }
        : props.filters;
      const result: { filename: string; content: string; rowCount: number } =
        await utils.clients.exportCsv.fetch(input);
      // Build a Blob and trigger a download. Same pattern any CSV-gen
      // FE uses; no library dep needed.
      const blob = new Blob([result.content], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setPending(false);
    }
  };

  const label = props.clientId
    ? "Export"
    : (props.visibleCount ?? 0) > 0
      ? `Export (${props.visibleCount})`
      : "Export";

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={pending}
        className={
          props.compact
            ? "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-line text-ink-700 hover:bg-sunken disabled:opacity-50"
            : "inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-line text-ink-700 hover:bg-sunken disabled:opacity-50"
        }
        title={
          props.clientId
            ? "Export this client + their tasks as CSV"
            : "Export filtered clients as CSV"
        }
      >
        <Download className="w-3.5 h-3.5" aria-hidden />
        {pending ? "Exporting…" : label}
      </button>
      {error && (
        <span className="absolute top-full right-0 mt-1 text-2xs text-danger-ink bg-danger-bg border border-danger-border rounded px-2 py-1 whitespace-nowrap shadow-overlay z-10">
          {error}
        </span>
      )}
    </span>
  );
}
