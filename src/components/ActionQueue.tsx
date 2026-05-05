import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronRight,
  ChevronDown,
  Mail,
  CheckCircle2,
  Megaphone,
  MessageSquare,
  Users,
} from "lucide-react";
import { trpc } from "../lib/api/client";
import { MOCK_TODO_ITEMS } from "../data/mockTodoItems";
import type {
  ChecklistItemSnapshot,
  MockTodoItem,
  TodoVerb,
} from "../data/mockTodoItems";
import { env } from "../config";
import { actions } from "../data/store";
import { DateLabel } from "./ui/DateLabel";
import { DotStack } from "./ui/DotStack";
import { SectionHeader } from "./ui/SectionHeader";
import { ChaseBundleModal, type ChaseItem } from "./ChaseBundleModal";
import { cn } from "../lib/utils";
import {
  buildQueueRows,
  summarizeClientGroup,
  type ClientGroupRow,
  type StateAlertRow,
  type BulkBatchRow,
  type QueueTodoItem,
} from "../lib/queueGrouping";

// ActionQueue — Today's chase queue. One row per (client × email-thread).
// State alerts pin to top; bulk-batch drafts render their own variant.
// Click a row to act; chevron expands to show individual TodoItems.

const VERB_ICON: Record<TodoVerb, typeof Mail> = {
  Send: Mail,
  Confirm: CheckCircle2,
  Apply: Megaphone,
  Discuss: MessageSquare,
};

// Urgency dots — small SVG circles, matching the DESIGN.md dot
// vocabulary used elsewhere (Timeline mini-timeline, Today triage
// queue rail). Colored as pills, never as row paint (T4 — "status
// colors are pills, never paint").
const URGENCY_DOT_CLASS: Record<MockTodoItem["urgency"], string> = {
  high: "bg-danger-solid",
  medium: "bg-warn-solid",
  normal: "bg-ok-solid",
};

const URGENCY_LABEL: Record<MockTodoItem["urgency"], string> = {
  high: "High urgency",
  medium: "Medium urgency",
  normal: "Routine",
};

function UrgencyDot({ urgency }: { urgency: MockTodoItem["urgency"] }) {
  return (
    <span
      className={cn(
        "w-2 h-2 rounded-pill shrink-0 mt-1.5",
        URGENCY_DOT_CLASS[urgency],
      )}
      aria-label={URGENCY_LABEL[urgency]}
      role="img"
    />
  );
}

export function ActionQueue() {
  const [expanded, setExpanded] = useState(false);
  const todoQuery = trpc.todoItems.list.useQuery({ limit: 50 });
  const live = todoQuery.data?.items ?? [];
  const isMock = env.useMockData;
  const useMockFallback = isMock && live.length === 0;
  const items: QueueTodoItem[] = useMockFallback
    ? (MOCK_TODO_ITEMS as QueueTodoItem[])
    : (live as QueueTodoItem[]);

  const rows = buildQueueRows(items);
  const visibleCount = expanded ? rows.length : 5;
  const visible = rows.slice(0, visibleCount);
  const hidden = rows.length - visibleCount;

  return (
    <section className="mb-section" aria-labelledby="action-queue-heading">
      <SectionHeader
        title={<span id="action-queue-heading">Action queue</span>}
        meta={
          rows.length === 1
            ? `${rows.length} client · ${items.length} ${items.length === 1 ? "item" : "items"}`
            : `${rows.length} clients · ${items.length} items`
        }
      />
      <div className="bg-surface border border-line rounded-md overflow-hidden">
        <ul className="divide-y divide-line" role="list">
          {visible.map((row) => {
            if (row.kind === "state_alert")
              return <StateAlertRowView key={row.key} row={row} />;
            if (row.kind === "bulk_batch")
              return <BulkBatchRowView key={row.key} row={row} />;
            return <ClientGroupRowView key={row.key} row={row} />;
          })}
        </ul>
        {hidden > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full px-region py-2.5 text-xs text-ink-500 hover:text-ink-900 hover:bg-sunken/40 border-t border-line"
          >
            Show {hidden} more {hidden === 1 ? "client" : "clients"}
          </button>
        )}
      </div>
    </section>
  );
}

function navigateForItem(
  item: QueueTodoItem,
  navigate: ReturnType<typeof useNavigate>,
): void {
  if (
    (item.surface === "task_detail" || item.surface === "email_draft_modal") &&
    item.clientId &&
    item.taskId
  ) {
    navigate(`/clients/${item.clientId}/tasks/${item.taskId}`);
    return;
  }
  if (item.surface === "alert_detail") {
    navigate("/alerts");
    return;
  }
  if (item.surface === "opportunity_detail") {
    navigate("/opportunities");
    return;
  }
  if (item.surface === "bounce_modal") {
    navigate("/mail");
    return;
  }
  if (item.verb === "Apply") navigate("/alerts");
  else if (item.verb === "Discuss") navigate("/opportunities");
  else navigate("/mail");
}

// Aggregate every checklist-item state across a client-group row. arrival-timing
// items carry the snapshot; other verbs (Confirm/Discuss/Apply) don't,
// so we synthesize a state from the verb so each item still contributes
// one dot. Keeps the dot count = item count, which is what the user
// reads at-a-glance ("4 items, 3 outstanding, 1 received").
function aggregateChecklistStates(
  items: QueueTodoItem[],
): ChecklistItemSnapshot[] {
  const out: ChecklistItemSnapshot[] = [];
  for (const it of items) {
    if (it.checklistItems && it.checklistItems.length > 0) {
      out.push(...it.checklistItems);
      continue;
    }
    // Synthetic single dot for non-Mode-B rows so the row reads "5 dots
    // for 5 items" instead of "4 dots for the bundled chase + 1 missing
    // dot for the inbound to confirm".
    const synth: ChecklistItemSnapshot["state"] =
      it.verb === "Send"
        ? "requested_waiting"
        : it.verb === "Confirm"
          ? "received_unreviewed"
          : "not_requested";
    out.push({
      id: it.id,
      label: it.task ?? it.client,
      state: synth,
    });
  }
  return out;
}

// ── Client group row ──────────────────────────────────────────────────────
// One row per client. The whole row is the expand button — chevron is a
// passive icon, dots live at the bottom of the content as a status footer
// (not a left-prefix that competes with the client name for first read).
// Inside the expanded panel, each task lists its checklist items as
// checkboxes (pre-checked for outstanding states); selection state is
// lifted up to this component so a single "Send N" footer covers items
// across all tasks for this client. Clicking Send opens the
// ChaseBundleModal — one email, one composer, all selected items.
function ClientGroupRowView({ row }: { row: ClientGroupRow }) {
  const [open, setOpen] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);
  const summary = summarizeClientGroup(row);
  const sendCount = row.verbCounts.Send ?? 0;
  const primaryVerb: TodoVerb =
    sendCount > 0
      ? "Send"
      : row.verbCounts.Confirm
        ? "Confirm"
        : row.verbCounts.Discuss
          ? "Discuss"
          : "Apply";
  const PrimaryIcon = VERB_ICON[primaryVerb];
  const checklistStates = aggregateChecklistStates(row.items);
  const itemCount = checklistStates.length;

  // All chase-eligible items across all tasks in this group, flattened
  // into a single shape the modal can consume. Indexed by composite
  // taskId+itemId so checkbox state survives reorders.
  const allChaseItems = useMemo<ChaseItem[]>(() => {
    const out: ChaseItem[] = [];
    for (const it of row.items) {
      if (!it.checklistItems) continue;
      for (const ci of it.checklistItems) {
        if (
          ci.state === "received_confirmed" ||
          ci.state === "not_applicable"
        ) {
          continue;
        }
        out.push({
          id: `${it.taskId ?? it.id}:${ci.id}`,
          taskName: it.task ?? row.clientName,
          taskId: it.taskId,
          itemLabel: ci.label,
          state: ci.state,
        });
      }
    }
    return out;
  }, [row]);

  // Lifted checkbox state — pre-checked for every chase-eligible item.
  // The parent Send button reads this to know how many items to bundle.
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(allChaseItems.map((ci) => [ci.id, true])),
  );
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const includedChaseItems = allChaseItems.filter((ci) => checked[ci.id]);

  // Real-mode bundled send wiring (PR B.5) — saves a draft scoped to
  // the first task containing any checked item, then immediately sends
  // it via the BE pipeline. The schema constrains email_drafts.taskId
  // to a single task; bundling across tasks therefore lives in the
  // body, not the FK. Phase 2 introduces multi-task drafts so the
  // email_drafts row can fan out activity events across every linked
  // task. Mock-mode keeps the in-memory store shortcut.
  const saveDraftMut = trpc.emails.saveDraft.useMutation();
  const sendEmailMut = trpc.emails.send.useMutation();
  const liveClientQuery = trpc.clients.get.useQuery(
    { id: row.clientId ?? "" },
    { enabled: !env.useMockData && Boolean(row.clientId) },
  );
  const clientEmail = liveClientQuery.data?.contactEmail ?? undefined;

  const onSendBundled = async (payload: {
    subject: string;
    body: string;
    itemIds: string[];
  }) => {
    const firstTaskId = includedChaseItems.find((it) => it.taskId)?.taskId;
    if (!firstTaskId) {
      toast.error("Can't send — no linked task. Open the client to add one.");
      return;
    }
    if (env.useMockData) {
      const id = actions.saveEmailDraft({
        taskId: firstTaskId,
        clientId: row.clientId ?? "",
        to: "client@example.com",
        cc: "",
        subject: payload.subject,
        body: payload.body,
        tone: "formal",
        aiSources: [
          {
            kind: "substrate",
            note: `bundled chase ${payload.itemIds.length} items`,
          },
        ],
        sendMethod: "cpa_send",
        status: "draft",
      });
      actions.sendEmail(id);
      toast.success(
        `Sent · ${payload.itemIds.length} ${payload.itemIds.length === 1 ? "item" : "items"} bundled into one email`,
      );
      setBundleOpen(false);
      return;
    }
    // Real mode: persist + send through the BE. The chain is
    // saveDraft → send so the activity_event row that emails.send
    // writes uses the just-created draft id (clean audit trail).
    if (!clientEmail) {
      toast.error(
        "Can't send — no email on file for this client. Add one in client detail.",
      );
      return;
    }
    try {
      const draft = (await saveDraftMut.mutateAsync({
        taskId: firstTaskId,
        toAddress: clientEmail,
        ccAddress: null,
        subject: payload.subject,
        body: payload.body,
        tone: "default",
        aiSources: {
          kind: "bundled_chase",
          itemCount: payload.itemIds.length,
        },
      } as never)) as { id: string };
      await sendEmailMut.mutateAsync({ id: draft.id } as never);
      toast.success(
        `Sent · ${payload.itemIds.length} ${payload.itemIds.length === 1 ? "item" : "items"} bundled into one email`,
      );
      setBundleOpen(false);
    } catch (err) {
      const m = err instanceof Error ? err.message : "Send failed";
      toast.error(`Send failed: ${m}`);
    }
  };

  return (
    <li
      className="group bg-surface focus-within:bg-canvas/60 transition-colors"
      data-deadline-row
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Collapse client" : "Expand client"}
        className={cn(
          "w-full text-left px-region py-3 flex items-start gap-3 transition-colors",
          // Real hover treatment: solid sunken on hover; a slightly
          // brighter shade when expanded so the open state reads
          // distinct without competing with row hover. Focus ring on
          // keyboard nav. Active (mousedown) gets a subtle press tint.
          "hover:bg-sunken active:bg-sunken-strong/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo/40",
          open && "bg-canvas/70",
        )}
      >
        <div className="flex-1 min-w-0">
          {/* Identity line — client name is a Link with stopPropagation
              so navigating doesn't toggle the expand. */}
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-0.5 flex-wrap">
            {row.clientId ? (
              <Link
                to={`/clients/${row.clientId}`}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-ink-900 hover:underline focus-visible:outline-none focus-visible:underline"
              >
                {row.clientName}
              </Link>
            ) : (
              <span className="font-medium text-ink-900">{row.clientName}</span>
            )}
            <span className="text-ink-300" aria-hidden>·</span>
            <span>
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            {row.earliestDueDate && (
              <>
                <span className="text-ink-300" aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  earliest due{" "}
                  <DateLabel value={row.earliestDueDate} format="auto" />
                </span>
              </>
            )}
            {/* Verb hint — muted metadata, NOT a button. Earlier this
                rendered as `<icon> Send` in ink-700 on the right edge,
                which read as a tappable Send affordance. Clicking did
                nothing (the parent <button> just toggles expand), so
                users hit a dead end. The verb is already restated on
                the action line below; here we render it as inline
                metadata in muted text so it reads as "next action:
                Send" — a status, not a CTA. */}
            <span className="ml-auto inline-flex items-center gap-1 text-2xs text-ink-400">
              next:
              <PrimaryIcon className="w-3 h-3" aria-hidden />
              <span className="font-medium text-ink-500">{primaryVerb}</span>
            </span>
          </div>

          {/* Action line — verb summary (e.g. "Send 4 reminders · across 1040 + 941") */}
          <div className="text-sm text-ink-900 font-medium">{summary}</div>

          {/* Context — first item's context as flavor */}
          <div className="text-xs text-ink-500 mt-0.5 line-clamp-1">
            {row.items[0].context}
          </div>

          {/* Status footer — DotStack at the bottom of the row content,
              not as a left prefix. Tells the chase-loop story without
              competing with the client name for first read. */}
          <div className="mt-2 flex items-center gap-2 text-2xs text-ink-500">
            <DotStack
              states={checklistStates.map((c) => c.state)}
              maxVisible={12}
            />
            <span className="text-ink-400">{statusSummary(checklistStates)}</span>
          </div>
        </div>

        {/* Chevron is decorative — the entire row is the expand button. */}
        <span className="pt-1.5 shrink-0 text-ink-400 group-hover:text-ink-700 transition-colors">
          {open ? (
            <ChevronDown className="w-4 h-4" aria-hidden />
          ) : (
            <ChevronRight className="w-4 h-4" aria-hidden />
          )}
        </span>
      </button>

      {open && (
        <div className="bg-sunken/40 border-t border-line">
          <ul className="divide-y divide-line/60">
            {row.items.map((it) => (
              <SubItemRow
                key={it.id}
                item={it}
                checked={checked}
                onToggle={(id) =>
                  setChecked((p) => ({ ...p, [id]: !p[id] }))
                }
              />
            ))}
          </ul>
          {/* Parent-level Send bar — covers items across ALL tasks in
              the group. Lifted above the per-task Send buttons because
              one chase email per loop is the PRD §7.3 invariant. */}
          {allChaseItems.length > 0 && (
            <div className="px-region py-2.5 flex items-center justify-between border-t border-line bg-canvas/80">
              <span className="text-xs text-ink-500">
                {checkedCount === 0
                  ? "Pick at least one item to send"
                  : checkedCount === allChaseItems.length
                    ? `All ${checkedCount} items selected`
                    : `${checkedCount} of ${allChaseItems.length} selected`}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setBundleOpen(true);
                }}
                disabled={checkedCount === 0}
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded transition-colors",
                  "bg-indigo text-white hover:bg-indigo-hover active:bg-indigo-hover/90",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40",
                  "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo",
                )}
              >
                <Mail className="w-3 h-3" aria-hidden />
                Send {checkedCount} in one email
              </button>
            </div>
          )}
        </div>
      )}

      <ChaseBundleModal
        open={bundleOpen}
        clientName={row.clientName}
        items={includedChaseItems}
        onClose={() => setBundleOpen(false)}
        onSend={onSendBundled}
      />
    </li>
  );
}

// Plain-language summary of a checklist-state distribution. Used in the
// status footer beneath each parent row so the dot stack reads honest at
// a glance ("3 awaiting client · 1 awaiting your review").
function statusSummary(states: ChecklistItemSnapshot[]): string {
  const counts = states.reduce<Record<string, number>>((acc, s) => {
    acc[s.state] = (acc[s.state] ?? 0) + 1;
    return acc;
  }, {});
  const parts: string[] = [];
  if (counts.received_unreviewed)
    parts.push(`${counts.received_unreviewed} awaiting your review`);
  if (counts.received_issue)
    parts.push(`${counts.received_issue} flagged`);
  if (counts.requested_waiting)
    parts.push(`${counts.requested_waiting} awaiting client`);
  if (counts.not_requested)
    parts.push(`${counts.not_requested} first reminder pending`);
  if (counts.received_confirmed)
    parts.push(`${counts.received_confirmed} confirmed`);
  return parts.join(" · ");
}

// Color a checklist-item dot to match the canonical state palette
// (mirrors DotStack's checklistStateColor map). Used by the expanded
// per-item rows below the parent.
const CHECKLIST_DOT_CLASS: Record<
  ChecklistItemSnapshot["state"],
  string
> = {
  not_requested: "bg-ink-400",
  requested_waiting: "bg-warn-solid",
  received_unreviewed: "bg-info-solid",
  received_confirmed: "bg-ok-solid",
  received_issue: "bg-danger-solid",
  not_applicable: "bg-ink-200",
};

const CHECKLIST_STATE_LABEL: Record<
  ChecklistItemSnapshot["state"],
  string
> = {
  not_requested: "First reminder pending",
  requested_waiting: "Awaiting client",
  received_unreviewed: "Awaiting your review",
  received_confirmed: "Confirmed",
  received_issue: "Has issue",
  not_applicable: "N/A",
};

// Sub-item inside an expanded client group. For arrival-timing rows (with a
// checklistItems snapshot), each checklist item renders as a per-row
// checkbox + state dot. Selection state is OWNED by the parent
// ClientGroupRowView so a single Send bar at the bottom of the
// expanded panel can bundle items across multiple tasks. The Send
// button on this sub-row is gone — it would have promised a per-task
// email, which contradicts the one-chase-loop-per-email invariant.
//
// Non-Mode-B verbs fall back to the legacy single-row treatment with
// click-to-act behaviour.
function SubItemRow({
  item,
  checked,
  onToggle,
}: {
  item: QueueTodoItem;
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const Icon = VERB_ICON[item.verb];
  const navigate = useNavigate();

  if (item.checklistItems && item.checklistItems.length > 0) {
    const taskScopedKey = (ciId: string) =>
      `${item.taskId ?? item.id}:${ciId}`;
    return (
      <li className="px-region py-2.5 pl-10 bg-surface/60">
        {/* Task header — form name + due date + stage */}
        <div className="flex items-center gap-2 text-xs text-ink-500 mb-1.5 flex-wrap">
          {item.task && (
            <span className="text-ink-700 font-medium">{item.task}</span>
          )}
          {item.dueDate && (
            <>
              {item.task && <span className="text-ink-300" aria-hidden>·</span>}
              <span className="inline-flex items-center gap-1">
                due <DateLabel value={item.dueDate} format="auto" />
              </span>
            </>
          )}
          {item.stageLabel && (
            <>
              <span className="text-ink-300" aria-hidden>·</span>
              <span className="text-ink-500">{item.stageLabel}</span>
            </>
          )}
        </div>
        {/* Per-checklist-item rows — checkboxes (pre-checked for outstanding) */}
        <ul className="space-y-1">
          {item.checklistItems.map((ci) => {
            const k = taskScopedKey(ci.id);
            const disabled =
              ci.state === "received_confirmed" ||
              ci.state === "not_applicable";
            const isChecked = !disabled && (checked[k] ?? false);
            return (
              <li
                key={ci.id}
                className={cn(
                  "flex items-center gap-2 text-sm rounded px-1.5 py-1 transition-colors",
                  disabled
                    ? "text-ink-400"
                    : "text-ink-900 hover:bg-canvas cursor-pointer",
                )}
                onClick={() => {
                  if (disabled) return;
                  onToggle(k);
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggle(k)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={disabled}
                  className={cn(
                    "w-3.5 h-3.5 rounded border-line shrink-0 accent-indigo",
                    disabled && "opacity-40 cursor-not-allowed",
                  )}
                  aria-label={`Include ${ci.label} in next chase`}
                />
                <span
                  className={cn(
                    "inline-block w-1.5 h-1.5 rounded-pill shrink-0",
                    CHECKLIST_DOT_CLASS[ci.state],
                  )}
                  aria-hidden
                />
                <span className="flex-1 truncate">{ci.label}</span>
                <span className="text-2xs text-ink-500 shrink-0">
                  {CHECKLIST_STATE_LABEL[ci.state]}
                </span>
              </li>
            );
          })}
        </ul>
      </li>
    );
  }
  // Non-Mode-B fallback — legacy single-row treatment.
  return (
    <li>
      <button
        type="button"
        onClick={() => navigateForItem(item, navigate)}
        className={cn(
          "w-full text-left px-region py-2 pl-10 flex items-start gap-3 transition-colors",
          "hover:bg-surface focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-indigo/40",
        )}
      >
        <UrgencyDot urgency={item.urgency} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-0.5 flex-wrap">
            {item.task && (
              <span className="text-ink-700 font-medium">{item.task}</span>
            )}
            {item.dueDate && (
              <>
                {item.task && <span className="text-ink-300" aria-hidden>·</span>}
                <span className="inline-flex items-center gap-1">
                  due <DateLabel value={item.dueDate} format="auto" />
                </span>
              </>
            )}
            {item.stageLabel && (
              <>
                <span className="text-ink-300" aria-hidden>·</span>
                <span
                  className={
                    item.daysBehind && item.daysBehind > 7
                      ? "text-danger-ink font-medium"
                      : item.daysBehind && item.daysBehind > 0
                        ? "text-warn-ink"
                        : "text-ink-500"
                  }
                >
                  {item.stageLabel}
                  {item.daysBehind != null && item.daysBehind > 0 && (
                    <span className="ml-1">· {item.daysBehind}d behind</span>
                  )}
                </span>
              </>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-700">
              <Icon className="w-3 h-3" aria-hidden />
              <span className="font-medium">{item.verb}</span>
            </span>
          </div>
          <div className="text-sm text-ink-900">{item.action}</div>
          <div className="text-xs text-ink-500 mt-0.5">{item.context}</div>
        </div>
        <ChevronRight
          className="w-3.5 h-3.5 text-ink-400 shrink-0 mt-1"
          aria-hidden
        />
      </button>
    </li>
  );
}

// ── State alert row ───────────────────────────────────────────────────────
// state-monitor state-event row. Different shape: event headline + affected count.
// Pinned to the top of the queue. The cascade (alert → mutates Task →
// mutates outstanding TodoItems → re-ranks queue) happens upstream; this
// row is the "go act on it" entry point.
function StateAlertRowView({ row }: { row: StateAlertRow }) {
  const item = row.item;
  const navigate = useNavigate();
  return (
    <li className="group bg-surface" data-deadline-row>
      <button
        type="button"
        onClick={() => navigateForItem(item, navigate)}
        className="w-full text-left px-region py-3 flex items-start gap-3 hover:bg-sunken/40 transition-colors"
      >
        <UrgencyDot urgency={item.urgency} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-0.5 flex-wrap">
            <span className="text-2xs uppercase tracking-wider font-semibold text-ink-500">
              State alert
            </span>
            <span className="text-ink-300" aria-hidden>·</span>
            <span className="text-ink-900 font-medium">{item.client}</span>
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-700">
              <Megaphone className="w-3 h-3" aria-hidden />
              <span className="font-medium">Notify all</span>
            </span>
          </div>
          <div className="text-sm text-ink-900 font-medium">{item.action}</div>
          <div className="text-xs text-ink-500 mt-0.5">{item.context}</div>
        </div>
        <ChevronRight
          className="w-4 h-4 text-ink-400 group-hover:text-ink-700 shrink-0 mt-1"
          aria-hidden
        />
      </button>
    </li>
  );
}

// ── Bulk batch row ────────────────────────────────────────────────────────
// email-drafter "approve all" batches — multi-client by design (not a single-client
// chase, so doesn't fit the client-group model). One row, one approve action.
function BulkBatchRowView({ row }: { row: BulkBatchRow }) {
  const item = row.item;
  const Icon = VERB_ICON[item.verb];
  const navigate = useNavigate();
  return (
    <li className="group bg-surface" data-deadline-row>
      <button
        type="button"
        onClick={() => navigateForItem(item, navigate)}
        className="w-full text-left px-region py-3 flex items-start gap-3 hover:bg-sunken/40 transition-colors"
      >
        <UrgencyDot urgency={item.urgency} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-0.5">
            <Users className="w-3 h-3" aria-hidden />
            <span className="font-medium text-ink-900">{item.client}</span>
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-700">
              <Icon className="w-3 h-3" aria-hidden />
              <span className="font-medium">{item.verb}</span>
            </span>
          </div>
          <div className="text-sm text-ink-900 font-medium">{item.action}</div>
          <div className="text-xs text-ink-500 mt-0.5">{item.context}</div>
        </div>
        <ChevronRight
          className="w-4 h-4 text-ink-400 group-hover:text-ink-700 shrink-0 mt-1"
          aria-hidden
        />
      </button>
    </li>
  );
}
