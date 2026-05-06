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

import { Bell, ChevronRight, ArrowUpRight } from "lucide-react";
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

  // Two-tier composition. Top row: badge + headline + meta + Review-all
  // affordance. Bottom row: up to 3 alert peeks as inline pills, each a
  // deep-link to its dedicated alert detail. The pills are the
  // "headline of headlines" — same data as /alerts but rendered tight,
  // so the eye scans the names before deciding whether to enter.
  return (
    <section
      className="mb-card group bg-gradient-to-br from-warn-bg/70 via-warn-bg/55 to-warn-bg/40 border border-warn-border/70 rounded-md px-region py-region transition-shadow hover:shadow-pop"
      aria-label="What changed since your last visit"
    >
      {/* Headline row — eyebrow → bell tile → headline → counter → CTA */}
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="w-9 h-9 rounded-md bg-warn-bg border border-warn-border/60 flex items-center justify-center text-warn-ink shrink-0 shadow-[inset_0_-1px_0_rgba(154,59,18,0.06)]"
        >
          <Bell className="w-4 h-4" aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wider text-warn-ink/80">
            Since you were last here
          </p>
          <p className="text-sm text-ink-900 mt-0.5 leading-snug">
            <span className="font-semibold tabular-nums">{items.length}</span>
            <span className="font-medium ml-1">
              new state {items.length === 1 ? "alert" : "alerts"}
            </span>
            {totalClients > 0 && (
              <>
                <span className="text-ink-400 mx-1.5">·</span>
                <span className="text-ink-700 tabular-nums">{totalClients}</span>
                <span className="text-ink-500 ml-1">
                  {totalClients === 1 ? "client affected" : "clients affected"}
                </span>
              </>
            )}
          </p>
        </div>
        <Link
          to="/alerts"
          className="text-xs font-medium text-warn-ink hover:text-warn-ink/80 inline-flex items-center gap-1 shrink-0 px-2 h-7 rounded-md hover:bg-warn-bg/60 transition-colors"
        >
          Review all
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>

      {/* Mini-list — top 3 alert peeks as compact link pills below the
          headline. Hairline divider above keeps the two zones visually
          distinct without a heavy boundary. */}
      <ul className="mt-region pt-region border-t border-warn-border/40 flex flex-wrap items-center gap-1.5">
        {items.slice(0, 3).map((a) => (
          <li key={a.id}>
            <Link
              to={`/alerts/${a.id}`}
              className="group/pill inline-flex items-center gap-1.5 max-w-[26ch] sm:max-w-[36ch] h-7 px-2.5 rounded-md bg-surface/70 border border-warn-border/40 hover:bg-surface hover:border-warn-border/80 transition-colors"
              title={a.title}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-warn-ink tabular-nums">
                {a.stateCode}
              </span>
              <span className="text-xs text-ink-700 group-hover/pill:text-ink-900 truncate">
                {a.title}
              </span>
              <ArrowUpRight
                className="w-3 h-3 text-ink-400 group-hover/pill:text-warn-ink shrink-0 transition-colors"
                aria-hidden
              />
            </Link>
          </li>
        ))}
        {items.length > 3 && (
          <li className="text-2xs font-medium text-ink-500 pl-1">
            +{items.length - 3} more
          </li>
        )}
      </ul>
    </section>
  );
}
