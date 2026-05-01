import { useNavigate } from "react-router-dom";
import { TrendingUp, ArrowRight, X, Sparkles } from "lucide-react";
import { useAllOpenInsights, useResolveInsight } from "../hooks/useAiInsights";
import { useStore } from "../data/store";
import { useState } from "react";

/**
 * Pattern 4 — the advisory awakening (PRD §2.7). Proactive Mode E insight
 * cards on the dashboard. The product *invites* the senior partner to see
 * the AI surface as the lever for Layer B revenue: "advisory" not "data".
 *
 * Visually subtle — not a wall of suggestions (PRD §12.6 anti-metric).
 * One card prominent, plus a count of others.
 */
export function InsightStrip() {
  const insights = useAllOpenInsights();
  const { clients } = useStore();
  const navigate = useNavigate();
  const resolve = useResolveInsight();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = insights.filter((i) => !dismissed.has(i.id));
  if (visible.length === 0) return null;

  const lead = visible[0];
  const leadClient = clients.find((c) => c.id === lead.clientId);
  if (!leadClient) return null;

  const others = visible.slice(1, 4);

  return (
    <section
      aria-label="AI proactive insights"
      className="bg-gradient-to-br from-surface to-sunken/40 border border-line rounded-md overflow-hidden"
    >
      <header className="flex items-center px-4 py-2 border-b border-line bg-sunken/40">
        <TrendingUp className="w-3.5 h-3.5 text-ink-500 mr-1.5" aria-hidden />
        <span className="text-xs uppercase tracking-wider text-ink-700 font-semibold">
          Advisory opportunities
        </span>
        <span
          className="ml-2 inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded-full border border-info-border bg-info-bg text-info-ink"
          title="Mode E (cross-year insights) — AI surfaced these from your client history."
        >
          <Sparkles className="w-3 h-3" aria-hidden />
          AI surfaced
        </span>
        <span className="ml-2 text-2xs text-ink-500">{visible.length} open</span>
      </header>

      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <button
                onClick={() => navigate(`/clients/${leadClient.id}`)}
                className="text-sm font-medium text-ink-900 hover:underline"
              >
                {leadClient.name}
              </button>
            </div>
            <p className="text-sm text-ink-900 font-medium">{lead.title}</p>
            <p className="text-xs text-ink-500 mt-0.5">{lead.detail}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <button
                onClick={() => navigate(`/clients/${leadClient.id}`)}
                className="text-xs px-2.5 py-1 rounded bg-accent text-canvas hover:bg-accent-hover inline-flex items-center gap-1"
              >
                Open client <ArrowRight className="w-3 h-3" aria-hidden />
              </button>
              <button
                onClick={() => resolve(lead.id, "mark_known")}
                className="text-xs px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken"
              >
                Mark known
              </button>
              <button
                onClick={() => resolve(lead.id, "snooze")}
                className="text-xs px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken"
              >
                Snooze 30 days
              </button>
            </div>
            <p className="text-2xs text-ink-400 mt-2 italic">
              This is the kind of opportunity advisory work is built on.
            </p>
          </div>
          <button
            onClick={() => setDismissed((prev) => new Set(prev).add(lead.id))}
            className="text-ink-400 hover:text-ink-700"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        {others.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line">
            <p className="text-2xs uppercase tracking-wider text-ink-400 mb-1.5">
              Also open
            </p>
            <ul className="space-y-1">
              {others.map((o) => {
                const c = clients.find((c) => c.id === o.clientId);
                return (
                  <li
                    key={o.id}
                    className="flex items-center gap-2 text-xs text-ink-700"
                  >
                    <span className="w-1 h-1 rounded-full bg-ink-300 shrink-0" />
                    <button
                      onClick={() => c && navigate(`/clients/${c.id}`)}
                      className="hover:text-ink-900 truncate flex-1 text-left"
                    >
                      <span className="font-medium">{c?.name}</span>
                      <span className="text-ink-400"> · </span>
                      {o.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
