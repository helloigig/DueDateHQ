import { useModalDialog } from "../hooks/useModalDialog";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  requireAcknowledge,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** If provided, the confirm button is disabled until the user ticks an acknowledgement. */
  requireAcknowledge?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useModalDialog(open, onCancel);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-md w-full mx-4 outline-none"
      >
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 id="confirm-title" className="text-base font-semibold text-slate-900">
            {title}
          </h2>
        </div>
        <div className="px-5 py-4 text-sm text-slate-600 space-y-3">
          <div>{body}</div>
          {requireAcknowledge && (
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                data-ack
                className="mt-0.5"
                onChange={(e) => {
                  const btn =
                    (e.currentTarget.closest('[role="dialog"]') as HTMLElement | null)
                      ?.querySelector<HTMLButtonElement>("[data-confirm]");
                  if (btn) btn.disabled = !e.currentTarget.checked;
                }}
              />
              <span>{requireAcknowledge}</span>
            </label>
          )}
        </div>
        <div className="px-5 py-3 bg-slate-50 rounded-b-lg flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-sm px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            data-autofocus={requireAcknowledge ? undefined : true}
            data-confirm
            disabled={!!requireAcknowledge}
            className={`text-sm px-3 py-1.5 rounded font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed ${
              destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-slate-900 hover:bg-slate-800"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
