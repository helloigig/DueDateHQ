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
import { actions, useStore } from "../data/store";
import { DateLabel } from "./ui/DateLabel";
import { DotStack } from "./ui/DotStack";
import { SectionHeader } from "./ui/SectionHeader";
import { StateChipGroup } from "./StateChipGroup";
import { ChaseBundleModal, type ChaseItem } from "./ChaseBundleModal";
import { cn } from "../lib/utils";
import {
  buildQueueRows,
  summarizeClientGroup,
  summarizeClientGroupTasks,
  type ClientGroupRow,
  type BulkBatchRow,
  type QueueTodoItem,
} from "../lib/queueGrouping";
import type { Client } from "../types";

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
  // Wrap the 8px dot in a 16x16 container that matches the chevron column
  // on the per-client row, so leading icons + the text after them sit at
  // the same x position regardless of which row variant rendered.
  return (
    <span
      className="w-4 h-4 shrink-0 flex items-center justify-center pt-0.5"
      aria-label={URGENCY_LABEL[urgency]}
      role="img"
    >
      <span
        className={cn(
          "w-2 h-2 rounded-pill",
          URGENCY_DOT_CLASS[urgency],
        )}
        aria-hidden
      />
    </span>
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

  // Pull every client once so the per-row identity strip can render
  // primary + nexus state pills without N round-trips. Mock mode reads
  // the store; real mode falls through to the same shape via mock-
  // adapter. The map is keyed by id so per-row lookup is O(1).
  const storeClients = useStore().clients;
  const clientsById = useMemo(() => {
    const m = new Map<string, Client>();
    for (const c of storeClients) m.set(c.id, c);
    return m;
  }, [storeClients]);

  const rows = buildQueueRows(items);
  const visibleCount = expanded ? rows.length : 5;
  const visible = rows.slice(0, visibleCount);
  const hidden = rows.length - visibleCount;

  return (
    <section className="mb-section" aria-labelledby="action-queue-heading">
      <SectionHeader
        title={<span id="action-queue-heading">Action queue</span>}
        // Yuqi audit 2026-05-06: section header meta normalized to
        // "{count} {entity-noun}" across Today / ActionQueue / Timeline so
        // the strip reads consistently. Items lead because they're the
        // unit the user acts on; the client count is implied by the row
        // grouping below.
        meta={`${items.length} ${items.length === 1 ? "item" : "items"} across ${rows.length} ${rows.length === 1 ? "client" : "clients"}`}
      />
      <div className="bg-surface border border-line rounded-md overflow-hidden">
        <ul className="divide-y divide-line" role="list">
          {visible.map((row) => {
            if (row.kind === "bulk_batch")
              return <BulkBatchRowView key={row.key} row={row} />;
            return (
              <ClientGroupRowView
                key={row.key}
                row={row}
                client={
                  row.clientId ? clientsById.get(row.clientId) : undefined
                }
              />
            );
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
    navigate(`/clients/${item.clientId}?task=${item.taskId}`);
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
function ClientGroupRowView({
  row,
  client,
}: {
  row: ClientGroupRow;
  client?: Client;
}) {
  const [open, setOpen] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);
  const summary = summarizeClientGroup(row);
  const taskScope = summarizeClientGroupTasks(row);
  const checklistStates = aggregateChecklistStates(row.items);
  // "last sent Yd ago" — derive from the max `daysBehind` across Send
  // items in this group. daysBehind is the chase-loop's stuck duration
  // (days since the most recent reminder), so the max across this
  // client's sends approximates "last sent for any of these" — close
  // enough for the demo. Falls back to omitting the footer fragment
  // when no Send item carries the field.
  const lastSentDays = (() => {
    let max = 0;
    let any = false;
    for (const it of row.items) {
      if (it.verb === "Send" && typeof it.daysBehind === "number") {
        any = true;
        if (it.daysBehind > max) max = it.daysBehind;
      }
    }
    return any ? max : null;
  })();

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
      {/* Header — caret + identity (name + state pills) on the left,
          Send button on the right. The caret/identity area toggles
          expand; the Send button is a sibling sitting outside that
          click target so a single click on it doesn't also expand
          the panel. */}
      <div
        className={cn(
          "flex items-start gap-2 px-region py-3 transition-colors",
          "hover:bg-sunken",
          open && "bg-canvas/70",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Collapse client" : "Expand client"}
          className={cn(
            "flex-1 min-w-0 text-left flex items-start gap-2",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo/40 rounded",
          )}
        >
          {/* Caret — collapse indicator on the left, matching the
              mockup. Up = open, right = collapsed. */}
          <span className="pt-0.5 shrink-0 text-ink-400 group-hover:text-ink-700 transition-colors">
            {open ? (
              <ChevronDown className="w-4 h-4" aria-hidden />
            ) : (
              <ChevronRight className="w-4 h-4" aria-hidden />
            )}
          </span>
          <div className="flex-1 min-w-0">
            {/* Identity row — client name (small, muted) + primary +
                nexus state pills inline. The name is a Link so a
                middle-click / cmd-click opens the client without
                expanding this row. */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {row.clientId ? (
                <Link
                  to={`/clients/${row.clientId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-ink-500 hover:text-ink-900 hover:underline truncate"
                >
                  {row.clientName}
                </Link>
              ) : (
                <span className="text-xs text-ink-500 truncate">
                  {row.clientName}
                </span>
              )}
              {client && (
                <StateChipGroup
                  primary={client.primaryState}
                  nexus={client.nexusStates}
                />
              )}
            </div>
            {/* Title — verb breakdown, big and bold. The expanded child
                list below shows exactly the same N items that this
                summary describes; the row's footer count agrees. */}
            <h3 className="text-base font-semibold text-ink-900 leading-snug">
              {summary}
            </h3>
            {/* Meta row: dot stack (chase-loop status across the items)
                + task scope ("across F-1120") + last-sent recency.
                The action count is implicit in the verb breakdown above
                — we don't print "{N} items pending" again because that
                drifted from `summary` whenever the two used different
                denominators. */}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <DotStack
                states={checklistStates.map((c) => c.state)}
                maxVisible={12}
              />
              {taskScope && (
                <span className="text-xs text-ink-500">{taskScope}</span>
              )}
              {lastSentDays != null && (
                <span className="text-xs text-ink-400">
                  · last sent {lastSentDays}d ago
                </span>
              )}
            </div>
          </div>
        </button>
        {/* Send button — opens the bundle modal with whatever items
            are currently selected (defaults to all chase-eligible).
            Visible in both collapsed and expanded states so one click
            sends without forcing the user to expand first. Disabled
            when no items are eligible. */}
        {allChaseItems.length > 0 && (
          <button
            type="button"
            onClick={() => setBundleOpen(true)}
            disabled={checkedCount === 0}
            title={
              checkedCount === 0
                ? "Expand to pick items"
                : `Send ${checkedCount} in one email`
            }
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors",
              "border-line bg-surface text-ink-700 hover:bg-sunken",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            <Mail className="w-3.5 h-3.5" aria-hidden />
            Send
          </button>
        )}
      </div>

      {open && (
        <div className="bg-sunken/40 border-t border-line">
          <ul className="divide-y divide-line/60">
            {groupItemsByTask(row.items).map((tg) => (
              <TaskGroupRow
                key={tg.key}
                group={tg}
                checked={checked}
                onToggle={(id) =>
                  setChecked((p) => ({ ...p, [id]: !p[id] }))
                }
              />
            ))}
          </ul>
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

// statusSummary / CHECKLIST_DOT_CLASS / CHECKLIST_STATE_LABEL retired
// 2026-05-06 — the redesign drops the per-item state dot and full
// "Awaiting client" label in favour of a checkbox + optional
// "Follow-up" tag (clean per the mockup). The chase-loop story is
// told by the parent row's DotStack, which already reads the same
// state palette via DotStack's internal map.

// Group items by (taskId | task+dueDate) so multiple TodoItems for the
// same task share a single header. Two items can land on the same task
// when, e.g., Mode B emits a "Collect" chase row and Mode C emits a
// "Review" anomaly flag against the same form — both belong under one
// "F-1120 (FL corporate) · due May 1" header rather than repeating it.
type TaskGroup = {
  key: string;
  task?: string;
  dueDate?: string;
  // Items grouped by render type. Mode-B chase rows carry a checklist
  // snapshot; Mode-A/C/etc. rows render as inline action items below.
  modeBItems: QueueTodoItem[];
  actionItems: QueueTodoItem[];
};

function groupItemsByTask(items: QueueTodoItem[]): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  const order: string[] = [];
  for (const it of items) {
    const key =
      it.taskId ??
      (it.task && it.dueDate ? `${it.task}|${it.dueDate}` : `id:${it.id}`);
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        task: it.task,
        dueDate: it.dueDate,
        modeBItems: [],
        actionItems: [],
      };
      groups.set(key, g);
      order.push(key);
    }
    if (it.checklistItems && it.checklistItems.length > 0) {
      g.modeBItems.push(it);
    } else {
      g.actionItems.push(it);
    }
  }
  return order.map((k) => groups.get(k)!);
}

// One render block per task within an expanded client group. Renders the
// task header (form + due date) ONCE, then all action items beneath:
// Mode-B chase checkboxes, then Mode-A/C/etc. inline action rows. The
// per-task header dedup is the load-bearing fix — without it, a task
// with both a chase and an anomaly flag repeats its header twice.
//
// Selection state for the checkboxes is OWNED by the parent
// ClientGroupRowView so a single Send bar at the bottom of the expanded
// panel can bundle items across multiple tasks (PRD §7.3 — one chase
// loop per email).
function TaskGroupRow({
  group,
  checked,
  onToggle,
}: {
  group: TaskGroup;
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const navigate = useNavigate();
  const hasContent =
    group.modeBItems.length > 0 || group.actionItems.length > 0;
  if (!hasContent) return null;

  return (
    <li className="px-region py-3 pl-10 bg-surface/60">
      {/* Task header — bold form name + due date, rendered ONCE per
          task. Matches the mockup's "TX Franchise · due May 15"
          pattern. Multiple TodoItems on the same task (e.g. a Mode B
          chase + a Mode C anomaly flag) all share this single header. */}
      {(group.task || group.dueDate) && (
        <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
          {group.task && (
            <span className="text-sm text-ink-900 font-semibold">
              {group.task}
            </span>
          )}
          {group.dueDate && (
            <span className="inline-flex items-baseline gap-1 text-xs text-ink-500">
              due <DateLabel value={group.dueDate} format="auto" />
            </span>
          )}
        </div>
      )}

      <ul className="space-y-1">
        {/* Mode-B checklist rows — flatten checklistItems across all
            Mode-B TodoItems on this task into a single checkbox list.
            Items in `requested_waiting` have already been chased once →
            tag them as "Follow-up" so first-asks vs. re-asks read at a
            glance. State dots / full state labels are intentionally
            dropped; the chase-loop story is told by the parent row's
            DotStack. */}
        {group.modeBItems.map((item) =>
          (item.checklistItems ?? []).map((ci) => {
            const k = `${item.taskId ?? item.id}:${ci.id}`;
            const disabled =
              ci.state === "received_confirmed" ||
              ci.state === "not_applicable";
            const isChecked = !disabled && (checked[k] ?? false);
            const isFollowUp = ci.state === "requested_waiting";
            return (
              <li
                key={k}
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
                <span className="flex-1 truncate">{ci.label}</span>
                {isFollowUp && (
                  <span className="text-2xs text-warn-ink shrink-0">
                    Follow-up
                  </span>
                )}
              </li>
            );
          }),
        )}

        {/* Non-Mode-B rows (Mode A inbound to confirm, Mode C anomaly
            flag, replies, etc.) — inline action rows that match the
            checkbox-row rhythm above. Click navigates to the action
            surface; right-side pill names the verb. */}
        {group.actionItems.map((item) => {
          const Icon = VERB_ICON[item.verb];
          const verbLabel =
            item.verb === "Confirm"
              ? "Confirm"
              : item.verb === "Discuss"
                ? "Reply"
                : item.verb;
          return (
            <li
              key={item.id}
              className="rounded transition-colors hover:bg-canvas cursor-pointer"
              onClick={() => navigateForItem(item, navigate)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigateForItem(item, navigate);
                }
              }}
            >
              <div className="flex items-start gap-2 px-1.5 py-1.5">
                <span
                  className={cn(
                    "inline-block w-1.5 h-1.5 rounded-pill shrink-0 mt-1.5",
                    URGENCY_DOT_CLASS[item.urgency],
                  )}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink-900">{item.action}</div>
                  {item.context && (
                    <div className="text-xs text-ink-500 mt-0.5 line-clamp-2">
                      {item.context}
                    </div>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-ink-700 shrink-0 mt-0.5">
                  <Icon className="w-3 h-3" aria-hidden />
                  <span className="font-medium">{verbLabel}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-ink-400" aria-hidden />
                </span>
              </div>
            </li>
          );
        })}
      </ul>
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
        className="w-full text-left px-region py-3 flex items-start gap-2 hover:bg-sunken/40 transition-colors"
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
