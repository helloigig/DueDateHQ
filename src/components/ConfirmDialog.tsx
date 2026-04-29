import { Modal, useModalLabelId } from "./Modal";

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
  const labelId = useModalLabelId();

  return (
    <Modal open={open} onClose={onCancel} ariaLabelledBy={labelId} size="md">
      <Modal.Header id={labelId} title={title} />

      <Modal.Body className="text-sm text-ink-700 space-y-3">
        <div>{body}</div>
        {requireAcknowledge && (
          <label className="flex items-start gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              data-ack
              className="mt-0.5"
              onChange={(e) => {
                const btn = (
                  e.currentTarget.closest('[role="dialog"]') as HTMLElement | null
                )?.querySelector<HTMLButtonElement>("[data-confirm]");
                if (btn) btn.disabled = !e.currentTarget.checked;
              }}
            />
            <span>{requireAcknowledge}</span>
          </label>
        )}
      </Modal.Body>

      <Modal.Footer tone="sunken">
        <button
          onClick={onCancel}
          className="text-sm px-3 py-1.5 rounded border border-line bg-surface hover:bg-sunken text-ink-700"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          data-autofocus={requireAcknowledge ? undefined : true}
          data-confirm
          disabled={!!requireAcknowledge}
          className={`text-sm px-3 py-1.5 rounded font-medium text-canvas disabled:opacity-40 disabled:cursor-not-allowed ${
            destructive
              ? "bg-danger-solid hover:opacity-90"
              : "bg-accent hover:bg-accent-hover"
          }`}
        >
          {confirmLabel}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
