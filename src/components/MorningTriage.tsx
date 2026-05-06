import { Link } from "react-router-dom";
import { CheckCircle2, ChevronRight } from "lucide-react";

// MorningTriage — calendar-truth status strip above the action queue.
//
// Earlier iterations rendered three banner-weight cards (past official /
// filing today / behind plan), each tinted with its tone bg. Three
// stacked tinted blocks shouted from the top of page; once the
// "Alerts to act on today" list moved in directly below, the two
// containers visually competed. The fix wasn't to tint less (warn rows
// would disappear into the white alerts container) — it was to make
// triage a different SHAPE: one thin strip, not a list of cards.
//
// What lives here now:
//   - aggregate counts over deadline state (past official / due today /
//     past internal target). These are derived from filing rows, not
//     TodoItems — so they don't double-count with the action queue
//     directly below.
//   - per-item next-gestures (anomalies, replies, inbound to confirm,
//     chases) live in the action queue's TodoItem feed, not here.
//
// Three render states:
//   - all zero      → calm one-liner ("All caught up.")
//   - one nonzero   → single chip + targeted CTA
//   - many nonzero  → all three chips inline + "See timeline ›"
//
// The past-official count is the only color signal — rendered in
// danger ink because legal-miss is the only tier that earns visual heat
// at this layer. Everything else stays neutral so the eye picks up
// "8 (red)" at first glance without competing tinted bgs.

export type MorningTriageSummary = {
  pastInternalTarget: number;
  pastOfficial: number;
  dueToday: number;
};

type Chip = {
  key: "past_official" | "filing_today" | "behind_plan";
  count: number;
  label: string;
  to: string;
  ctaLabel: string;
  isDanger: boolean;
};

export function MorningTriage({
  summary,
}: {
  summary: MorningTriageSummary;
}) {
  const chips: Chip[] = [];

  if (summary.pastOfficial > 0) {
    chips.push({
      key: "past_official",
      count: summary.pastOfficial,
      label: "past official",
      to: "/timeline?filter=past_official",
      ctaLabel: "Review",
      isDanger: true,
    });
  }
  if (summary.dueToday > 0) {
    chips.push({
      key: "filing_today",
      count: summary.dueToday,
      label: summary.dueToday === 1 ? "due today" : "due today",
      to: "/timeline?filter=due_today",
      ctaLabel: "Open",
      isDanger: false,
    });
  }
  if (summary.pastInternalTarget > 0) {
    chips.push({
      key: "behind_plan",
      count: summary.pastInternalTarget,
      label: "behind plan",
      to: "/timeline?filter=behind_plan",
      ctaLabel: "See plan",
      isDanger: false,
    });
  }

  // Calm — yields the page to the queue immediately.
  if (chips.length === 0) {
    return (
      <div
        className="mb-section bg-surface border border-line rounded-md px-region py-2.5 flex items-center gap-3"
        aria-label="Morning triage"
      >
        <CheckCircle2 className="w-4 h-4 text-ok-ink shrink-0" aria-hidden />
        <span className="text-sm text-ink-700">
          <span className="font-medium text-ink-900">All caught up.</span>{" "}
          <span className="text-ink-500">Nothing on today's calendar.</span>
        </span>
      </div>
    );
  }

  // Single nonzero — compact targeted CTA. The strip says exactly what
  // the user needs and links to the right filtered timeline.
  if (chips.length === 1) {
    const c = chips[0];
    return (
      <Link
        to={c.to}
        className="mb-section block bg-surface border border-line rounded-md px-region py-2.5 flex items-center gap-3 hover:border-line-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40"
        aria-label="Morning triage"
      >
        <span className="text-sm flex-1 min-w-0 truncate">
          <span
            className={
              c.isDanger
                ? "font-semibold tabular-nums text-danger-ink"
                : "font-semibold tabular-nums text-ink-900"
            }
          >
            {c.count}
          </span>{" "}
          <span className="text-ink-500">{c.label}</span>
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-700 shrink-0">
          {c.ctaLabel}
          <ChevronRight className="w-3.5 h-3.5" aria-hidden />
        </span>
      </Link>
    );
  }

  // Multiple nonzero — show all chips inline. CTA navigates to the
  // calendar-truth surface (timeline) where the per-deadline view lives.
  return (
    <Link
      to="/timeline"
      className="mb-section block bg-surface border border-line rounded-md px-region py-2.5 flex items-center gap-3 hover:border-line-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40"
      aria-label="Morning triage"
    >
      <span className="text-sm flex-1 min-w-0 truncate">
        {chips.map((c, i) => (
          <span key={c.key}>
            {i > 0 && <span className="text-ink-400 mx-1.5">·</span>}
            <span
              className={
                c.isDanger
                  ? "font-semibold tabular-nums text-danger-ink"
                  : "font-semibold tabular-nums text-ink-900"
              }
            >
              {c.count}
            </span>{" "}
            <span className="text-ink-500">{c.label}</span>
          </span>
        ))}
      </span>
      <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-700 shrink-0">
        See timeline
        <ChevronRight className="w-3.5 h-3.5" aria-hidden />
      </span>
    </Link>
  );
}
