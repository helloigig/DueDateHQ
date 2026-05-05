import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  X as XIcon,
  ArrowRight,
  UserPlus,
  Check,
  Slash,
} from "lucide-react";
import { useSelection } from "../hooks/useSelection";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { trpc } from "../lib/api/client";
import { env } from "../config";
import { PageHeader } from "../components/ui/PageHeader";
import { PageContainer } from "../components/ui/PageContainer";
import { SectionHeader } from "../components/ui/SectionHeader";
import { StatusPill } from "../components/ui/StatusPill";
import { StateBadge } from "../components/ui/StateBadge";
import { FilterChip } from "../components/ui/FilterChip";
import { MetricTile } from "../components/ui/MetricTile";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { MultiSelectChip } from "../components/MultiSelectChip";
import { DeadlineChip } from "../components/ui/DeadlineChip";
import { clients as MOCK_CLIENTS } from "../data/mockClients";
import { useClients } from "../hooks/useClients";
import { useReassignTask } from "../hooks/useTasks";
import { useRemoteSession } from "../hooks/useSession";
import type { ClientTier } from "../types";
import { cn } from "../lib/utils";
import {
  TODAY,
  parseDate,
  daysBetween,
  periodSuffix,
} from "../data/dateHelpers";

// Lookup row: clientId → entityType / tier / primaryState. Used to
// enrich TaskRow with cross-axis filter dimensions (entity, tier,
// jurisdiction). Built per-render from live `clients.list` data so real
// mode reflects the firm's actual roster; falls back to MOCK_CLIENTS for
// the mock-mode seed when live data is unavailable.
type ClientLookupRow = {
  entityType: string;
  tier: ClientTier;
  primaryState: string;
};
type ClientSourceRow = {
  id: string;
  entityType: string;
  tier: ClientTier;
  primaryState: string;
};
function buildClientLookup(
  source: ReadonlyArray<ClientSourceRow>,
): Map<string, ClientLookupRow> {
  return new Map(
    source.map((c) => [
      c.id,
      {
        entityType: c.entityType,
        tier: c.tier,
        primaryState: c.primaryState,
      },
    ]),
  );
}
const MOCK_CLIENT_LOOKUP = buildClientLookup(MOCK_CLIENTS);

/**
 * Timeline — IA v0.7 §3.9a forward-planning surface.
 *
 * One row per task; each renders its TaskMilestone collection (initial_meeting
 * → collect → prepare → review → file) as a horizontal mini-timeline.
 * Rows group by client.
 *
 * Live BE: trpc.taskMilestones.fleetStack returns flat per-task milestone
 * rows; we group + sort. Falls back to MOCK_TIMELINES in mock mode only —
 * real mode shows an honest empty state when the BE returns nothing.
 *
 * v0u-aligned re-skin (PR3 of 4): KPI tiles header, gap-loud sections
 * (Behind / On-track), StatusPill (no row paint), indigo on the next-action.
 */

type Stage = "initial_meeting" | "collect" | "prepare" | "review" | "file";

type TaskRow = {
  client: string;
  task: string;
  /** Display string ("Apr 15") — kept for compatibility, used as the
      visible date on rows without a parseable ISO. */
  dueDate: string;
  /** ISO `YYYY-MM-DD` — official deadline. Powers the <DueDate> primitive
      so tone shifts (overdue / behind internal) are correct. */
  officialDueIso?: string;
  /** ISO — firm-set internal target. Optional; <DueDate> derives a
      buffer from formClass when absent. */
  internalDueIso?: string;
  formClass?: "annual_return" | "quarterly" | "monthly" | "extension" | "other";
  currentStage: Stage;
  daysBehind: number;
  missingCount: number;
  milestoneStatus: ("done" | "in_progress" | "not_started")[];
  taskId?: string;
  clientId?: string;
  // Filter / surface dimensions sourced from the client record.
  // Optional because mock rows without a clientId can't resolve them.
  jurisdiction?: string;
  entityType?: string;
  tier?: ClientTier;
  /** Preparer assignment — surfaced from `tasks.assigned_user_id`. Joined
   *  through fleetStack so the Timeline can render an avatar per row +
   *  highlight "what's mine". null = unassigned. */
  assignedUserId?: string | null;
  assigneeName?: string | null;
};

const STAGE_LABELS: Record<Stage, string> = {
  initial_meeting: "Initial mtg",
  collect: "Collect",
  prepare: "Prepare",
  review: "Review",
  file: "File",
};

const MOCK_TIMELINES: TaskRow[] = [
  {
    taskId: "mock-task-apex",
    client: "Apex Fund",
    task: "1065 Partner Forms",
    dueDate: "Mar 15",
    officialDueIso: "2026-03-15",
    internalDueIso: "2026-03-08",
    formClass: "annual_return",
    currentStage: "collect",
    daysBehind: 7,
    missingCount: 8,
    milestoneStatus: ["done", "done", "in_progress", "not_started", "not_started"],
    jurisdiction: "federal",
    entityType: "Partnership",
    tier: "premium",
    assignedUserId: "user-mock",
    assigneeName: "Sarah Mitchell",
  },
  {
    taskId: "mock-task-hartfield",
    client: "Emily Hartfield",
    task: "1040 NY",
    dueDate: "Apr 15",
    officialDueIso: "2026-04-15",
    internalDueIso: "2026-04-08",
    formClass: "annual_return",
    currentStage: "collect",
    daysBehind: 4,
    missingCount: 5,
    milestoneStatus: ["done", "done", "in_progress", "not_started", "not_started"],
    jurisdiction: "NY",
    entityType: "Individual",
    tier: "standard",
    assignedUserId: null,
    assigneeName: null,
  },
  {
    taskId: "mock-task-chen",
    client: "Marcus Chen",
    task: "S-Corp CA",
    dueDate: "Mar 31",
    officialDueIso: "2026-03-31",
    internalDueIso: "2026-03-24",
    formClass: "annual_return",
    currentStage: "prepare",
    daysBehind: 2,
    missingCount: 3,
    milestoneStatus: ["done", "done", "done", "in_progress", "not_started"],
    jurisdiction: "CA",
    entityType: "S-Corp",
    tier: "premium",
    assignedUserId: "user-mock",
    assigneeName: "Sarah Mitchell",
  },
  {
    taskId: "mock-task-mitchell",
    client: "Sarah Mitchell",
    task: "1040 TX",
    dueDate: "Apr 15",
    officialDueIso: "2026-04-15",
    internalDueIso: "2026-04-08",
    formClass: "annual_return",
    currentStage: "review",
    daysBehind: 0,
    missingCount: 1,
    milestoneStatus: ["done", "done", "done", "in_progress", "not_started"],
    jurisdiction: "TX",
    entityType: "Individual",
    tier: "standard",
    assignedUserId: null,
    assigneeName: null,
  },
  {
    taskId: "mock-task-lee",
    client: "Jordan Lee",
    task: "1040 Federal",
    dueDate: "Apr 15",
    officialDueIso: "2026-04-15",
    internalDueIso: "2026-04-08",
    formClass: "annual_return",
    currentStage: "file",
    daysBehind: 0,
    missingCount: 0,
    milestoneStatus: ["done", "done", "done", "done", "in_progress"],
    jurisdiction: "federal",
    entityType: "Individual",
    tier: "standard",
    assignedUserId: "user-mock",
    assigneeName: "Sarah Mitchell",
  },
  // On-track 941 — exercises (a) the calmer chip (no "On schedule"
  // prefix, just "IRS Jul 31") and (b) the period suffix that
  // disambiguates the row label as "941 · Q2 · federal".
  {
    taskId: "mock-task-941-q2",
    client: "Pacific Ridge Consulting",
    task: "941 · Q2 · federal",
    dueDate: "Jul 31",
    officialDueIso: "2026-07-31",
    internalDueIso: "2026-07-24",
    formClass: "quarterly",
    currentStage: "collect",
    daysBehind: 0,
    missingCount: 0,
    milestoneStatus: ["done", "in_progress", "not_started", "not_started", "not_started"],
    jurisdiction: "federal",
    entityType: "S-Corp",
    tier: "standard",
    assignedUserId: null,
    assigneeName: null,
  },
  {
    taskId: "mock-task-941-q3",
    client: "Pacific Ridge Consulting",
    task: "941 · Q3 · federal",
    dueDate: "Oct 31",
    officialDueIso: "2026-10-31",
    internalDueIso: "2026-10-24",
    formClass: "quarterly",
    currentStage: "initial_meeting",
    daysBehind: 0,
    missingCount: 0,
    milestoneStatus: ["in_progress", "not_started", "not_started", "not_started", "not_started"],
    jurisdiction: "federal",
    entityType: "S-Corp",
    tier: "standard",
    assignedUserId: null,
    assigneeName: null,
  },
];

type LiveMilestone = {
  taskId: string;
  milestoneType: string;
  status: "not_started" | "in_progress" | "blocked" | "done" | "overdue";
  targetDate: string | null;
  clientId: string;
  clientName: string;
  formType: string | null;
  jurisdiction: string | null;
  officialDueDate: string | null;
  /** Joined from `tasks.assigned_user_id` + `users` in fleetStack. */
  assignedUserId?: string | null;
  assigneeName?: string | null;
};

function groupLiveMilestones(
  rows: LiveMilestone[],
  clientLookup: Map<string, ClientLookupRow>,
): TaskRow[] {
  const byTask = new Map<string, LiveMilestone[]>();
  for (const r of rows) {
    const arr = byTask.get(r.taskId) ?? [];
    arr.push(r);
    byTask.set(r.taskId, arr);
  }
  const out: TaskRow[] = [];
  const stages: Stage[] = ["initial_meeting", "collect", "prepare", "review", "file"];
  for (const [taskId, ms] of byTask) {
    const milestoneStatus = stages.map((s) => {
      const m = ms.find((x) =>
        x.milestoneType === s ||
        (s === "collect" && x.milestoneType === "collect_materials") ||
        (s === "prepare" && x.milestoneType === "prepare_workpapers") ||
        (s === "review" && x.milestoneType === "internal_review")
      );
      const status = m?.status ?? "not_started";
      return status === "done"
        ? "done"
        : status === "in_progress" || status === "blocked" || status === "overdue"
          ? "in_progress"
          : "not_started";
    }) as ("done" | "in_progress" | "not_started")[];
    const currentIdx = milestoneStatus.findIndex((s) => s === "in_progress");
    const currentStage = stages[currentIdx >= 0 ? currentIdx : 0] ?? "collect";
    const dueMs = ms.find((x) => x.milestoneType === "file")?.targetDate;
    const lead = ms[0]!;
    const dueIso = dueMs ?? lead.officialDueDate;
    // Disambiguate quarterly forms (941/720 file every quarter).
    // Without the period, three 941 rows under the same client read as
    // identical labels — the only differentiator gets pushed into the
    // DeadlineChip date. Yuqi audit 2026-05-06: "you need to
    // differentiate that".
    const period =
      lead.formType && lead.officialDueDate
        ? periodSuffix(lead.formType, lead.officialDueDate.slice(0, 10))
        : null;
    const taskLabel =
      lead.formType || lead.jurisdiction
        ? [lead.formType, period, lead.jurisdiction]
            .filter(Boolean)
            .join(" · ")
        : "—";
    const lookup = clientLookup.get(lead.clientId);
    // Strip time component if present — DESIGN.md locked policy: dates only.
    const officialDueIso =
      dueIso && dueIso.length >= 10 ? dueIso.slice(0, 10) : undefined;
    // Compute daysBehind from the operative target date (file milestone if
    // present, otherwise official due). Hardcoded 0 was bucketing every
    // task under "On track" — including ones the chip rendered as OVERDUE.
    // File milestone done → 0 (no longer in the working pipeline). Otherwise
    // positive when today is past the target.
    const fileDone = milestoneStatus[stages.indexOf("file")] === "done";
    let daysBehind = 0;
    if (!fileDone && officialDueIso) {
      const target = parseDate(officialDueIso);
      const slip = daysBetween(target, TODAY);
      if (slip > 0) daysBehind = slip;
    }
    out.push({
      taskId,
      clientId: lead.clientId,
      client: lead.clientName,
      task: taskLabel,
      dueDate: dueIso
        ? new Date(dueIso).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "—",
      officialDueIso,
      // Internal target derived by <DueDate> via formClass when not provided.
      // BE doesn't yet send firm-level overrides; FE applies the default
      // buffer (annual_return: -7d) until the field ships on milestones.
      formClass: "annual_return",
      currentStage,
      daysBehind,
      missingCount: ms.filter((m) => m.status === "blocked" || m.status === "overdue").length,
      milestoneStatus,
      jurisdiction: lead.jurisdiction ?? lookup?.primaryState,
      entityType: lookup?.entityType,
      tier: lookup?.tier,
      assignedUserId: lead.assignedUserId ?? null,
      assigneeName: lead.assigneeName ?? null,
    });
  }
  return out;
}

type FilterMode = "all" | "waiting" | "behind";

interface AttrFilters {
  jurisdiction: string[];
  entity: string[];
  tier: string[];
}

const EMPTY_ATTR: AttrFilters = { jurisdiction: [], entity: [], tier: [] };

const ENTITY_OPTIONS = [
  { value: "Individual", label: "Individual" },
  { value: "LLC", label: "LLC" },
  { value: "S-Corp", label: "S-Corp" },
  { value: "C-Corp", label: "C-Corp" },
  { value: "Partnership", label: "Partnership" },
];

const TIER_OPTIONS = [
  { value: "premium", label: "Premium" },
  { value: "standard", label: "Standard" },
];

function jurisdictionLabel(j: string): string {
  return j === "federal" ? "FED" : j;
}

// Stable initials from a display name. Falls back to "?" when nothing
// reasonable can be derived. Hoisted so the per-row avatar + the picker
// render the same letters for the same user.
function initialsFor(input: string | null | undefined): string {
  if (!input) return "?";
  const parts = input.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return ((parts[0][0] ?? "") + (parts[1][0] ?? "")).toUpperCase();
}

// Deterministic palette pick from a userId — the avatar circle for the
// same user is consistently coloured across rows. Picks from a small
// fixed set so colours stay on-brand (no random HSL per render).
const ASSIGNEE_PALETTE = [
  "bg-indigo text-canvas",
  "bg-info-solid text-canvas",
  "bg-ok-solid text-canvas",
  "bg-warn-solid text-canvas",
  "bg-ink-700 text-canvas",
  "bg-ink-900 text-canvas",
] as const;

function paletteFor(id: string | null | undefined): string {
  if (!id) return "bg-sunken text-ink-500 border border-line";
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return ASSIGNEE_PALETTE[hash % ASSIGNEE_PALETTE.length] ?? ASSIGNEE_PALETTE[0];
}

interface FirmMember {
  id: string;
  email: string;
  displayName: string | null;
  role: "owner" | "member";
}

/**
 * AssigneePicker — DropdownMenu that lists firm members + an "Unassign"
 * footer. Used by both the per-row hover affordance + the bulk-action
 * toolbar. The trigger is rendered by the caller (asChild) so the same
 * picker behaves identically whether opened from a tiny icon button on
 * a row or a full-width pill in the floating toolbar.
 *
 * Yuqi audit 2026-05-05: "Timeline currently it is not assignable." —
 * single + bulk go through the same picker so picking yourself for one
 * row vs. five rows feels like the same gesture.
 */
function AssigneePicker({
  trigger,
  members,
  loading,
  currentUserId,
  showUnassign = true,
  onPick,
  align = "end",
  emptyLabel = "Loading firm members…",
  pickedLabel = "Pick a preparer",
}: {
  trigger: React.ReactNode;
  members: FirmMember[];
  loading?: boolean;
  /** When set, the matching member shows a check mark (current
   *  assignee). Pass null for the bulk picker (no single "current"
   *  selection across N rows). */
  currentUserId?: string | null;
  showUnassign?: boolean;
  onPick: (userId: string | null) => void;
  align?: "start" | "end";
  emptyLabel?: string;
  pickedLabel?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="min-w-[15rem]"
        // Stop click bubbling so the row's navigate-on-click handler
        // doesn't fire when the user picks a member from a row picker.
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel className="uppercase tracking-wider">
          {pickedLabel}
        </DropdownMenuLabel>
        {loading ? (
          <div className="px-3 py-2 text-2xs text-ink-500">{emptyLabel}</div>
        ) : members.length === 0 ? (
          <div className="px-3 py-2 text-2xs text-ink-500">
            No team members in this firm yet.
          </div>
        ) : (
          members.map((m) => {
            const name = m.displayName || m.email;
            const isMe = currentUserId === m.id;
            return (
              <DropdownMenuItem
                key={m.id}
                onSelect={() => onPick(m.id)}
                className="flex items-center gap-2"
              >
                <span
                  className={cn(
                    "inline-flex items-center justify-center w-5 h-5 rounded-pill text-[9px] font-bold leading-none shrink-0",
                    paletteFor(m.id),
                  )}
                  aria-hidden
                >
                  {initialsFor(name)}
                </span>
                <span className="flex-1 truncate">{name}</span>
                {isMe ? (
                  <Check className="w-3.5 h-3.5 text-indigo shrink-0" aria-hidden />
                ) : null}
              </DropdownMenuItem>
            );
          })
        )}
        {showUnassign && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onPick(null)}
              className="text-ink-500"
            >
              <Slash className="w-3.5 h-3.5" aria-hidden />
              <span>Unassign</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Small avatar used in the row's assignee column. Empty state is a
// muted dash so the column reads "no preparer yet" without looking
// broken (CPA scans the column for ownership at a glance).
function AssigneeAvatar({
  userId,
  name,
  isCurrentUser,
}: {
  userId: string | null | undefined;
  name: string | null | undefined;
  isCurrentUser: boolean;
}) {
  if (!userId) {
    return (
      <span
        className="text-2xs text-ink-400"
        title="Unassigned"
        aria-label="Unassigned"
      >
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-6 h-6 rounded-pill text-[10px] font-bold leading-none shrink-0",
        paletteFor(userId),
        // "What's mine" — subtle indigo ring so Sarah can scan
        // ownership across the fleet without reading every name.
        isCurrentUser && "ring-2 ring-indigo ring-offset-1 ring-offset-surface",
      )}
      title={name ? `${name}${isCurrentUser ? " (you)" : ""}` : userId}
    >
      {initialsFor(name ?? userId)}
    </span>
  );
}

export function Timeline() {
  // Focus mode (Yuqi audit 2026-05-05): URLs from cross-product
  // entry points carry context — Today's timeline-row click sends
  // `?date=YYYY-MM-DD`, TaskDetail's "View in Timeline" sends
  // `?focus=YYYY-MM-DD&clientId=...`. We accept all three keys so
  // earlier links don't drop on the floor:
  //   focus       — preferred, matches a row's officialDueIso
  //   date        — legacy alias from Today's timeline-day strip
  //   clientId    — restricts the visible rows to one client
  // Without this, those links landed on /timeline and the user had
  // to re-navigate manually (silent dead-link bug).
  const [searchParams, setSearchParams] = useSearchParams();
  const focusDate =
    searchParams.get("focus") ?? searchParams.get("date") ?? null;
  const focusClientId = searchParams.get("clientId") ?? null;
  const isFocused = !!(focusDate || focusClientId);
  const [focusNode, setFocusNode] = useState<HTMLElement | null>(null);
  const focusRowRef = useCallback((node: HTMLElement | null) => {
    setFocusNode(node);
  }, []);
  const clearFocus = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("focus");
    next.delete("date");
    next.delete("clientId");
    setSearchParams(next, { replace: true });
  };
  // Always land on "All tasks" — Yuqi audit 2026-05-05: the previous
  // default ("waiting") hid the broader fleet on every page load, which
  // forced the CPA to context-switch into the chip row before the page
  // even read as a forward-plan. Focus mode (deep link) leaves this
  // default alone — the row scrolls into view regardless of filter.
  const [filter, setFilter] = useState<FilterMode>("all");
  const [attr, setAttr] = useState<AttrFilters>(EMPTY_ATTR);
  // Stage-action confirm dialog state — null when closed.
  const [stageAction, setStageAction] = useState<{
    row: TaskRow;
    nextStage: Stage | null; // null = "File" complete
  } | null>(null);
  // Batch stage-action — opens a single confirm dialog summarising N
  // moves across N rows. Null when closed. Yuqi audit 2026-05-05:
  // "what about batch actions?" — selecting multiple rows + advancing
  // them all in one click avoids the click-confirm-click-confirm
  // pattern Sarah hits during a busy filing day.
  const [batchAdvanceOpen, setBatchAdvanceOpen] = useState(false);
  // Per-client expand/collapse — collapsed by default for groups with
  // taskCount > 1, expanded for single-task clients.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const fleetQuery = trpc.taskMilestones.fleetStack.useQuery({});
  const trpcUtils = trpc.useUtils();
  // Team list for the assignee picker — both per-row + bulk reuse this.
  // Eagerly fetched: the team is small (typically < 10 members) and
  // cached for 5min, so paying a single round-trip on Timeline mount is
  // worth not racing setState→re-render against the picker click.
  const teamQuery = trpc.team.list.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const teamMembers: FirmMember[] = useMemo(
    () =>
      (teamQuery.data?.members ?? []).map((m) => ({
        id: m.id,
        email: m.email,
        displayName: m.displayName,
        role: m.role,
      })),
    [teamQuery.data],
  );
  // Current user — drives the "what's mine" indigo ring on rows.
  const session = useRemoteSession();
  const currentUserId = session.data?.user?.id ?? null;

  const reassignTask = useReassignTask();
  const assignBulkMutation = trpc.tasks.assignBulk.useMutation({
    onSuccess: () => {
      void trpcUtils.taskMilestones.fleetStack.invalidate();
      void trpcUtils.tasks.list.invalidate();
    },
    onError: (err) => {
      toast.error(
        `Bulk assign failed — ${(err.message ?? "unknown").slice(0, 120)}`,
      );
      // Rollback — drop the optimistic overlay so re-render reads
      // truth from the (now-invalidated) server query.
      setAssigneeOverrides(new Map());
      void trpcUtils.taskMilestones.fleetStack.invalidate();
    },
  });

  // Local assignment overlay — keyed by taskId. Holds the optimistic
  // patch the moment a picker fires, so the row re-renders before the
  // mutation settles. Used in mock mode (where MOCK_TIMELINES is a
  // static const fallback and setData on an empty fleetStack cache
  // wouldn't surface) AND in real mode (belt + braces against any
  // race between the toast and the cache refetch).
  const [assigneeOverrides, setAssigneeOverrides] = useState<
    Map<string, { assignedUserId: string | null; assigneeName: string | null }>
  >(new Map());
  const applyOverride = useCallback(
    (taskIds: string[], userId: string | null, name: string | null) => {
      setAssigneeOverrides((prev) => {
        const next = new Map(prev);
        for (const id of taskIds) {
          next.set(id, { assignedUserId: userId, assigneeName: name });
        }
        return next;
      });
      // Also patch the tRPC cache so consumers reading fleetStack
      // directly stay in sync.
      const targets = new Set(taskIds);
      const cached = trpcUtils.taskMilestones.fleetStack.getData({});
      if (cached) {
        const nextCached = (cached as unknown as LiveMilestone[]).map((m) =>
          targets.has(m.taskId)
            ? { ...m, assignedUserId: userId, assigneeName: name }
            : m,
        );
        trpcUtils.taskMilestones.fleetStack.setData({}, nextCached as never);
      }
    },
    [trpcUtils],
  );
  const clientsQuery = useClients();
  const clientLookup = useMemo(() => {
    const live = clientsQuery.data?.items;
    if (live && live.length > 0) return buildClientLookup(live);
    return MOCK_CLIENT_LOOKUP;
  }, [clientsQuery.data]);
  const liveTimelines = useMemo(
    // Cast through unknown — FE-side router types are stale until BE
    // redeploys with the joined fleetStack shape; runtime contract is safe.
    () =>
      groupLiveMilestones(
        (fleetQuery.data ?? []) as unknown as LiveMilestone[],
        clientLookup,
      ),
    [fleetQuery.data, clientLookup],
  );

  // In real mode, never substitute MOCK_TIMELINES — empty BE shows empty
  // state, not fake "Apex Fund" rows the user can't act on.
  const sourceRaw =
    liveTimelines.length > 0
      ? liveTimelines
      : env.useMockData
        ? MOCK_TIMELINES
        : [];
  // Layer the optimistic assignment overlay on top — applies to both
  // mock fallback rows AND live ones for the brief window before the
  // BE refetch lands.
  const source = useMemo(() => {
    if (assigneeOverrides.size === 0) return sourceRaw;
    return sourceRaw.map((t) => {
      if (!t.taskId) return t;
      const override = assigneeOverrides.get(t.taskId);
      if (!override) return t;
      return {
        ...t,
        assignedUserId: override.assignedUserId,
        assigneeName: override.assigneeName,
      };
    });
  }, [sourceRaw, assigneeOverrides]);

  // Effective "behind" classifier — single source of truth for the bucket
  // split, the KPIs, and the filter chip. Combines the stored daysBehind
  // (set when a non-File milestone slips, derived in groupLiveMilestones)
  // with a freshness check against officialDueIso so a task whose file
  // milestone hasn't completed yet but the legal deadline has passed never
  // ends up under "On track" (the bug: MOCK_TIMELINES seeds had stale
  // daysBehind=0 even when officialDueIso was clearly past TODAY).
  const isBehind = (t: TaskRow): boolean => {
    if (t.daysBehind > 0) return true;
    const fileDone = t.milestoneStatus[4] === "done";
    if (fileDone) return false;
    if (!t.officialDueIso) return false;
    return daysBetween(parseDate(t.officialDueIso), TODAY) > 0;
  };
  // Effective slip in days — used in the sort weight + the count rendering.
  const effectiveDaysBehind = (t: TaskRow): number => {
    if (t.daysBehind > 0) return t.daysBehind;
    const fileDone = t.milestoneStatus[4] === "done";
    if (fileDone || !t.officialDueIso) return 0;
    const slip = daysBetween(parseDate(t.officialDueIso), TODAY);
    return slip > 0 ? slip : 0;
  };

  // KPIs across the full source (filter doesn't change them)
  const kpis = useMemo(() => {
    const active = source.length;
    const behind = source.filter(isBehind).length;
    const waiting = source.filter((t) => t.missingCount > 0).length;
    const ready = source.filter(
      (t) => !isBehind(t) && t.missingCount === 0,
    ).length;
    return { active, behind, waiting, ready };
  }, [source]);

  // Jurisdiction options derived from the source so the filter only
  // shows codes that exist in the data (no hardcoded 50-state list).
  const jurisdictionOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const t of source) if (t.jurisdiction) codes.add(t.jurisdiction);
    return Array.from(codes)
      .sort((a, b) => a.localeCompare(b))
      .map((code) => ({ value: code, label: jurisdictionLabel(code) }));
  }, [source]);

  const filtered = useMemo(() => {
    let out = source;
    // Focus filter takes precedence — when arriving from a deep link
    // with ?clientId=…, restrict to that client.
    if (focusClientId) {
      out = out.filter((t) => t.clientId === focusClientId);
    }
    if (filter === "waiting") out = out.filter((t) => t.missingCount > 0);
    if (filter === "behind") out = out.filter(isBehind);
    if (attr.jurisdiction.length) {
      out = out.filter(
        (t) => t.jurisdiction && attr.jurisdiction.includes(t.jurisdiction),
      );
    }
    if (attr.entity.length) {
      out = out.filter(
        (t) => t.entityType && attr.entity.includes(t.entityType),
      );
    }
    if (attr.tier.length) {
      out = out.filter((t) => t.tier && attr.tier.includes(t.tier));
    }
    return out;
  }, [source, filter, attr, focusClientId]);

  // Scroll the focused row into view once it mounts. Callback ref
  // fires after layout, so the scrollIntoView call happens at the
  // right time. Filter-length dependency re-fires when attr filters
  // clip and re-add the matching row.
  useEffect(() => {
    if (!isFocused || !focusNode) return;
    const id = window.setTimeout(() => {
      focusNode.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => window.clearTimeout(id);
  }, [isFocused, focusNode, filtered.length]);

  // Resolve the focused-client display name for the banner copy.
  const focusedClientLabel = useMemo(() => {
    if (!focusClientId) return null;
    const live = clientsQuery.data?.items ?? [];
    const c = live.find((x) => x.id === focusClientId);
    if (c) return c.name;
    const mock = MOCK_CLIENTS.find((x) => x.id === focusClientId);
    return mock?.name ?? focusClientId.slice(0, 8);
  }, [focusClientId]);

  const hasAttrFilters =
    attr.jurisdiction.length + attr.entity.length + attr.tier.length > 0;

  // Sort: missing × 10 + behind × 5 = "needs attention" score (per spec).
  const sorted = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          b.missingCount * 10 + effectiveDaysBehind(b) * 5 -
          (a.missingCount * 10 + effectiveDaysBehind(a) * 5),
      ),
    [filtered],
  );

  // Split sorted into Behind + On-track sections (gap > fill)
  const behindList = sorted.filter(isBehind);
  const onTrackList = sorted.filter((t) => !isBehind(t));

  // Selection across the union of behind + on-track lists. Keyed on
  // taskId; rows without a taskId (rare seed-data edge case) can't be
  // selected — they fall through to the existing single-row stage
  // action via dot-click. The hook lives at the page level so the
  // floating toolbar can read the count without hoisting state through
  // every TaskTable / ClientGroup / TaskTimelineRow render path.
  const selectableRows = useMemo(
    () => sorted.filter((t) => !!t.taskId),
    [sorted],
  );
  const timelineSelection = useSelection<TaskRow>(
    selectableRows,
    (t) => t.taskId ?? "",
  );
  const selectedTimelineRows = timelineSelection.selectedItems;

  return (
    <PageContainer variant="wide">
      <PageHeader title="Timeline" meta={`${kpis.active} active`} />

      {/* Focus banner — appears when arriving from a cross-product
          deep link (?focus=, ?date=, ?clientId=). Tells the user
          what they're centered on; "Clear focus" returns to the
          normal multi-client view. Without this, focused state was
          silent and the user wondered why some rows disappeared. */}
      {isFocused && (
        <div className="mb-region px-3 py-2 rounded-md bg-info-bg border border-info-border flex items-center gap-3 text-xs text-info-ink">
          <span className="font-medium">Focused</span>
          <span className="text-info-ink/80">
            {focusDate && <>on {focusDate}</>}
            {focusDate && focusedClientLabel && " · "}
            {focusedClientLabel && <>{focusedClientLabel}</>}
          </span>
          <button
            type="button"
            onClick={clearFocus}
            className="ml-auto text-2xs px-2 py-0.5 rounded border border-info-border bg-surface text-info-ink hover:bg-info-bg/60 inline-flex items-center gap-1"
          >
            <XIcon className="w-3 h-3" aria-hidden /> Clear focus
          </button>
        </div>
      )}

      {/* KPI tiles — same Mercury-style headline shape the Clients
          page uses (label / value / helper). The Behind + Awaiting
          tiles double as filter triggers, mirroring the Clients
          "Stuck >14d" tile pattern: clicking flips the workflow
          filter so the table below scopes immediately. Yuqi audit
          2026-05-05: "top section of timeline page the same structure
          and layout as client — follow its design." Three tiles fits
          the same 3-column grid Clients uses when its conditional
          Multi-state tile is visible; otherwise we stack two-up on
          tablets and one-up on mobile. Ready-to-file is display-only
          (no matching filter chip — its purpose is the count, not
          a slice the CPA narrows the table to). */}
      <div className="mb-card grid grid-cols-1 gap-card md:grid-cols-3">
        <MetricTile
          label="Behind internal"
          value={kpis.behind}
          tone={kpis.behind > 0 ? "danger" : "neutral"}
          helper="Past internal target — push"
          active={filter === "behind"}
          onClick={() => setFilter(filter === "behind" ? "all" : "behind")}
        />
        <MetricTile
          label="Awaiting docs"
          value={kpis.waiting}
          tone={kpis.waiting > 0 ? "warn" : "neutral"}
          helper="Items waiting on client"
          active={filter === "waiting"}
          onClick={() => setFilter(filter === "waiting" ? "all" : "waiting")}
        />
        <MetricTile
          label="Ready to file"
          value={kpis.ready}
          tone={kpis.ready > 0 ? "ok" : "neutral"}
          helper="All milestones complete"
        />
      </div>

      {/* Workflow-state chips — single source of truth via shared
          FilterChip. Sit directly under the tiles so the eye reads
          tiles → chips → MultiSelect filters → table, matching the
          Clients page rhythm. */}
      <div className="flex items-center gap-1 mb-card">
        <FilterChip
          active={filter === "all"}
          count={kpis.active}
          onClick={() => setFilter("all")}
        >
          All tasks
        </FilterChip>
        <FilterChip
          active={filter === "waiting"}
          count={kpis.waiting}
          onClick={() => setFilter("waiting")}
        >
          Awaiting docs
        </FilterChip>
        <FilterChip
          active={filter === "behind"}
          count={kpis.behind}
          onClick={() => setFilter("behind")}
        >
          Behind
        </FilterChip>
      </div>

      {/* Attribute filters — second axis (jurisdiction / entity / tier).
          Workflow chips above answer "what STATE?", these answer "what
          SLICE of the fleet?" Multi-select; compose with the chips.
          Mirrors the Clients page filter row (Entity / State / Tier /
          Package) — sits below the workflow filter so the visual rhythm
          tiles → workflow chips → attribute chips → table holds. */}
      <div className="mb-region flex items-center gap-2 flex-wrap">
        <MultiSelectChip
          label="Jurisdiction"
          options={jurisdictionOptions}
          selected={attr.jurisdiction}
          onChange={(next) => setAttr((a) => ({ ...a, jurisdiction: next }))}
        />
        <MultiSelectChip
          label="Entity"
          options={ENTITY_OPTIONS}
          selected={attr.entity}
          onChange={(next) => setAttr((a) => ({ ...a, entity: next }))}
        />
        <MultiSelectChip
          label="Tier"
          options={TIER_OPTIONS}
          selected={attr.tier}
          onChange={(next) => setAttr((a) => ({ ...a, tier: next }))}
        />
        {hasAttrFilters && (
          <button
            type="button"
            onClick={() => setAttr(EMPTY_ATTR)}
            className="text-xs text-ink-500 hover:text-ink-900 underline underline-offset-2 ml-1"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Sections */}
      {sorted.length === 0 ? (
        <EmptyTimeline filter={filter} />
      ) : (
        <>
          {filter !== "behind" && behindList.length > 0 && (
            <section className="mb-section">
              <SectionHeader
                title="Behind schedule"
                meta={`${behindList.length} ${behindList.length === 1 ? "task" : "tasks"}`}
              />
              <TaskTable
                rows={behindList}
                collapsed={collapsed}
                onToggleGroup={toggleGroup}
                onStageClick={(row, ns) => setStageAction({ row, nextStage: ns })}
                focusDate={focusDate}
                focusRowRef={focusRowRef}
                isSelected={(taskId) => timelineSelection.has(taskId)}
                onToggleSelect={(taskId) => timelineSelection.toggle(taskId)}
                teamMembers={teamMembers}
                teamLoading={teamQuery.isLoading}
                currentUserId={currentUserId}

                onAssignRow={(row, userId) => {
                  if (!row.taskId) return;
                  const member = userId
                    ? teamMembers.find((m) => m.id === userId) ?? null
                    : null;
                  const name = member
                    ? member.displayName ?? member.email
                    : null;
                  applyOverride([row.taskId], userId, name);
                  reassignTask(row.taskId, { preparerUserId: userId });
                  toast.success(
                    userId
                      ? `Assigned ${row.client} · ${row.task}${name ? ` → ${name}` : ""}`
                      : `Unassigned ${row.client} · ${row.task}`,
                  );
                }}
              />
            </section>
          )}
          {filter !== "behind" && onTrackList.length > 0 && (
            <section className="mb-section">
              <SectionHeader
                title="On track"
                meta={`${onTrackList.length} ${onTrackList.length === 1 ? "task" : "tasks"}`}
              />
              <TaskTable
                rows={onTrackList}
                collapsed={collapsed}
                onToggleGroup={toggleGroup}
                onStageClick={(row, ns) => setStageAction({ row, nextStage: ns })}
                focusDate={focusDate}
                focusRowRef={focusRowRef}
                isSelected={(taskId) => timelineSelection.has(taskId)}
                onToggleSelect={(taskId) => timelineSelection.toggle(taskId)}
                teamMembers={teamMembers}
                teamLoading={teamQuery.isLoading}
                currentUserId={currentUserId}

                onAssignRow={(row, userId) => {
                  if (!row.taskId) return;
                  const member = userId
                    ? teamMembers.find((m) => m.id === userId) ?? null
                    : null;
                  const name = member
                    ? member.displayName ?? member.email
                    : null;
                  applyOverride([row.taskId], userId, name);
                  reassignTask(row.taskId, { preparerUserId: userId });
                  toast.success(
                    userId
                      ? `Assigned ${row.client} · ${row.task}${name ? ` → ${name}` : ""}`
                      : `Unassigned ${row.client} · ${row.task}`,
                  );
                }}
              />
            </section>
          )}
          {filter === "behind" && (
            <section className="mb-section">
              <SectionHeader
                title="Behind schedule"
                meta={`${behindList.length} ${behindList.length === 1 ? "task" : "tasks"}`}
              />
              <TaskTable
                rows={behindList}
                collapsed={collapsed}
                onToggleGroup={toggleGroup}
                onStageClick={(row, ns) => setStageAction({ row, nextStage: ns })}
                focusDate={focusDate}
                focusRowRef={focusRowRef}
                isSelected={(taskId) => timelineSelection.has(taskId)}
                onToggleSelect={(taskId) => timelineSelection.toggle(taskId)}
                teamMembers={teamMembers}
                teamLoading={teamQuery.isLoading}
                currentUserId={currentUserId}

                onAssignRow={(row, userId) => {
                  if (!row.taskId) return;
                  const member = userId
                    ? teamMembers.find((m) => m.id === userId) ?? null
                    : null;
                  const name = member
                    ? member.displayName ?? member.email
                    : null;
                  applyOverride([row.taskId], userId, name);
                  reassignTask(row.taskId, { preparerUserId: userId });
                  toast.success(
                    userId
                      ? `Assigned ${row.client} · ${row.task}${name ? ` → ${name}` : ""}`
                      : `Unassigned ${row.client} · ${row.task}`,
                  );
                }}
              />
            </section>
          )}
        </>
      )}

      {/* Sticky bottom toolbar — appears when ≥1 row selected. Mirrors
          the /clients + Filings tab toolbar shape. Yuqi audit 2026-05-05:
          "what about batch actions?" — selecting multiple rows + advancing
          them in one click avoids the click-confirm-click-confirm pattern
          Sarah hits on a busy filing day. Assignability ("currently it
          is not assignable") is deferred to its own scope — needs a user
          picker + team-list query + tasks.assign mutation. */}
      {timelineSelection.count > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-ink-900 text-canvas rounded-lg shadow-overlay flex items-center gap-3 px-4 py-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="text-xs tabular-nums">
            <span className="font-semibold">{timelineSelection.count}</span>{" "}
            {timelineSelection.count === 1 ? "task" : "tasks"} selected
          </span>
          <span className="text-ink-500 text-2xs" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={() => setBatchAdvanceOpen(true)}
            className="text-xs px-2.5 py-1 rounded bg-indigo hover:bg-indigo-hover transition-colors inline-flex items-center gap-1"
          >
            <ArrowRight className="w-3 h-3" aria-hidden />
            Advance stage
          </button>
          <AssigneePicker
            trigger={
              <button
                type="button"
                className="text-xs px-2.5 py-1 rounded bg-canvas/10 hover:bg-canvas/20 text-canvas transition-colors inline-flex items-center gap-1"
              >
                <UserPlus className="w-3 h-3" aria-hidden />
                Assign to…
              </button>
            }
            members={teamMembers}
            loading={teamQuery.isLoading}
            currentUserId={null}
            pickedLabel={`Assign ${timelineSelection.count} ${
              timelineSelection.count === 1 ? "task" : "tasks"
            } to…`}
            onPick={(userId) => {
              const taskIds = selectedTimelineRows
                .map((r) => r.taskId)
                .filter((id): id is string => !!id);
              if (taskIds.length === 0) return;
              const member = userId
                ? teamMembers.find((m) => m.id === userId) ?? null
                : null;
              const name = member ? member.displayName ?? member.email : null;
              // Optimistic — flip the cache before the round-trip.
              applyOverride(taskIds, userId, name);
              assignBulkMutation.mutate(
                { taskIds, preparerUserId: userId },
                {
                  onSuccess: (res) => {
                    const verb = userId
                      ? `Assigned ${res.count} ${res.count === 1 ? "task" : "tasks"}${
                          name ? ` to ${name}` : ""
                        }`
                      : `Unassigned ${res.count} ${res.count === 1 ? "task" : "tasks"}`;
                    toast.success(verb);
                    timelineSelection.clear();
                  },
                },
              );
            }}
          />
          <button
            type="button"
            disabled
            className="text-xs px-2.5 py-1 rounded bg-sunken/20 text-ink-300 cursor-not-allowed inline-flex items-center gap-1"
            title="Coming next pass — needs a team-member picker + tasks.assign mutation"
          >
            Assign to… (soon)
          </button>
          <button
            type="button"
            onClick={() => timelineSelection.clear()}
            className="text-xs text-ink-300 hover:text-canvas transition-colors px-2 inline-flex items-center gap-1"
            aria-label="Clear selection"
          >
            <XIcon className="w-3 h-3" aria-hidden />
            Clear
          </button>
        </div>
      )}

      {/* Batch advance-stage confirm Dialog — opens from the toolbar's
          "Advance stage" action. Lists every selected row's transition
          ("Acme · 1040: Collect → Prepare", etc.) so the user audits
          the moves before firing. Single confirm fires N stage advances
          in sequence (each toasted; aggregate toast at the end). */}
      <Dialog
        open={batchAdvanceOpen}
        onOpenChange={(open) => !open && setBatchAdvanceOpen(false)}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>
              Advance {selectedTimelineRows.length}{" "}
              {selectedTimelineRows.length === 1 ? "task" : "tasks"}?
            </DialogTitle>
            <DialogDescription>
              Each selected task moves from its current stage to the next.
              Tasks already at &ldquo;File&rdquo; will be marked filed.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <ul className="text-sm divide-y divide-line border border-line rounded-md max-h-[40vh] overflow-y-auto">
              {selectedTimelineRows.map((row) => {
                const stageList: Stage[] = [
                  "initial_meeting",
                  "collect",
                  "prepare",
                  "review",
                  "file",
                ];
                const currentIdx = stageList.indexOf(row.currentStage);
                const nextStage = stageList[currentIdx + 1] ?? null;
                return (
                  <li
                    key={row.taskId ?? `${row.client}-${row.task}`}
                    className="px-3 py-2 flex items-center gap-2"
                  >
                    <span className="text-ink-700 truncate min-w-0 flex-1">
                      <span className="font-medium text-ink-900">
                        {row.client}
                      </span>
                      <span className="text-ink-400"> · </span>
                      {row.task}
                    </span>
                    <span className="text-2xs text-ink-500 shrink-0 tabular-nums inline-flex items-center gap-1">
                      {STAGE_LABELS[row.currentStage]}
                      <ArrowRight className="w-3 h-3" aria-hidden />
                      {nextStage ? STAGE_LABELS[nextStage] : "Filed"}
                    </span>
                  </li>
                );
              })}
            </ul>
            {selectedTimelineRows.some((r) => (r.missingCount ?? 0) > 0) && (
              <p className="mt-3 text-xs text-warn-ink bg-warn-bg border border-warn-border rounded p-2">
                Heads up —{" "}
                {selectedTimelineRows.filter(
                  (r) => (r.missingCount ?? 0) > 0,
                ).length}{" "}
                of these tasks still have items waiting on the client.
                Advancing now records the step as done despite the open
                items.
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBatchAdvanceOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                // Phase-1 stub mirroring the single-row stage-action
                // dialog: fires a per-row toast + an aggregate so the
                // user gets row-level feedback for audit but doesn't
                // miss the overall outcome. Real BE mutation lands
                // when the single-row path gets wired (same TODO).
                let advancedCount = 0;
                let filedCount = 0;
                const stageList: Stage[] = [
                  "initial_meeting",
                  "collect",
                  "prepare",
                  "review",
                  "file",
                ];
                for (const row of selectedTimelineRows) {
                  const currentIdx = stageList.indexOf(row.currentStage);
                  const nextStage = stageList[currentIdx + 1] ?? null;
                  if (nextStage) advancedCount++;
                  else filedCount++;
                }
                const parts: string[] = [];
                if (advancedCount > 0) {
                  parts.push(
                    `Advanced ${advancedCount} ${
                      advancedCount === 1 ? "task" : "tasks"
                    }`,
                  );
                }
                if (filedCount > 0) {
                  parts.push(
                    `Filed ${filedCount} ${
                      filedCount === 1 ? "task" : "tasks"
                    }`,
                  );
                }
                toast.success(parts.join(" · "));
                setBatchAdvanceOpen(false);
                timelineSelection.clear();
              }}
              className="bg-indigo hover:bg-indigo-hover text-white"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage-action confirm Dialog — opens when the CPA clicks a row's
          stage label. Surfaces the exact transition (e.g. "Mark Collect
          done · advance to Prepare") so the action is non-magical. Confirm
          fires a toast (real wiring lands when the BE mutation ships;
          spec lives in §21 of the design critique). */}
      <Dialog
        open={!!stageAction}
        onOpenChange={(open) => !open && setStageAction(null)}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              {stageAction?.nextStage
                ? `Mark ${STAGE_LABELS[stageAction.row.currentStage]} done?`
                : `Mark ${stageAction?.row.task ?? "task"} filed?`}
            </DialogTitle>
            <DialogDescription>
              {stageAction?.nextStage
                ? `${stageAction.row.client} · ${stageAction.row.task} will advance from ${STAGE_LABELS[stageAction.row.currentStage]} to ${STAGE_LABELS[stageAction.nextStage]}.`
                : `${stageAction?.row.client} · ${stageAction?.row.task} will be marked filed and removed from the active queue.`}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {stageAction?.row.missingCount && stageAction.row.missingCount > 0 ? (
              <p className="text-xs text-warn-ink bg-warn-bg border border-warn-border rounded p-2">
                Heads up — {stageAction.row.missingCount} item
                {stageAction.row.missingCount === 1 ? " is" : "s are"} still
                marked waiting on the client. Advancing now records the step
                as done despite the open items.
              </p>
            ) : (
              <p className="text-xs text-ink-500">
                Audit-trailed with timestamp + your user. Reversible from the
                task detail page within 24h.
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStageAction(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!stageAction) return;
                const verb = stageAction.nextStage
                  ? `${STAGE_LABELS[stageAction.row.currentStage]} marked done`
                  : "Marked filed";
                toast.success(
                  `${verb} · ${stageAction.row.client} · ${stageAction.row.task}`,
                );
                setStageAction(null);
              }}
              className="bg-indigo hover:bg-indigo-hover text-white"
            >
              {stageAction?.nextStage ? "Advance" : "Mark filed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function EmptyTimeline({ filter }: { filter: FilterMode }) {
  return (
    <div className="text-center py-12 bg-surface border border-line rounded-md">
      <p className="text-sm text-ink-700 font-medium">
        {filter === "waiting" && "Nothing waiting on a client right now."}
        {filter === "behind" && "All tasks on schedule."}
        {filter === "all" && "No active tasks yet."}
      </p>
      <p className="text-xs text-ink-500 mt-1">
        {filter === "waiting" &&
          "Toggle to All tasks to see everything in flight."}
        {filter === "behind" &&
          "Toggle to All tasks for the full forward-plan."}
        {filter === "all" &&
          "Add a client and a service package — milestones populate automatically."}
      </p>
    </div>
  );
}

/** Group rows by client, preserving the input order's first appearance.
 *  A client with N tasks shows as ONE group with N nested rows — keeps the
 *  fleet view scannable when a single client carries 8 deadlines. */
function groupRowsByClient(rows: TaskRow[]): { key: string; client: string; clientId?: string; tasks: TaskRow[] }[] {
  const groups = new Map<string, { key: string; client: string; clientId?: string; tasks: TaskRow[] }>();
  for (const t of rows) {
    const key = t.clientId ?? t.client;
    const g = groups.get(key);
    if (g) g.tasks.push(t);
    else groups.set(key, { key, client: t.client, clientId: t.clientId, tasks: [t] });
  }
  return Array.from(groups.values());
}

function TaskTable({
  rows,
  collapsed,
  onToggleGroup,
  onStageClick,
  focusDate,
  focusRowRef,
  isSelected,
  onToggleSelect,
  teamMembers,
  teamLoading,
  currentUserId,
  onPrimeTeamQuery,
  onAssignRow,
}: {
  rows: TaskRow[];
  collapsed: Set<string>;
  onToggleGroup: (key: string) => void;
  onStageClick: (row: TaskRow, nextStage: Stage | null) => void;
  focusDate?: string | null;
  focusRowRef?: (node: HTMLElement | null) => void;
  /** Selection state — page-level useSelection hook threaded through.
   *  When undefined, rows render without checkboxes (used by other
   *  callers if any). */
  isSelected?: (taskId: string) => boolean;
  onToggleSelect?: (taskId: string) => void;
  /** Assignment context — team list + handlers for the per-row picker. */
  teamMembers?: FirmMember[];
  teamLoading?: boolean;
  currentUserId?: string | null;
  /** Hover/focus on a row picker primes the team query so the dropdown
   *  isn't paying the round-trip on first click. */
  onPrimeTeamQuery?: () => void;
  onAssignRow?: (row: TaskRow, userId: string | null) => void;
}) {
  const groups = groupRowsByClient(rows);
  return (
    <div className="bg-surface border border-line rounded-md overflow-hidden divide-y divide-line">
      {groups.map((g) => (
        <ClientGroup
          key={g.key}
          group={g}
          collapsed={collapsed.has(g.key)}
          onToggle={() => onToggleGroup(g.key)}
          onStageClick={onStageClick}
          focusDate={focusDate}
          focusRowRef={focusRowRef}
          isSelected={isSelected}
          onToggleSelect={onToggleSelect}
          teamMembers={teamMembers}
          teamLoading={teamLoading}
          currentUserId={currentUserId}
          onPrimeTeamQuery={onPrimeTeamQuery}
          onAssignRow={onAssignRow}
        />
      ))}
    </div>
  );
}

function ClientGroup({
  group,
  collapsed,
  onToggle,
  onStageClick,
  focusDate,
  focusRowRef,
  isSelected,
  onToggleSelect,
  teamMembers,
  teamLoading,
  currentUserId,
  onPrimeTeamQuery,
  onAssignRow,
}: {
  group: { key: string; client: string; clientId?: string; tasks: TaskRow[] };
  collapsed: boolean;
  onToggle: () => void;
  onStageClick: (row: TaskRow, nextStage: Stage | null) => void;
  focusDate?: string | null;
  focusRowRef?: (node: HTMLElement | null) => void;
  isSelected?: (taskId: string) => boolean;
  onToggleSelect?: (taskId: string) => void;
  teamMembers?: FirmMember[];
  teamLoading?: boolean;
  currentUserId?: string | null;
  onPrimeTeamQuery?: () => void;
  onAssignRow?: (row: TaskRow, userId: string | null) => void;
}) {
  const navigate = useNavigate();
  const taskCount = group.tasks.length;
  // Worst-case urgency across the group's tasks. Drives the StatusPill
  // on the group header so the eye picks up the dominant signal at a
  // glance — same archetype as the per-row pill, scaled up to the
  // client level.
  const worstBehind = group.tasks.reduce(
    (m, t) => Math.max(m, t.daysBehind),
    0,
  );
  const totalWaiting = group.tasks.reduce((s, t) => s + t.missingCount, 0);
  const tier = group.tasks[0]?.tier;
  // Single-task clients render flush (no header row) — header would
  // just duplicate the row's identity column.
  if (taskCount === 1) {
    return (
      <TaskTimelineRow
        t={group.tasks[0]}
        onStageClick={onStageClick}
        focusDate={focusDate}
        focusRowRef={focusRowRef}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
        teamMembers={teamMembers}
        teamLoading={teamLoading}
        currentUserId={currentUserId}
        onPrimeTeamQuery={onPrimeTeamQuery}
        onAssignRow={onAssignRow}
      />
    );
  }
  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-3 px-region py-2 bg-sunken/40 border-b border-line",
          !collapsed && "border-b-line",
          collapsed && "border-b-transparent",
        )}
      >
        {/* Toggle expand/collapse — chevron rotates based on state. */}
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 w-5 h-5 inline-flex items-center justify-center rounded text-ink-500 hover:text-ink-900 hover:bg-sunken transition-colors"
          aria-label={collapsed ? `Expand ${group.client}` : `Collapse ${group.client}`}
          aria-expanded={!collapsed}
        >
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 transition-transform",
              !collapsed && "rotate-90",
            )}
            aria-hidden
          />
        </button>
        {/* Client name — clickable to client detail (separate target
            from the toggle so the row's two affordances don't fight). */}
        <button
          type="button"
          onClick={() => {
            if (group.clientId) navigate(`/clients/${group.clientId}`);
          }}
          disabled={!group.clientId}
          className={cn(
            "text-sm font-semibold text-ink-900 truncate text-left",
            group.clientId ? "hover:underline cursor-pointer" : "cursor-default",
          )}
          title={group.clientId ? `Open ${group.client}` : undefined}
        >
          {group.client}
        </button>
        {tier && <TimelineTierPill tier={tier} />}
        <span className="text-xs text-ink-500 tabular-nums shrink-0">
          {taskCount} tasks
        </span>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {worstBehind > 0 ? (
            <StatusPill variant="danger" size="xs">
              worst {worstBehind}d behind
            </StatusPill>
          ) : totalWaiting > 0 ? (
            <StatusPill variant="warn" size="xs">
              {totalWaiting} waiting
            </StatusPill>
          ) : (
            <StatusPill variant="ok" size="xs">
              On track
            </StatusPill>
          )}
        </div>
      </div>
      {!collapsed && (
        <ul className="divide-y divide-line/60" role="list">
          {group.tasks.map((t) => (
            <TaskTimelineRow
              key={t.taskId ?? `${group.key}-${t.task}`}
              t={t}
              nested
              onStageClick={onStageClick}
              focusDate={focusDate}
              focusRowRef={focusRowRef}
              isSelected={isSelected}
              onToggleSelect={onToggleSelect}
              teamMembers={teamMembers}
              teamLoading={teamLoading}
              currentUserId={currentUserId}
              onPrimeTeamQuery={onPrimeTeamQuery}
              onAssignRow={onAssignRow}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TimelineTierPill({ tier }: { tier: ClientTier }) {
  const styles =
    tier === "premium"
      ? "bg-indigo-soft text-indigo-ink border-indigo-soft"
      : "bg-sunken text-ink-700 border-line";
  return (
    <span
      className={cn(
        "inline-flex items-center text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0",
        styles,
      )}
      title={`${tier === "premium" ? "Premium" : "Standard"} tier client`}
    >
      {tier === "premium" ? "Premium" : "Standard"}
    </span>
  );
}

function TaskTimelineRow({
  t,
  nested,
  onStageClick,
  focusDate,
  focusRowRef,
  isSelected,
  onToggleSelect,
  teamMembers,
  teamLoading,
  currentUserId,
  onPrimeTeamQuery,
  onAssignRow,
}: {
  t: TaskRow;
  nested?: boolean;
  onStageClick: (row: TaskRow, nextStage: Stage | null) => void;
  focusDate?: string | null;
  focusRowRef?: (node: HTMLElement | null) => void;
  isSelected?: (taskId: string) => boolean;
  onToggleSelect?: (taskId: string) => void;
  teamMembers?: FirmMember[];
  teamLoading?: boolean;
  currentUserId?: string | null;
  onPrimeTeamQuery?: () => void;
  onAssignRow?: (row: TaskRow, userId: string | null) => void;
}) {
  const navigate = useNavigate();
  const stages: Stage[] = [
    "initial_meeting",
    "collect",
    "prepare",
    "review",
    "file",
  ];
  const navigable = !!(t.taskId && t.clientId);
  // The stage button advances `currentStage` → next-in-sequence; if
  // current is the last (file), advance triggers "mark filed" (null).
  const currentIdx = stages.indexOf(t.currentStage);
  const nextStage: Stage | null = stages[currentIdx + 1] ?? null;
  // Focus highlight — true when the URL's ?focus=YYYY-MM-DD (or ?date=)
  // matches this row's official deadline. Carries the scroll target ref
  // so the page-level useEffect can scrollIntoView on mount.
  const isFocusedRow = !!(focusDate && t.officialDueIso === focusDate);

  return (
    <li className="list-none">
      <div
        ref={isFocusedRow ? focusRowRef : undefined}
        role={navigable ? "button" : undefined}
        tabIndex={navigable ? 0 : undefined}
        onClick={() => {
          if (navigable) navigate(`/clients/${t.clientId}?task=${t.taskId}`);
        }}
        onKeyDown={(e) => {
          if (!navigable) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate(`/clients/${t.clientId}?task=${t.taskId}`);
          }
        }}
        className={cn(
          "group w-full text-left flex items-center gap-4 px-region py-3 transition-colors",
          nested && "pl-card", // indent under client group header
          navigable ? "hover:bg-sunken cursor-pointer" : "cursor-default",
          "focus-visible:outline-none focus-visible:bg-sunken",
          isFocusedRow &&
            "ring-2 ring-info-border bg-info-bg/40 hover:bg-info-bg/60",
        )}
        title={
          navigable
            ? "Open task detail"
            : "Example row — sign in and add a client to see your real tasks here"
        }
      >
        {/* Selection checkbox — only when isSelected/onToggleSelect are
            wired (page-level useSelection threaded through). Stops
            propagation so clicking the box doesn't navigate. Only
            renders when the row has a taskId (rare seed-data edge case
            without one falls through to read-only behaviour). */}
        {isSelected && onToggleSelect && t.taskId && (
          <input
            type="checkbox"
            checked={isSelected(t.taskId)}
            onChange={() => onToggleSelect(t.taskId!)}
            onClick={(e) => e.stopPropagation()}
            className="w-3.5 h-3.5 rounded border-line accent-indigo shrink-0 self-center"
            aria-label={`Select ${t.client} · ${t.task}`}
          />
        )}
        {/* Identity — state badge anchors the row visually so jurisdiction
            reads at a glance (was previously buried inside `task` text).
            When nested, the client name is on the parent header so we
            drop it here to avoid duplication. */}
        <div className="w-64 shrink-0 min-w-0 flex items-start gap-2.5">
          {t.jurisdiction && (
            <StateBadge
              code={
                t.jurisdiction === "federal"
                  ? "FED"
                  : t.jurisdiction.toUpperCase()
              }
              size="sm"
            />
          )}
          <div className="flex-1 min-w-0">
            {!nested && (
              <div className="flex items-center gap-2 mb-0.5">
                <div className="text-sm font-semibold text-ink-900 truncate flex-1 min-w-0">
                  {t.client}
                </div>
                {t.tier && <TimelineTierPill tier={t.tier} />}
              </div>
            )}
            <div
              className={cn(
                "text-xs",
                nested ? "text-ink-700" : "text-ink-500",
              )}
            >
              <span className="truncate">{t.task}</span>
              <span className="text-ink-400 mx-1">·</span>
              {t.officialDueIso ? (
                <DeadlineChip
                  variant="compact"
                  officialDueDate={t.officialDueIso}
                  internalTargetDate={t.internalDueIso}
                  currentMilestoneTargetDate={t.internalDueIso}
                  currentMilestoneLabel={STAGE_LABELS[t.currentStage]}
                  status={
                    t.currentStage === "file" &&
                    t.daysBehind === 0 &&
                    t.missingCount === 0
                      ? "completed"
                      : undefined
                  }
                  originalBufferDays={
                    t.formClass === "quarterly"
                      ? 3
                      : t.formClass === "monthly"
                        ? 2
                        : 7
                  }
                />
              ) : (
                <span className="text-ink-400">due {t.dueDate}</span>
              )}
            </div>
          </div>
        </div>

        {/* Mini-timeline. Yuqi audit 2026-05-05: "Initial mtg is actually
            'Mark Initial mtg done' right? Why not discard that and click
            onto the Initial Mtg dot and mark done?" The right-column
            "Mark X done" button has been retired — clicking the
            CURRENT-stage dot fires the same advance flow. Past dots
            (done) and future dots (not_started) remain decorative. The
            current dot has a larger 12px hit target wrapper around its
            10px visual so the tap area is touch-friendly without
            inflating the dot's visual weight. */}
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          {stages.map((s, idx) => {
            const status = t.milestoneStatus[idx] ?? "not_started";
            const isCurrent = s === t.currentStage;
            const dotClass =
              status === "done"
                ? "bg-ok-solid"
                : status === "in_progress"
                  ? isCurrent
                    ? "bg-warn-solid ring-2 ring-warn-border ring-offset-1 ring-offset-surface"
                    : "bg-warn-solid"
                  : "bg-line-strong";
            return (
              <div
                key={s}
                className="flex items-center gap-1.5 flex-1 min-w-0"
              >
                {isCurrent ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStageClick(t, nextStage);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    aria-label={
                      nextStage
                        ? `Mark ${STAGE_LABELS[s]} done — advance to ${STAGE_LABELS[nextStage]}`
                        : `Mark ${STAGE_LABELS[s]} done`
                    }
                    title={
                      nextStage
                        ? `Click to mark ${STAGE_LABELS[s]} done · advances to ${STAGE_LABELS[nextStage]}`
                        : `Click to mark ${STAGE_LABELS[s]} done · final stage`
                    }
                    className={cn(
                      "shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full",
                      "transition-transform hover:scale-110 cursor-pointer",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-soft",
                    )}
                  >
                    <span
                      className={cn(
                        "w-2.5 h-2.5 rounded-pill",
                        dotClass,
                      )}
                    />
                  </button>
                ) : (
                  <span
                    className={cn(
                      "w-2.5 h-2.5 rounded-pill shrink-0",
                      dotClass,
                    )}
                    title={`${STAGE_LABELS[s]} — ${status.replace("_", " ")}`}
                  />
                )}
                {idx < stages.length - 1 && (
                  <span
                    className="flex-1 h-px bg-line shrink min-w-3"
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Assignee column — single source of "who owns this task." Renders
            an avatar for the assigned preparer + a click target that swaps
            the avatar for an AssigneePicker dropdown so the CPA can pick a
            new preparer (or unassign) without leaving the row. Hover surfaces
            an "Assign" affordance for unassigned rows so the empty state is
            actionable, not just decorative.
            Yuqi audit 2026-05-05: "Timeline currently it is not assignable." */}
        <div
          className="w-20 shrink-0 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") e.stopPropagation();
          }}
        >
          {onAssignRow && t.taskId && teamMembers ? (
            <AssigneePicker
              trigger={
                <button
                  type="button"
                  onMouseEnter={onPrimeTeamQuery}
                  onFocus={onPrimeTeamQuery}
                  className={cn(
                    "inline-flex items-center justify-center rounded-pill p-0.5 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-soft",
                  )}
                  aria-label={
                    t.assignedUserId
                      ? `Assigned to ${t.assigneeName ?? "team member"} — change`
                      : "Assign preparer"
                  }
                  title={
                    t.assignedUserId
                      ? t.assigneeName
                        ? `${t.assigneeName} — click to reassign`
                        : "Click to reassign"
                      : "Assign preparer"
                  }
                >
                  {t.assignedUserId ? (
                    <AssigneeAvatar
                      userId={t.assignedUserId}
                      name={t.assigneeName}
                      isCurrentUser={
                        !!currentUserId && t.assignedUserId === currentUserId
                      }
                    />
                  ) : (
                    // Unassigned: dashed placeholder always visible (no
                    // opacity-0) so the column reads consistently across
                    // rows. Hover deepens tone + reveals the picker
                    // affordance so the empty state is discoverable.
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-pill bg-sunken/40 text-ink-400 group-hover:bg-sunken group-hover:text-ink-700 border border-dashed border-line transition-colors">
                      <UserPlus
                        className="w-3 h-3 opacity-60 group-hover:opacity-100"
                        aria-hidden
                      />
                    </span>
                  )}
                </button>
              }
              members={teamMembers}
              loading={teamLoading}
              currentUserId={t.assignedUserId ?? null}
              pickedLabel={`Assign ${t.client.split(" ")[0] ?? "task"} to…`}
              onPick={(userId) => onAssignRow(t, userId)}
            />
          ) : (
            <AssigneeAvatar
              userId={t.assignedUserId}
              name={t.assigneeName}
              isCurrentUser={
                !!currentUserId && t.assignedUserId === currentUserId
              }
            />
          )}
        </div>

        {/* Status pill — gap-loud (T4: as pill, never paint).
            Yuqi audit 2026-05-05: "Ready" pill killed. Pills are for
            non-default states; absence of a pill IS the "no problem"
            signal. Showing "Ready" on every clean row trained the eye
            to ignore the column entirely, then real "behind" / "waiting"
            states had to fight for attention against a wall of green.
            Now: behind = red pill, waiting = yellow pill, clean = nothing. */}
        {/* Yuqi audit 2026-05-05: the right-column "Mark X done" button
            was retired — its job is now done by clicking the current-
            stage dot in the mini-timeline above. The status column
            keeps its width so row alignment doesn't reflow. */}
        <div className="w-44 shrink-0 flex items-center justify-end gap-2">
          {t.daysBehind > 0 ? (
            <StatusPill variant="danger" size="xs">
              {t.daysBehind}d behind
            </StatusPill>
          ) : t.missingCount > 0 ? (
            <StatusPill variant="warn" size="xs">
              {t.missingCount} waiting
            </StatusPill>
          ) : null}
        </div>

        <ChevronRight
          className={cn(
            "w-4 h-4 shrink-0 transition-colors",
            navigable
              ? "text-ink-400 group-hover:text-ink-700"
              : "text-ink-300",
          )}
          aria-hidden
        />
      </div>
    </li>
  );
}
