import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  SkipForward,
  Sparkles,
  X,
} from "lucide-react";
import { PageContainer } from "@/components/ui/PageContainer";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/button";
import { clients as MOCK_CLIENTS } from "@/data/mockClients";
import { deadlines as MOCK_DEADLINES } from "@/data/mockDeadlines";
import { TODAY, parseDate, daysBetween } from "@/data/dateHelpers";
import { cn } from "@/lib/utils";

/**
 * /today/triage — focused single-card triage mode.
 *
 * Inherits the v0m-triage-queue exploration. Renders one Action Queue
 * item at a time as a large focused card; the CPA presses keys (j/k to
 * navigate, c to mark complete, s to skip, o to open client, Esc back
 * to /today) to move through the queue Superhuman/Karbon-style.
 *
 * The right-side queue preview shows where you are in the stack so the
 * focused view never feels untethered. When the queue is empty, the
 * page renders an honest "all done" state and offers a path back.
 */

type TriageUrgency = "overdue" | "due_today" | "due_soon" | "awaiting";

interface TriageItem {
  id: string;
  clientId: string;
  clientName: string;
  form: string;
  jurisdiction: string;
  entityType: string;
  servicePackage: string;
  dueDate: string;
  estimatedTax?: number;
  status: string;
  urgency: TriageUrgency;
  urgencyDays?: number;
  authority: string;
  // Mock related deadlines for this client (not the focused one)
  related: { id: string; date: string; form: string; jurisdiction: string; status: "ok" | "open" | "warn" }[];
}

const urgencyToPill: Record<TriageUrgency, { variant: "danger" | "warn" | "info" | "neutral"; label: (n?: number) => string }> = {
  overdue: { variant: "danger", label: (n) => `Overdue${n ? ` ${n}d` : ""}` },
  due_today: { variant: "warn", label: () => "Due today" },
  due_soon: { variant: "warn", label: (n) => `Due in ${n ?? 0}d` },
  awaiting: { variant: "info", label: () => "Awaiting client" },
};

function jurisdictionLabel(j: string): string {
  return j === "federal" ? "Federal" : j;
}

function authorityFor(jurisdiction: string): string {
  if (jurisdiction === "federal") return "IRS";
  if (jurisdiction === "CA") return "California Franchise Tax Board";
  if (jurisdiction === "TX") return "Texas Comptroller";
  if (jurisdiction === "NY") return "NY Department of Taxation";
  if (jurisdiction === "LA") return "Louisiana DOR";
  return `${jurisdiction} DOR`;
}

function buildTriageQueue(): TriageItem[] {
  const clientById = new Map(MOCK_CLIENTS.map((c) => [c.id, c]));
  const deadlinesByClient = new Map<string, typeof MOCK_DEADLINES>();
  for (const d of MOCK_DEADLINES) {
    const list = deadlinesByClient.get(d.clientId) ?? [];
    list.push(d);
    deadlinesByClient.set(d.clientId, list);
  }

  const items: TriageItem[] = [];
  for (const d of MOCK_DEADLINES) {
    const c = clientById.get(d.clientId);
    if (!c) continue;
    const due = parseDate(d.officialDueDate);
    const diff = daysBetween(TODAY, due);
    let urgency: TriageUrgency | null = null;
    let urgencyDays: number | undefined;
    if (d.status === "overdue" || diff < 0) {
      urgency = "overdue";
      urgencyDays = Math.abs(diff);
    } else if (diff === 0) {
      urgency = "due_today";
    } else if (diff > 0 && diff <= 7 && d.status === "not_started") {
      urgency = "due_soon";
      urgencyDays = diff;
    } else if (d.status === "in_progress") {
      urgency = "awaiting";
    }
    if (!urgency) continue;

    const related = (deadlinesByClient.get(d.clientId) ?? [])
      .filter((other) => other.id !== d.id)
      .slice(0, 3)
      .map((other) => ({
        id: other.id,
        date: other.officialDueDate,
        form: other.form,
        jurisdiction: other.jurisdiction,
        status: (other.status === "completed"
          ? "ok"
          : other.status === "in_progress"
            ? "warn"
            : "open") as "ok" | "open" | "warn",
      }));

    items.push({
      id: `${d.clientId}-${d.form}`,
      clientId: c.id,
      clientName: c.name,
      form: d.form,
      jurisdiction: d.jurisdiction,
      entityType: c.entityType,
      servicePackage: c.servicePackage ?? `${jurisdictionLabel(d.jurisdiction)} ${c.entityType}`,
      dueDate: d.officialDueDate,
      estimatedTax: undefined,
      status: d.status,
      urgency,
      urgencyDays,
      authority: authorityFor(d.jurisdiction),
      related,
    });
  }
  return items
    .sort((a, b) => {
      const order: Record<TriageUrgency, number> = {
        overdue: 0,
        due_today: 1,
        awaiting: 2,
        due_soon: 3,
      };
      return order[a.urgency] - order[b.urgency];
    })
    .slice(0, 12);
}

export function TodayTriage() {
  const navigate = useNavigate();
  const queue = useMemo(buildTriageQueue, []);
  const [cursor, setCursor] = useState(0);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  const total = queue.length;
  const remaining = queue.filter(
    (i) => !completed.has(i.id) && !skipped.has(i.id),
  ).length;
  const progressPct = total === 0 ? 0 : ((cursor + 1) / total) * 100;
  const current = queue[cursor];

  // Auto-advance helper: jump to the next un-handled item.
  const advance = () => {
    let nextIdx = cursor + 1;
    while (
      nextIdx < total &&
      (completed.has(queue[nextIdx].id) || skipped.has(queue[nextIdx].id))
    ) {
      nextIdx += 1;
    }
    if (nextIdx >= total) {
      // Wrap to beginning, find first un-handled
      nextIdx = 0;
      while (
        nextIdx < total &&
        (completed.has(queue[nextIdx].id) || skipped.has(queue[nextIdx].id))
      ) {
        nextIdx += 1;
      }
    }
    if (nextIdx < total) setCursor(nextIdx);
  };

  // Action handlers — wired to keyboard + on-card buttons.
  const onComplete = () => {
    if (!current) return;
    setCompleted((prev) => new Set(prev).add(current.id));
    toast.success(`Marked complete · ${current.clientName}`);
    advance();
  };
  const onSendReminder = () => {
    if (!current) return;
    toast.success(`Reminder sent to ${current.clientName}`);
  };
  const onDefer = () => {
    if (!current) return;
    toast.info(`${current.clientName} deferred to next session`);
    advance();
  };
  const onOpenClient = () => {
    if (!current) return;
    toast.info(`Open client detail · ${current.clientName}`);
  };
  const onSkip = () => {
    if (!current) return;
    setSkipped((prev) => new Set(prev).add(current.id));
    toast.info("Skipped");
    advance();
  };

  // Keyboard shortcuts — Superhuman/Karbon-style. j/k navigate, single
  // letters trigger actions. Only fires when no input is focused.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (total === 0) return;
      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          setCursor((i) => Math.min(total - 1, i + 1));
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          setCursor((i) => Math.max(0, i - 1));
          break;
        case "c":
          e.preventDefault();
          onComplete();
          break;
        case "r":
          e.preventDefault();
          onSendReminder();
          break;
        case "d":
          e.preventDefault();
          onDefer();
          break;
        case "o":
          e.preventDefault();
          onOpenClient();
          break;
        case "s":
          e.preventDefault();
          onSkip();
          break;
        case "Escape":
          navigate("/design/today");
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, cursor, current?.id, completed, skipped]);

  // Empty state — all done OR nothing to triage in the first place.
  if (total === 0 || remaining === 0) {
    return (
      <PageContainer variant="workshop">
        <section className="flex-1 flex flex-col items-center justify-center bg-canvas px-region">
          <div className="text-center max-w-[420px]">
            <CheckCircle2 className="w-12 h-12 text-ok-ink mx-auto mb-4" aria-hidden />
            <h1 className="text-display font-semibold text-ink-900 mb-2">
              {total === 0 ? "Nothing to triage today." : "Triage queue cleared."}
            </h1>
            <p className="text-sm text-ink-500 mb-6">
              {total === 0
                ? "Action items will appear here as deadlines, replies, and approvals come in."
                : `You handled ${completed.size} ${completed.size === 1 ? "item" : "items"} this session.`}
            </p>
            <Link
              to="/design/today"
              className="inline-flex items-center gap-1 text-sm font-medium text-ink-900 hover:text-ink-700"
            >
              Back to Today <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </PageContainer>
    );
  }

  const pill = urgencyToPill[current.urgency];

  return (
    <PageContainer variant="workshop">
      {/* ── Center stage: focused card ─────────────────────────── */}
      <section className="flex-1 min-w-0 flex flex-col bg-canvas overflow-hidden">
        {/* Top progress bar */}
        <div className="px-4 md:px-6 lg:px-8 py-3 bg-surface border-b border-line flex items-center gap-3 sticky top-0 z-10">
          <button
            type="button"
            onClick={() => setCursor((i) => Math.max(0, i - 1))}
            disabled={cursor === 0}
            className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-line text-ink-500 hover:bg-sunken hover:text-ink-900 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-500 transition-colors"
            title="Previous (k)"
            aria-label="Previous"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden />
          </button>
          <div className="text-xs text-ink-700 font-medium tabular-nums shrink-0">
            <span className="text-ink-900">{cursor + 1}</span>
            <span className="text-ink-400"> of </span>
            <span className="text-ink-900">{total}</span>
            <span className="text-ink-400"> in triage</span>
          </div>
          <div className="flex-1 max-w-[320px] h-1 bg-line rounded-pill overflow-hidden">
            <div
              className="h-full bg-ink-900 rounded-pill transition-[width] duration-200"
              style={{ width: `${progressPct}%` }}
              aria-hidden
            />
          </div>
          <div className="text-xs text-ink-500 tabular-nums shrink-0">
            {remaining} left
          </div>
          <button
            type="button"
            onClick={() => setCursor((i) => Math.min(total - 1, i + 1))}
            disabled={cursor === total - 1}
            className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-line text-ink-500 hover:bg-sunken hover:text-ink-900 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-500 transition-colors"
            title="Next (j)"
            aria-label="Next"
          >
            <ChevronRight className="w-4 h-4" aria-hidden />
          </button>
          <Link
            to="/design/today"
            className="ml-auto inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-900 transition-colors"
            title="Back to Today (Esc)"
          >
            <X className="w-3.5 h-3.5" aria-hidden />
            Exit triage
          </Link>
        </div>

        {/* Focused card — center stage */}
        <div className="flex-1 overflow-y-auto py-8 px-4 md:px-6 lg:px-8 flex justify-center">
          <article className="w-full max-w-[720px] bg-surface border border-line rounded-lg shadow-pop overflow-hidden">
            {/* Header */}
            <header className="px-6 py-5 border-b border-line">
              <div className="flex items-center gap-2 mb-2">
                <StatusPill variant={pill.variant} size="sm">
                  {pill.label(current.urgencyDays)}
                </StatusPill>
                <span className="text-xs text-ink-500">
                  {current.authority}
                </span>
              </div>
              <h1 className="text-display font-semibold text-ink-900 leading-tight">
                {current.form} · {jurisdictionLabel(current.jurisdiction)}
              </h1>
              <div className="mt-2 text-sm text-ink-700">
                <span className="font-semibold text-ink-900">{current.clientName}</span>
                <span className="text-ink-400"> · </span>
                <span>{current.entityType}</span>
                <span className="text-ink-400"> · </span>
                <span>Service Package: <span className="font-medium text-ink-900">{current.servicePackage}</span></span>
              </div>
            </header>

            {/* Body */}
            <div className="px-6 py-5 flex flex-col gap-5">
              {/* AI block — info-tinted; explains AI's reasoning */}
              <div className="flex items-start gap-3 px-4 py-3 bg-info-bg border border-info-border rounded-md">
                <span className="shrink-0 w-7 h-7 rounded-md bg-info-solid text-white inline-flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" aria-hidden />
                </span>
                <div className="flex-1 text-xs text-ink-700 leading-relaxed">
                  <span className="font-semibold text-ink-900">
                    Generated from {current.servicePackage}.
                  </span>{" "}
                  {current.form} is the {jurisdictionLabel(current.jurisdiction)}{" "}
                  return for this entity type. Audit-trailed back to the
                  package definition + {current.authority} bulletin.{" "}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      toast.info("Open Service Package definition");
                    }}
                    className="text-info-ink underline underline-offset-2"
                  >
                    View source
                  </a>
                </div>
              </div>

              {/* Meta grid — 2 columns of key facts */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <MetaField label="Form" value={current.form} />
                <MetaField label="Jurisdiction" value={current.authority} />
                <MetaField label="Original due" value={current.dueDate} />
                <MetaField
                  label="Status"
                  value={current.status.replace(/_/g, " ")}
                />
              </dl>

              {/* Related deadlines for this client */}
              {current.related.length > 0 && (
                <div>
                  <div className="text-2xs uppercase tracking-wider text-ink-500 font-semibold mb-2">
                    Related {current.clientName} deadlines
                  </div>
                  <ul className="border-t border-line">
                    {current.related.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 py-2 border-b border-line text-xs"
                      >
                        <span
                          className={cn(
                            "w-2 h-2 rounded-pill shrink-0",
                            r.status === "ok" && "bg-ok-solid",
                            r.status === "warn" && "bg-warn-solid",
                            r.status === "open" && "border border-ink-400",
                          )}
                          aria-hidden
                        />
                        <span className="font-medium text-ink-700 tabular-nums shrink-0 w-16">
                          {r.date.slice(5).replace("-", "/")}
                        </span>
                        <span className="flex-1 truncate text-ink-700">{r.form}</span>
                        <span className="text-2xs uppercase tracking-wider text-ink-500 font-semibold shrink-0">
                          {r.jurisdiction === "federal" ? "FED" : r.jurisdiction}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Action bar — keyboard-first, but mouse-clickable */}
            <footer className="px-6 py-4 border-t border-line bg-sunken/30 flex items-center gap-2 flex-wrap">
              <Button
                onClick={onComplete}
                className="bg-indigo hover:bg-indigo-hover text-white"
              >
                <CheckCircle2 aria-hidden />
                Mark complete
                <kbd className="ml-1 font-mono text-2xs border border-white/30 px-1 rounded">C</kbd>
              </Button>
              <Button variant="outline" onClick={onSendReminder}>
                Send reminder
                <kbd className="ml-1 font-mono text-2xs border border-line px-1 rounded">R</kbd>
              </Button>
              <Button variant="outline" onClick={onDefer}>
                <Clock aria-hidden />
                Defer
                <kbd className="ml-1 font-mono text-2xs border border-line px-1 rounded">D</kbd>
              </Button>
              <Button variant="ghost" onClick={onOpenClient}>
                <ExternalLink aria-hidden />
                Open client
                <kbd className="ml-1 font-mono text-2xs border border-line px-1 rounded">O</kbd>
              </Button>
              <Button variant="ghost" onClick={onSkip} className="ml-auto text-ink-500">
                <SkipForward aria-hidden />
                Skip
                <kbd className="ml-1 font-mono text-2xs border border-line px-1 rounded">S</kbd>
              </Button>
            </footer>
          </article>
        </div>
      </section>

      {/* ── Right rail: queue preview ────────────────────────── */}
      <aside className="w-80 shrink-0 border-l border-line bg-canvas flex flex-col overflow-hidden">
        <header className="px-region py-3 border-b border-line bg-surface flex items-center justify-between">
          <div>
            <div className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
              Triage queue
            </div>
            <div className="text-sm font-semibold text-ink-900 tabular-nums mt-0.5">
              {remaining} <span className="text-ink-400 font-normal">of {total} left</span>
            </div>
          </div>
          <div className="text-2xs text-ink-400 inline-flex items-center gap-1">
            <kbd className="font-mono border border-line bg-sunken px-1 rounded">j</kbd>
            <kbd className="font-mono border border-line bg-sunken px-1 rounded">k</kbd>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <QueueSection label="Overdue" tone="danger">
            {queue
              .map((q, idx) => ({ q, idx }))
              .filter(({ q }) => q.urgency === "overdue")
              .map(({ q, idx }) => (
                <QueueRow
                  key={q.id}
                  item={q}
                  current={idx === cursor}
                  done={completed.has(q.id) || skipped.has(q.id)}
                  onClick={() => setCursor(idx)}
                />
              ))}
          </QueueSection>
          <QueueSection label="Today">
            {queue
              .map((q, idx) => ({ q, idx }))
              .filter(({ q }) => q.urgency === "due_today")
              .map(({ q, idx }) => (
                <QueueRow
                  key={q.id}
                  item={q}
                  current={idx === cursor}
                  done={completed.has(q.id) || skipped.has(q.id)}
                  onClick={() => setCursor(idx)}
                />
              ))}
          </QueueSection>
          <QueueSection label="This week">
            {queue
              .map((q, idx) => ({ q, idx }))
              .filter(({ q }) => q.urgency === "due_soon" || q.urgency === "awaiting")
              .map(({ q, idx }) => (
                <QueueRow
                  key={q.id}
                  item={q}
                  current={idx === cursor}
                  done={completed.has(q.id) || skipped.has(q.id)}
                  onClick={() => setCursor(idx)}
                />
              ))}
          </QueueSection>
        </div>
      </aside>
    </PageContainer>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
        {label}
      </dt>
      <dd className="mt-0.5 text-ink-900 capitalize">{value}</dd>
    </div>
  );
}

function QueueSection({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: "danger";
  children: React.ReactNode;
}) {
  // Hide empty sections (gap > fill — only render when there's content).
  const childArr = Array.isArray(children) ? children : [children];
  const hasItems = childArr.some(
    (c) => c !== null && c !== undefined && c !== false,
  );
  if (!hasItems) return null;
  return (
    <div>
      <div
        className={cn(
          "text-2xs uppercase tracking-wider font-semibold px-region pt-3 pb-1",
          tone === "danger" ? "text-danger-ink" : "text-ink-500",
        )}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function QueueRow({
  item,
  current,
  done,
  onClick,
}: {
  item: TriageItem;
  current: boolean;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-region py-2 border-b border-line hover:bg-sunken transition-colors",
        current && "bg-indigo-soft border-l-[3px] border-l-indigo pl-[13px]",
        done && !current && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-pill shrink-0",
            item.urgency === "overdue" && "bg-danger-solid",
            item.urgency === "due_today" && "bg-warn-solid",
            (item.urgency === "due_soon" || item.urgency === "awaiting") &&
              "border border-ink-400",
          )}
          aria-hidden
        />
        <span className="text-xs font-semibold text-ink-900 truncate flex-1">
          {item.clientName}
        </span>
        <span
          className={cn(
            "text-2xs font-semibold tabular-nums shrink-0",
            item.urgency === "overdue" && "text-danger-ink",
            item.urgency === "due_today" && "text-warn-ink",
            item.urgency !== "overdue" && item.urgency !== "due_today" && "text-ink-400",
          )}
        >
          {item.urgency === "overdue" && `${item.urgencyDays}d late`}
          {item.urgency === "due_today" && "Today"}
          {item.urgency === "due_soon" && `${item.urgencyDays}d`}
          {item.urgency === "awaiting" && "Awaiting"}
        </span>
        {done && (
          <CheckCircle2 className="w-3 h-3 text-ok-ink shrink-0" aria-hidden />
        )}
      </div>
      <div className="text-2xs text-ink-500 truncate pl-[14px]">
        {item.form} · {jurisdictionLabel(item.jurisdiction)}
      </div>
    </button>
  );
}
