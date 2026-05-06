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

  // Single-line ambient banner. Earlier version listed the first 3
  // alert names inline + "+N more"; that duplicated /alerts (the
  // destination of "Review all") and competed with the page's
  // <StateAlertsPreview> "Escalated alerts" section directly below.
  // Per Q5 / Q4 grouping discipline: one signal per concept. Banner
  // = "you have new ones, click here"; the section = the actual
  // triage surface.
  return (
    <Link
      to="/alerts"
      className="mb-card flex items-center gap-3 bg-warn-bg/60 border border-warn-border/70 rounded-md px-4 py-2.5 hover:bg-warn-bg/80 transition-colors group"
    >
      <span className="w-7 h-7 rounded-md bg-warn-bg flex items-center justify-center text-warn-ink shrink-0">
        <Bell className="w-3.5 h-3.5" aria-hidden />
      </span>
      <p className="flex-1 min-w-0 text-sm text-ink-900">
        <span className="font-medium">
          {items.length === 1
            ? "1 new state alert"
            : `${items.length} new state alerts`}
        </span>
        <span className="text-ink-500"> since you were last here</span>
        {totalClients > 0 && (
          <span className="text-ink-500">
            {" · "}
            {totalClients === 1
              ? "1 client affected"
              : `${totalClients} clients affected`}
          </span>
        )}
      </p>
      <span className="text-xs text-ink-700 group-hover:text-ink-900 inline-flex items-center gap-1 shrink-0">
        Review all
        <ChevronRight className="w-3 h-3" aria-hidden />
      </span>
    </Link>
  );
}
