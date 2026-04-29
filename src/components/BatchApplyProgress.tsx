import { CheckCircle2, Loader2 } from "lucide-react";

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
  if (!open) return null;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isComplete = done >= total && total > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div
        role="status"
        aria-live="polite"
        className="bg-white rounded-lg shadow-2xl border border-slate-200 max-w-sm w-full mx-4 p-5"
      >
        <div className="flex items-center gap-3">
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden />
          ) : (
            <Loader2 className="w-5 h-5 text-slate-700 animate-spin" aria-hidden />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            {subtitle && (
              <div className="text-xs text-slate-500 mt-0.5 truncate">
                {subtitle}
              </div>
            )}
          </div>
          <div className="text-sm font-medium text-slate-700 tabular-nums shrink-0">
            {done} / {total}
          </div>
        </div>

        <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-slate-900 transition-all duration-150 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-2 text-2xs text-slate-400">
          Each adjustment is logged to the client activity timeline.
        </div>
      </div>
    </div>
  );
}
