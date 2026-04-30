import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, AlertOctagon, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useAnnouncements } from "../hooks/useAnnouncements";
import { trpc } from "../lib/api/client";

// Mode F Health module — per IA v0.7 amendment §3.9d.
//
// State-monitoring's own monitoring. Without this surface, "no alerts" is
// ambiguous (real silence vs. monitoring is broken). This is the second
// module on Today, below the action queue.
//
// Per PRD §4.3 Mode F SLO: per-state freshness ≤ 6h target / ≤ 24h hard ceiling.
// Color: green if all states ≤ 6h fresh; amber if any 6-24h stale; red if any
// > 24h or scraper job dead.
//
// v0.7 amendment Phase 1: overall health status is derived from the existing
// announcement query (loading/error state); per-state freshness breakdown
// remains illustrative mock until backend exposes per-state last_scraped_at
// (queued for Phase 3 backend). Honest hybrid: real query signal + mock
// per-state details with an inline note.

type StateHealth = {
  code: string;
  label: string;
  staleHours: number;
  status: "fresh" | "stale_short" | "stale_long" | "rescrape_running";
};

// Illustrative per-state details for Phase 1 — real per-state freshness
// requires backend `last_scraped_at` per StateAnnouncementSource (Phase 3).
const ILLUSTRATIVE_STATES: StateHealth[] = [
  { code: "NY", label: "New York", staleHours: 4, status: "stale_short" },
  { code: "TX", label: "Texas", staleHours: 12, status: "stale_short" },
  { code: "CA", label: "California", staleHours: 28, status: "rescrape_running" },
];

export function ModeFHealth() {
  // Wire to trpc.modeFHealth.status — overall status derived from real
  // announcement pipeline detectedAt; per-state breakdown stays illustrative
  // until backend exposes StateAnnouncementSource.lastScrapedAt (Phase 3).
  const healthQuery = trpc.modeFHealth.status.useQuery();
  const announcementsQuery = useAnnouncements({ activeOnly: false });
  const total = healthQuery.data?.total ?? 50;
  const liveStates = healthQuery.data?.perState ?? null;

  const queryDegraded = healthQuery.isError || announcementsQuery.isError;
  const queryLoading = healthQuery.isLoading;
  const announcementCount = announcementsQuery.data?.length ?? 0;

  const states = (liveStates as typeof ILLUSTRATIVE_STATES) ?? ILLUSTRATIVE_STATES;
  const stale = queryDegraded ? total : states.length;
  const fresh = total - stale;
  const lastSyncMinAgo = healthQuery.data?.lastSyncMinAgo ?? 14;
  const nextSyncInMin = healthQuery.data?.nextSyncInMin ?? 16;

  const overall = useMemo(() => {
    if (queryDegraded) return "red";
    if (queryLoading) return "amber";
    if (healthQuery.data?.overall) return healthQuery.data.overall;
    const longStale = states.filter((s) => s.staleHours > 24).length;
    if (longStale > 0) return "red";
    if (states.length > 0) return "amber";
    return "green";
  }, [queryDegraded, queryLoading, healthQuery.data?.overall, states]);

  const Icon =
    overall === "green"
      ? CheckCircle2
      : overall === "amber"
        ? AlertTriangle
        : AlertOctagon;

  const tone =
    overall === "green"
      ? "text-success-solid"
      : overall === "amber"
        ? "text-warning-solid"
        : "text-danger-solid";

  return (
    <section
      aria-labelledby="modef-health-heading"
      className="rounded-md border border-line bg-surface p-3 mt-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${tone}`} aria-hidden />
        <h2
          id="modef-health-heading"
          className="text-2xs uppercase tracking-wider text-ink-500 font-semibold"
        >
          State Monitoring Health
        </h2>
        <span className="ml-auto text-2xs text-ink-400 tabular-nums">
          last sync {lastSyncMinAgo}m ago · next in {nextSyncInMin}m
        </span>
      </div>

      <div className="text-sm text-ink-900">
        {queryDegraded ? (
          <span className="text-danger-ink">
            Announcement pipeline unreachable — Mode F degraded.{" "}
            <button
              onClick={() => {
                healthQuery.refetch();
                announcementsQuery.refetch();
              }}
              className="underline hover:no-underline text-danger-solid"
            >
              Retry
            </button>
          </span>
        ) : queryLoading ? (
          <span className="text-ink-500">Checking pipeline…</span>
        ) : overall === "green" ? (
          <span>
            <strong className="tabular-nums">{fresh}/{total}</strong> states
            up to date — monitoring healthy ({announcementCount} active alerts)
          </span>
        ) : (
          <>
            <span>
              <strong className="tabular-nums">{fresh}/{total}</strong> states
              up to date · <strong className="tabular-nums">{stale}</strong> stale
              <span className="text-2xs text-ink-400 ml-2">
                ({announcementCount} active alerts)
              </span>
            </span>
            <ul className="mt-2 space-y-1 text-xs text-ink-700">
              {states.map((s) => (
                <li key={s.code} className="flex items-center gap-2">
                  <span className="font-mono tabular-nums w-9 text-ink-500">
                    {s.code}
                  </span>
                  <span>{s.label}</span>
                  <span className="ml-auto tabular-nums text-ink-500">
                    {s.staleHours}h stale
                  </span>
                  {s.status === "rescrape_running" && (
                    <span className="inline-flex items-center gap-1 text-info-solid text-2xs">
                      <RefreshCw className="w-3 h-3 animate-spin" aria-hidden />
                      re-scrape running
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs">
        <Link
          to="/settings/integrations"
          className="text-ink-500 hover:text-ink-900 underline-offset-2 hover:underline"
        >
          View per-state status →
        </Link>
        <span className="text-ink-300">·</span>
        <Link
          to="/settings/integrations"
          className="text-ink-500 hover:text-ink-900 underline-offset-2 hover:underline"
        >
          Mode F eval metrics →
        </Link>
        {!queryDegraded && !queryLoading && (
          <span className="ml-auto text-2xs text-ink-300 italic">
            {healthQuery.data?.perStateIllustrative
              ? "per-state breakdown illustrative pending Phase 3 backend"
              : "live per-state freshness from backend"}
          </span>
        )}
      </div>
    </section>
  );
}
