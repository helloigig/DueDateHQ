import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Sparkles, AlertTriangle, Check, ChevronRight } from "lucide-react";
import type { Announcement, Client, Deadline } from "../types";
import {
  TODAY,
  countdownLabel,
  daysBetween,
  hoursSince,
  parseDate,
} from "../data/dateHelpers";
import { actions } from "../data/store";
import { StateBadge } from "./ui/StateBadge";
import { useSetDeadlineStatus } from "../hooks/useDeadlines";
import { env } from "../config";
import { ClientChip } from "./ClientChip";

type PriorityItem =
  | {
      kind: "deadline";
      id: string;
      deadline: Deadline;
      client: Client;
      score: number;
      reason: string;
    }
  | {
      kind: "alert";
      id: string;
      alert: Announcement;
      score: number;
      reason: string;
    };

function score(d: Deadline, c: Client): { score: number; reason: string } {
  const days = daysBetween(TODAY, parseDate(d.officialDueDate));
  const multiState = (c.nexusStates?.length ?? 0) > 0;
  if (days < 0) {
    const daysLate = -days;
    return {
      score: Math.min(99, 90 + daysLate),
      reason: `Overdue by ${daysLate}d — penalty risk mounting`,
    };
  }
  if (days === 0) {
    return {
      score: multiState ? 89 : 85,
      reason: multiState ? "Due today · multi-state return" : "Due today",
    };
  }
  if (days <= 3) {
    return {
      score: multiState ? 78 : 72,
      reason: `Due in ${days}d${
        multiState ? " · multi-state filing needs extra runway" : ""
      }`,
    };
  }
  if (days <= 7) {
    return { score: 62, reason: `Due in ${days}d — prep window closing` };
  }
  return { score: 50, reason: `Due in ${days}d` };
}

export function PriorityCard({
  deadlines,
  clientsById,
  excludeIds,
  escalatedAlerts = [],
  onDismiss,
}: {
  deadlines: Deadline[];
  clientsById: Map<string, Client>;
  excludeIds?: Set<string>;
  escalatedAlerts?: Announcement[];
  onDismiss: () => void;
}) {
  const setStatusMut = useSetDeadlineStatus();
  const markComplete = (deadlineId: string) => {
    if (env.useMockData) {
      actions.setDeadlineStatus(deadlineId, "completed");
    } else {
      setStatusMut.mutate({ id: deadlineId, status: "completed" });
    }
  };
  const items: PriorityItem[] = useMemo(() => {
    const active = deadlines.filter(
      (d) =>
        d.status !== "completed" &&
        d.status !== "filed_extension" &&
        !(excludeIds && excludeIds.has(d.id))
    );
    const deadlineItems: PriorityItem[] = active
      .map((d) => {
        const c = clientsById.get(d.clientId);
        if (!c) return null;
        const { score: s, reason } = score(d, c);
        return {
          kind: "deadline" as const,
          id: d.id,
          deadline: d,
          client: c,
          score: s,
          reason,
        };
      })
      .filter((x): x is Extract<PriorityItem, { kind: "deadline" }> => x !== null);

    const alertItems: PriorityItem[] = escalatedAlerts.map((a) => {
      const hours = Math.round(hoursSince(a.detectedAt));
      return {
        kind: "alert" as const,
        id: a.id,
        alert: a,
        score: 92,
        reason: `Unactioned state alert · ${a.affectedClientIds.length} clients affected · ${hours}h old`,
      };
    });

    return [...alertItems, ...deadlineItems]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [deadlines, clientsById, excludeIds, escalatedAlerts]);

  if (items.length === 0) return null;

  return (
    <section className="bg-surface border border-line rounded-md overflow-hidden">
      <header className="px-4 py-3 border-b border-line">
        <div className="flex items-center">
          <Sparkles className="w-3.5 h-3.5 text-ink-500 mr-1.5" aria-hidden />
          <h2 className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
            You might be missing
          </h2>
          <button
            onClick={onDismiss}
            className="ml-auto text-xs text-ink-500 hover:text-ink-900"
          >
            Hide for today
          </button>
        </div>
        <p className="text-xs text-ink-500 mt-1">
          Higher-risk items beyond this week, ranked by penalty exposure.
        </p>
      </header>
      <ul>
        {items.map((item) =>
          item.kind === "alert" ? (
            <li
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0 hover:bg-sunken"
            >
              <ScoreIndicator value={item.score} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-danger-ink shrink-0" aria-hidden />
                  <StateBadge code={item.alert.stateCode} size="sm" />
                  <span className="text-sm font-medium text-ink-900 truncate">
                    {item.alert.title}
                  </span>
                </div>
                <div className="text-xs text-ink-500 truncate mt-0.5">
                  {item.reason}
                </div>
              </div>
              <Link
                to={`/alerts/${item.alert.id}`}
                className="text-sm font-medium px-2.5 py-1 rounded-md bg-indigo text-white hover:bg-indigo-hover flex items-center gap-1"
              >
                Review
                <ChevronRight className="w-3.5 h-3.5" aria-hidden />
              </Link>
            </li>
          ) : (
            <li
              key={item.id}
              className="group flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0 hover:bg-sunken"
            >
              <ScoreIndicator value={item.score} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <ClientChip
                    client={item.client}
                    size="sm"
                    as="link"
                    showState={false}
                  />
                  <span className="text-sm text-ink-700 truncate">
                    · {item.deadline.form}
                  </span>
                </div>
                <div className="text-xs text-ink-500 truncate mt-0.5">
                  {item.reason}
                </div>
              </div>
              <span className="text-xs font-medium text-ink-700 tabular-nums w-16 text-right shrink-0">
                {countdownLabel(item.deadline.officialDueDate)}
              </span>
              <button
                onClick={() => markComplete(item.deadline.id)}
                className="text-xs p-1.5 rounded bg-ok-bg text-ok-ink hover:bg-ok-border/40"
                aria-label="Mark complete"
                title="Mark complete"
              >
                <Check className="w-3.5 h-3.5" aria-hidden />
              </button>
            </li>
          )
        )}
      </ul>
    </section>
  );
}

function ScoreIndicator({ value }: { value: number }) {
  const isDanger = value >= 90;
  const cls = isDanger
    ? "bg-danger-bg text-danger-ink border border-danger-border"
    : "bg-sunken text-ink-900 border border-line";
  return (
    <div
      className={`flex items-center justify-center w-7 h-7 rounded text-2xs font-semibold tabular-nums shrink-0 ${cls}`}
      title={`Priority score: ${value}`}
    >
      {value}
    </div>
  );
}
