import { Link } from "react-router-dom";
import { trpc } from "../lib/api/client";

// StateHealthPill — inline at-a-glance state-monitoring status, lives next
// to the State alerts section title. Replaces the previous ModeFHealth
// card on Today (per DESIGN.md "Don't ship Mode F Health as its own card
// on Today"). The detail page survives at /settings/integrations.
//
// Three states, status-colored:
//   • all healthy   → muted "50/50" with a small green dot (no chrome)
//   • 1 degraded    → amber pill "49/50 · {STATE} {N}h old"
//   • ≥2 stale      → red pill   "47/50 · {N} stale"
//
// The colored dot signals "live" — no need for the word.

type Variant = "ok" | "warn" | "danger";

export function StateHealthPill() {
  const healthQuery = trpc.modeFHealth.status.useQuery();
  const total = healthQuery.data?.total ?? 50;
  const liveStates = healthQuery.data?.perState ?? null;

  // Loading → minimal placeholder, no flicker
  if (healthQuery.isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-400">
        <span
          className="w-1.5 h-1.5 rounded-full bg-ink-300 animate-pulse"
          aria-hidden
        />
        <span className="tabular-nums">—/—</span>
      </span>
    );
  }

  // Pipeline error → escalate to red, click retries
  if (healthQuery.isError) {
    return (
      <button
        type="button"
        onClick={() => healthQuery.refetch()}
        className="inline-flex items-center gap-1.5 text-xs text-danger-ink bg-danger-bg/40 hover:bg-danger-bg/60 px-2 py-0.5 rounded-full"
        title="State-monitoring pipeline unreachable. Click to retry."
      >
        <span className="w-1.5 h-1.5 rounded-full bg-danger-solid" aria-hidden />
        <span className="tabular-nums">health check · retry</span>
      </button>
    );
  }

  const stale = liveStates?.length ?? 0;
  const fresh = total - stale;
  const overall = healthQuery.data?.overall ?? deriveOverall(liveStates);

  const variant: Variant =
    overall === "green" ? "ok" : overall === "amber" ? "warn" : "danger";

  // Healthy — quietest possible: just dot + count, no bg, no border
  if (variant === "ok") {
    return (
      <Link
        to="/settings/integrations"
        className="inline-flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-900"
        title={`All ${total} states monitored. Last sync ${healthQuery.data?.lastSyncMinAgo ?? "—"}m ago.`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-ok-solid" aria-hidden />
        <span className="tabular-nums">
          {fresh}/{total}
        </span>
      </Link>
    );
  }

  // Degraded — 1 stale gets named explicitly; 2+ rolls up to a count
  const degradedLabel = (() => {
    if (!liveStates || liveStates.length === 0) return null;
    if (liveStates.length === 1) {
      const s = liveStates[0];
      return `${s.code} ${s.staleHours}h old`;
    }
    return `${liveStates.length} stale`;
  })();

  const variantClasses =
    variant === "warn"
      ? "text-warn-ink bg-warn-bg/40 hover:bg-warn-bg/60"
      : "text-danger-ink bg-danger-bg/40 hover:bg-danger-bg/60";

  const dotClass = variant === "warn" ? "bg-warn-solid" : "bg-danger-solid";

  return (
    <Link
      to="/settings/integrations"
      className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${variantClasses}`}
      title="Click for per-state detail."
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} aria-hidden />
      <span className="tabular-nums">
        {fresh}/{total}
      </span>
      {degradedLabel && (
        <>
          <span className="text-ink-300">·</span>
          <span>{degradedLabel}</span>
        </>
      )}
    </Link>
  );
}

function deriveOverall(
  liveStates: Array<{ staleHours: number }> | null,
): "green" | "amber" | "red" {
  if (!liveStates || liveStates.length === 0) return "green";
  if (liveStates.some((s) => s.staleHours > 24)) return "red";
  return "amber";
}
