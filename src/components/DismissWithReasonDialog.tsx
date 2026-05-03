import { useState } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

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

  const reason = pick === "Other" ? custom.trim() : pick;
  const canSubmit = pick !== "Other" || custom.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Dismiss this alert?</DialogTitle>
          <DialogDescription>
            You won't see this in banners or the bell again. The alert stays in
            your history. The reason you select helps tune AI matching.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-2">
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
              className="w-full text-sm px-2.5 py-1.5 rounded border border-line focus:outline-none focus:ring-2 focus:ring-indigo resize-none"
            />
          )}
        </DialogBody>

        <DialogFooter tone="sunken">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => onConfirm(reason)}
          >
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
