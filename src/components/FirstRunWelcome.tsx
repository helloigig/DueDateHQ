import { useState } from "react";
import { X, Sparkles } from "lucide-react";

const KEY = "duedatehq.first_run_dismissed.v1";

/**
 * One-time welcome card surfaced on the dashboard the first time a user
 * lands after onboarding. Dismissible. Distills the AI-authority gradient
 * into one paragraph and points at the queue + ⌘K so the user knows the
 * shortcuts before they need them.
 *
 * This replaces "explain on the Done screen" — the user lands directly on
 * the working product instead of reading a marketing page.
 */
export function FirstRunWelcome() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(KEY) === "1";
  });

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <aside className="bg-info-bg/60 border border-info-border rounded-md px-4 py-2.5 flex items-center gap-3 text-xs">
      <Sparkles className="w-3.5 h-3.5 text-info-ink shrink-0" aria-hidden />
      <div className="flex-1 min-w-0 flex items-center flex-wrap gap-x-2 gap-y-1">
        <span className="text-ink-900 font-medium">Welcome.</span>
        <span className="text-ink-700">
          AI authority is colour-coded:
        </span>
        <Pill badge="GREEN" tone="green" text="AI acts" />
        <Pill badge="YELLOW" tone="yellow" text="AI proposes, you approve" />
        <Pill badge="RED" tone="red" text="AI never opines" />
        <span className="text-ink-500">
          ·{" "}
          <kbd className="font-mono border border-line rounded px-1 bg-surface">
            ⌘K
          </kbd>{" "}
          to search,{" "}
          <kbd className="font-mono border border-line rounded px-1 bg-surface">
            j
          </kbd>
          /
          <kbd className="font-mono border border-line rounded px-1 bg-surface">
            k
          </kbd>{" "}
          to navigate.
        </span>
      </div>
      <button
        onClick={dismiss}
        className="text-ink-400 hover:text-ink-700 shrink-0"
        aria-label="Dismiss welcome"
      >
        <X className="w-3.5 h-3.5" aria-hidden />
      </button>
    </aside>
  );
}

function Pill({
  badge,
  tone,
  text,
}: {
  badge: string;
  tone: "green" | "yellow" | "red";
  text: string;
}) {
  const styles =
    tone === "green"
      ? "bg-ok-bg text-ok-ink border-ok-border"
      : tone === "yellow"
      ? "bg-warn-bg text-warn-ink border-warn-border"
      : "bg-danger-bg text-danger-ink border-danger-border";
  return (
    <span className="inline-flex items-baseline gap-1">
      <span
        className={`text-2xs uppercase tracking-wide px-1 rounded border ${styles}`}
      >
        {badge}
      </span>
      <span className="text-ink-500">{text}</span>
    </span>
  );
}

