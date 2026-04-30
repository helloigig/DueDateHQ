import { Sparkles, Snowflake, Calendar, Bell, X, AlertTriangle } from "lucide-react";
import type {
  AiInsight,
  ChecklistItem,
  Client,
  ImportedFact,
  Task,
} from "../types";
import { arrivalTiming, crossYearInsights } from "../lib/ai-stub";
import { actions } from "../data/store";
import { trpc } from "../lib/api/client";

interface Props {
  task?: Task;
  client: Client;
  checklistItems: ChecklistItem[];
  facts: ImportedFact[];
  insights: AiInsight[];
  /** Opens the email modal pre-filled with the question for an insight. */
  onAskClient: (insightId: string) => void;
}

/**
 * Right rail on Task detail; collapsible section on Client detail. Surfaces
 * Mode B (per-client timing), Mode C aggregated (last year's issues), and
 * Mode E (cross-year cards). Cold-start fallback per PRD §4.2 when there's
 * no ImportedFact history.
 */
export function AiInsightsPanel({
  task,
  client,
  checklistItems,
  facts,
  insights,
  onAskClient,
}: Props) {
  const hasHistory = facts.length > 0;
  const openInsights = insights.filter((i) => i.status === "open");
  // Cross-fact consistency — Mode C-style flags when same fact has multiple
  // sources with disagreeing values (PRD §9.6 v0.8 amendment). Renders below
  // cross-year insights as its own section.
  const consistencyQuery = trpc.imports.factConsistency.useQuery({
    clientId: client.id,
  });
  const consistencyFlags = consistencyQuery.data?.flags ?? [];

  const taskItemTypes = task
    ? Array.from(
        new Set(checklistItems.filter((c) => c.taskId === task.id).map((c) => c.itemType))
      )
    : [];
  const timingPreds = task
    ? taskItemTypes
        .map((it) => ({
          itemType: it,
          pred: arrivalTiming(client.id, it, facts),
        }))
        .filter((x) => x.pred.source === "history")
    : [];

  const crossYear = task ? crossYearInsights(client.id, checklistItems, facts) : [];

  return (
    <aside className="bg-surface border border-line rounded-md overflow-hidden">
      <header className="flex items-center px-4 py-3 border-b border-line bg-sunken/40">
        <Sparkles className="w-3.5 h-3.5 text-ink-500 mr-1.5" aria-hidden />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-700">
          AI insights
        </h2>
        <span className="ml-auto text-2xs text-ink-400">
          Mode B · C · E
        </span>
      </header>

      {/* Cross-fact consistency — Mode C flags */}
      {consistencyFlags.length > 0 && (
        <div className="border-b border-line">
          <SectionTitle>Fact consistency (Mode C)</SectionTitle>
          <ul className="divide-y divide-line">
            {consistencyFlags.map((flag, i) => (
              <li
                key={`${flag.factType}-${flag.taxYear}-${i}`}
                className={
                  flag.severity === "high"
                    ? "px-4 py-3 bg-danger-bg/30"
                    : flag.severity === "medium"
                      ? "px-4 py-3 bg-warning-bg/30"
                      : "px-4 py-3"
                }
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                      flag.severity === "high"
                        ? "text-danger-solid"
                        : "text-warning-solid"
                    }`}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-900">
                      {flag.factType.replace(/_/g, " ")}{" "}
                      <span className="text-ink-500 font-normal">
                        · TY {flag.taxYear}
                      </span>
                    </p>
                    <p className="text-xs text-ink-700 mt-0.5">{flag.reason}</p>
                    <ul className="mt-2 space-y-1 text-2xs text-ink-500">
                      {flag.values.map((v) => (
                        <li
                          key={v.factId}
                          className="flex items-baseline gap-2"
                        >
                          <span className="font-mono tabular-nums text-ink-700">
                            {Array.isArray(v.value)
                              ? `[${(v.value as string[]).join(", ")}]`
                              : typeof v.value === "number"
                                ? `$${v.value.toLocaleString()}`
                                : String(v.value)}
                          </span>
                          <span className="text-ink-400">
                            from {v.sourceGmailMessageId ?? "(unknown source)"} · {v.confidence}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasHistory && (
        <div className="px-4 py-4 text-xs text-ink-500 bg-info-bg border-b border-info-border">
          <p className="text-info-ink font-medium">Substrate-only mode</p>
          <p className="mt-1">
            Personalized predictions unlock once you import a prior-year return
            for {client.name}. The dashboard widget below the activity timeline
            walks you through the layered import.
          </p>
        </div>
      )}

      {/* Mode E — cross-year insights */}
      {openInsights.length > 0 && (
        <div className="border-b border-line">
          <SectionTitle>Cross-year (Mode E)</SectionTitle>
          <ul className="divide-y divide-line">
            {openInsights.map((insight) => (
              <li key={insight.id} className="px-4 py-3">
                <p className="text-sm font-medium text-ink-900">
                  {insight.title}
                </p>
                <p className="text-xs text-ink-500 mt-1">{insight.detail}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {insight.actions.includes("ask_client") && (
                    <ActionChip
                      icon={<Bell className="w-3 h-3" aria-hidden />}
                      onClick={() => onAskClient(insight.id)}
                    >
                      Ask client
                    </ActionChip>
                  )}
                  {insight.actions.includes("schedule_advisory") && (
                    <ActionChip
                      icon={<Calendar className="w-3 h-3" aria-hidden />}
                      onClick={() =>
                        actions.resolveInsight(insight.id, "schedule_advisory")
                      }
                    >
                      Schedule advisory
                    </ActionChip>
                  )}
                  {insight.actions.includes("mark_known") && (
                    <ActionChip
                      onClick={() =>
                        actions.resolveInsight(insight.id, "mark_known")
                      }
                    >
                      Mark known
                    </ActionChip>
                  )}
                  {insight.actions.includes("snooze") && (
                    <ActionChip
                      icon={<Snowflake className="w-3 h-3" aria-hidden />}
                      onClick={() =>
                        actions.resolveInsight(insight.id, "snooze")
                      }
                    >
                      Snooze
                    </ActionChip>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mode B — per-client timing */}
      {timingPreds.length > 0 && (
        <div className="border-b border-line">
          <SectionTitle>Arrival timing (Mode B)</SectionTitle>
          <ul className="divide-y divide-line">
            {timingPreds.slice(0, 5).map((t) => (
              <li key={t.itemType} className="px-4 py-2.5 text-xs text-ink-700">
                <p>
                  <span className="font-medium capitalize">
                    {t.itemType.replace(/_/g, " ")}
                  </span>
                </p>
                <p className="text-ink-500 mt-0.5">{t.pred.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mode E — cross-year missing patterns */}
      {crossYear.length > 0 && (
        <div className="border-b border-line">
          <SectionTitle>Missing this year (Mode E)</SectionTitle>
          <ul className="divide-y divide-line">
            {crossYear.slice(0, 4).map((c) => (
              <li key={c.itemType} className="px-4 py-2.5">
                <p className="text-xs font-medium text-ink-900 capitalize">
                  {c.itemType.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-ink-500 mt-0.5">{c.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {openInsights.length === 0 && timingPreds.length === 0 && crossYear.length === 0 && (
        <div className="px-4 py-5 text-xs text-ink-500">
          No insights to surface yet for this {task ? "task" : "client"}.
        </div>
      )}

      <footer className="px-4 py-2 text-2xs text-ink-400 bg-sunken/40 flex items-center gap-1">
        <X className="w-2.5 h-2.5" aria-hidden /> AI never decides — it
        surfaces.
      </footer>
    </aside>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-2xs uppercase tracking-wider text-ink-500 px-4 py-2 bg-sunken/30 border-b border-line">
      {children}
    </h3>
  );
}

function ActionChip({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-2xs uppercase tracking-wide px-2 py-0.5 rounded border border-line text-ink-700 hover:bg-sunken inline-flex items-center gap-1"
    >
      {icon}
      {children}
    </button>
  );
}
