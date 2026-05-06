/**
 * Alert triage modal — fires once per browser session on the first
 * /-page-land when there are state alerts that arrived since the user's
 * previous `last_active_at` AND have at least one matched client.
 *
 * The intent: a CPA who logs in once per day shouldn't have to scan a
 * page to find out that 12 of their clients just got hit by a CA
 * disaster extension. Surfacing it as a foreground modal makes the
 * "what changed" answer impossible to miss.
 *
 * Friction guards:
 *   1. Suppressed entirely when the user has flipped the off-toggle
 *      in Settings → Notifications → "Show triage on first land"
 *   2. Per-session sessionStorage flag so reload / nav-and-back
 *      doesn't re-show within the same tab
 *   3. Two dismiss paths: "Review on /alerts" (deep link) and
 *      "Maybe later" (close + remember for the session)
 *   4. Empty payload → modal never renders. Quiet days are silent.
 *
 * Doesn't block /today rendering — the modal sits on top of the page,
 * and the page renders fully behind it.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronRight, X } from "lucide-react";
import { trpc } from "../lib/api/client";

const SESSION_FLAG_KEY = "alert_triage_shown_v1";

export function AlertTriageModal() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Per-user opt-out: Settings → Notifications → "Show triage on
  // first land". Defaults to true (the dogfooding ask was for a strong
  // notification on first-land); users who find it noisy turn it off
  // and keep the inline `<WhatChangedBanner>` as the alternative.
  const triageSettingsQuery = trpc.announcements.getTriageSettings.useQuery(
    undefined,
    { staleTime: 60_000 },
  );
  const enabled = triageSettingsQuery.data?.enabled ?? true;

  // Only fetch alerts when the toggle is on AND we haven't shown this session.
  const shownThisSession =
    typeof window !== "undefined" &&
    window.sessionStorage.getItem(SESSION_FLAG_KEY) === "1";

  const triageQuery = trpc.announcements.triageOnFirstLand.useQuery(undefined, {
    enabled: enabled && !shownThisSession && !triageSettingsQuery.isLoading,
    staleTime: Infinity, // We only want the snapshot once per session
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Open the modal when the query resolves with non-empty data and we
  // haven't shown it this session.
  useEffect(() => {
    if (!enabled) return;
    if (shownThisSession) return;
    const items = triageQuery.data;
    if (!items || items.length === 0) return;
    setOpen(true);
    // Mark shown immediately, even if the user closes without acting —
    // the modal earns one shot per session.
    window.sessionStorage.setItem(SESSION_FLAG_KEY, "1");
  }, [triageQuery.data, enabled, shownThisSession]);

  const items = triageQuery.data ?? [];
  if (!enabled || !open || items.length === 0) return null;

  const close = () => setOpen(false);
  const reviewOnAlertsPage = () => {
    close();
    navigate("/alerts");
  };

  const total = items.length;
  const totalClients = items.reduce(
    (acc, i) => acc + i.affectedClientCount,
    0,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-[2px] animate-in fade-in duration-200"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-triage-title"
    >
      <div
        className="bg-surface rounded-lg shadow-overlay border border-line max-w-[min(100vw-2rem,34rem)] w-full overflow-hidden animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — peach-tinted welcome strip. The single "warmer"
            surface in the modal frames the headline; the body returns
            to neutral surface so the alerts list reads as content. */}
        <header className="px-region pt-region pb-card bg-gradient-to-br from-warn-bg/60 via-warn-bg/40 to-transparent border-b border-warn-border/40 flex items-start gap-3 relative">
          {/* Header icon tile sized to match the row state-code pill
              below (w-9 h-9 = 36px) so the header reads as one of the
              row family. Yuqi audit 2026-05-06. */}
          <span
            aria-hidden
            className="w-9 h-9 rounded-md bg-warn-bg border border-warn-border/60 flex items-center justify-center text-warn-ink shrink-0 shadow-[inset_0_-1px_0_rgba(154,59,18,0.06)]"
          >
            <Bell className="w-4 h-4" aria-hidden />
          </span>
          <div className="flex-1 min-w-0 pr-7">
            <p className="text-2xs font-semibold uppercase tracking-wider text-warn-ink/80">
              Since you were last here
            </p>
            <h2
              id="alert-triage-title"
              className="text-base font-semibold text-ink-900 mt-0.5 leading-snug"
            >
              <span className="tabular-nums">{total}</span>{" "}
              new state {total === 1 ? "alert" : "alerts"}
            </h2>
            <p className="text-xs text-ink-500 mt-1">
              <span className="tabular-nums text-ink-700 font-medium">
                {totalClients}
              </span>{" "}
              {totalClients === 1 ? "client affected" : "clients affected"} across these {total === 1 ? "alert" : "alerts"}.
            </p>
          </div>
          <button
            onClick={close}
            className="absolute top-3 right-3 w-7 h-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 hover:bg-warn-bg/40 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </header>

        {/* Alert list — each row a focused mini-card. Group hover lifts
            the bg + colors the chevron so the row reads as actionable. */}
        <ul className="divide-y divide-line max-h-[50vh] overflow-y-auto">
          {items.map((a) => (
            <li
              key={a.id}
              role="button"
              tabIndex={0}
              className="group px-region py-3 flex items-start gap-3 hover:bg-sunken/60 focus-visible:bg-sunken focus-visible:outline-none cursor-pointer transition-colors"
              onClick={() => {
                close();
                navigate(`/alerts/${a.id}`);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  close();
                  navigate(`/alerts/${a.id}`);
                }
              }}
            >
              {/* State badge sized to match the header bell tile
                  (w-9 h-9). One icon family per modal. */}
              <span
                aria-hidden
                className="inline-flex items-center justify-center w-9 h-9 rounded-md text-xs font-bold tracking-wide text-ink-900 bg-sunken shrink-0 group-hover:bg-surface transition-colors"
              >
                {a.stateCode}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-900 leading-snug">
                  {a.title}
                </p>
                <p className="text-2xs text-ink-500 mt-1 truncate">
                  {a.authority}
                  <span className="mx-1.5 text-ink-300">·</span>
                  <span className="tabular-nums">{a.affectedClientCount}</span>{" "}
                  {a.affectedClientCount === 1 ? "client" : "clients"}
                </p>
              </div>
              <ChevronRight
                className="w-4 h-4 text-ink-300 group-hover:text-ink-700 group-hover:translate-x-0.5 shrink-0 mt-1 transition-all"
                aria-hidden
              />
            </li>
          ))}
        </ul>

        {/* Footer — sunken strip so the actions feel grounded. Cancel
            sits left, primary right, per modal convention. */}
        <footer className="px-region py-3 bg-canvas border-t border-line flex items-center justify-end gap-2">
          <button
            onClick={close}
            className="text-sm px-3 h-9 rounded-md border border-line bg-surface hover:bg-sunken text-ink-700 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
          >
            Maybe later
          </button>
          <button
            onClick={reviewOnAlertsPage}
            className="text-sm px-4 h-9 rounded-md bg-indigo text-white hover:bg-indigo-hover font-medium inline-flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
          >
            Review all
            <ChevronRight className="w-3.5 h-3.5" aria-hidden />
          </button>
        </footer>
      </div>
    </div>
  );
}
