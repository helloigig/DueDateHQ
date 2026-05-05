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
import { CalendarClock, Phone, Mail } from "lucide-react";
import type { Announcement, Client } from "../types";
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
// (cross-year-insighter personalization). For the design-stage modal we use a generic set
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
            Each call lands on Today as a TodoItem. Talking points are
            generated from the alert + client history. You'll book the time
            externally for now — calendar integration is on the roadmap.
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
                  <div className="flex items-baseline gap-2">
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
