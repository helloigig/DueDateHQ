// `TODAY` and `NOW_ANCHOR` are mode-aware:
//   • Mock mode (default / demo): pinned to 2026-04-23 so fixture data with
//     known `detectedAt` / `dueDate` values lands in the intended bucket
//     every time. Without this, demo escalation tiers, "behind plan" counts,
//     and snooze gating drift as real time advances.
//   • Real mode (VITE_USE_MOCK_DATA=false): tracks actual local-day start
//     and current UTC moment so escalation, deadline state, and snooze-
//     until-tomorrow all advance day-to-day with real users' clocks.
//
// Both stay typed as `Date` so the ~70 import sites across the app don't
// change. Module evaluates once per page load; that resolution is fine
// for the lifetime of a session.
const isMockMode = import.meta.env.VITE_USE_MOCK_DATA !== "false";

export const TODAY = isMockMode
  ? new Date("2026-04-23T00:00:00")
  : (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    })();

export function parseDate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * Quarter / period suffix for known recurring federal forms.
 *
 * Why it lives here: forms like 941 and 720 are filed multiple times a
 * year (Q1/Q2/Q3/Q4). When a per-client view groups them by client, the
 * raw "941 · federal" label repeats N times — the only differentiator
 * is the IRS due date, which gets pushed into a separate chip and is
 * easy to miss when scanning. Yuqi audit 2026-05-06: "why are there
 * three 941? you need to differentiate that". This helper derives
 * the period from the IRS due date so the row label can read
 * "941 · Q1 · federal" and disambiguate at a glance.
 *
 * 941 / 720 schedule (federal payroll + excise):
 *   Apr — covers Q1   |   Jul — covers Q2
 *   Oct — covers Q3   |   Jan-of-next-year — covers Q4
 *
 * Returns null when the form isn't on a recognised quarterly schedule
 * (callers fall back to the bare form name).
 */
export function periodSuffix(
  form: string,
  dueDate: string,
): string | null {
  const formNumber = form.replace(/\s*\(.*\)\s*$/, "").trim().toUpperCase();
  const month = parseInt(dueDate.slice(5, 7), 10);
  if (formNumber === "941" || formNumber === "720") {
    if (month === 4) return "Q1";
    if (month === 7) return "Q2";
    if (month === 10) return "Q3";
    if (month === 1) return "Q4";
  }
  return null;
}

/**
 * Hours between two ISO timestamps (a → b). Positive if b is after a.
 * In mock mode "now" is pinned to a fixed anchor so escalation tiers
 * are deterministic in the demo. In real mode "now" is real-now so
 * tier (fresh / reminder / escalated / blocking) advances day-to-day.
 */
const NOW_ANCHOR = isMockMode
  ? new Date("2026-04-23T11:00:00Z") // mid-morning Thursday
  : new Date();

export function hoursSince(iso: string): number {
  const t = new Date(iso).getTime();
  return (NOW_ANCHOR.getTime() - t) / (1000 * 60 * 60);
}

export type EscalationTier = "fresh" | "reminder" | "escalated" | "blocking";

export function escalationTier(hours: number): EscalationTier {
  if (hours < 24) return "fresh";
  if (hours < 48) return "reminder";
  if (hours < 72) return "escalated";
  return "blocking";
}

export function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function startOfWeek(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

export function endOfMonth(d: Date): Date {
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  e.setHours(23, 59, 59, 999);
  return e;
}

export function formatShortDate(iso: string): string {
  const d = parseDate(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatLongDate(iso: string): string {
  // Guard against undefined / null / empty / malformed inputs — common with
  // imported clients whose addedAt didn't round-trip cleanly. Without this,
  // `new Date("").toLocaleDateString()` renders as "Invalid Date" in the UI.
  if (!iso) return "—";
  const d = parseDate(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatWeekdayShort(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export function countdownLabel(dueIso: string): string {
  const due = parseDate(dueIso);
  const diff = daysBetween(TODAY, due);
  if (diff < 0) return `${-diff}d late`;
  if (diff === 0) return "Today";
  const weekEnd = endOfWeek(TODAY);
  if (due <= weekEnd) return formatWeekdayShort(due);
  if (diff < 14) return `${diff}d`;
  return formatShortDate(dueIso);
}

export type TimeBucket = "overdue" | "this_week" | "this_month" | "long_term";

export function bucketOf(dueIso: string): TimeBucket {
  const due = parseDate(dueIso);
  const diff = daysBetween(TODAY, due);
  if (diff < 0) return "overdue";
  const weekEnd = endOfWeek(TODAY);
  if (due <= weekEnd) return "this_week";
  // "This month" = the ~5 Mon-Sun weeks beyond this week.
  // When "today" is late in a calendar month, this naturally spans into next month.
  const monthOut = new Date(weekEnd);
  monthOut.setDate(weekEnd.getDate() + 35);
  if (due <= monthOut) return "this_month";
  return "long_term";
}

export function weekOfLabel(iso: string): string {
  const d = parseDate(iso);
  const monday = startOfWeek(d);
  return `Week of ${monday.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

// ──────────────────────────────────────────────────────────────────────────
// Deadline state classifier — drives the <DeadlineChip> surface.
//
// CPAs work to a buffer between an internal target date (firm-set, the date
// they plan to file by) and the official IRS / state deadline. The product's
// central "are we behind?" question deserves one canonical answer so every
// surface (TaskHeader, list rows, Today queue, Timeline) inherits the same
// framing. Two integers + the active milestone label = the entire CPA-facing
// state — no qualitative verbs needed (locked policy:
// `feedback_deadlines_dates_only.md` — dates only, never times; whole-day
// integers, no clock).
//
// State machine:
//   on_track        — no slip; current milestone target still in the future
//   behind          — non-File milestone has slipped past target
//   past_file_safe  — File target slipped, runway to IRS > half original buffer
//   past_file_tight — File target slipped, runway ≤ half original buffer
//   critical        — ≤ 3 days to official deadline, not yet filed
//   overdue         — past official deadline, not filed
//   extension       — extension was filed (status flag)
//   completed       — task closed
// ──────────────────────────────────────────────────────────────────────────

export type DeadlineState =
  | "on_track"
  | "behind"
  | "past_file_safe"
  | "past_file_tight"
  | "critical"
  | "overdue"
  | "extension"
  | "completed";

export type RecommendedAction =
  | "chase"
  | "submit"
  | "extension"
  | "extension_now"
  | "view_extension"
  | null;

export interface DeadlineStateInput {
  officialDueDate: string;
  /** Firm-set internal target (the File milestone target). */
  internalTargetDate?: string;
  /** Earliest non-done milestone target — drives "behind on Collect" framing. */
  currentMilestoneTargetDate?: string;
  currentMilestoneLabel?: string;
  status?:
    | "not_started"
    | "in_progress"
    | "completed"
    | "deferred"
    | "filed_extension"
    | "overdue"
    | "not_applicable";
  /** Original buffer used to compute the "tight" threshold. Defaults to 7d (annual). */
  originalBufferDays?: number;
}

export interface DeadlineStateResult {
  state: DeadlineState;
  /** Signed integer days late on the operative milestone. Always whole days. */
  daysBehind: number;
  /** Days remaining to official deadline. Negative = past it. Always whole days. */
  daysToOfficial: number;
  /** Active milestone driving the framing — null when on track and nothing is set. */
  activeMilestone: { label: string; targetDate: string } | null;
  /** True once the back-plan has slipped — official date should louden. */
  showOfficialReference: boolean;
  recommendedAction: RecommendedAction;
}

export function classifyDeadlineState(
  input: DeadlineStateInput,
): DeadlineStateResult {
  const {
    officialDueDate,
    internalTargetDate,
    currentMilestoneTargetDate,
    currentMilestoneLabel,
    status,
    originalBufferDays = 7,
  } = input;

  const official = parseDate(officialDueDate);
  const daysToOfficial = daysBetween(TODAY, official);

  if (status === "completed") {
    return {
      state: "completed",
      daysBehind: 0,
      daysToOfficial,
      activeMilestone: null,
      showOfficialReference: false,
      recommendedAction: null,
    };
  }
  if (status === "filed_extension") {
    return {
      state: "extension",
      daysBehind: 0,
      daysToOfficial,
      activeMilestone: null,
      showOfficialReference: true,
      recommendedAction: "view_extension",
    };
  }

  if (daysToOfficial < 0) {
    return {
      state: "overdue",
      daysBehind: -daysToOfficial,
      daysToOfficial,
      activeMilestone: null,
      showOfficialReference: true,
      recommendedAction: "extension_now",
    };
  }

  if (daysToOfficial <= 3) {
    return {
      state: "critical",
      daysBehind: 0,
      daysToOfficial,
      activeMilestone: null,
      showOfficialReference: true,
      recommendedAction: "extension_now",
    };
  }

  // Grey zone: today > internalTargetDate but legal deadline still reachable.
  // Tight vs safe split by how much of the original buffer has been eaten.
  if (internalTargetDate) {
    const internal = parseDate(internalTargetDate);
    const fileSlip = daysBetween(internal, TODAY);
    if (fileSlip > 0) {
      const tightThreshold = Math.max(1, Math.floor(originalBufferDays / 2));
      const isTight = daysToOfficial <= tightThreshold;
      return {
        state: isTight ? "past_file_tight" : "past_file_safe",
        daysBehind: fileSlip,
        daysToOfficial,
        activeMilestone: { label: "File", targetDate: internalTargetDate },
        showOfficialReference: true,
        recommendedAction: isTight ? "extension" : "submit",
      };
    }
  }

  // Behind on a non-File milestone (Collect, Prepare, Review).
  if (currentMilestoneTargetDate && currentMilestoneLabel) {
    const ms = parseDate(currentMilestoneTargetDate);
    const slip = daysBetween(ms, TODAY);
    if (slip > 0) {
      return {
        state: "behind",
        daysBehind: slip,
        daysToOfficial,
        activeMilestone: {
          label: currentMilestoneLabel,
          targetDate: currentMilestoneTargetDate,
        },
        showOfficialReference: false,
        recommendedAction: "chase",
      };
    }
  }

  return {
    state: "on_track",
    daysBehind: 0,
    daysToOfficial,
    activeMilestone:
      currentMilestoneTargetDate && currentMilestoneLabel
        ? {
            label: currentMilestoneLabel,
            targetDate: currentMilestoneTargetDate,
          }
        : null,
    showOfficialReference: false,
    recommendedAction: null,
  };
}
