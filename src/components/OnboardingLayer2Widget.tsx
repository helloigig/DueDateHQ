import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plug, X, Sparkles, Settings as SettingsIcon } from "lucide-react";
import { useSession } from "../data/session";
import { useStore } from "../data/store";

/**
 * Layer 2 suggestions — what to connect after the firm's roster is in.
 * Each is a specific capability unlock, framed honestly (never "AI is
 * learning" — forever-no list).
 */
const LAYER_2_SUGGESTIONS = [
  {
    title: "Connect QuickBooks",
    detail:
      "Unlocks financial profiles for your clients — richer per-client signals begin forming.",
    cta: "Settings → Integrations",
    href: "/settings/integrations",
  },
  {
    title: "Upload a prior-year return",
    detail:
      "One PDF activates cross-year insights and per-client timing. The biggest single capability unlock.",
    cta: "Settings → Imports",
    href: "/settings/imports",
  },
  {
    title: "Connect Gmail or Outlook",
    detail:
      "Inbound replies route automatically and your draft emails sound like you, not like a template.",
    cta: "Settings → Integrations",
    href: "/settings/integrations",
  },
];

/**
 * Layer 3 suggestions — surfaced once L2 is "enough." These are
 * advanced-fit affordances: things a fully-set-up firm benefits from
 * but doesn't need cold-start. They live behind a quieter framing
 * because the partner has already invested.
 */
const LAYER_3_SUGGESTIONS = [
  {
    title: "Customize reminder cadences",
    detail:
      "Override the default 3-day / 7-day / 14-day chase rhythm per template. Useful once you've watched a season cycle.",
    cta: "Settings → Reminders",
    href: "/settings/reminders",
  },
  {
    title: "Invite teammates",
    detail:
      "Per-staff filters, assignee dashboards, audit-trail attribution. Needed once your firm is past one preparer.",
    cta: "Settings → Team",
    href: "/settings/team",
  },
  {
    title: "Set up scheduled exports",
    detail:
      "Auto-generate the audit-trail PDF + deadline iCal each week, delivered to your firm's archive.",
    cta: "Settings → Exports",
    href: "/settings/exports",
  },
];

/**
 * Persistent dashboard widget per IA §3.9 / PRD §8.4.
 *
 * Two-mode: rotates Layer 2 suggestions while integrations are missing,
 * shifts to Layer 3 (advanced-fit) suggestions once at least one
 * integration is connected. The mode shift makes the widget useful at
 * every stage without nagging users who've already done the obvious work.
 *
 * Internal "Layer 1/2/3" vocabulary stays in the spec — user-facing
 * copy avoids it.
 */
export function OnboardingLayer2Widget() {
  const session = useSession();
  // The store doesn't expose connected integrations directly in mock mode
  // — use a heuristic: if any imports exist, we treat L2 as started, and
  // L3 suggestions become the rotation. Real-mode reads
  // integrations.list and counts status='connected'.
  const { imports } = useStore();
  const inLayer3 = imports.length > 0;
  const suggestions = useMemo(
    () => (inLayer3 ? LAYER_3_SUGGESTIONS : LAYER_2_SUGGESTIONS),
    [inLayer3],
  );
  const [dismissed, setDismissed] = useState(false);
  const [idx, setIdx] = useState(0);

  if (!session?.onboardingComplete) return null;
  if (dismissed) return null;

  const s = suggestions[idx % suggestions.length];

  return (
    <aside
      className={[
        "rounded-md px-4 py-3 flex items-start gap-3 border",
        // L3 surface is calmer (sunken bg, neutral icon) — the partner
        // has already invested, the widget should not feel like a sales
        // pitch.
        inLayer3
          ? "bg-sunken/60 border-line"
          : "bg-info-bg border-info-border",
      ].join(" ")}
    >
      {inLayer3 ? (
        <SettingsIcon className="w-4 h-4 text-ink-700 mt-0.5" aria-hidden />
      ) : (
        <Sparkles className="w-4 h-4 text-info-ink mt-0.5" aria-hidden />
      )}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${inLayer3 ? "text-ink-900" : "text-info-ink"}`}
        >
          {s?.title ?? ""}
        </p>
        <p
          className={`text-xs mt-0.5 ${inLayer3 ? "text-ink-700" : "text-info-ink/80"}`}
        >
          {s?.detail ?? ""}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Link
            to={s?.href ?? "/settings"}
            className={[
              "text-xs px-3 py-1 rounded inline-flex items-center gap-1",
              inLayer3
                ? "border border-line text-ink-700 hover:bg-surface"
                : "bg-info-solid text-canvas hover:bg-info-ink",
            ].join(" ")}
          >
            <Plug className="w-3 h-3" aria-hidden />
            {s?.cta ?? "Settings"}
          </Link>
          <button
            onClick={() => setIdx((v) => v + 1)}
            className={`text-xs hover:underline ${inLayer3 ? "text-ink-500" : "text-info-ink"}`}
          >
            Show another
          </button>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className={
          inLayer3
            ? "text-ink-400 hover:text-ink-900"
            : "text-info-ink/70 hover:text-info-ink"
        }
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" aria-hidden />
      </button>
    </aside>
  );
}
