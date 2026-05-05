/**
 * SchedulePlanningCallModal — pte_change action surface.
 *
 * Creates planning_calls rows + Today TodoItems. Each call carries Mode-E
 * generated talking points. Calendar integration is P2 — for now, the
 * TodoItem on Today is the surface; Sarah books externally.
 *
 * Spec: docs/specs/alert-detail-pte-change.md
 */
import { useMemo, useState } from "react";
import { CalendarClock, Phone, Mail, CalendarPlus, Download } from "lucide-react";
import type { Announcement, Client } from "../types";
import {
  downloadIcs,
  googleCalendarUrl,
  outlookCalendarUrl,
} from "../lib/calendarLink";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

export interface SchedulePlanningCallModalProps {
  open: boolean;
  announcement: Announcement | null;
  recipients: Client[];
  onClose: () => void;
  onConfirm: (input: {
    clientIds: string[];
    suggestedWindow: "this_week" | "next_2_weeks" | "before_deadline";
    composeEmail: boolean;
  }) => void;
}

const WINDOW_OPTIONS = [
  { value: "this_week", label: "This week", hint: "Fastest follow-up" },
  { value: "next_2_weeks", label: "Next 2 weeks", hint: "Standard cadence" },
  { value: "before_deadline", label: "Before next deadline", hint: "Latest acceptable" },
] as const;

// Talking-points generator stub. In production, BE returns this per-client
// (Mode E personalization). For the design-stage modal we use a generic set
// that adapts to the alert's summary.
function talkingPointsFor(_client: Client, ann: Announcement): string[] {
  return [
    `Confirm intent for 2026 election`,
    `Walk through impact: ${ann.title}`,
    `Q-estimate timing implications`,
  ];
}

export function SchedulePlanningCallModal({
  open,
  announcement,
  recipients,
  onClose,
  onConfirm,
}: SchedulePlanningCallModalProps) {
  const [windowChoice, setWindowChoice] =
    useState<"this_week" | "next_2_weeks" | "before_deadline">("next_2_weeks");
  const [composeEmail, setComposeEmail] = useState(true);

  const points = useMemo(() => {
    if (!announcement) return new Map<string, string[]>();
    const m = new Map<string, string[]>();
    recipients.forEach((c) => m.set(c.id, talkingPointsFor(c, announcement)));
    return m;
  }, [recipients, announcement]);

  if (!announcement) return null;

  const submit = () => {
    onConfirm({
      clientIds: recipients.map((r) => r.id),
      suggestedWindow: windowChoice,
      composeEmail,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-info-ink" aria-hidden />
            Schedule planning calls for {recipients.length} client{recipients.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Each call lands on Today as a TodoItem with talking points
            generated from the alert + client history. Add to Google,
            Outlook, or download an .ics for your existing calendar — your
            choice, no scopes required.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 max-h-96 overflow-y-auto">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-500 font-semibold mb-2">
              Suggested window
            </p>
            <div className="grid grid-cols-3 gap-2">
              {WINDOW_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setWindowChoice(opt.value)}
                  className={`p-2.5 rounded border text-left text-sm ${
                    windowChoice === opt.value
                      ? "border-info-border bg-info-bg/40 ring-2 ring-info-solid/30"
                      : "border-line bg-surface hover:bg-sunken/30"
                  }`}
                >
                  <div className="font-medium text-ink-900">{opt.label}</div>
                  <div className="text-xs text-ink-500">{opt.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-ink-500 font-semibold mb-2">
              Per-client talking points
            </p>
            <ul className="divide-y divide-line border border-line rounded-md bg-surface">
              {recipients.map((c) => (
                <li key={c.id} className="px-3 py-2.5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium text-ink-900">{c.name}</span>
                    <span className="text-xs text-ink-500">
                      {c.entityType} · {c.primaryState}
                    </span>
                    <span className="ml-auto text-xs text-ink-400 inline-flex items-center gap-0.5">
                      <Phone className="w-3 h-3" aria-hidden />
                      Phone
                    </span>
                  </div>
                  <ul className="mt-1.5 space-y-0.5 text-xs text-ink-600">
                    {(points.get(c.id) ?? []).map((pt, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-ink-400">·</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                  <CalendarLinks
                    title={`Planning call · ${c.name}`}
                    description={[
                      `Re: ${announcement.title}`,
                      "",
                      "Talking points:",
                      ...(points.get(c.id) ?? []).map((p) => `· ${p}`),
                    ].join("\n")}
                    suggestedWindow={windowChoice}
                  />
                </li>
              ))}
            </ul>
          </div>

          <label className="flex items-start gap-2 cursor-pointer p-3 rounded border border-line bg-sunken/30">
            <input
              type="checkbox"
              checked={composeEmail}
              onChange={(e) => setComposeEmail(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-info-solid"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-ink-900 inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" aria-hidden />
                Also draft outreach emails ({recipients.length})
              </span>
              <p className="text-xs text-ink-500 mt-0.5">
                Each client gets a "let's chat about your election" email with
                the suggested window. You'll review each draft before sending.
              </p>
            </div>
          </label>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={recipients.length === 0}>
            Schedule {recipients.length} call{recipients.length === 1 ? "" : "s"}
            {composeEmail && ` + draft ${recipients.length} email${recipients.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Resolves the suggested-window choice into a concrete start datetime,
 * defaulting to 10:00 local time on the chosen day. The CPA can edit
 * the time in their calendar client of choice — we just open it
 * pre-filled. This avoids the trap of silently picking 9am or 5pm
 * (feedback_deadlines_dates_only doesn't apply here — this is a
 * call, which IS time-bound — but defaulting to a conservative
 * mid-morning slot still respects the spirit).
 */
function suggestedStartIso(
  suggestedWindow: "this_week" | "next_2_weeks" | "before_deadline",
): string {
  const now = new Date();
  const offsetDays =
    suggestedWindow === "this_week"
      ? 2
      : suggestedWindow === "next_2_weeks"
        ? 7
        : 14;
  const target = new Date(now);
  target.setDate(now.getDate() + offsetDays);
  target.setHours(10, 0, 0, 0);
  return target.toISOString();
}

function CalendarLinks({
  title,
  description,
  suggestedWindow,
}: {
  title: string;
  description: string;
  suggestedWindow: "this_week" | "next_2_weeks" | "before_deadline";
}) {
  const startIso = suggestedStartIso(suggestedWindow);
  const event = { title, description, startIso, durationMinutes: 30 };
  const linkClass =
    "text-2xs inline-flex items-center gap-1 px-2 py-1 rounded border border-line text-ink-700 hover:bg-sunken";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-2xs uppercase tracking-wide text-ink-400 mr-1">
        Add to:
      </span>
      <a
        href={googleCalendarUrl(event)}
        target="_blank"
        rel="noreferrer"
        className={linkClass}
      >
        <CalendarPlus className="w-3 h-3" aria-hidden />
        Google
      </a>
      <a
        href={outlookCalendarUrl(event)}
        target="_blank"
        rel="noreferrer"
        className={linkClass}
      >
        <CalendarPlus className="w-3 h-3" aria-hidden />
        Outlook
      </a>
      <button
        type="button"
        onClick={() =>
          downloadIcs(
            event,
            `${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics`,
          )
        }
        className={linkClass}
        title="Apple Calendar / desktop Outlook / any RFC-5545 client"
      >
        <Download className="w-3 h-3" aria-hidden />
        .ics
      </button>
    </div>
  );
}
