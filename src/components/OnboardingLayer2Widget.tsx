import { useState } from "react";
import { Link } from "react-router-dom";
import { Plug, X, Sparkles } from "lucide-react";
import { useSession } from "../data/session";

const SUGGESTIONS = [
  {
    title: "Connect QuickBooks",
    detail:
      "Unlocks financial profiles for your clients · Mode B/C/E anchors begin forming.",
    cta: "Settings → Integrations",
    href: "/settings/integrations",
  },
  {
    title: "Upload a prior-year return",
    detail:
      "One PDF activates Mode E cross-year insights and Mode B per-client timing.",
    cta: "Settings → Imports",
    href: "/settings/imports",
  },
  {
    title: "Connect Gmail or Outlook",
    detail:
      "Unlocks Method B inbound + Mode D voice mirroring across all your clients.",
    cta: "Settings → Integrations",
    href: "/settings/integrations",
  },
];

/**
 * Persistent dashboard widget per IA §3.9 / PRD §8.4. Rotates the next-best
 * Onboarding Layer 2 suggestion. Each is framed as a specific capability
 * unlock — never as "more import" or "AI is learning."
 */
export function OnboardingLayer2Widget() {
  const session = useSession();
  const [dismissed, setDismissed] = useState(false);
  const [idx, setIdx] = useState(0);

  // Hide if user hasn't even completed Layer 1, or has explicitly dismissed.
  if (!session?.onboardingComplete) return null;
  if (dismissed) return null;

  const s = SUGGESTIONS[idx % SUGGESTIONS.length];

  return (
    <aside className="bg-info-bg border border-info-border rounded-md px-4 py-3 flex items-start gap-3">
      <Sparkles className="w-4 h-4 text-info-ink mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-info-ink">{s.title}</p>
        <p className="text-xs text-info-ink/80 mt-0.5">{s.detail}</p>
        <div className="mt-2 flex items-center gap-2">
          <Link
            to={s.href}
            className="text-xs px-3 py-1 rounded bg-info-solid text-canvas hover:bg-info-ink inline-flex items-center gap-1"
          >
            <Plug className="w-3 h-3" aria-hidden />
            {s.cta}
          </Link>
          <button
            onClick={() => setIdx((v) => v + 1)}
            className="text-xs text-info-ink hover:underline"
          >
            Show another suggestion
          </button>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-info-ink/70 hover:text-info-ink"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" aria-hidden />
      </button>
    </aside>
  );
}
