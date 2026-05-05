/**
 * "What changed since you were last here" — banner that surfaces above
 * the action queue when there are state alerts the user hasn't seen yet.
 *
 * Same data source as `<AlertTriageModal>` (`announcements.triageOnFirstLand`)
 * but rendered as an inline banner rather than a foreground modal:
 *
 *   - Modal: blocks the page, demands attention. Can be disabled.
 *   - Banner: doesn't block, persists across the session, dismissible
 *             by clicking through to /alerts or expanding inline.
 *
 * The banner is the always-on baseline. The modal is the louder
 * variant for users who want the morning-briefing interruption. Even
 * with the modal disabled in Settings, this banner still surfaces
 * the urgency on every visit until the user dismisses or reads each
 * alert.
 *
 * Hides when the payload is empty (zero new alerts since last visit).
 */

import { Bell, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/api/client";

export function WhatChangedBanner() {
  const triageQuery = trpc.announcements.triageOnFirstLand.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const items = triageQuery.data ?? [];
  if (items.length === 0) return null;

  const totalClients = items.reduce(
    (acc, i) => acc + i.affectedClientCount,
    0,
  );

  return (
    <div className="mb-card bg-warn-bg/40 border border-warn-border/60 rounded-md px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="w-7 h-7 rounded-md bg-warn-bg flex items-center justify-center text-warn-ink shrink-0">
          <Bell className="w-3.5 h-3.5" aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ink-900 font-medium">
            {items.length === 1
              ? "1 new state alert since you were last here"
              : `${items.length} new state alerts since you were last here`}
            {totalClients > 0 && (
              <span className="text-ink-500 font-normal ml-1">
                ·{" "}
                {totalClients === 1
                  ? "1 client affected"
                  : `${totalClients} clients affected`}
              </span>
            )}
          </p>
          <ul className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-700">
            {items.slice(0, 3).map((a) => (
              <li key={a.id} className="flex items-center gap-1.5">
                <Link
                  to={`/alerts/${a.id}`}
                  className="hover:text-ink-900 hover:underline"
                >
                  <span className="font-mono font-semibold uppercase tracking-wider text-ink-500 mr-1">
                    {a.stateCode}
                  </span>
                  <span>{a.title}</span>
                </Link>
              </li>
            ))}
            {items.length > 3 && (
              <li className="text-ink-500">+ {items.length - 3} more</li>
            )}
          </ul>
        </div>
        <Link
          to="/alerts"
          className="text-xs text-ink-700 hover:text-ink-900 inline-flex items-center gap-1 shrink-0"
        >
          Review all
          <ChevronRight className="w-3 h-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
