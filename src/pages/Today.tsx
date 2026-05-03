import { useMemo, useState } from "react";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import { Banner } from "@/components/ui/Banner";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { DateLabel } from "@/components/ui/DateLabel";
import { ActionQueueRow, type RowUrgency, type RowAction } from "@/components/today/ActionQueueRow";
import { TimelineDayRow } from "@/components/today/TimelineDayRow";
import { type DotStackUrgency } from "@/components/ui/DotStack";
import { clients as MOCK_CLIENTS } from "@/data/mockClients";
import { deadlines as MOCK_DEADLINES } from "@/data/mockDeadlines";
import { TODAY, parseDate, daysBetween, addDays, toIso } from "@/data/dateHelpers";
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

interface QueueItem {
  id: string;
  clientId: string;
  clientName: string;
  meta: string;
  urgency: RowUrgency;
  urgencyDays?: number;
  action: RowAction;
}

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

function jurisdictionLabel(j: string): string {
  if (j === "federal") return "Federal";
  return j;
}

function buildQueue(): QueueItem[] {
  const clientById = new Map(MOCK_CLIENTS.map((c) => [c.id, c]));
  const queue: QueueItem[] = [];
  for (const d of MOCK_DEADLINES) {
    const c = clientById.get(d.clientId);
    if (!c) continue;
    const due = parseDate(d.officialDueDate);
    const diff = daysBetween(TODAY, due);
    let urgency: RowUrgency | null = null;
    let urgencyDays: number | undefined;
    let action: RowAction = "send";
    if (d.status === "overdue" || diff < 0) {
      urgency = "overdue";
      urgencyDays = Math.abs(diff);
    } else if (diff === 0) {
      urgency = "due_today";
      action = "review";
    } else if (diff > 0 && diff <= 7 && d.status === "not_started") {
      urgency = "due_soon";
      urgencyDays = diff;
    } else if (d.status === "in_progress") {
      urgency = "awaiting_review";
      action = "open";
    }
    if (!urgency) continue;
    queue.push({
      id: `${d.clientId}-${d.form}`,
      clientId: c.id,
      clientName: c.name,
      meta: `${d.form} · ${jurisdictionLabel(d.jurisdiction)} · ${c.entityType}`,
      urgency,
      urgencyDays,
      action,
    });
  }
  // Sort: overdue first → due-today → others by date
  return queue
    .sort((a, b) => {
      const order: Record<RowUrgency, number> = {
        overdue: 0,
        due_today: 1,
        awaiting_review: 2,
        due_soon: 3,
        awaiting_client: 4,
        ai_suggested: 5,
      };
      return order[a.urgency] - order[b.urgency];
    })
    .slice(0, 12); // cap demo at 12 rows
}

function buildTimeline(): TimelineDay[] {
  const byDate = new Map<string, { count: number; urgencies: Set<DotStackUrgency> }>();
  for (let offset = 1; offset <= 14; offset++) {
    const date = toIso(addDays(TODAY, offset));
    byDate.set(date, { count: 0, urgencies: new Set() });
  }
  for (const d of MOCK_DEADLINES) {
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

function buildConfirmedToday(): ConfirmedItem[] {
  // Demo: synthesize 3 items confirmed earlier this morning
  return [
    {
      id: "cf-1",
      clientName: "Riverside Holdings LLC",
      meta: "Form 568 · CA · LLC",
      confirmedAt: "9:42a",
    },
    {
      id: "cf-2",
      clientName: "Pacific Ridge S-Corp",
      meta: "1120-S · Federal · S-Corp",
      confirmedAt: "10:15a",
    },
    {
      id: "cf-3",
      clientName: "Bayview Dental C-Corp",
      meta: "Q1 estimate · Federal · C-Corp",
      confirmedAt: "11:03a",
    },
  ];
}

function SectionHeader({
  title,
  meta,
}: {
  title: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="text-xl font-medium text-ink-900 tracking-[-0.005em]">{title}</h2>
      {meta && <div className="text-sm text-ink-500 tabular-nums">{meta}</div>}
    </div>
  );
}

export function Today() {
  const queue = useMemo(buildQueue, []);
  const timeline = useMemo(buildTimeline, []);
  const confirmed = useMemo(buildConfirmedToday, []);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [confirmedExpanded, setConfirmedExpanded] = useState(false);

  return (
    <div className="mx-auto max-w-[800px] px-4 md:px-8 py-6 md:py-8">
      {/* Page title — T8: understated, no display face, date inline */}
      <h1 className="text-[28px] font-medium text-ink-900 tracking-[-0.01em] leading-tight mb-6">
        Today, <span className="text-ink-700">
          <DateLabel value={toIso(TODAY)} format="short" />
        </span>
      </h1>

      {/* State notification banner — T7: info, NOT modal/toast/bell */}
      {!bannerDismissed && (
        <div className="mb-6">
          <Banner
            variant="info"
            onDismiss={() => setBannerDismissed(true)}
            action={{ label: "Review impacts", onClick: () => {/* navigate */} }}
          >
            <strong className="font-semibold">IRS revised Form 941.</strong>{" "}
            <span className="text-info-ink/90">
              72 of your clients are affected.
            </span>
          </Banner>
        </div>
      )}

      {/* Action Queue — gap-first dominant section */}
      <section className="mb-12">
        <SectionHeader
          title="Action Queue"
          meta={<>{queue.length} {queue.length === 1 ? "item" : "items"}</>}
        />
        {queue.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing to do today."
            description="We'll surface chases, replies, and approvals here as they need your attention."
          />
        ) : (
          <div className="border-t border-line" role="list">
            {queue.map((item, i) => (
              <ActionQueueRow
                key={item.id}
                clientName={item.clientName}
                meta={item.meta}
                urgency={item.urgency}
                urgencyDays={item.urgencyDays}
                action={item.action}
                onAction={() => {/* trigger send/open */}}
                onRowClick={() => {/* navigate to client */}}
                isLast={i === queue.length - 1}
              />
            ))}
          </div>
        )}
      </section>

      {/* Timeline — glance-view of next 14 days */}
      <section className="mb-12">
        <SectionHeader title="Timeline" meta={<>Next 14 days</>} />
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
                onClick={() => {/* navigate to /timeline?date=... */}}
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
    </div>
  );
}
