import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarGrid } from "../components/CalendarGrid";
import { PageContainer } from "../components/ui/PageContainer";
import { PageHeader } from "../components/ui/PageHeader";
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
        d.status !== "filed_extension",
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
    <PageContainer variant="wide" className="space-y-card">
      <PageHeader
        title="Calendar"
        meta="The shape of your month"
      />
      <p className="-mt-card mb-card text-sm text-ink-500 max-w-2xl">
        Every deadline plotted by day. Click a day to filter, click a pill to
        open the task.
      </p>
      {/* Metric row — gap-section between distinct metrics; bare numbers
          inline-tinted for danger / accent / neutral. No middle dots. */}
      <div className="flex items-baseline flex-wrap gap-x-section gap-y-1 tabular-nums text-sm">
        {stats.overdue > 0 && (
          <span className="text-danger-ink">
            <span className="font-semibold">{stats.overdue}</span>
            <span className="ml-1.5">overdue</span>
          </span>
        )}
        {stats.today > 0 && (
          <span>
            <span className="text-ink-900 font-semibold">{stats.today}</span>
            <span className="ml-1.5 text-ink-500">due today</span>
          </span>
        )}
        <span>
          <span className="text-ink-900 font-semibold">{stats.thisMonth}</span>
          <span className="ml-1.5 text-ink-500">this month</span>
        </span>
        <span>
          <span className="text-ink-900 font-semibold">{stats.total}</span>
          <span className="ml-1.5 text-ink-500">total open</span>
        </span>
      </div>

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
    </PageContainer>
  );
}
