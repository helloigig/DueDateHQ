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
  type ClientGroupRow,
  type StateAlertRow,
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
  const checklistStates = aggregateChecklistStates(row.items);
  // Pending = anything not confirmed / not_applicable (the chase loop
  // is still open). The mockup's "{N} items pending · last sent {Y}d
  // ago" footer reads this number.
  const pendingCount = checklistStates.filter(
    (c) => c.state !== "received_confirmed" && c.state !== "not_applicable",
  ).length;
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
            {/* Title — verb summary, big and bold per the mockup
                ("Send 7 reminders · across TX Franchise + 941"). */}
            <h3 className="text-base font-semibold text-ink-900 leading-snug">
              {summary}
            </h3>
            {/* Dot row + status line — dots above, "{N} items pending ·
                last sent {Y}d ago" below. The dots tell the chase-loop
                story; the line gives the count + recency at a glance. */}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <DotStack
                states={checklistStates.map((c) => c.state)}
                maxVisible={12}
              />
              <span className="text-xs text-ink-500">
                {pendingCount} {pendingCount === 1 ? "item" : "items"} pending
                {lastSentDays != null && (
                  <>
                    {" · "}
                    <span className="text-ink-400">
                      last sent {lastSentDays}d ago
                    </span>
                  </>
                )}
              </span>
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
      <li className="px-region py-3 pl-10 bg-surface/60">
        {/* Task header — bold form name + due date. Matches the
            mockup's "TX Franchise · due May 15" pattern. The full
            state-label strip is gone (it lived per-item on the row
            below before; the state is now communicated by checkbox
            disabled-state + the optional "Follow-up" tag). */}
        <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
          {item.task && (
            <span className="text-sm text-ink-900 font-semibold">
              {item.task}
            </span>
          )}
          {item.dueDate && (
            <span className="inline-flex items-baseline gap-1 text-xs text-ink-500">
              due <DateLabel value={item.dueDate} format="auto" />
            </span>
          )}
          {item.stageLabel && (
            <span className="text-2xs text-ink-400">
              · {item.stageLabel}
            </span>
          )}
        </div>
        {/* Per-checklist-item rows — checkbox + label + optional
            "Follow-up" tag. Items in `requested_waiting` have already
            been chased once → tag them as a follow-up so the CPA can
            see at a glance which are first-asks vs. re-asks. State
            dots and full state labels are dropped; the chase-loop
            story is told by the parent row's DotStack instead. */}
        <ul className="space-y-1">
          {item.checklistItems.map((ci) => {
            const k = taskScopedKey(ci.id);
            const disabled =
              ci.state === "received_confirmed" ||
              ci.state === "not_applicable";
            const isChecked = !disabled && (checked[k] ?? false);
            const isFollowUp = ci.state === "requested_waiting";
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
                <span className="flex-1 truncate">{ci.label}</span>
                {isFollowUp && (
                  <span className="text-2xs text-warn-ink shrink-0">
                    Follow-up
                  </span>
                )}
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
