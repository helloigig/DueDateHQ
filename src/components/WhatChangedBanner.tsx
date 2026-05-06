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
import { useAnnouncements } from "../hooks/useAnnouncements";

export function WhatChangedBanner() {
  const triageQuery = trpc.announcements.triageOnFirstLand.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  // Pull the full announcement list to resolve UNIQUE affected clients
  // across the triage items. Summing per-alert counts double-counts a
  // client when two alerts touch them (e.g. a NY LLC affected by both
  // the nexus rule and the penalty waiver). The /alerts header uses
  // unique clients too — keeping the same metric here avoids the demo
  // confusion of "24 clients" on Today vs "21 clients" on /alerts.
  const announcementsQuery = useAnnouncements({ activeOnly: true });

  const items = triageQuery.data ?? [];
  if (items.length === 0) return null;

  const triageIds = new Set(items.map((i) => i.id));
  const uniqueClientIds = new Set<string>();
  for (const a of announcementsQuery.data ?? []) {
    if (!triageIds.has(a.id)) continue;
    for (const cid of a.affectedClientIds) uniqueClientIds.add(cid);
  }
  const uniqueClientCount = uniqueClientIds.size;

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
            {uniqueClientCount > 0 && (
              <span className="text-ink-500 font-normal ml-1">
                ·{" "}
                {uniqueClientCount === 1
                  ? "1 client affected"
                  : `${uniqueClientCount} clients affected`}
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
