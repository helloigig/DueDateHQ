import { useMemo, useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  AlertTriangle,
  Mail,
  Sparkles,
  ArrowRight,
  Bell,
} from "lucide-react";
import { useStore, actions } from "../data/store";
import type {
  Announcement,
  ChecklistItem,
  Client,
  AiInsight,
  Task,
} from "../types";
import { TODAY, toIso } from "../data/dateHelpers";
import { useAllOpenInsights } from "../hooks/useAiInsights";
import { EmailDraftModal, type EmailDraftIntent } from "./EmailDraftModal";

/**
 * The single most-important surface of the redesign. Replaces "scroll the
 * calendar" as the dashboard hero with "make the decisions waiting on you,
 * in order." Each row is one decision, one keystroke, one context-preserving
 * action.
 *
 * Composition by urgency:
 *   1. Decisions waiting on the CPA (yellow zone): confirms + flag resolutions
 *   2. Today's outgoing: Mode B-timed reminders ready to send
 *   3. External signals: state alerts affecting clients (Pattern 3)
 *   4. Advisory opportunities: Mode E insights (Pattern 4)
 *
 * What it deliberately ISN'T: a calendar. Time-grouped deadlines live below
 * as a secondary "context" section the CPA scrolls to only when they need
 * the wide view.
 */

type QueueItem =
  | {
      kind: "decision_confirm";
      id: string;
      checklist: ChecklistItem;
      task: Task;
      client: Client;
      sortKey: number;
    }
  | {
      kind: "decision_flag";
      id: string;
      checklist: ChecklistItem;
      task: Task;
      client: Client;
      sortKey: number;
    }
  | {
      kind: "outgoing_reminder";
      id: string;
      checklist: ChecklistItem;
      task: Task;
      client: Client;
      sortKey: number;
    }
  | {
      kind: "alert";
      id: string;
      announcement: Announcement;
      sortKey: number;
    }
  | {
      kind: "insight";
      id: string;
      insight: AiInsight;
      client: Client;
      sortKey: number;
    };

interface Props {
  /** When defined, lets parent know the count for an empty-state. */
  onCountChange?: (n: number) => void;
}

type SectionKey = "decisions" | "outgoing" | "signals" | "advisory";

const CAP_COLLAPSED = 3;

export function TriageQueue({ onCountChange }: Props) {
  const navigate = useNavigate();
  const { checklistItems, tasks, clients, announcements } = useStore();
  const insights = useAllOpenInsights();
  const [emailIntent, setEmailIntent] = useState<EmailDraftIntent | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [expanded, setExpanded] = useState<Set<SectionKey>>(new Set());
  const queueRef = useRef<HTMLDivElement>(null);

  const items = useMemo<QueueItem[]>(() => {
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const clientById = new Map(clients.map((c) => [c.id, c]));
    const today = toIso(TODAY);
    const out: QueueItem[] = [];

    // 1) Yellow-zone confirm decisions (highest urgency)
    for (const ci of checklistItems) {
      if (ci.state !== "received_unreviewed") continue;
      const task = taskById.get(ci.taskId);
      if (!task) continue;
      const client = clientById.get(task.clientId);
      if (!client) continue;
      out.push({
        kind: "decision_confirm",
        id: `dc-${ci.id}`,
        checklist: ci,
        task,
        client,
        sortKey: 100,
      });
    }

    // 2) Yellow-zone flag-resolution decisions
    for (const ci of checklistItems) {
      if (ci.state !== "received_issue") continue;
      const task = taskById.get(ci.taskId);
      if (!task) continue;
      const client = clientById.get(task.clientId);
      if (!client) continue;
      const sevSort = ci.flagSeverity === "high" ? 90 : ci.flagSeverity === "medium" ? 92 : 94;
      out.push({
        kind: "decision_flag",
        id: `df-${ci.id}`,
        checklist: ci,
        task,
        client,
        sortKey: sevSort,
      });
    }

    // 3) Today's outgoing — items where nextReminderAt <= today
    for (const ci of checklistItems) {
      if (ci.state !== "requested_waiting") continue;
      if (!ci.nextReminderAt || ci.nextReminderAt > today) continue;
      const task = taskById.get(ci.taskId);
      if (!task) continue;
      const client = clientById.get(task.clientId);
      if (!client) continue;
      out.push({
        kind: "outgoing_reminder",
        id: `og-${ci.id}`,
        checklist: ci,
        task,
        client,
        sortKey: 80,
      });
    }

    // 4) State alerts affecting clients, undismissed
    for (const a of announcements) {
      if (a.dismissed) continue;
      if (a.affectedClientIds.length === 0) continue;
      out.push({
        kind: "alert",
        id: `al-${a.id}`,
        announcement: a,
        sortKey: a.read ? 60 : 70,
      });
    }

    // 5) Advisory opportunities (Mode E)
    for (const ins of insights) {
      const client = clientById.get(ins.clientId);
      if (!client) continue;
      out.push({
        kind: "insight",
        id: `in-${ins.id}`,
        insight: ins,
        client,
        sortKey: 50,
      });
    }

    out.sort((a, b) => b.sortKey - a.sortKey);
    return out;
  }, [checklistItems, tasks, clients, announcements, insights]);

  useEffect(() => {
    onCountChange?.(items.length);
  }, [items.length, onCountChange]);

  // Keyboard navigation: j/k or arrow up/down to move; Enter to act primary.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
      ) {
        return;
      }
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const it = items[activeIdx];
        if (it) primaryAction(it);
      } else if (e.key.toLowerCase() === "c") {
        const it = items[activeIdx];
        if (it && it.kind === "decision_confirm") {
          actions.setChecklistItemState(it.checklist.id, "received_confirmed", "cpa");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, activeIdx]);

  function primaryAction(it: QueueItem) {
    switch (it.kind) {
      case "decision_confirm":
        actions.setChecklistItemState(it.checklist.id, "received_confirmed", "cpa");
        break;
      case "decision_flag":
        navigate(`/clients/${it.client.id}/tasks/${it.task.id}`);
        break;
      case "outgoing_reminder":
        setEmailIntent({
          task: it.task,
          client: it.client,
          checklistItem: it.checklist,
        });
        break;
      case "alert":
        navigate(`/announcements/${it.announcement.id}`);
        break;
      case "insight":
        navigate(`/clients/${it.client.id}`);
        break;
    }
  }

  if (items.length === 0) {
    return (
      <section className="bg-surface border border-line rounded-md px-5 py-6 text-center">
        <Sparkles
          className="w-5 h-5 text-ink-400 mx-auto mb-2"
          aria-hidden
        />
        <p className="text-sm font-medium text-ink-900">
          Inbox zero — no decisions waiting.
        </p>
        <p className="text-xs text-ink-500 mt-1">
          AI is watching. We'll surface the next one when it arrives.
        </p>
      </section>
    );
  }

  return (
    <>
      <section
        ref={queueRef}
        className="bg-surface border border-line rounded-md overflow-hidden"
        aria-label="Today's focus"
      >
        <header className="flex items-baseline px-4 py-2.5 border-b border-line bg-sunken/40 gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-700">
            Today's focus
          </h2>
          <span className="text-2xs text-ink-500">
            The {Math.min(items.length, CAP_COLLAPSED * 4)} most urgent of {items.length}
          </span>
          <span className="ml-auto text-2xs text-ink-400 hidden sm:flex items-center gap-2">
            <kbd className="font-mono border border-line rounded px-1 py-0.5">j</kbd>
            <kbd className="font-mono border border-line rounded px-1 py-0.5">k</kbd>
            navigate
            <kbd className="font-mono border border-line rounded px-1 py-0.5">↵</kbd>
            act
          </span>
        </header>
        {(() => {
          const sections: Array<{ key: SectionKey; title: string; blurb: string; items: QueueItem[] }> = [
            {
              key: "decisions",
              title: "Decisions waiting on you",
              blurb:
                "Yellow zone — AI proposed, you approve. Confirm promotes to received_confirmed (the §5.3 invariant).",
              items: items.filter(
                (i) => i.kind === "decision_confirm" || i.kind === "decision_flag"
              ),
            },
            {
              key: "outgoing",
              title: "Today's outgoing",
              blurb:
                "Reminders Mode B says it's time to send. Each opens the AI draft modal — you review, you send.",
              items: items.filter((i) => i.kind === "outgoing_reminder"),
            },
            {
              key: "signals",
              title: "External signals",
              blurb:
                "State announcements affecting your portfolio. The wedge that gets the meeting (Pattern 3).",
              items: items.filter((i) => i.kind === "alert"),
            },
            {
              key: "advisory",
              title: "Advisory opportunities",
              blurb:
                "Mode E pattern recognition. The lever for moving from preparer to advisor (Pattern 4).",
              items: items.filter((i) => i.kind === "insight"),
            },
          ];

          let runningIdx = 0;
          return sections
            .filter((s) => s.items.length > 0)
            .map((s) => {
              const isExpanded = expanded.has(s.key);
              const visible = isExpanded ? s.items : s.items.slice(0, CAP_COLLAPSED);
              const sectionStartIdx = runningIdx;
              runningIdx += visible.length;
              return (
                <div key={s.key} className="border-b border-line last:border-b-0">
                  <header className="px-4 py-2 bg-sunken/30 flex items-baseline gap-2">
                    <h3 className="text-2xs uppercase tracking-wider text-ink-700 font-semibold">
                      {s.title}
                    </h3>
                    <span className="text-2xs text-ink-400">
                      {s.items.length}
                    </span>
                    <p className="text-2xs text-ink-500 italic ml-auto truncate max-w-md">
                      {s.blurb}
                    </p>
                  </header>
                  <ul className="divide-y divide-line">
                    {visible.map((it, localIdx) => {
                      const globalIdx = sectionStartIdx + localIdx;
                      return (
                        <QueueRow
                          key={it.id}
                          item={it}
                          active={globalIdx === activeIdx}
                          onActivate={() => setActiveIdx(globalIdx)}
                          onPrimary={() => primaryAction(it)}
                          onOpenEmail={(intent) => setEmailIntent(intent)}
                        />
                      );
                    })}
                  </ul>
                  {s.items.length > CAP_COLLAPSED && (
                    <button
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(s.key)) next.delete(s.key);
                          else next.add(s.key);
                          return next;
                        })
                      }
                      className="w-full text-left px-4 py-1.5 text-2xs text-ink-500 hover:bg-sunken/40 border-t border-line"
                    >
                      {isExpanded
                        ? `Show fewer`
                        : `Show ${s.items.length - CAP_COLLAPSED} more`}
                    </button>
                  )}
                </div>
              );
            });
        })()}
        <footer className="px-4 py-1.5 border-t border-line bg-sunken/20 text-2xs text-ink-400 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-warn-solid" />
          Yellow zone — AI proposes, you approve. PRD §4.5.
          <span className="ml-auto">
            Median triage target: 3-5 min · PRD §12.5
          </span>
        </footer>
      </section>

      <EmailDraftModal
        open={!!emailIntent}
        intent={emailIntent}
        onClose={() => setEmailIntent(null)}
      />
    </>
  );
}

function QueueRow({
  item,
  active,
  onActivate,
  onPrimary,
  onOpenEmail,
}: {
  item: QueueItem;
  active: boolean;
  onActivate: () => void;
  onPrimary: () => void;
  onOpenEmail: (intent: EmailDraftIntent) => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const tone = toneFor(item.kind);
  const accent = tone === "yellow" ? "border-l-warn-solid" : tone === "info" ? "border-l-info-solid" : "border-l-line";

  return (
    <li
      ref={ref}
      onMouseEnter={onActivate}
      className={[
        "ddhq-row-transition border-l-2",
        accent,
        active ? "bg-sunken/60" : "hover:bg-sunken/30",
      ].join(" ")}
    >
      <div className="flex items-start gap-3 px-4 py-2.5">
        <KindIcon kind={item.kind} />
        <div className="flex-1 min-w-0">
          <PrimaryLine item={item} />
          <ContextLine item={item} />
        </div>
        <PrimaryAction
          item={item}
          onPrimary={onPrimary}
          onOpenEmail={onOpenEmail}
        />
      </div>
    </li>
  );
}

function toneFor(kind: QueueItem["kind"]): "yellow" | "info" | "neutral" {
  if (kind === "decision_confirm" || kind === "decision_flag") return "yellow";
  if (kind === "outgoing_reminder") return "yellow";
  if (kind === "alert") return "info";
  if (kind === "insight") return "info";
  return "neutral";
}

function KindIcon({ kind }: { kind: QueueItem["kind"] }) {
  const Icon =
    kind === "decision_confirm"
      ? Check
      : kind === "decision_flag"
      ? AlertTriangle
      : kind === "outgoing_reminder"
      ? Mail
      : kind === "alert"
      ? Bell
      : Sparkles;
  const wrap =
    kind === "decision_confirm"
      ? "bg-warn-bg border border-warn-border text-warn-ink"
      : kind === "decision_flag"
      ? "bg-warn-bg border border-warn-border text-warn-ink"
      : kind === "outgoing_reminder"
      ? "bg-info-bg border border-info-border text-info-ink"
      : kind === "alert"
      ? "bg-danger-bg border border-danger-border text-danger-ink"
      : "bg-sunken border border-line text-ink-700";
  return (
    <span
      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${wrap}`}
    >
      <Icon className="w-3 h-3" aria-hidden />
    </span>
  );
}

function PrimaryLine({ item }: { item: QueueItem }) {
  switch (item.kind) {
    case "decision_confirm":
      return (
        <p className="text-sm text-ink-900">
          <span className="font-medium">{item.client.name}</span>
          <span className="text-ink-400"> · </span>
          Confirm <span className="font-medium">{item.checklist.label}</span>
          {item.checklist.aiClassification && (
            <span className="text-ink-500">
              {" "}— AI thinks {item.checklist.aiClassification.toLowerCase()}
            </span>
          )}
        </p>
      );
    case "decision_flag":
      return (
        <p className="text-sm text-ink-900">
          <span className="font-medium">{item.client.name}</span>
          <span className="text-ink-400"> · </span>
          Resolve flag on <span className="font-medium">{item.checklist.label}</span>
        </p>
      );
    case "outgoing_reminder":
      return (
        <p className="text-sm text-ink-900">
          Send reminder to <span className="font-medium">{item.client.name}</span>
          <span className="text-ink-400"> for </span>
          <span className="font-medium">{item.checklist.label}</span>
        </p>
      );
    case "alert":
      return (
        <p className="text-sm text-ink-900">
          <span className="font-medium">
            {item.announcement.stateCode}: {item.announcement.title}
          </span>
        </p>
      );
    case "insight":
      return (
        <p className="text-sm text-ink-900">
          <span className="font-medium">{item.client.name}</span>
          <span className="text-ink-400"> · </span>
          {item.insight.title}
        </p>
      );
  }
}

function ContextLine({ item }: { item: QueueItem }) {
  switch (item.kind) {
    case "decision_confirm":
      return (
        <p className="text-xs text-ink-500 mt-0.5 flex items-center gap-1.5">
          <span>
            {item.task.formType} · received{" "}
            {item.checklist.receivedAt?.slice(0, 10) ?? "today"}
          </span>
          {item.checklist.aiConfidence && (
            <span className="text-2xs uppercase tracking-wide px-1 rounded bg-sunken text-ink-700">
              AI {item.checklist.aiConfidence}
            </span>
          )}
        </p>
      );
    case "decision_flag":
      return (
        <p className="text-xs text-warn-ink mt-0.5">
          {item.checklist.flagReason}
        </p>
      );
    case "outgoing_reminder":
      return (
        <p className="text-xs text-ink-500 mt-0.5">
          {item.task.formType} due {item.task.officialDueDate}
          {item.checklist.lastReminderAt && (
            <>
              {" · "}last sent {item.checklist.lastReminderAt}
            </>
          )}
        </p>
      );
    case "alert":
      return (
        <p className="text-xs text-ink-500 mt-0.5">
          {item.announcement.affectedClientIds.length} affected · {item.announcement.authority}
        </p>
      );
    case "insight":
      return (
        <p className="text-xs text-ink-500 mt-0.5 line-clamp-1">
          {item.insight.detail}
        </p>
      );
  }
}

function PrimaryAction({
  item,
  onPrimary,
  onOpenEmail,
}: {
  item: QueueItem;
  onPrimary: () => void;
  onOpenEmail: (intent: EmailDraftIntent) => void;
}) {
  const yellowBtn =
    "text-xs px-3 py-1.5 rounded bg-warn-solid text-canvas hover:bg-warn-ink transition-colors flex items-center gap-1";
  const accentBtn =
    "text-xs px-3 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover transition-colors flex items-center gap-1";
  const ghost =
    "text-xs px-2 py-1.5 rounded text-ink-500 hover:bg-sunken hover:text-ink-900";

  switch (item.kind) {
    case "decision_confirm":
      return (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrimary();
            }}
            className={yellowBtn}
            title="Promote to received_confirmed (only the CPA can do this — PRD §5.3)"
          >
            <Check className="w-3 h-3" aria-hidden /> Confirm
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              actions.setChecklistItemState(
                item.checklist.id,
                "requested_waiting",
                "cpa"
              );
            }}
            className={ghost}
          >
            Reject
          </button>
        </div>
      );
    case "decision_flag":
      return (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              actions.setChecklistItemState(
                item.checklist.id,
                "received_confirmed",
                "cpa"
              );
            }}
            className={yellowBtn}
          >
            <Check className="w-3 h-3" aria-hidden /> Confirm anyway
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenEmail({
                task: item.task,
                client: item.client,
                checklistItem: item.checklist,
                context: `I wanted to confirm something on the ${item.checklist.label} you sent: ${item.checklist.flagReason ?? ""}`,
              });
            }}
            className={accentBtn}
          >
            <Mail className="w-3 h-3" aria-hidden /> Ask client
          </button>
        </div>
      );
    case "outgoing_reminder":
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenEmail({
              task: item.task,
              client: item.client,
              checklistItem: item.checklist,
            });
          }}
          className={accentBtn}
        >
          <Mail className="w-3 h-3" aria-hidden /> Send
        </button>
      );
    case "alert":
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrimary();
          }}
          className="text-xs px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-sunken transition-colors flex items-center gap-1"
        >
          Review <ArrowRight className="w-3 h-3" aria-hidden />
        </button>
      );
    case "insight":
      return (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrimary();
            }}
            className="text-xs px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-sunken transition-colors flex items-center gap-1"
          >
            Open <ArrowRight className="w-3 h-3" aria-hidden />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              actions.resolveInsight(item.insight.id, "snooze");
            }}
            className={ghost}
            title="Snooze 30 days"
          >
            Snooze
          </button>
        </div>
      );
  }
}

