export const TODAY = new Date("2026-04-23T00:00:00");

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
 * Hours between two ISO timestamps (a → b). Positive if b is after a.
 * Uses "now" = TODAY anchor so escalation is deterministic in demo.
 */
const NOW_ANCHOR = new Date("2026-04-23T11:00:00Z"); // mid-morning Thursday

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
  const d = parseDate(iso);
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
