import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { useStore } from "../data/store";
import { useAllOpenInsights } from "../hooks/useAiInsights";
import { useState } from "react";

const KEY = "duedatehq.advisory_peek_dismissed.v1";

/**
 * Pattern 4 — the advisory awakening (PRD §2.7). A lightweight peek above
 * the task list surfacing Mode E opportunities at firm-level. The CPA's
 * eye lands on it briefly, then drops to today's tasks. One sentence per
 * lead opportunity — not a wall of cards.
 *
 * Dismissible. Doesn't dominate the dashboard.
 */
export function AdvisoryPeek() {
  const navigate = useNavigate();
  const { clients } = useStore();
  const insights = useAllOpenInsights();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(KEY) === "1";
  });

  if (dismissed || insights.length === 0) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const lead = insights[0];
  const client = clients.find((c) => c.id === lead.clientId);
  if (!client) return null;
  const others = insights.length - 1;

  return (
    <aside
      className="bg-info-bg/40 border border-info-border rounded-md px-4 py-2.5 flex items-center gap-3"
      aria-label="Advisory opportunities"
    >
      <Sparkles className="w-3.5 h-3.5 text-info-ink shrink-0" aria-hidden />
      <div className="flex-1 min-w-0 text-xs">
        <span className="text-ink-500 uppercase tracking-wider text-2xs font-semibold mr-2">
          Advisory
        </span>
        <button
          onClick={() => navigate(`/clients/${client.id}`)}
          className="text-ink-900 font-medium hover:underline"
        >
          {client.name}
        </button>
        <span className="text-ink-700"> · {lead.title}</span>
        {others > 0 && (
          <span className="text-ink-500 ml-1">
            · + {others} more open
          </span>
        )}
      </div>
      <button
        onClick={() => navigate(`/clients/${client.id}`)}
        className="text-2xs text-info-ink hover:underline shrink-0 inline-flex items-center gap-0.5"
      >
        Review <ArrowRight className="w-3 h-3" aria-hidden />
      </button>
      <button
        onClick={dismiss}
        className="text-ink-400 hover:text-ink-700 shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" aria-hidden />
      </button>
    </aside>
  );
}
