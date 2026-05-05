import { useState } from "react";

/**
 * Final confirm modal. Shows the firm what they're about to commit:
 * "Create 17 deadlines for Acme LLC across 4 jurisdictions" + an optional
 * "save as a reusable package" checkbox + Confirm/Cancel.
 *
 * Mirrors the user-stated copy goal:
 *   "This will create 17 deadlines for Acme LLC across 4 jurisdictions.
 *    Save as package for reuse? ☐ Confirm"
 */
export function ConfirmModal({
  clientName,
  deadlineCount,
  stateCount,
  stateLabel,
  isPending,
  errorMessage,
  onConfirm,
  onCancel,
}: {
  clientName: string;
  deadlineCount: number;
  stateCount: number;
  stateLabel: string;
  isPending: boolean;
  errorMessage: string | null;
  onConfirm: (saveAsPackage: boolean, customName?: string) => void;
  onCancel: () => void;
}) {
  const [saveAsPackage, setSaveAsPackage] = useState(false);
  const [customName, setCustomName] = useState("");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/50 backdrop-blur-[2px] p-4"
      onMouseDown={onCancel}
    >
      <div
        role="dialog"
        aria-label="Confirm multi-state filing"
        className="bg-surface rounded-md shadow-overlay border border-line w-full max-w-md outline-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-line">
          <h2 className="text-base font-semibold text-ink-900">
            Confirm filing setup
          </h2>
        </div>

        <div className="px-5 py-4 space-y-4 text-sm">
          <p className="text-ink-700">
            This will create{" "}
            <span className="font-semibold text-ink-900">
              {deadlineCount} deadline{deadlineCount === 1 ? "" : "s"}
            </span>{" "}
            for{" "}
            <span className="font-semibold text-ink-900">{clientName}</span>{" "}
            across{" "}
            <span className="font-semibold text-ink-900">
              {stateCount} jurisdiction{stateCount === 1 ? "" : "s"}
            </span>{" "}
            ({stateLabel}).
          </p>
          <p className="text-xs text-ink-500">
            Tasks and AI-suggested checklists will be spawned alongside.
            You can mark anything not-applicable later.
          </p>

          <label className="flex items-start gap-2 cursor-pointer pt-2 border-t border-line">
            <input
              type="checkbox"
              checked={saveAsPackage}
              onChange={(e) => setSaveAsPackage(e.target.checked)}
              className="mt-1 w-3.5 h-3.5 accent-accent"
            />
            <span className="text-sm text-ink-700">
              <span className="font-medium text-ink-900">
                Save as a reusable package
              </span>
              <span className="block text-2xs text-ink-500 mt-0.5">
                Re-apply this state combination to other multi-state clients
                in one click.
              </span>
            </span>
          </label>

          {saveAsPackage && (
            <div className="pl-6">
              <label className="block">
                <span className="text-2xs uppercase tracking-wider text-ink-500 font-semibold mb-1 block">
                  Package name (optional)
                </span>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={`${clientName} — Multi-State`}
                  className="w-full px-2.5 py-1.5 rounded border border-line text-sm focus:outline-none focus:ring-2 focus:ring-indigo focus:border-indigo"
                />
                <span className="block text-2xs text-ink-400 mt-1">
                  Leave blank to use the default name.
                </span>
              </label>
            </div>
          )}

          {errorMessage && (
            <div className="text-xs text-danger-ink bg-danger-bg/40 border border-danger-border rounded px-3 py-2">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-line bg-sunken/30 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="text-sm px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-sunken disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onConfirm(saveAsPackage, customName.trim() || undefined)
            }
            disabled={isPending}
            className="text-sm px-4 py-1.5 rounded-md bg-indigo text-white hover:bg-indigo-hover disabled:opacity-40"
          >
            {isPending ? "Creating…" : `Create ${deadlineCount} deadlines`}
          </button>
        </div>
      </div>
    </div>
  );
}
