import { useState } from "react";
import { Link } from "react-router-dom";
import type { Announcement } from "../types";
import { hoursSince } from "../data/dateHelpers";
import { useModalDialog } from "../hooks/useModalDialog";

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
  const dialogRef = useModalDialog(alerts.length > 0, onClose);

  if (alerts.length === 0) return null;

  const submitSnooze = () => {
    onSnooze(reason.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="blocking-alerts-title"
        className="bg-white rounded-lg shadow-2xl border border-red-200 max-w-lg w-full mx-4 outline-none"
      >
        <div className="px-5 py-4 border-b border-red-100 bg-red-50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚠️</span>
            <h2
              id="blocking-alerts-title"
              className="text-base font-semibold text-red-900"
            >
              {alerts.length === 1
                ? "1 alert still needs review"
                : `${alerts.length} alerts still need review`}
            </h2>
          </div>
          <p className="text-xs text-red-800 mt-1.5 pl-8">
            These have been unactioned for more than 72 hours. Each could be
            affecting live client deadlines.
          </p>
        </div>

        <ul className="divide-y divide-slate-100">
          {alerts.map((a) => {
            const h = Math.round(hoursSince(a.detectedAt));
            return (
              <li key={a.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {a.stateCode}: {a.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {a.affectedClientIds.length} client
                    {a.affectedClientIds.length === 1 ? "" : "s"} · {h}h
                    unactioned
                  </div>
                </div>
                <Link
                  to={`/alerts/${a.id}`}
                  onClick={onClose}
                  className="text-sm px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 shrink-0"
                >
                  Review →
                </Link>
              </li>
            );
          })}
        </ul>

        {showSnoozeReason ? (
          <div className="px-5 py-3 bg-slate-50 rounded-b-lg space-y-2">
            <label className="block text-xs font-medium text-slate-600">
              Why are you snoozing? (optional, helps us tune alerting)
            </label>
            <textarea
              data-autofocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. awaiting client confirmation; already reviewed in practice manager"
              rows={2}
              className="w-full text-sm px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSnoozeReason(false)}
                className="text-sm px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50"
              >
                Back
              </button>
              <button
                onClick={submitSnooze}
                className="text-sm px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800"
              >
                Snooze 24h
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-3 bg-slate-50 rounded-b-lg flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Snoozing logs the reason and re-raises tomorrow.
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSnoozeReason(true)}
                className="text-sm px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50"
              >
                Snooze for today
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
