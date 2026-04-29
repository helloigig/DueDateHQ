import { useState } from "react";
import { Modal, useModalLabelId } from "./Modal";

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
  const labelId = useModalLabelId();

  const reason = pick === "Other" ? custom.trim() : pick;
  const canSubmit = pick !== "Other" || custom.trim().length > 0;

  return (
    <Modal open={open} onClose={onCancel} ariaLabelledBy={labelId} size="md">
      <Modal.Header
        id={labelId}
        title="Dismiss this alert?"
        description="You won't see this in banners or the bell again. The alert stays in your history. The reason you select helps tune AI matching."
      />

      <Modal.Body className="space-y-2">
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
              className="mt-0.5 accent-accent"
            />
            <span className="text-ink-700">{r}</span>
          </label>
        ))}
        <label className="flex items-start gap-2 cursor-pointer text-sm">
          <input
            type="radio"
            name="dismiss-reason"
            value="Other"
            checked={pick === "Other"}
            onChange={() => setPick("Other")}
            className="mt-0.5 accent-accent"
          />
          <span className="text-ink-700">Other</span>
        </label>
        {pick === "Other" && (
          <textarea
            data-autofocus
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            rows={2}
            placeholder="What's the reason?"
            className="w-full text-sm px-2.5 py-1.5 rounded border border-line focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        )}
      </Modal.Body>

      <Modal.Footer tone="sunken">
        <button
          onClick={onCancel}
          className="text-sm px-3 py-1.5 rounded border border-line bg-surface hover:bg-sunken text-ink-700"
        >
          Cancel
        </button>
        <button
          disabled={!canSubmit}
          onClick={() => onConfirm(reason)}
          className="text-sm px-3 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Dismiss
        </button>
      </Modal.Footer>
    </Modal>
  );
}
