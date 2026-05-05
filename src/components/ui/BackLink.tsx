import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Back affordance that returns to the PREVIOUS layer in the user's nav
 * stack, not a hard-coded root. The user explicitly asked for this:
 * deep-linked entries shouldn't bounce them to /clients when they came
 * from /alerts or /timeline.
 *
 * Falls back to the provided route only when there's no useful history
 * (fresh tab, magic-link landing) — detected via window.history.length === 1
 * (the SPA's initial entry).
 */
export interface BackLinkProps {
  /** Where to go if the browser has no prior history. */
  fallback: string;
  /** Label rendered after "‹". When omitted, the component derives it
   *  from the fallback route segment. */
  fallbackLabel?: string;
  className?: string;
}

export function BackLink({ fallback, fallbackLabel, className }: BackLinkProps) {
  const navigate = useNavigate();

  const onClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  const label = fallbackLabel ?? deriveLabel(fallback);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1",
        className,
      )}
    >
      <ArrowLeft className="w-3 h-3" aria-hidden /> Back to {label}
    </button>
  );
}

function deriveLabel(path: string): string {
  const seg = path.replace(/^\//, "").split("/")[0] ?? "previous";
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}
