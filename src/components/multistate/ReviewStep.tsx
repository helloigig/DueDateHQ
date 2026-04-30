import { findState } from "../../data/usStates";

interface DeadlinePreview {
  templateId: string;
  formType: string;
  jurisdiction: string;
  period: string;
  officialDueDate: string;
  adjustedDueDate: string;
}

interface Group {
  jurisdiction: string;
  templateCount: number;
  deadlineCount: number;
  deadlines: DeadlinePreview[];
}

/**
 * Review-before-commit step. Lists every deadline that will be created,
 * grouped by jurisdiction. Each row has a checkbox to exclude it from the
 * commit — directly addresses the Q6 anti-goal: "I don't want a deadline
 * for a state where this client doesn't actually file."
 */
export function ReviewStep({
  groups,
  isLoading,
  excluded,
  onToggleExclude,
  statesWithoutTemplates,
}: {
  /** Currently unused — reserved for cross-referencing picked vs. seeded
   *  states inline. Kept on the prop signature so callers don't break when
   *  Phase 1 wires it. */
  selected?: string[];
  groups: Group[];
  isLoading: boolean;
  excluded: string[];
  onToggleExclude: (templateId: string) => void;
  statesWithoutTemplates: string[];
}) {
  if (isLoading) {
    return (
      <div className="px-5 py-8 text-center">
        <div className="inline-block animate-pulse text-ink-400 text-sm">
          Computing deadlines…
        </div>
      </div>
    );
  }
  if (groups.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-sm text-ink-500">
          No deadlines to preview. Pick at least one state from the previous
          step.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      {statesWithoutTemplates.length > 0 && (
        <div className="mb-4 px-3 py-2 rounded border border-warn-border bg-warn-bg/40 text-xs text-warn-ink">
          <strong>Heads up:</strong> {statesWithoutTemplates.length} of your
          picks ({statesWithoutTemplates.map((s) => s.toUpperCase()).join(", ")})
          don't have seeded forms yet. Those states will be skipped — Phase 1
          adds full 50-state coverage.
        </div>
      )}
      <div className="space-y-5">
        {groups.map((g) => {
          const stateName =
            g.jurisdiction === "federal"
              ? "Federal"
              : findState(g.jurisdiction.toUpperCase())?.name ??
                g.jurisdiction.toUpperCase();
          return (
            <section key={g.jurisdiction}>
              <header className="flex items-baseline justify-between mb-2 pb-1 border-b border-line">
                <h3 className="text-sm font-semibold text-ink-900">
                  {stateName}
                </h3>
                <span className="text-2xs text-ink-500">
                  {g.deadlines.length} deadline
                  {g.deadlines.length === 1 ? "" : "s"}
                </span>
              </header>
              <ul className="space-y-1">
                {g.deadlines.map((d) => {
                  const isExcluded = excluded.includes(d.templateId);
                  return (
                    <li
                      key={`${d.templateId}-${d.period}`}
                      className={`flex items-center gap-3 px-3 py-2 rounded border ${
                        isExcluded
                          ? "border-line bg-sunken/30 opacity-60"
                          : "border-line bg-canvas"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!isExcluded}
                        onChange={() => onToggleExclude(d.templateId)}
                        className="w-3.5 h-3.5 accent-accent"
                        aria-label={`Include ${d.formType} ${d.period}`}
                      />
                      <span className="font-mono text-sm text-ink-900 w-28 truncate">
                        {d.formType}
                      </span>
                      <span className="text-2xs uppercase text-ink-400 w-16">
                        {d.period}
                      </span>
                      <span className="flex-1 text-xs text-ink-500">
                        Due {formatDate(d.adjustedDueDate)}
                      </span>
                      {isExcluded && (
                        <span className="text-2xs italic text-ink-400">
                          excluded
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Re-export for parents that need the type
export type { Group as MultiStatePreviewGroup };
