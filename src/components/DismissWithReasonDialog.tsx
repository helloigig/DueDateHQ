import { useState } from "react";
import { useModalDialog } from "../hooks/useModalDialog";

const REASONS = [
  "None of my clients are affected",
  "Already handled in another tool",
  "Reviewed — no action needed",
  "Duplicate of another alert",
] as const;

export function DismissWithReasonDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [pick, setPick] = useState<string>(REASONS[0]);
  const [custom, setCustom] = useState("");
  const dialogRef = useModalDialog(open, onCancel);

  if (!open) return null;

  const reason = pick === "Other" ? custom.trim() : pick;
  const canSubmit = pick !== "Other" || custom.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dismiss-title"
        className="bg-white rounded-lg shadow-2xl border border-slate-200 max-w-md w-full mx-4 outline-none"
      >
        <div className="px-5 py-4 border-b border-slate-100">
          <h2
            id="dismiss-title"
            className="text-base font-semibold text-slate-900"
          >
            Dismiss this alert?
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            You won't see this in banners or the bell again. The alert stays in
            your history. The reason you select helps tune AI matching.
          </p>
        </div>

        <div className="px-5 py-4 space-y-2">
          {REASONS.map((r) => (
            <label
              key={r}
              className="flex items-start gap-2 cursor-pointer text-sm"
            >
              <input
                type="radio"
                name="dismiss-reason"
                value={r}
                checked={pick === r}
                onChange={() => setPick(r)}
                className="mt-0.5 accent-slate-900"
              />
              <span className="text-slate-700">{r}</span>
            </label>
          ))}
          <label className="flex items-start gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              name="dismiss-reason"
              value="Other"
              checked={pick === "Other"}
              onChange={() => setPick("Other")}
              className="mt-0.5 accent-slate-900"
            />
            <span className="text-slate-700">Other</span>
          </label>
          {pick === "Other" && (
            <textarea
              data-autofocus
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              rows={2}
              placeholder="What's the reason?"
              className="w-full text-sm px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
            />
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 rounded-b-lg flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-sm px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            disabled={!canSubmit}
            onClick={() => onConfirm(reason)}
            className="text-sm px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
