import { useMemo, useState } from "react";
import { ChevronDown, Megaphone, Sparkles, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSession, updateSession } from "@/data/session";
import { useStore } from "@/data/store";
import { StatusPill } from "@/components/ui/StatusPill";
import { DateLabel } from "@/components/ui/DateLabel";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ActionQueue } from "@/components/ActionQueue";
import { TimelineDayRow } from "@/components/today/TimelineDayRow";
import { MorningTriage } from "@/components/MorningTriage";
import { StateAlertCard, type AffectedClient } from "@/components/StateAlertCard";
import { type DotStackUrgency } from "@/components/ui/DotStack";
import { clients as MOCK_CLIENTS } from "@/data/mockClients";
import { deadlines as MOCK_DEADLINES } from "@/data/mockDeadlines";
import { TODAY, addDays, toIso } from "@/data/dateHelpers";
import {
  useAnnouncements,
  useDismissAnnouncement,
} from "@/hooks/useAnnouncements";
import { useTriageDeadlines } from "@/hooks/useDeadlines";
import { useClients } from "@/hooks/useClients";
import { trpc } from "@/lib/api/client";
import { env } from "@/config";
import type { Announcement, Deadline } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Today — the CPA's daily entry surface.
 *
 * Implementation of docs/specs/today-page.md. Composes from the design-system
 * primitives (StatusPill, Banner, EmptyState, DateLabel, DotStack) and two
 * page-scoped components (ActionQueueRow, TimelineDayRow).
 *
 * Mounted at /design/today as a non-destructive design preview alongside the
 * existing Dashboard. Once approved, swap with the index route.
 *
 * Mock data: filters mockDeadlines + mockClients against TODAY (2026-04-23)
 * so the Action Queue + Timeline reflect real shapes.
 */

interface ConfirmedItem {
  id: string;
  clientName: string;
  meta: string;
  confirmedAt: string; // "9:42a"
}

interface TimelineDay {
  date: string;
  count: number;
  urgency: DotStackUrgency;
  label?: string;
}

function buildTimeline(deadlines: ReadonlyArray<Deadline>): TimelineDay[] {
  const byDate = new Map<string, { count: number; urgencies: Set<DotStackUrgency> }>();
  for (let offset = 1; offset <= 14; offset++) {
    const date = toIso(addDays(TODAY, offset));
    byDate.set(date, { count: 0, urgencies: new Set() });
  }
  for (const d of deadlines) {
    const slot = byDate.get(d.officialDueDate);
    if (!slot) continue;
    slot.count += 1;
    if (d.status === "overdue") slot.urgencies.add("danger");
    else if (d.status === "in_progress") slot.urgencies.add("warn");
    else slot.urgencies.add("neutral");
  }
  const out: TimelineDay[] = [];
  for (const [date, { count, urgencies }] of byDate.entries()) {
    if (count === 0) continue;
    let urgency: DotStackUrgency = "neutral";
    if (urgencies.has("danger")) urgency = "danger";
    else if (urgencies.has("warn")) urgency = "warn";
    out.push({ date, count, urgency });
  }
  // Decorate the largest day with a contextual label
  if (out.length > 0) {
    const largest = out.reduce((a, b) => (b.count > a.count ? b : a));
    if (largest.count >= 3) largest.label = "Multi-client filing day";
  }
  return out;
}

/**
 * Derive today's confirmed items from live checklist state.
 *
 * Yuqi audit 2026-05-06: prior version returned a hardcoded array of
 * three demo rows that never moved no matter what the user actually
 * confirmed in-session. Now reads from `useStore` (mock) /
 * `trpc.todoItems.list` (real) and shows checklist items that flipped
 * to `received_confirmed` today.
 */
function buildConfirmedTodayFromChecklist(
  checklistItems: Array<{
    id: string;
    state: string;
    label?: string;
    taskId?: string;
    confirmedAt?: string;
  }>,
  taskById: Map<string, { clientName?: string; formType?: string; jurisdiction?: string }>,
): ConfirmedItem[] {
  const todayIso = toIso(TODAY);
  const out: ConfirmedItem[] = [];
  for (const ci of checklistItems) {
    if (ci.state !== "received_confirmed" || !ci.confirmedAt) continue;
    if (!ci.confirmedAt.startsWith(todayIso)) continue;
    const task = ci.taskId ? taskById.get(ci.taskId) : undefined;
    out.push({
      id: ci.id,
      clientName: task?.clientName ?? ci.label ?? "Unknown client",
      meta: task
        ? `${task.formType ?? "—"} · ${task.jurisdiction ?? "—"}`
        : ci.label ?? "Confirmed item",
      confirmedAt: formatTimeShort(ci.confirmedAt),
    });
  }
  return out;
}

function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "p" : "a";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m}${ampm}`;
}

export function Today() {
  // Live data — `deadlines.listForTriage` is firm-scoped on real BE; mock
  // mode falls through to the in-memory store. `clients.list` powers the
  // entityType + name lookup. We fall back to MOCK_DEADLINES / MOCK_CLIENTS
  // *only* in mock mode where the store is empty (e.g. design previews
  // before seed). In real mode an empty firm renders an empty queue —
  // never substitute mock rows the user can't act on.
  const triageQuery = useTriageDeadlines();
  const liveDeadlines = (triageQuery.data ?? []) as unknown as Deadline[];
  const clientsQuery = useClients();
  const liveClients = clientsQuery.data?.items ?? [];

  const deadlinesForBuild =
    liveDeadlines.length > 0
      ? liveDeadlines
      : env.useMockData
        ? MOCK_DEADLINES
        : [];
  const clientsForBuild =
    liveClients.length > 0
      ? liveClients
      : env.useMockData
        ? MOCK_CLIENTS
        : [];

  const timeline = useMemo(
    () => buildTimeline(deadlinesForBuild),
    [deadlinesForBuild],
  );

  // Morning triage — calendar-truth pulse.
  //
  // The strip just below the page header answers ONE question: "before
  // I touch the action queue, what does the calendar say is hot today?"
  // It is NOT a list of action items (that's the queue immediately
  // below) and it is NOT a list of inbound replies (that's the bell).
  //
  // Three signals only, derived from deadline dates:
  //   1. pastOfficial     — official due date passed, not yet filed.
  //                         Highest urgency. Red. Should be ~0 in a
  //                         healthy firm; nonzero = extension territory.
  //   2. dueToday         — official due date = today. Medium urgency.
  //                         Neutral.
  //   3. pastInternalTarget — past the firm's internal target but
  //                         official deadline still in future. Low
  //                         urgency. Neutral. The "buffer eaten" signal
  //                         Sarah feels every morning.
  // All three zero → calm "All caught up" line that yields the page to
  // the queue immediately. The component itself owns the chip-vs-strip
  // collapsing logic.
  const triageSummary = useMemo(() => {
    const todayIso = toIso(TODAY);
    const open = deadlinesForBuild.filter(
      (d) => d.status !== "completed" && d.status !== "filed_extension",
    );
    return {
      pastOfficial: open.filter((d) => d.officialDueDate < todayIso).length,
      dueToday: open.filter((d) => d.officialDueDate === todayIso).length,
      pastInternalTarget: open.filter(
        (d) =>
          !!d.internalDueDate &&
          d.internalDueDate < todayIso &&
          d.officialDueDate >= todayIso,
      ).length,
    };
  }, [deadlinesForBuild]);
  // Confirmed today — derived from live checklist state (mock store
  // mutations + real-mode BE), not a hardcoded demo array. Joins each
  // item with its task to surface "client · form · jurisdiction".
  const storeSnapshot = useStore();
  const checklistItems = storeSnapshot.checklistItems ?? [];
  const tasksAll = storeSnapshot.tasks ?? [];
  const clientById = useMemo(
    () => new Map(clientsForBuild.map((c) => [c.id, c])),
    [clientsForBuild],
  );
  const taskById = useMemo(() => {
    const m = new Map<
      string,
      { clientName?: string; formType?: string; jurisdiction?: string }
    >();
    if (!Array.isArray(tasksAll)) return m;
    for (const t of tasksAll) {
      const c = clientById.get(t.clientId);
      m.set(t.id, {
        clientName: c?.name,
        formType: t.formType,
        jurisdiction: t.jurisdiction,
      });
    }
    return m;
  }, [tasksAll, clientById]);
  const confirmed = useMemo(
    () => buildConfirmedTodayFromChecklist(checklistItems, taskById),
    [checklistItems, taskById],
  );
  const [confirmedExpanded, setConfirmedExpanded] = useState(false);

  // State alerts — driven by real announcement data (mock-mode tRPC).
  // Renders as the v0u differentiator surface preview: cards on Today,
  // click navigates to /alerts/:id where the full feed + co-pilot pane
  // lives. (No in-page Sheet — one drilldown destination shared across
  // all surfaces, per the chrome-consistency pass.)
  const navigate = useNavigate();
  const announcementsQuery = useAnnouncements({ activeOnly: true });
  // Today shows the top 3 most-recent active alerts only — the upstream
  // mock-adapter list handler sorts by detectedAt desc, so slice(0, 3)
  // here is the canonical "newest 3." Anything beyond goes to /alerts.
  const allAnnouncements = announcementsQuery.data ?? [];
  const announcements = allAnnouncements.slice(0, 3);
  const totalActiveAnnouncements = allAnnouncements.length;
  const dismissMutation = useDismissAnnouncement();
  const affectedFor = useMemo(() => {
    return (a: Announcement): AffectedClient[] => {
      const source = clientsForBuild;
      const map = new Map(source.map((c) => [c.id, c]));
      return a.affectedClientIds
        .map((id) => map.get(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => ({
          id: c.id,
          name: c.name,
          email: c.contactEmail ?? undefined,
        }));
    };
  }, [clientsForBuild]);

  // First-action arc (Yuqi audit 2026-05-05): freshly-onboarded users
  // land on Today with a populated queue but no muscle memory. Surface a
  // one-time banner pointing at the first item the action queue would
  // emphasise. Reads the same trpc.todoItems.list source <ActionQueue/>
  // uses below so the banner and the queue can never disagree.
  // Dismissed (X) or satisfied (sent) → flips session.firstChaseDone
  // permanently. Eligibility: onboardingComplete && !firstChaseDone &&
  // at least one item.
  const session = useSession();
  const todoQuery = trpc.todoItems.list.useQuery({ limit: 5 });
  const firstTodo = todoQuery.data?.items?.[0] ?? null;
  const showFirstChaseHint =
    !!session?.onboardingComplete &&
    !session?.firstChaseDone &&
    firstTodo !== null;
  const firstChaseTarget =
    showFirstChaseHint && firstTodo
      ? {
          clientId: firstTodo.clientId,
          clientName: firstTodo.client,
          meta: firstTodo.task ?? firstTodo.action,
        }
      : null;
  const dismissFirstChase = () => {
    updateSession({ firstChaseDone: true });
  };

  return (
    <PageContainer>
      {/* Page header — DESIGN.md §Typography display (22px / 600). Date inline
          (T8: desk, not stage). PageHeader primitive enforces consistency
          across all pages — see src/components/ui/PageHeader.tsx. */}
      <PageHeader
        title={
          <>
            Today
            <span className="ml-2 font-medium text-ink-500">
              <DateLabel value={toIso(TODAY)} format="short" />
            </span>
          </>
        }
      />

      {/* First-chase coach mark — appears once after import, dismisses
          on send-or-X. The value is converting a fresh roster to the
          actual daily verb (chase a client) before muscle memory has
          formed. Quiet-tinted to read as a guide, not an alert. */}
      {firstChaseTarget && (
        <div className="mb-section border border-info-border bg-info-bg/40 rounded-md px-4 py-3 flex items-start gap-3">
          <Sparkles
            className="w-4 h-4 text-info-ink shrink-0 mt-0.5"
            aria-hidden
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ink-900 font-medium">
              Try it: send your first chase to{" "}
              <span className="text-info-ink">
                {firstChaseTarget.clientName.split(/\s+/)[0]}
              </span>
            </p>
            <p className="text-xs text-ink-500 mt-0.5">
              {firstChaseTarget.meta} — most pressing item on your queue.
              Open the client to draft the reminder.
            </p>
          </div>
          <Link
            to={`/clients/${firstChaseTarget.clientId}?tab=todo`}
            onClick={dismissFirstChase}
            className="text-xs px-2.5 py-1 rounded bg-indigo text-white hover:bg-indigo-hover shrink-0"
          >
            Open client
          </Link>
          <button
            type="button"
            onClick={dismissFirstChase}
            className="text-ink-400 hover:text-ink-700 shrink-0 mt-0.5"
            aria-label="Dismiss first-chase hint"
          >
            <X className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      )}

      {/* Morning triage — single-line calendar-truth pulse. See the
          comment on `triageSummary` above for what each signal means
          and what NOT to put here. */}
      <MorningTriage summary={triageSummary} />

      {/* State alerts — the v0.7 differentiator surface (v0u synthesis).
          One section per concept — replaces the prior hardcoded info banner.
          Empty state mimics the existing AnnouncementBanner "All clear" so
          the page never reads as broken when zero announcements are active. */}
      <section className="mb-section">
        <SectionHeader
          title="State alerts"
          meta={
            announcementsQuery.isLoading
              ? "Loading…"
              : totalActiveAnnouncements > 0
                ? `${totalActiveAnnouncements} active ${totalActiveAnnouncements === 1 ? "alert" : "alerts"}`
                : "All clear"
          }
          action={
            totalActiveAnnouncements > announcements.length ? (
              <Link
                to="/alerts"
                className="text-xs text-ink-500 hover:text-ink-900 underline underline-offset-[3px] decoration-[1.5px]"
              >
                All {totalActiveAnnouncements} alerts
              </Link>
            ) : (
              <Link
                to="/alerts"
                className="text-xs text-ink-500 hover:text-ink-900 underline underline-offset-[3px] decoration-[1.5px]"
              >
                All alerts
              </Link>
            )
          }
        />
        {announcementsQuery.isLoading ? (
          <div className="text-sm text-ink-500 py-6 text-center border-t border-line">
            Loading state alerts…
          </div>
        ) : announcements.length === 0 ? (
          <div className="bg-surface border border-line rounded-md px-4 py-3 flex items-center gap-3">
            <span
              className="w-2 h-2 rounded-pill bg-ok-solid shrink-0"
              aria-hidden
            />
            <Megaphone className="w-4 h-4 text-ink-500 shrink-0" aria-hidden />
            <span className="text-sm text-ink-700">
              <span className="font-semibold text-ink-900">All clear.</span>{" "}
              Monitoring 50 state authorities — nothing affecting your clients
              right now.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-card">
            {announcements.map((a) => (
              <StateAlertCard
                key={a.id}
                a={a}
                variant="today"
                affectedClients={affectedFor(a)}
                onSelect={() => navigate(`/alerts/${a.id}`)}
                onSnooze={() => {
                  dismissMutation.mutate({ id: a.id });
                  toast.success("Snoozed until tomorrow");
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Action Queue — gap-first dominant section.
          Yuqi audit 2026-05-05 / 2026-05-06: previously Today rendered
          a flat ActionQueueRow per item with a "Send" button that
          merely navigated to the client (no email composer, no
          bundling). The full <ActionQueue/> component (PR #109)
          carries the multi-select checkbox UX, the Send-N-as-one-
          email bundle modal, and the real-mode BE wiring (saveDraft
          + send). It existed but wasn't wired here. Swapped in
          directly so the user actually gets a working Send + the
          checkbox affordance. The component owns its own data fetch
          (`trpc.todoItems.list`) and SectionHeader. */}
      <ActionQueue />

      {/* Timeline — glance-view of next 14 days */}
      <section className="mb-section">
        <SectionHeader
          title="Timeline"
          meta={`${timeline.reduce((s, d) => s + d.count, 0)} ${
            timeline.reduce((s, d) => s + d.count, 0) === 1
              ? "deadline"
              : "deadlines"
          } in next 14 days`}
        />
        {timeline.length === 0 ? (
          <div className="text-sm text-ink-500 py-6 text-center border-t border-line">
            No deadlines in the next 14 days.
          </div>
        ) : (
          <div className="border-t border-line" role="list">
            {timeline.map((d, i) => (
              <TimelineDayRow
                key={d.date}
                date={d.date}
                count={d.count}
                urgency={d.urgency}
                label={d.label}
                onClick={() => navigate(`/timeline?date=${d.date}`)}
                isLast={i === timeline.length - 1}
              />
            ))}
          </div>
        )}
      </section>

      {/* Confirmed today — collapsed by default (gap > fill) */}
      <section>
        <button
          type="button"
          onClick={() => setConfirmedExpanded((v) => !v)}
          className="w-full flex items-center justify-between py-3 px-1 border-t border-line text-sm font-medium text-ink-700 hover:bg-sunken/40 transition-colors focus-visible:outline-none focus-visible:bg-sunken/40"
          aria-expanded={confirmedExpanded}
        >
          <span>
            Confirmed today{" "}
            <span className="text-ink-500 tabular-nums">({confirmed.length})</span>
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-ink-400 transition-transform duration-200",
              confirmedExpanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
        {confirmedExpanded && (
          <div role="list">
            {confirmed.map((c, i) => (
              <div
                key={c.id}
                className={cn(
                  "flex items-start gap-4 py-3 px-1",
                  i !== confirmed.length - 1 && "border-b border-line",
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-700 truncate">
                    {c.clientName}
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5 truncate">
                    {c.meta}
                  </div>
                </div>
                <div className="shrink-0">
                  <StatusPill variant="ok" dot>
                    Confirmed at {c.confirmedAt}
                  </StatusPill>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
