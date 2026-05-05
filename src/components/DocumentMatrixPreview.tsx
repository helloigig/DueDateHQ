import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { useStore } from "../data/store";
import { useImportedFactsForClient } from "../hooks/useAiInsights";
import { useTasksForClient } from "../hooks/useTasks";

/**
 * Compact preview of the document longitudinal table — 4 most-active
 * doc types × current + 2 prior years. Surfaced on the default Tasks
 * tab so the multi-year lens is visible without forcing a tab click.
 *
 * Critique context: the full DocumentMatrix on the Documents tab is one
 * of the strongest IA ideas in this product (rows = doc types, cols =
 * years), but it was buried. This preview brings the value forward
 * while keeping the full view as the deep-dive destination.
 *
 * Hidden when there's no longitudinal data (no prior facts and no
 * checklist items). The full view's empty state (Connect QBO / upload
 * prior return) covers cold-start.
 */
export function DocumentMatrixPreview({
  clientId,
  onOpenFull,
}: {
  clientId: string;
  onOpenFull: () => void;
}) {
  const facts = useImportedFactsForClient(clientId);
  const tasks = useTasksForClient(clientId);
  const checklistsByTaskId = useStore().checklistItems;
  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => [currentYear, currentYear - 1, currentYear - 2],
    [currentYear],
  );

  // Pull all doc types seen across prior facts + current task checklists,
  // ranked by frequency so the busiest types lead.
  const types = useMemo(() => {
    const counts = new Map<string, { label: string; n: number }>();
    for (const f of facts) {
      const cur = counts.get(f.itemType) ?? {
        label: f.itemType.replace(/_/g, " "),
        n: 0,
      };
      cur.n++;
      counts.set(f.itemType, cur);
    }
    for (const ci of checklistsByTaskId) {
      if (!tasks.some((t) => t.id === ci.taskId)) continue;
      const cur = counts.get(ci.itemType) ?? { label: ci.label, n: 0 };
      cur.n++;
      counts.set(ci.itemType, cur);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 4)
      .map(([itemType, v]) => ({ itemType, label: v.label }));
  }, [facts, checklistsByTaskId, tasks]);

  if (types.length === 0) return null;

  function cellFor(itemType: string, year: number): "received" | "missing" | "current" {
    if (year === currentYear) {
      const has = checklistsByTaskId.some(
        (ci) =>
          ci.itemType === itemType &&
          tasks.some((t) => t.id === ci.taskId) &&
          (ci.state === "received_confirmed" ||
            ci.state === "received_unreviewed" ||
            ci.state === "received_issue"),
      );
      return has ? "current" : "missing";
    }
    const had = facts.some((f) => f.itemType === itemType && f.year === year);
    return had ? "received" : "missing";
  }

  // Detect a possible gap to surface in the subtitle: a doc that came
  // in last year but hasn't this year. cross-year-insighter's small wedge.
  const gapType = useMemo(() => {
    for (const t of types) {
      if (
        cellFor(t.itemType, currentYear - 1) === "received" &&
        cellFor(t.itemType, currentYear) === "missing"
      ) {
        return t.label;
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types, facts, checklistsByTaskId]);

  return (
    <section className="bg-surface border border-line rounded-md overflow-hidden">
      <header className="px-4 py-2.5 border-b border-line bg-sunken/30 flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-700">
          Documents — last 3 years
        </h3>
        <button
          onClick={onOpenFull}
          className="ml-auto text-2xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-0.5"
        >
          Open full view
          <ArrowRight className="w-2.5 h-2.5" aria-hidden />
        </button>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-canvas">
            <tr>
              <th className="text-left px-4 py-1.5 text-2xs uppercase tracking-wider text-ink-500 font-semibold w-2/5">
                Document
              </th>
              {years.map((y) => (
                <th
                  key={y}
                  className="text-center px-3 py-1.5 text-2xs uppercase tracking-wider text-ink-500 font-semibold tabular-nums"
                >
                  {y === currentYear ? `${y} ·` : y}
                  {y === currentYear && (
                    <span className="ml-1 text-info-ink">now</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {types.map(({ itemType, label }) => (
              <tr key={itemType}>
                <td className="px-4 py-1.5 text-xs text-ink-900 capitalize">
                  {label}
                </td>
                {years.map((y) => {
                  const c = cellFor(itemType, y);
                  return (
                    <td
                      key={y}
                      className="px-3 py-1.5 text-center"
                      title={
                        c === "received"
                          ? "Received in this prior year"
                          : c === "current"
                            ? "Received this year"
                            : "Missing"
                      }
                    >
                      {c === "received" && (
                        <span className="text-ok-ink">●</span>
                      )}
                      {c === "current" && (
                        <span className="text-info-ink">●</span>
                      )}
                      {c === "missing" && (
                        <span className="text-ink-300">○</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {gapType && (
        <p className="px-4 py-2 text-2xs text-warn-ink bg-warn-bg/30 border-t border-line">
          <span className="font-medium">Cross-year signal:</span> {gapType} came
          in last year but not yet this year.
        </p>
      )}
    </section>
  );
}
