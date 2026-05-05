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
import { Bell, X } from "lucide-react";
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-triage-title"
    >
      <div
        className="bg-surface rounded-lg shadow-xl border border-line max-w-[min(100vw-2rem,32rem)] w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-line flex items-center gap-3">
          <span className="w-8 h-8 rounded-md bg-warn-bg/60 flex items-center justify-center text-warn-ink shrink-0">
            <Bell className="w-4 h-4" aria-hidden />
          </span>
          <div className="flex-1 min-w-0">
            <h2
              id="alert-triage-title"
              className="text-base font-semibold text-ink-900"
            >
              {total === 1
                ? "1 new state alert since you were last here"
                : `${total} new state alerts since you were last here`}
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              {totalClients === 1
                ? "1 client affected across these alerts."
                : `${totalClients} clients affected across these alerts.`}
            </p>
          </div>
          <button
            onClick={close}
            className="text-ink-400 hover:text-ink-700"
            aria-label="Close"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </header>

        <ul className="divide-y divide-line max-h-[50vh] overflow-y-auto">
          {items.map((a) => (
            <li
              key={a.id}
              className="px-5 py-3 flex items-start gap-3 hover:bg-canvas cursor-pointer"
              onClick={() => {
                close();
                navigate(`/alerts/${a.id}`);
              }}
            >
              <span className="text-2xs font-mono font-semibold uppercase tracking-wider text-ink-500 mt-0.5 w-8 shrink-0">
                {a.stateCode}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink-900 leading-snug">{a.title}</p>
                <p className="text-2xs text-ink-500 mt-0.5">
                  {a.authority} ·{" "}
                  {a.affectedClientCount === 1
                    ? "1 client affected"
                    : `${a.affectedClientCount} clients affected`}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <footer className="px-5 py-3 bg-canvas border-t border-line flex items-center justify-end gap-2">
          <button
            onClick={close}
            className="text-sm px-3 py-1.5 rounded border border-line bg-surface hover:bg-canvas text-ink-700"
          >
            Maybe later
          </button>
          <button
            onClick={reviewOnAlertsPage}
            className="text-sm px-4 py-1.5 rounded bg-ink-900 text-white hover:opacity-90"
          >
            Review all →
          </button>
        </footer>
      </div>
    </div>
  );
}
