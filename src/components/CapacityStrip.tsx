import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, TrendingUp } from "lucide-react";
import { useStore } from "../data/store";
import { useSession } from "../data/session";
import { TODAY, parseDate, daysBetween } from "../data/dateHelpers";

/**
 * Capacity-planning strip on the Dashboard.
 *
 * Visible only for firms with ≥3 active staff (Yan-Jing scale). For Sarah
 * with 49 clients and one preparer, capacity planning is solved by
 * "look at the calendar" — surfacing it daily would be noise. For Yan
 * with 600 clients across 4 staff, capacity is the work.
 *
 * Three signals, calmest first:
 *   1. Per-staff load (open tasks per assignee, color by relative load)
 *   2. Imbalance — flagged when one preparer has >40% more load than median
 *   3. Forecast — peak-month overload (only shown when overdue + 7-day load
 *      exceed the firm's working-day budget)
 *
 * The full capacity dashboard lives at /opportunities → Capacity. This is
 * the daily-glance version.
 */
export function CapacityStrip() {
  const session = useSession();
  const { tasks } = useStore();

  const stats = useMemo(() => {
    const open = tasks.filter(
      (t) => t.status !== "completed" && t.status !== "filed_extension",
    );
    // Group by assignee
    const byStaff = new Map<string, number>();
    for (const t of open) {
      const who = t.assignedUser ?? "Unassigned";
      byStaff.set(who, (byStaff.get(who) ?? 0) + 1);
    }
    const staffEntries = [...byStaff.entries()].sort((a, b) => b[1] - a[1]);
    // Imbalance signal — peak vs median
    const counts = staffEntries.map(([, n]) => n);
    const median = counts.length
      ? counts.sort((a, b) => a - b)[Math.floor(counts.length / 2)]!
      : 0;
    const peak = staffEntries[0]?.[1] ?? 0;
    const imbalanced = median > 0 && peak > median * 1.4;
    // 7-day load — tasks with internal target ≤ 7 days
    const sevenDay = open.filter((t) => {
      const d = daysBetween(TODAY, parseDate(t.officialDueDate));
      return d >= 0 && d <= 7;
    }).length;
    const overdue = open.filter(
      (t) => daysBetween(TODAY, parseDate(t.officialDueDate)) < 0,
    ).length;
    // Crude budget — assume 5 tasks/day/staff for a senior preparer.
    // Real production reads firms.capacity_budget and per-staff overrides.
    const dailyBudget = staffEntries.length * 5;
    const sevenDayBudget = dailyBudget * 5; // 5 working days
    const overloaded = sevenDay + overdue > sevenDayBudget;

    return {
      staffCount: staffEntries.length,
      staffEntries,
      median,
      peak,
      imbalanced,
      sevenDay,
      overdue,
      sevenDayBudget,
      overloaded,
    };
  }, [tasks]);

  // Only surface for ≥3-staff firms. Below that, the calendar is enough.
  // Solo / 2-person firms see this exact data on /opportunities if they
  // want it, but it doesn't earn a daily slot.
  if (stats.staffCount < 3) return null;
  // Tier check too — Solo plan never sees this.
  if (session?.tier === "solo") return null;

  return (
    <section
      className="bg-surface border border-line rounded-md overflow-hidden"
      aria-label="Capacity at a glance"
    >
      <header className="px-4 py-2.5 border-b border-line bg-sunken/40 flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-ink-700" aria-hidden />
        <h2 className="text-sm font-semibold text-ink-900">
          Capacity this week
        </h2>
        <Link
          to="/opportunities#capacity"
          className="ml-auto text-2xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-0.5"
        >
          Full forecast
          <ArrowRight className="w-2.5 h-2.5" aria-hidden />
        </Link>
      </header>

      <div className="px-4 py-3 space-y-2.5">
        {/* Overload alert — most urgent signal, first */}
        {stats.overloaded && (
          <div className="flex items-start gap-2 bg-warn-bg/60 border border-warn-border rounded px-2.5 py-1.5">
            <AlertTriangle
              className="w-3.5 h-3.5 text-warn-ink shrink-0 mt-0.5"
              aria-hidden
            />
            <p className="text-xs text-warn-ink">
              <span className="font-semibold">
                {stats.sevenDay + stats.overdue} tasks
              </span>{" "}
              due in 7 days vs ~{stats.sevenDayBudget}-task working budget.
              Consider reassigning or filing extensions on the bottom-priority
              third.
            </p>
          </div>
        )}

        {/* Per-staff load strip — horizontal bars, fastest visual scan
            for "who's overloaded right now" */}
        <ul className="space-y-1">
          {stats.staffEntries.slice(0, 6).map(([staff, n]) => {
            const ratio = stats.peak > 0 ? n / stats.peak : 0;
            const isHot = stats.imbalanced && n === stats.peak;
            return (
              <li
                key={staff}
                className="flex items-center gap-2 text-2xs tabular-nums"
              >
                <span
                  className={[
                    "w-24 truncate font-medium",
                    isHot ? "text-warn-ink" : "text-ink-700",
                  ].join(" ")}
                >
                  {staff}
                </span>
                <div className="flex-1 h-1.5 bg-sunken rounded-full overflow-hidden">
                  <div
                    className={[
                      "h-full rounded-full",
                      isHot ? "bg-warn-solid" : "bg-ink-700",
                    ].join(" ")}
                    style={{ width: `${Math.max(4, ratio * 100)}%` }}
                  />
                </div>
                <span className="text-ink-500 w-12 text-right">{n} open</span>
              </li>
            );
          })}
        </ul>

        {stats.imbalanced && !stats.overloaded && (
          <p className="text-2xs text-ink-500">
            Load is uneven — peak is {Math.round((stats.peak / stats.median - 1) * 100)}
            % above median.{" "}
            <Link
              to="/to-review"
              className="underline hover:text-ink-900"
            >
              Open To review with a staff filter
            </Link>{" "}
            to redistribute.
          </p>
        )}
      </div>
    </section>
  );
}
