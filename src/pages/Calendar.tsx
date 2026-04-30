import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarGrid } from "../components/CalendarGrid";
import { useStore } from "../data/store";
import { TODAY } from "../data/dateHelpers";
import type { Deadline } from "../types";

/**
 * /calendar — the planning lens. Promoted from a bottom-of-dashboard
 * `<details>` collapsible to a dedicated route in the sidebar so CPAs who
 * think calendar-first don't have to scroll past the task list every
 * morning.
 *
 * Why a separate page (not just unfolding the dashboard widget):
 *   - Distinct mental mode — "shape of my month" vs "what's next"
 *   - Lets the calendar take full vertical space (the dashboard's
 *     constrained collapsible was always a compromise)
 *   - URL-addressable for cmd-clicking and bookmarking
 *
 * Stays read-only — clicking a day filters; clicking a pill opens the task.
 * No drag-to-reschedule yet (P2 surface; that lives behind a deadline
 * mutation API that doesn't exist).
 */
export function Calendar() {
  const { deadlines } = useStore();

  const stats = useMemo(() => {
    const open = deadlines.filter(
      (d) =>
        d.status !== "completed" &&
        d.status !== "filed_extension" &&
        d.status !== "deferred",
    );
    const todayIso = TODAY.toISOString().slice(0, 10);
    const overdue = open.filter((d: Deadline) => d.officialDueDate < todayIso);
    const today = open.filter((d) => d.officialDueDate === todayIso);
    const thisMonth = open.filter((d) => {
      const dd = new Date(d.officialDueDate);
      return (
        dd.getFullYear() === TODAY.getFullYear() &&
        dd.getMonth() === TODAY.getMonth()
      );
    });
    return {
      total: open.length,
      overdue: overdue.length,
      today: today.length,
      thisMonth: thisMonth.length,
    };
  }, [deadlines]);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Calendar</h1>
        <p className="text-sm text-ink-500 mt-2 max-w-2xl">
          The shape of your month — every deadline plotted by day. Click a day
          to filter, click a pill to open the task.
        </p>
        <p className="mt-3 text-sm text-ink-700 flex items-center flex-wrap gap-x-3 gap-y-1 tabular-nums">
          {stats.overdue > 0 && (
            <>
              <span className="text-danger-ink">
                <span className="font-semibold">{stats.overdue}</span> overdue
              </span>
              <span className="text-ink-300">·</span>
            </>
          )}
          {stats.today > 0 && (
            <>
              <span>
                <span className="text-ink-900 font-semibold">{stats.today}</span>{" "}
                <span className="text-ink-500">due today</span>
              </span>
              <span className="text-ink-300">·</span>
            </>
          )}
          <span>
            <span className="text-ink-900 font-semibold">{stats.thisMonth}</span>{" "}
            <span className="text-ink-500">this month</span>
          </span>
          <span className="text-ink-300">·</span>
          <span>
            <span className="text-ink-900 font-semibold">{stats.total}</span>{" "}
            <span className="text-ink-500">total open</span>
          </span>
        </p>
      </header>

      <div className="bg-surface border border-line rounded-md overflow-hidden">
        <CalendarGrid />
      </div>

      <p className="text-2xs text-ink-400">
        Need to push these into Google / Outlook / Apple Calendar?{" "}
        <Link to="/settings/integrations" className="underline">
          Connect a provider in Settings → Integrations
        </Link>
        .
      </p>
    </div>
  );
}
