import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Mail, ChevronRight, Filter as FilterIcon, X } from "lucide-react";
import { useStore } from "../data/store";
import { useSession } from "../data/session";
import type { ChecklistItem } from "../types";
import { EmailDraftModal, type EmailDraftIntent } from "../components/EmailDraftModal";
import { PageContainer } from "../components/ui/PageContainer";
import { PageHeader } from "../components/ui/PageHeader";
import { confirmWithUndo, confirmAllWithUndo } from "../lib/confirmWithUndo";
import { useSetChecklistItemState } from "../hooks/useChecklist";
import { TODAY, toIso, parseDate, daysBetween } from "../data/dateHelpers";
import { ClientChip } from "../components/ClientChip";

type Tab = "confirms" | "chases" | "all";
type Window = "all" | "overdue" | "this_week" | "this_month" | "long_term";

const WINDOWS: Array<{ key: Window; label: string }> = [
  { key: "all", label: "All windows" },
  { key: "overdue", label: "Overdue" },
  { key: "this_week", label: "This week" },
  { key: "this_month", label: "This month" },
  { key: "long_term", label: "Long term" },
];

/**
 * /to-review — bulk surface for routine decisions.
 *
 * Filtering: 4 dimensions stack.
 *   1. Tab — confirms / chases / all (the work-type axis)
 *   2. Staff — filter to one assignee (Yan Jing scale: 4+ preparers,
 *      "show me Priya's pile" is the most-used cut)
 *   3. State — filter to one filing state (CA / NY / TX / etc.)
 *      lets a CPA scan everything affected by a single state alert
 *   4. Window — overdue / this week / this month / long term
 *      week-windowed planning view
 *
 * Mid-firm value: Yan Jing has 600 clients, 4 preparers, files in
 * 12+ states. Without per-staff + per-state filters, /to-review is a
 * undifferentiated wall of 200+ items every morning. With them, each
 * preparer opens a 30-row "my work" view and works it down.
 */
export function Inbox() {
  const { checklistItems, tasks, clients } = useStore();
  const session = useSession();
  const today = toIso(TODAY);
  const setChecklistState = useSetChecklistItemState();
  const [tab, setTab] = useState<Tab>("confirms");
  const [emailIntent, setEmailIntent] = useState<EmailDraftIntent | null>(null);
  const [staffFilter, setStaffFilter] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [window, setWindow] = useState<Window>("all");

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients]
  );

  // Filter dimensions — pull unique values from current data so filter
  // chips only show options that exist. Hide the staff filter for solo
  // firms (only one preparer — useless).
  const showStaffFilter = session?.tier !== "solo";
  const staffOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      if (t.assignedUser) set.add(t.assignedUser);
    }
    return [...set].sort();
  }, [tasks]);
  const stateOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) {
      if (c.primaryState) set.add(c.primaryState);
    }
    return [...set].sort();
  }, [clients]);

  // Helper: does this checklist item match the current state/staff/window
  // filter? Used by both confirms + chases lists.
  const matchesFilters = (c: ChecklistItem): boolean => {
    const task = taskById.get(c.taskId);
    if (!task) return false;
    if (staffFilter && task.assignedUser !== staffFilter) return false;
    const client = clientById.get(task.clientId);
    if (stateFilter && client?.primaryState !== stateFilter) return false;
    if (window !== "all") {
      const days = daysBetween(TODAY, parseDate(task.officialDueDate));
      if (window === "overdue" && days >= 0) return false;
      if (window === "this_week" && (days < 0 || days > 7)) return false;
      if (window === "this_month" && (days < 0 || days > 31)) return false;
      if (window === "long_term" && days <= 31) return false;
    }
    return true;
  };

  // Confirms / chases filters are unchanged (the work-type cut), and
  // each is then narrowed by the four-axis filter via matchesFilters.
  const confirms = useMemo(
    () =>
      checklistItems
        .filter(
          (c) =>
            c.state === "received_unreviewed" &&
            !c.flagReason &&
            (c.aiConfidence === "high" || c.aiConfidence === "medium")
        )
        .filter(matchesFilters)
        .sort((a, b) =>
          (a.receivedAt ?? "").localeCompare(b.receivedAt ?? ""),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checklistItems, staffFilter, stateFilter, window],
  );

  const needsContextCount = useMemo(
    () =>
      checklistItems.filter(
        (c) =>
          c.state === "received_unreviewed" &&
          (c.flagReason ||
            c.aiConfidence === "low" ||
            !c.aiConfidence)
      ).length,
    [checklistItems]
  );

  // Chases that belong in the fast lane: due today on routine cadence.
  // Stalled cases (>14 days post-reminder, no response) are excluded —
  // they need a phone call, not another email, and the Dashboard's
  // Quiet-Clients banner already surfaces them. Without this cut, the
  // same item shows in two places and bloats the badge into a wall.
  const STALLED_HOURS = 14 * 24;
  const hoursSinceIso = (iso: string) =>
    (Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000);
  const chases = useMemo(
    () =>
      checklistItems
        .filter(
          (c) =>
            c.state === "requested_waiting" &&
            c.nextReminderAt &&
            c.nextReminderAt <= today &&
            (!c.lastReminderAt ||
              hoursSinceIso(c.lastReminderAt) < STALLED_HOURS)
        )
        .filter(matchesFilters)
        .sort((a, b) =>
          (a.lastReminderAt ?? "").localeCompare(b.lastReminderAt ?? ""),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checklistItems, today, staffFilter, stateFilter, window],
  );

  // Items we excluded from chases because they're quiet-client cases
  // (>14 days since last reminder, no response). Surface a one-line
  // callout pointing to the Dashboard's Quiet-Clients banner so the
  // CPA knows where those items went — they need a phone call, not
  // another email.
  const quietClientCount = useMemo(
    () =>
      checklistItems.filter(
        (c) =>
          c.state === "requested_waiting" &&
          c.lastReminderAt &&
          hoursSinceIso(c.lastReminderAt) >= STALLED_HOURS
      ).length,
    [checklistItems]
  );

  const visible =
    tab === "confirms" ? confirms : tab === "chases" ? chases : [...confirms, ...chases];

  const onConfirm = (id: string) => {
    const item = checklistItems.find((c) => c.id === id);
    if (item) confirmWithUndo(item, setChecklistState);
  };

  const onSend = (item: ChecklistItem) => {
    const task = taskById.get(item.taskId);
    const client = task ? clientById.get(task.clientId) : null;
    if (!task || !client) return;
    setEmailIntent({ task, client, checklistItem: item });
  };

  const onConfirmAll = () => {
    confirmAllWithUndo(confirms, setChecklistState);
  };

  const hasActiveFilter =
    staffFilter !== null || stateFilter !== null || window !== "all";
  const clearFilters = () => {
    setStaffFilter(null);
    setStateFilter(null);
    setWindow("all");
  };

  return (
    <PageContainer variant="wide" className="space-y-card">
      <PageHeader title="To review" className="mb-region" />
      <p className="text-caption text-ink-500 max-w-2xl -mt-region">
        Routine decisions you can clear in 5 seconds each — AI is confident
        about every item here. Anything ambiguous (low confidence, flagged,
        custom items) waits for you on its task page where you can see the
        context.
      </p>

      {(needsContextCount > 0 || quietClientCount > 0) && (
        <div className="text-2xs text-ink-500 space-y-0.5">
          {needsContextCount > 0 && (
            <p>
              Plus {needsContextCount} document
              {needsContextCount === 1 ? "" : "s"} that{" "}
              {needsContextCount === 1 ? "needs" : "need"} more context —
              flagged, AI uncertain, or custom. Those live on their task pages
              where you can see what surrounds them.
            </p>
          )}
          {quietClientCount > 0 && (
            <p>
              Plus {quietClientCount} chase
              {quietClientCount === 1 ? "" : "s"} where the client has been
              quiet for over two weeks — those are surfaced on the{" "}
              <Link to="/" className="underline hover:text-ink-900">
                dashboard's Quiet Clients banner
              </Link>{" "}
              because email reminders aren't moving the needle anymore.
            </p>
          )}
        </div>
      )}

      <div className="border-b border-line flex gap-1">
        <TabButton
          active={tab === "confirms"}
          onClick={() => setTab("confirms")}
          label="Confirm AI-sorted docs"
          count={confirms.length}
        />
        <TabButton
          active={tab === "chases"}
          onClick={() => setTab("chases")}
          label="Send scheduled reminders"
          count={chases.length}
        />
        <TabButton
          active={tab === "all"}
          onClick={() => setTab("all")}
          label="All"
          count={confirms.length + chases.length}
        />
      </div>

      {/* Filter bar — 4-axis cuts beyond the tab. Surfaces only the
          dimensions that have data; for solo firms the staff dropdown
          hides entirely. */}
      <FilterBar
        showStaffFilter={showStaffFilter && staffOptions.length > 1}
        staffOptions={staffOptions}
        stateOptions={stateOptions}
        staffFilter={staffFilter}
        setStaffFilter={setStaffFilter}
        stateFilter={stateFilter}
        setStateFilter={setStateFilter}
        windowFilter={window}
        setWindowFilter={setWindow}
        hasActiveFilter={hasActiveFilter}
        clearFilters={clearFilters}
        currentSession={session?.userName ?? null}
      />

      {tab === "confirms" && confirms.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={onConfirmAll}
            className="text-xs px-3 py-1.5 rounded bg-warn-bg text-warn-ink border border-warn-border hover:bg-warn-bg/70"
          >
            Confirm all {confirms.length}
            {hasActiveFilter && " (filtered)"}
          </button>
          <p className="text-2xs text-ink-500">
            Each confirmation is logged in the activity timeline.
          </p>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="bg-surface border border-line rounded-md p-8 text-center">
          {hasActiveFilter ? (
            <>
              <p className="text-sm text-ink-900 font-medium">
                Nothing matches these filters.
              </p>
              <button
                onClick={clearFilters}
                className="inline-block mt-3 text-xs px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-sunken"
              >
                Clear filters
              </button>
            </>
          ) : needsContextCount > 0 ? (
            <>
              <p className="text-sm text-ink-900 font-medium">
                Fast lane is empty.
              </p>
              <p className="text-2xs text-ink-500 mt-1 max-w-md mx-auto">
                The {needsContextCount} pending document
                {needsContextCount === 1 ? "" : "s"} need
                {needsContextCount === 1 ? "s" : ""} more context than this
                surface offers — open the relevant task to see surrounding
                documents and decide.
              </p>
              <Link
                to="/"
                className="inline-block mt-3 text-xs px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-sunken"
              >
                Back to dashboard
              </Link>
            </>
          ) : (
            <p className="text-sm text-ink-500">All clear. Nothing waiting.</p>
          )}
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-md overflow-hidden">
          <ul className="divide-y divide-line">
            {visible.map((c) => {
              const task = taskById.get(c.taskId);
              const client = task ? clientById.get(task.clientId) : null;
              if (!task || !client) return null;
              const isConfirm = c.state === "received_unreviewed";
              return (
                <li key={c.id} className="px-4 py-3 flex items-center gap-3">
                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      isConfirm
                        ? "bg-info-bg border-info-border"
                        : "bg-sunken border-line"
                    }`}
                  >
                    {isConfirm ? (
                      <span className="w-2 h-2 rounded-full bg-info-solid" />
                    ) : (
                      <span className="text-2xs text-ink-500">⏱</span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-900 truncate">
                      <ClientChip
                        client={client}
                        size="sm"
                        as="span"
                        showState
                      />
                      <span className="text-ink-400"> · </span>
                      {c.label}
                    </p>
                    <p className="text-2xs text-ink-500">
                      {task.formType}
                      {/* primaryState now lives inside the ClientChip
                          above — single source for client identity. */}
                      {showStaffFilter && task.assignedUser && (
                        <>
                          {" · "}
                          {task.assignedUser}
                        </>
                      )}
                      {c.aiClassification && (
                        <>
                          {" · "}AI thinks {c.aiClassification.toLowerCase()}
                        </>
                      )}
                      {c.aiConfidence && (
                        <span
                          className={`ml-1 inline-block text-2xs uppercase tracking-wide px-1 rounded ${
                            c.aiConfidence === "high"
                              ? "bg-ok-bg text-ok-ink"
                              : c.aiConfidence === "medium"
                              ? "bg-info-bg text-info-ink"
                              : "bg-warn-bg text-warn-ink"
                          }`}
                        >
                          AI {c.aiConfidence}
                        </span>
                      )}
                      {c.lastReminderAt && (
                        <>
                          {" · last reminder "}
                          {c.lastReminderAt.slice(0, 10)}
                        </>
                      )}
                    </p>
                  </div>
                  <Link
                    to={`/clients/${client.id}?task=${task.id}`}
                    className="text-xs text-ink-500 hover:text-ink-900 px-2 py-1 rounded hover:bg-sunken inline-flex items-center gap-1"
                  >
                    Open <ChevronRight className="w-3 h-3" aria-hidden />
                  </Link>
                  {isConfirm ? (
                    <button
                      onClick={() => onConfirm(c.id)}
                      className="text-xs px-3 py-1.5 rounded bg-warn-bg text-warn-ink border border-warn-border hover:bg-warn-bg/70 inline-flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" aria-hidden /> Confirm
                    </button>
                  ) : (
                    <button
                      onClick={() => onSend(c)}
                      className="text-xs px-3 py-1.5 rounded bg-indigo text-white hover:bg-indigo-hover inline-flex items-center gap-1"
                    >
                      <Mail className="w-3 h-3" aria-hidden /> Send
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <EmailDraftModal
        open={!!emailIntent}
        intent={emailIntent}
        onClose={() => setEmailIntent(null)}
      />
    </PageContainer>
  );
}

function FilterBar({
  showStaffFilter,
  staffOptions,
  stateOptions,
  staffFilter,
  setStaffFilter,
  stateFilter,
  setStateFilter,
  windowFilter,
  setWindowFilter,
  hasActiveFilter,
  clearFilters,
  currentSession,
}: {
  showStaffFilter: boolean;
  staffOptions: string[];
  stateOptions: string[];
  staffFilter: string | null;
  setStaffFilter: (v: string | null) => void;
  stateFilter: string | null;
  setStateFilter: (v: string | null) => void;
  windowFilter: Window;
  setWindowFilter: (v: Window) => void;
  hasActiveFilter: boolean;
  clearFilters: () => void;
  currentSession: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-2xs">
      <FilterIcon className="w-3 h-3 text-ink-400" aria-hidden />

      {showStaffFilter && (
        <FilterDropdown
          label="Anyone"
          activeLabel={
            staffFilter
              ? staffFilter === currentSession
                ? `${staffFilter} (you)`
                : staffFilter
              : null
          }
          options={[
            ...(currentSession && staffOptions.includes(currentSession)
              ? [{ value: currentSession, label: `${currentSession} (you)` }]
              : []),
            ...staffOptions
              .filter((s) => s !== currentSession)
              .map((s) => ({ value: s, label: s })),
          ]}
          selected={staffFilter}
          onSelect={setStaffFilter}
        />
      )}

      <FilterDropdown
        label="Any state"
        activeLabel={stateFilter}
        options={stateOptions.map((s) => ({ value: s, label: s }))}
        selected={stateFilter}
        onSelect={setStateFilter}
      />

      {/* Window — chip strip, not a dropdown, since we always want
          all 5 visible (the planning lens is the same for every CPA) */}
      <div className="flex gap-0.5 ml-1">
        {WINDOWS.map((w) => (
          <button
            key={w.key}
            onClick={() => setWindowFilter(w.key)}
            className={[
              "px-2 py-0.5 rounded uppercase tracking-wide font-medium",
              windowFilter === w.key
                ? "bg-ink-900 text-surface"
                : "text-ink-500 hover:bg-sunken hover:text-ink-900",
            ].join(" ")}
          >
            {w.label}
          </button>
        ))}
      </div>

      {hasActiveFilter && (
        <button
          onClick={clearFilters}
          className="ml-auto text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-sunken"
        >
          <X className="w-2.5 h-2.5" aria-hidden /> Clear filters
        </button>
      )}
    </div>
  );
}

function FilterDropdown({
  label,
  activeLabel,
  options,
  selected,
  onSelect,
}: {
  label: string;
  activeLabel: string | null;
  options: Array<{ value: string; label: string }>;
  selected: string | null;
  onSelect: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  if (options.length === 0) return null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "px-2 py-0.5 rounded border inline-flex items-center gap-1 uppercase tracking-wide font-medium",
          selected
            ? "bg-info-bg text-info-ink border-info-border"
            : "border-line text-ink-500 hover:bg-sunken hover:text-ink-900",
        ].join(" ")}
      >
        {activeLabel ?? label}
        <span className="text-ink-300 text-2xs">⌄</span>
      </button>
      {open && (
        <>
          <span
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full mt-1 z-40 bg-surface border border-line rounded-md shadow-overlay py-1 min-w-[8rem]">
            <button
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-sunken ${
                !selected ? "text-ink-900 font-medium" : "text-ink-700"
              }`}
            >
              {label}
            </button>
            <div className="border-t border-line my-1" />
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onSelect(o.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-sunken ${
                  selected === o.value
                    ? "text-ink-900 font-medium"
                    : "text-ink-700"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm flex items-center gap-2 -mb-px border-b-[1.5px] ${
        active
          ? "text-ink-900 border-ink-900 font-medium"
          : "border-transparent text-ink-500 hover:text-ink-700"
      }`}
    >
      {label}
      <span className="text-2xs text-ink-400 tabular-nums">{count}</span>
    </button>
  );
}
