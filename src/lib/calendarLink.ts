/**
 * Calendar integration — Phase 1 surface.
 *
 * Three lightweight paths exist before we build OAuth-backed Google /
 * Microsoft Calendar integrations (Phase 2):
 *
 *   1. Google Calendar deep-link — opens a pre-filled "Create event" page
 *      in the CPA's existing google.com login. Free, instant, no scopes.
 *   2. Outlook deep-link — same idea against outlook.live.com.
 *   3. .ics download — works for Apple Calendar / Outlook desktop / any
 *      RFC-5545 client. We never POST to a calendar API.
 *
 * Time policy: deadlines are dates, not times (feedback_deadlines_dates_only).
 * Planning calls ARE time-bound, so this helper accepts a 30-minute window
 * starting at a given local datetime — caller picks the time, we never
 * silently default to a business hour.
 *
 * No bytes leave the browser; no telemetry; no calendar token storage.
 */

export interface CalendarEventInput {
  title: string;
  /** ISO 8601 start, e.g. "2026-05-12T15:00:00". Local time semantics. */
  startIso: string;
  /** Minutes; defaults to 30. */
  durationMinutes?: number;
  description?: string;
  location?: string;
  /** Optional attendee emails — surfaced in Google/Outlook deep-links. */
  attendees?: string[];
}

const DEFAULT_DURATION = 30;

function toCompactUtc(iso: string): string {
  // 20260512T150000Z (RFC-5545 form). Treat the input as already-resolved
  // local time; the user picks the time so we don't second-guess offsets.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function endIso(input: CalendarEventInput): string {
  const start = new Date(input.startIso);
  const dur = input.durationMinutes ?? DEFAULT_DURATION;
  return new Date(start.getTime() + dur * 60_000).toISOString();
}

export function googleCalendarUrl(input: CalendarEventInput): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${toCompactUtc(input.startIso)}/${toCompactUtc(endIso(input))}`,
    details: input.description ?? "",
    location: input.location ?? "",
  });
  if (input.attendees && input.attendees.length > 0) {
    params.set("add", input.attendees.join(","));
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(input: CalendarEventInput): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: input.title,
    startdt: input.startIso,
    enddt: endIso(input),
    body: input.description ?? "",
    location: input.location ?? "",
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function buildIcs(input: CalendarEventInput): string {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@duedatehq.space`;
  const now = toCompactUtc(new Date().toISOString());
  const escape = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DueDateHQ//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toCompactUtc(input.startIso)}`,
    `DTEND:${toCompactUtc(endIso(input))}`,
    `SUMMARY:${escape(input.title)}`,
    input.description ? `DESCRIPTION:${escape(input.description)}` : "",
    input.location ? `LOCATION:${escape(input.location)}` : "",
    ...(input.attendees ?? []).map(
      (a) => `ATTENDEE;RSVP=TRUE:mailto:${a}`,
    ),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.filter(Boolean).join("\r\n");
}

export function downloadIcs(input: CalendarEventInput, filename = "event.ics") {
  const blob = new Blob([buildIcs(input)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
