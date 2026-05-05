import { AlertTriangle, RotateCcw } from "lucide-react";

export function ErrorState({
  title = "Something went wrong.",
  message,
  onRetry,
  compact = false,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const detail =
    message ??
    "We couldn't load this view. Check your connection and try again.";
  return (
    <div
      role="alert"
      className={
        compact
          ? "bg-danger-bg border border-danger-border rounded-md px-4 py-3 text-sm text-danger-ink flex items-center gap-2"
          : "max-w-xl mx-auto my-8 bg-surface border border-line rounded-md px-6 py-8 text-center"
      }
    >
      <AlertTriangle
        className={compact ? "w-4 h-4 shrink-0" : "w-5 h-5 mx-auto text-danger-ink"}
        aria-hidden
      />
      <div className={compact ? "flex-1 min-w-0" : "mt-3"}>
        <p
          className={
            compact
              ? "font-medium"
              : "text-sm font-medium text-ink-900"
          }
        >
          {title}
        </p>
        {!compact && (
          <p className="text-xs text-ink-500 mt-1">{detail}</p>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className={
            compact
              ? "text-xs px-2 py-1 rounded border border-danger-border hover:bg-surface flex items-center gap-1"
              : "mt-4 inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-line text-ink-700 hover:bg-sunken"
          }
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden />
          Retry
        </button>
      )}
    </div>
  );
}
