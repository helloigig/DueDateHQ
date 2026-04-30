import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Mail,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { useStore } from "../data/store";
import { confirmWithUndo } from "../lib/confirmWithUndo";
import { useAllOpenInsights } from "../hooks/useAiInsights";
import { TODAY, toIso } from "../data/dateHelpers";
import { EmailDraftModal, type EmailDraftIntent } from "./EmailDraftModal";

/**
 * The dashboard hero — re-organized around what actually blocks the CPA's
 * day, not the calendar. Three cards in priority order:
 *
 *   1. Decisions waiting — yellow-zone resolution (highest urgency)
 *   2. Documents to confirm — Mode A inbound classifications pending CPA
 *      approval (the §5.3 invariant moment)
 *   3. Chase ready to send — Mode B says it's time to follow up with these
 *      clients
 *
 * Each card shows top 3 items inline + a deep-link to its full inbox.
 * Bulk lives in /inbox; the dashboard never tries to be the bulk surface.
 */

export function ChaseLoopStatus() {
  const navigate = useNavigate();
  const { checklistItems, tasks, clients } = useStore();
  const insights = useAllOpenInsights();
  const today = toIso(TODAY);
  const [emailIntent, setEmailIntent] = useState<EmailDraftIntent | null>(null);

  const taskById = useMemo(
    () => new Map(tasks.map((t) => [t.id, t])),
    [tasks]
  );
  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients]
  );

  // 1. Decisions: AI flags (received_issue) + Mode E insights (unresolved)
  const decisions = useMemo(() => {
    const flagged = checklistItems
      .filter((c) => c.state === "received_issue")
      .map((c) => ({ kind: "flag" as const, item: c }));
    const advisory = insights.map((i) => ({ kind: "insight" as const, insight: i }));
    return [...flagged, ...advisory];
  }, [checklistItems, insights]);

  // 2. Confirms: received_unreviewed
  const confirms = useMemo(
    () => checklistItems.filter((c) => c.state === "received_unreviewed"),
    [checklistItems]
  );

  // 3. Chase: requested_waiting items whose nextReminderAt has hit
  const chases = useMemo(
    () =>
      checklistItems.filter(
        (c) =>
          c.state === "requested_waiting" &&
          c.nextReminderAt &&
          c.nextReminderAt <= today
      ),
    [checklistItems, today]
  );

  // Convert each list into "unique tasks/clients touched" so the card
  // counts align with the stat strip (which speaks in client/deadline
  // units, not per-item units). Avoids the "60 clients but 85 confirms"
  // dissonance.
  const decisionTasks = useMemo(() => {
    const taskIds = new Set<string>();
    const clientIds = new Set<string>();
    for (const d of decisions) {
      if (d.kind === "flag") {
        taskIds.add(d.item.taskId);
        const t = taskById.get(d.item.taskId);
        if (t) clientIds.add(t.clientId);
      } else if (d.kind === "insight") {
        clientIds.add(d.insight.clientId);
      }
    }
    return { tasks: taskIds.size, clients: clientIds.size };
  }, [decisions, taskById]);

  const confirmTasks = useMemo(() => {
    const taskIds = new Set<string>();
    for (const c of confirms) taskIds.add(c.taskId);
    return taskIds.size;
  }, [confirms]);

  const chaseTasks = useMemo(() => {
    const taskIds = new Set<string>();
    for (const c of chases) taskIds.add(c.taskId);
    return taskIds.size;
  }, [chases]);

  // Empty state — quiet morning
  const total = decisions.length + confirms.length + chases.length;
  if (total === 0) {
    return (
      <section className="bg-surface border border-line rounded-md p-6 text-center">
        <p className="text-sm font-medium text-ink-900">
          Quiet morning — nothing waiting on you.
        </p>
        <p className="text-xs text-ink-500 mt-1">
          AI is watching for inbound docs and timing-driven chases. We'll surface
          the next thing when it arrives.
        </p>
      </section>
    );
  }

  return (
    <>
      <section
        className="grid grid-cols-1 lg:grid-cols-3 gap-3"
        aria-label="Chase loop status"
      >
        <Card
          tone="yellow"
          icon={<AlertTriangle className="w-4 h-4" aria-hidden />}
          title="Decisions"
          count={decisionTasks.clients}
          countLabel="client"
          secondary={
            decisions.length > 0
              ? `${decisions.length} item${decisions.length === 1 ? "" : "s"} across ${decisionTasks.tasks || decisionTasks.clients} task${(decisionTasks.tasks || decisionTasks.clients) === 1 ? "" : "s"}`
              : undefined
          }
          subtitle={
            decisions.length === 0
              ? "Nothing to resolve."
              : "AI flagged something. You decide."
          }
          ctaLabel="Resolve"
          ctaHref={null}
          onCta={() => {
            // Jump to the first decision context
            const first = decisions[0];
            if (!first) return;
            if (first.kind === "flag") {
              const t = taskById.get(first.item.taskId);
              if (t) navigate(`/clients/${t.clientId}/tasks/${t.id}`);
            } else if (first.kind === "insight") {
              navigate(`/clients/${first.insight.clientId}`);
            }
          }}
          items={decisions.slice(0, 3).map((d, idx) => {
            if (d.kind === "flag") {
              const task = taskById.get(d.item.taskId);
              const client = task ? clientById.get(task.clientId) : null;
              if (!task || !client) return null;
              return (
                <li key={`f-${idx}`} className="text-xs text-ink-700">
                  <button
                    onClick={() => navigate(`/clients/${client.id}/tasks/${task.id}`)}
                    className="text-left hover:underline w-full"
                  >
                    <span className="font-medium text-ink-900">{client.name}</span>
                    <span className="text-ink-400"> · </span>
                    <span>{d.item.label}</span>
                    <span className="text-ink-400"> — </span>
                    <span className="text-warn-ink line-clamp-1">
                      {d.item.flagReason}
                    </span>
                  </button>
                </li>
              );
            }
            if (d.kind === "insight") {
              const client = clientById.get(d.insight.clientId);
              if (!client) return null;
              return (
                <li key={`i-${idx}`} className="text-xs text-ink-700">
                  <button
                    onClick={() => navigate(`/clients/${client.id}`)}
                    className="text-left hover:underline w-full"
                  >
                    <span className="font-medium text-ink-900">{client.name}</span>
                    <span className="text-ink-400"> · </span>
                    <span className="line-clamp-1">{d.insight.title}</span>
                  </button>
                </li>
              );
            }
            return null;
          })}
        />

        <Card
          tone="info"
          icon={<Check className="w-4 h-4" aria-hidden />}
          title="Tasks with docs to confirm"
          count={confirmTasks}
          countLabel="task"
          secondary={
            confirms.length > 0
              ? `${confirms.length} document${confirms.length === 1 ? "" : "s"} across ${confirmTasks} task${confirmTasks === 1 ? "" : "s"}`
              : undefined
          }
          subtitle={
            confirms.length === 0
              ? "Inbox zero."
              : confirmTasks === 1
              ? "1 task has docs in. Quick scan, then confirm."
              : `${confirmTasks} tasks have docs in. Batch them when you have a minute.`
          }
          ctaLabel={confirms.length > 3 ? "Open inbox" : "Review"}
          ctaHref="/to-review"
          items={confirms.slice(0, 3).map((c) => {
            const task = taskById.get(c.taskId);
            const client = task ? clientById.get(task.clientId) : null;
            if (!task || !client) return null;
            return (
              <li
                key={c.id}
                className="text-xs text-ink-700 flex items-center gap-2"
              >
                <button
                  onClick={() => confirmWithUndo(c)}
                  className="text-2xs px-1.5 py-0.5 rounded bg-warn-bg text-warn-ink border border-warn-border hover:bg-warn-bg/70 shrink-0"
                  title="Confirm — only you can do this"
                >
                  ✓
                </button>
                <button
                  onClick={() => navigate(`/clients/${client.id}/tasks/${task.id}`)}
                  className="text-left hover:underline truncate flex-1"
                >
                  <span className="font-medium text-ink-900">{client.name}</span>
                  <span className="text-ink-400"> · </span>
                  <span>{c.label}</span>
                </button>
              </li>
            );
          })}
        />

        <Card
          tone="info"
          icon={<Mail className="w-4 h-4" aria-hidden />}
          title="Clients to chase today"
          count={chaseTasks}
          countLabel="task"
          secondary={
            chases.length > 0
              ? `${chases.length} reminder${chases.length === 1 ? "" : "s"} ready`
              : undefined
          }
          subtitle={
            chases.length === 0
              ? "Nothing to chase today."
              : `It's time to follow up on ${chaseTasks} task${chaseTasks === 1 ? "" : "s"}.`
          }
          ctaLabel={chases.length > 3 ? "Open inbox" : "Send all"}
          ctaHref={chases.length > 3 ? "/to-review" : null}
          items={chases.slice(0, 3).map((c) => {
            const task = taskById.get(c.taskId);
            const client = task ? clientById.get(task.clientId) : null;
            if (!task || !client) return null;
            const daysSinceLast = c.lastReminderAt
              ? Math.max(
                  0,
                  Math.round(
                    (TODAY.getTime() - new Date(c.lastReminderAt).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                )
              : null;
            return (
              <li
                key={c.id}
                className="text-xs text-ink-700 flex items-center gap-2"
              >
                <button
                  onClick={() =>
                    setEmailIntent({
                      task,
                      client,
                      checklistItem: c,
                    })
                  }
                  className="text-2xs px-1.5 py-0.5 rounded bg-accent text-canvas hover:bg-accent-hover shrink-0"
                  title="Send AI-drafted reminder"
                >
                  ✉
                </button>
                <span className="truncate flex-1">
                  <span className="font-medium text-ink-900">{client.name}</span>
                  <span className="text-ink-400"> · </span>
                  <span>{c.label}</span>
                  {daysSinceLast !== null && (
                    <span className="text-ink-400"> · {daysSinceLast}d silent</span>
                  )}
                </span>
              </li>
            );
          })}
        />
      </section>

      <EmailDraftModal
        open={!!emailIntent}
        intent={emailIntent}
        onClose={() => setEmailIntent(null)}
      />
    </>
  );
}

function Card({
  tone,
  icon,
  title,
  count,
  countLabel,
  secondary,
  subtitle,
  ctaLabel,
  ctaHref,
  onCta,
  items,
}: {
  tone: "yellow" | "info" | "neutral";
  icon: React.ReactNode;
  title: string;
  count: number;
  countLabel?: string;
  secondary?: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string | null;
  onCta?: () => void;
  items: React.ReactNode;
}) {
  const navigate = useNavigate();
  const accent =
    tone === "yellow"
      ? "border-l-warn-solid"
      : tone === "info"
      ? "border-l-info-solid"
      : "border-l-line";
  const onClick = () => {
    if (ctaHref) navigate(ctaHref);
    else if (onCta) onCta();
  };
  return (
    <article
      className={`bg-surface border border-line border-l-2 ${accent} rounded-md p-4 flex flex-col`}
    >
      <header className="flex items-baseline gap-2 mb-1.5">
        <span className="text-ink-700">{icon}</span>
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        <span className="ml-auto flex items-baseline gap-1">
          <span className="text-2xl font-semibold text-ink-900 tabular-nums">
            {count}
          </span>
          {countLabel && (
            <span className="text-2xs uppercase tracking-wider text-ink-500">
              {count === 1 ? countLabel : `${countLabel}s`}
            </span>
          )}
        </span>
      </header>
      {secondary && (
        <p className="text-2xs text-ink-400 mb-1 -mt-1">{secondary}</p>
      )}
      <p className="text-xs text-ink-500 mb-3">{subtitle}</p>
      {count > 0 && (
        <ul className="space-y-1.5 mb-3 min-h-[60px]">{items}</ul>
      )}
      {count > 0 && (
        <button
          onClick={onClick}
          disabled={!ctaHref && !onCta}
          className="text-xs px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-sunken inline-flex items-center justify-center gap-1 mt-auto disabled:opacity-40"
        >
          {ctaLabel}
          <ArrowRight className="w-3 h-3" aria-hidden />
        </button>
      )}
    </article>
  );
}
