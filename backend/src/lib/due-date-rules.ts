/**
 * Due-date rule engine. Stored as JSONB on `service_templates.due_date_rule`.
 * `computeDueDate(rule, period)` resolves a rule + period (e.g. "2026" or
 * "2026-Q1") to one or more concrete dates.
 *
 * Phase 0 covers the two patterns that handle every form we ship in seed
 * data: annual fixed (e.g. 1040 → April 15) and quarterly fixed (e.g. 941 →
 * Apr 30 / Jul 31 / Oct 31 / Jan 31). Fiscal-year and rolling rules come
 * with §5.3 deadline-engine work in Phase 1.
 */

export type WeekendShift = "next_business_day" | "none";

export type DueDateRule =
  | {
      type: "annual_fixed";
      month: number; // 1-12
      day: number; // 1-31
      weekendShift?: WeekendShift;
    }
  | {
      type: "quarterly_fixed";
      // One entry per Q1..Q4. month/day are filed-by dates.
      periods: Array<{ month: number; day: number }>;
      weekendShift?: WeekendShift;
    };

const DAY_MS = 86_400_000;

function shiftIfWeekend(d: Date, mode: WeekendShift = "next_business_day"): Date {
  if (mode === "none") return d;
  const dow = d.getUTCDay();
  if (dow === 6) return new Date(d.getTime() + 2 * DAY_MS); // Sat → Mon
  if (dow === 0) return new Date(d.getTime() + 1 * DAY_MS); // Sun → Mon
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface ComputedDueDate {
  /** "2026" / "2026-Q1" — what was passed in. */
  period: string;
  /** Statutory date (no weekend shift). */
  officialDueDate: string;
  /** Weekend/holiday-adjusted date — what the dashboard displays. */
  adjustedDueDate: string;
}

export function computeDueDate(
  rule: DueDateRule,
  period: string,
): ComputedDueDate[] {
  if (rule.type === "annual_fixed") {
    const year = parseInt(period, 10);
    if (!Number.isFinite(year)) {
      throw new Error(`annual_fixed expects period="yyyy", got "${period}"`);
    }
    const official = new Date(Date.UTC(year, rule.month - 1, rule.day));
    const adjusted = shiftIfWeekend(official, rule.weekendShift);
    return [
      {
        period,
        officialDueDate: isoDate(official),
        adjustedDueDate: isoDate(adjusted),
      },
    ];
  }
  // quarterly_fixed: period can be "yyyy" (returns all 4) or "yyyy-Qq" (returns 1).
  const yearMatch = period.match(/^(\d{4})(?:-Q([1-4]))?$/);
  if (!yearMatch) {
    throw new Error(
      `quarterly_fixed expects period="yyyy" or "yyyy-Qq", got "${period}"`,
    );
  }
  const year = parseInt(yearMatch[1]!, 10);
  const quarterFilter = yearMatch[2] ? parseInt(yearMatch[2], 10) : null;
  const out: ComputedDueDate[] = [];
  rule.periods.forEach((p, idx) => {
    const q = idx + 1;
    if (quarterFilter && q !== quarterFilter) return;
    // Some quarterly forms (e.g. 1040-ES Q4) file in *next* year.
    // We assume `month` is a month in the same calendar year unless its
    // index is later than its month — which only happens for Q4 spilling
    // to Jan. Detect that by comparing to the previous period.
    const prev = idx > 0 ? rule.periods[idx - 1]! : null;
    const yearOffset = prev && p.month < prev.month ? 1 : 0;
    const official = new Date(
      Date.UTC(year + yearOffset, p.month - 1, p.day),
    );
    const adjusted = shiftIfWeekend(official, rule.weekendShift);
    out.push({
      period: `${year}-Q${q}`,
      officialDueDate: isoDate(official),
      adjustedDueDate: isoDate(adjusted),
    });
  });
  return out;
}
