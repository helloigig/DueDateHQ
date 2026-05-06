import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { Announcement } from "../types";
import { hoursSince } from "../data/dateHelpers";
import { Button } from "./ui/button";
import { StateBadge } from "./ui/StateBadge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

export function BlockingAlertsDialog({
  alerts,
  totalAffecting,
  onSnooze,
  onClose,
}: {
  alerts: Announcement[];
  /** Total alerts affecting the firm (the /alerts "Affecting you" tab
   *  count). Used to render "{escalated} of {totalAffecting} affecting
   *  you" so the modal explicitly reads as a subset. */
  totalAffecting?: number;
  onSnooze: (reason: string) => void;
  onClose: () => void;
}) {
  const [showSnoozeReason, setShowSnoozeReason] = useState(false);
  const [reason, setReason] = useState("");

  if (alerts.length === 0) return null;

  return (
    <AlertDialog open={alerts.length > 0}>
      <AlertDialogContent size="lg">
        <AlertDialogHeader tone="danger">
          <div className="flex items-start gap-3">
            {/* Header icon tile sized to match the StateBadge size="md"
                in the rows below (w-9 h-9 = 36px). Same visual weight
                so the header reads as the "row of rows" — same anatomy,
                bigger label. Yuqi audit 2026-05-06: previously the
                40px header tile and 28px row badge looked like
                different families. */}
            <span
              aria-hidden
              className="w-9 h-9 rounded-md bg-danger-bg border border-danger-border/60 flex items-center justify-center text-danger-ink shrink-0 shadow-[inset_0_-1px_0_rgba(185,28,28,0.06)]"
            >
              <AlertTriangle className="w-4 h-4" aria-hidden />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-2xs font-semibold uppercase tracking-wider text-danger-ink/80">
                Past 72-hour SLA
              </p>
              <AlertDialogTitle tone="danger" className="mt-0.5">
                <span className="tabular-nums">{alerts.length}</span>{" "}
                {alerts.length === 1 ? "alert still needs review" : "alerts still need review"}
              </AlertDialogTitle>
              <AlertDialogDescription tone="danger" className="mt-1.5 text-ink-500">
                Unactioned for more than 72 hours. Each could be affecting live client deadlines.
                {typeof totalAffecting === "number" && totalAffecting > alerts.length && (
                  <>
                    <br />
                    <Link
                      to="/alerts"
                      onClick={onClose}
                      className="text-2xs text-ink-500 hover:text-ink-900 underline underline-offset-2 inline-flex items-center gap-1 mt-1.5"
                    >
                      <span className="tabular-nums">{alerts.length}</span> of{" "}
                      <span className="tabular-nums">{totalAffecting}</span> alerts affecting you have crossed 72h →
                    </Link>
                  </>
                )}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <ul className="divide-y divide-line overflow-y-auto">
          {alerts.map((a) => {
            const h = Math.round(hoursSince(a.detectedAt));
            return (
              <li
                key={a.id}
                className="group px-region py-3 flex items-center gap-3 hover:bg-sunken/60 transition-colors"
              >
                {/* Match the header icon tile size (w-9 h-9) for visual
                    consistency. Bumped from size="sm" (w-7 h-7) per
                    Yuqi audit. */}
                <StateBadge code={a.stateCode} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 truncate">
                    {a.title}
                  </div>
                  <div className="text-2xs text-ink-500 mt-1">
                    <span className="tabular-nums">{a.affectedClientIds.length}</span>{" "}
                    {a.affectedClientIds.length === 1 ? "client" : "clients"}
                    <span className="mx-1.5 text-ink-300">·</span>
                    <span className="tabular-nums">{h}h</span> unactioned
                  </div>
                </div>
                <Link
                  to={`/alerts/${a.id}`}
                  onClick={onClose}
                  className="text-sm h-9 px-3 rounded-md bg-indigo text-white hover:bg-indigo-hover shrink-0 inline-flex items-center gap-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
                >
                  Review
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>

        {showSnoozeReason ? (
          <AlertDialogFooter align="end">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-ink-700 mb-1 whitespace-nowrap">
                Why are you snoozing? <span className="text-ink-400 font-normal">(optional)</span>
              </label>
              <textarea
                data-autofocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. awaiting client confirmation; already reviewed in practice manager"
                rows={2}
                className="w-full text-sm px-2.5 py-1.5 rounded border border-line focus:outline-none focus:ring-2 focus:ring-indigo resize-none"
              />
            </div>
            <div className="flex items-center gap-2 self-end shrink-0">
              <Button
                variant="outline"
                onClick={() => setShowSnoozeReason(false)}
              >
                Back
              </Button>
              <Button onClick={() => onSnooze(reason.trim())}>
                Snooze 24h
              </Button>
            </div>
          </AlertDialogFooter>
        ) : (
          <AlertDialogFooter align="between">
            <span className="text-xs text-ink-500">
              Snoozing logs the reason and re-raises tomorrow.
            </span>
            <Button
              variant="outline"
              onClick={() => setShowSnoozeReason(true)}
            >
              Snooze for today
            </Button>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
