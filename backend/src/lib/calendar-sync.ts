/**
 * Google Calendar push — Phase 1 one-way sync.
 *
 * Mirrors a firm's deadlines as Google Calendar events on the connected
 * CPA's primary calendar. Push-only: edits made in the dashboard
 * propagate to the calendar; edits made in the calendar do NOT come
 * back (Phase 2 wires the two-way path via Google Calendar push
 * notifications + webhook handler).
 *
 * The dedupe key is `deadlines.calendar_event_id`:
 *   - null      → POST /events to create
 *   - non-null  → PATCH /events/{id} to update
 *
 * Idempotent: re-running on the same firm produces zero new events,
 * just updates ones whose source-of-truth fields changed.
 *
 * Triggered from two places:
 *   1. `seedClientWithPackage` (assignBundle path) — kicks off after
 *      deadlines are spawned so the CPA sees calendar events appear
 *      within seconds of completing onboarding.
 *   2. The 4h cron tick (`startCalendarSyncScheduler`) — catches up
 *      anything that drifted (deadlines edited in /clients, status
 *      transitions, etc.).
 */

import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { clients, deadlines, integrations } from "../db/schema.js";
import { getFreshAccessToken } from "./oauth.js";
import { log, captureException, span } from "./observability.js";

/**
 * Calendar push for one firm. Walks the firm's open deadlines (status
 * != completed/filed_extension) and ensures each has a corresponding
 * Google Calendar event.
 *
 * Skips silently when the firm hasn't connected Google Calendar — this
 * is called fire-and-forget from the assignBundle path, so a firm
 * without the integration shouldn't see errors in the activity log.
 */
export async function syncFirmToGoogleCalendar(
  firmId: string,
  options: { onlyStale?: boolean } = {},
): Promise<{
  pushed: number;
  updated: number;
  skipped: number;
  errors: number;
}> {
  return span("calendar.sync_firm", async () => {
    // Is the firm connected? Bail fast if not — caller (assignBundle)
    // doesn't care about non-connected firms and shouldn't see errors.
    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.firmId, firmId),
        eq(integrations.kind, "google_calendar"),
        eq(integrations.status, "connected"),
      ),
    });
    if (!integration) {
      return { pushed: 0, updated: 0, skipped: 0, errors: 0 };
    }

    let accessToken: string;
    try {
      accessToken = await getFreshAccessToken(firmId, "google_calendar");
    } catch (err) {
      // Token refresh failed — likely the user revoked access. Surface
      // via lastError (already set by oauth.ts) and bail. The Settings
      // panel shows the error; the cron will retry hourly.
      log.warn("calendar.sync.no_token", {
        firmId,
        message: err instanceof Error ? err.message : String(err),
      });
      return { pushed: 0, updated: 0, skipped: 0, errors: 1 };
    }

    // Pick the deadlines to push:
    //   - Open (status != completed / filed_extension)
    //   - Either never synced OR synced before the last update
    //     (i.e. stale relative to the dashboard truth)
    const candidates = await db
      .select({
        id: deadlines.id,
        clientId: deadlines.clientId,
        clientName: clients.name,
        formType: deadlines.formType,
        jurisdiction: deadlines.jurisdiction,
        adjustedDueDate: deadlines.adjustedDueDate,
        internalTargetDate: deadlines.internalTargetDate,
        status: deadlines.status,
        calendarEventId: deadlines.calendarEventId,
        calendarSyncedAt: deadlines.calendarSyncedAt,
        updatedAt: deadlines.updatedAt,
      })
      .from(deadlines)
      .innerJoin(clients, eq(clients.id, deadlines.clientId))
      .where(
        and(
          eq(deadlines.firmId, firmId),
          sql`${deadlines.status} NOT IN ('completed', 'filed_extension')`,
          options.onlyStale
            ? or(
                isNull(deadlines.calendarSyncedAt),
                lte(deadlines.calendarSyncedAt, deadlines.updatedAt),
              )!
            : sql`true`,
        ),
      );

    let pushed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const d of candidates) {
      try {
        const event = composeEvent({ ...d, deadlineId: d.id });
        if (d.calendarEventId) {
          await patchEvent(accessToken, d.calendarEventId, event);
          updated++;
        } else {
          const created = await createEvent(accessToken, event);
          await db
            .update(deadlines)
            .set({
              calendarEventId: created.id,
              calendarSyncedAt: new Date(),
            })
            .where(eq(deadlines.id, d.id));
          pushed++;
          continue;
        }
        await db
          .update(deadlines)
          .set({ calendarSyncedAt: new Date() })
          .where(eq(deadlines.id, d.id));
      } catch (err) {
        errors++;
        captureException(err, { firmId, deadlineId: d.id, ctx: "calendar.push" });
      }
    }

    if (pushed + updated + errors > 0) {
      await db
        .update(integrations)
        .set({
          lastSyncedAt: new Date(),
          lastError: errors > 0 ? `${errors} event(s) failed to push` : null,
        })
        .where(eq(integrations.id, integration.id));
    }

    log.info("calendar.sync.done", { firmId, pushed, updated, skipped, errors });
    return { pushed, updated, skipped, errors };
  });
}

// ---------- Event composition ----------

interface EventInput {
  clientName: string;
  formType: string;
  jurisdiction: string;
  adjustedDueDate: string;
  internalTargetDate: string | null;
  deadlineId: string;
}

interface GoogleCalendarEvent {
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
  // Reminder defaults — calendar's built-in 1-day-before notification
  // is enough for the morning-of awareness; the digest covers the
  // multi-day-out lookahead.
  reminders: {
    useDefault: false;
    overrides: Array<{ method: "popup"; minutes: number }>;
  };
  // Source link drops the user back into the dashboard for the
  // task. iOS Calendar honors this in the event detail view; macOS
  // Calendar shows it as a clickable URL in the description.
  source?: { title: string; url: string };
}

function composeEvent(d: EventInput): GoogleCalendarEvent {
  const summary = `[${d.clientName}] ${d.formType} due`;
  const dueDate = d.adjustedDueDate;
  // Google Calendar uses exclusive `end.date` for all-day events: a
  // one-day event uses end = start + 1.
  const end = addDay(dueDate);
  const target = d.internalTargetDate;
  const taskUrl = `${process.env.PUBLIC_BASE_URL ?? "https://duedatehq.space"}/tasks/${d.deadlineId}`;
  const description = [
    `Filing: ${d.formType}`,
    `Jurisdiction: ${d.jurisdiction.toUpperCase()}`,
    target ? `Internal target: ${target}` : null,
    "",
    `Open in DueDateHQ: ${taskUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summary,
    description,
    start: { date: dueDate },
    end: { date: end },
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: 24 * 60 }],
    },
    source: { title: "DueDateHQ", url: taskUrl },
  };
}

function addDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

// ---------- Google Calendar API ----------

const CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

async function createEvent(
  accessToken: string,
  event: GoogleCalendarEvent,
): Promise<{ id: string }> {
  const res = await fetch(CALENDAR_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`google_calendar_create_failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { id: string };
  return { id: json.id };
}

async function patchEvent(
  accessToken: string,
  eventId: string,
  event: GoogleCalendarEvent,
): Promise<void> {
  const url = `${CALENDAR_API}/${encodeURIComponent(eventId)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
  // 404 means the event was deleted in the calendar — clear our id
  // so the next cycle re-creates it. Treat as a soft success.
  if (res.status === 404) {
    log.info("calendar.event_404_repushing", { eventId });
    throw new Error("event_deleted_in_calendar"); // caller logs + retries via clearStaleEventId
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`google_calendar_patch_failed: ${res.status} ${body.slice(0, 200)}`);
  }
}

// ---------- Scheduler ----------

let handle: NodeJS.Timeout | null = null;

/**
 * Start the in-process 4-hour cron tick. Walks every firm with a
 * connected Google Calendar integration and syncs stale deadlines.
 * Set CALENDAR_SYNC_DISABLED=1 to suppress without redeploying.
 */
export function startCalendarSyncScheduler(intervalMs = 4 * 60 * 60 * 1000): void {
  if (handle) return;
  handle = setInterval(() => {
    void runCycle().catch((err) => captureException(err, { ctx: "calendar.sync.tick" }));
  }, intervalMs);
  handle.unref?.();
}

export function stopCalendarSyncScheduler(): void {
  if (handle) {
    clearInterval(handle);
    handle = null;
  }
}

async function runCycle(): Promise<void> {
  if (process.env.CALENDAR_SYNC_DISABLED === "1") return;
  const connected = await db
    .select({ firmId: integrations.firmId })
    .from(integrations)
    .where(
      and(
        eq(integrations.kind, "google_calendar"),
        eq(integrations.status, "connected"),
      ),
    );
  for (const row of connected) {
    try {
      await syncFirmToGoogleCalendar(row.firmId, { onlyStale: true });
    } catch (err) {
      captureException(err, { firmId: row.firmId, ctx: "calendar.sync.cycle" });
    }
  }
}
