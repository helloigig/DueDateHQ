import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import type { Announcement } from "../types";
import { hoursSince } from "../data/dateHelpers";
import { Modal, useModalLabelId } from "./Modal";

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
  const labelId = useModalLabelId();

  if (alerts.length === 0) return null;

  return (
    <Modal
      open={alerts.length > 0}
      onClose={onClose}
      ariaLabelledBy={labelId}
      size="lg"
      closeOnBackdrop={false}
    >
      <Modal.Header tone="danger">
        <div className="flex items-start gap-2">
          <AlertTriangle
            className="w-5 h-5 text-danger-ink shrink-0 mt-0.5"
            aria-hidden
          />
          <div>
            <h2
              id={labelId}
              className="text-base font-semibold text-danger-ink"
            >
              {alerts.length === 1
                ? "1 alert still needs review"
                : `${alerts.length} alerts still need review`}
            </h2>
            <p className="text-xs text-danger-ink mt-1">
              These have been unactioned for more than 72 hours. Each could be
              affecting live client deadlines.
            </p>
          </div>
        </div>
      </Modal.Header>

      <ul className="divide-y divide-line">
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
                className="text-sm px-3 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover shrink-0"
              >
                Review →
              </Link>
            </li>
          );
        })}
      </ul>

      {showSnoozeReason ? (
        <Modal.Footer tone="sunken" align="end">
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
              className="w-full text-sm px-2.5 py-1.5 rounded border border-line focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>
          <div className="flex items-center gap-2 self-end shrink-0">
            <button
              onClick={() => setShowSnoozeReason(false)}
              className="text-sm px-3 py-1.5 rounded border border-line bg-surface hover:bg-sunken text-ink-700"
            >
              Back
            </button>
            <button
              onClick={() => onSnooze(reason.trim())}
              className="text-sm px-3 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover"
            >
              Snooze 24h
            </button>
          </div>
        </Modal.Footer>
      ) : (
        <Modal.Footer tone="sunken" align="between">
          <span className="text-xs text-ink-500">
            Snoozing logs the reason and re-raises tomorrow.
          </span>
          <button
            onClick={() => setShowSnoozeReason(true)}
            className="text-sm px-3 py-1.5 rounded border border-line bg-surface hover:bg-sunken text-ink-700"
          >
            Snooze for today
          </button>
        </Modal.Footer>
      )}
    </Modal>
  );
}
