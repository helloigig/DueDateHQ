import { CheckCircle2, Loader2 } from "lucide-react";
import { Modal } from "./Modal";

export function BatchApplyProgress({
  open,
  total,
  done,
  title,
  subtitle,
}: {
  open: boolean;
  total: number;
  done: number;
  title: string;
  subtitle?: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isComplete = done >= total && total > 0;

  return (
    <Modal open={open} onClose={() => {}} closeOnBackdrop={false} size="sm">
      <Modal.Body>
        <div role="status" aria-live="polite" className="flex items-center gap-3">
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-ok-ink shrink-0" aria-hidden />
          ) : (
            <Loader2 className="w-5 h-5 text-ink-700 animate-spin shrink-0" aria-hidden />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ink-900">{title}</div>
            {subtitle && (
              <div className="text-xs text-ink-500 mt-0.5 truncate">
                {subtitle}
              </div>
            )}
          </div>
          <div className="text-sm font-medium text-ink-700 tabular-nums shrink-0">
            {done} / {total}
          </div>
        </div>

        <div className="mt-3 h-1.5 rounded-full bg-sunken overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-150 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-2 text-2xs text-ink-400">
          Each adjustment is logged to the client activity timeline.
        </div>
      </Modal.Body>
    </Modal>
  );
}
