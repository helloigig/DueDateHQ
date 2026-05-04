import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import type { Announcement } from "../types";
import { hoursSince } from "../data/dateHelpers";
import { Button } from "./ui/button";
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
  onSnooze,
  onClose,
}: {
  alerts: Announcement[];
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
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="w-5 h-5 text-danger-ink shrink-0 mt-0.5"
              aria-hidden
            />
            <div>
              <AlertDialogTitle tone="danger">
                {alerts.length === 1
                  ? "1 alert still needs review"
                  : `${alerts.length} alerts still need review`}
              </AlertDialogTitle>
              <AlertDialogDescription tone="danger">
                These have been unactioned for more than 72 hours. Each could be
                affecting live client deadlines.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <ul className="divide-y divide-line overflow-y-auto">
          {alerts.map((a) => {
            const h = Math.round(hoursSince(a.detectedAt));
            return (
              <li key={a.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 truncate">
                    {a.stateCode}: {a.title}
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {a.affectedClientIds.length} client
                    {a.affectedClientIds.length === 1 ? "" : "s"} · {h}h
                    unactioned
                  </div>
                </div>
                <Link
                  to={`/alerts/${a.id}`}
                  onClick={onClose}
                  className="text-sm px-3 py-1.5 rounded bg-indigo text-white hover:bg-indigo-hover shrink-0"
                >
                  Review →
                </Link>
              </li>
            );
          })}
        </ul>

        {showSnoozeReason ? (
          <AlertDialogFooter align="end">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-ink-700 mb-1">
                Why are you snoozing? (optional, helps us tune alerting)
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
