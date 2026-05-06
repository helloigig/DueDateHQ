import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Upload,
  UserPlus,
  Sparkles,
} from "lucide-react";
import { OnboardingShell } from "../../components/OnboardingShell";
import { OAuthWireframeModal } from "../../components/OAuthWireframeModal";
import { updateSession } from "../../data/session";

/**
 * Step 2 — bring your roster in. CSV is the primary affordance; QBO/Xero
 * (Tier 0 integrations) cover the "no CSV at hand" case; manual + demo are
 * the small-book / tire-kicker fallbacks. PRD §6.4 Tier 0.
 */
export function OnboardingChoosePath() {
  const navigate = useNavigate();
  const [oauthProvider, setOauthProvider] = useState<
    "quickbooks" | "xero" | null
  >(null);

  return (
    <OnboardingShell
      step={2}
      totalSteps={3}
      title="Bring your roster in"
      subtitle="Drop a CSV, connect your accounting tool, or start with a few clients."
    >
      {/* Primary — CSV upload. Hero card with gradient bg, icon tile,
          eyebrow + headline composition matching the rest of the
          product's status surface anatomy. */}
      <Link
        to="/onboarding/import"
        className="block bg-gradient-to-br from-indigo-soft/60 via-indigo-soft/30 to-canvas border border-indigo/30 rounded-lg p-card transition-all group hover:shadow-pop hover:border-indigo/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="w-12 h-12 rounded-md bg-indigo text-white flex items-center justify-center shrink-0 shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)]"
          >
            <Upload className="w-5 h-5" aria-hidden />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-2xs font-semibold uppercase tracking-wider text-indigo-ink">
                Recommended
              </p>
            </div>
            <h3 className="text-lg font-semibold text-ink-900 mt-0.5 leading-snug">
              Upload your client roster
            </h3>
            <p className="text-sm text-ink-500 mt-1.5 leading-relaxed">
              Drag a CSV from File In Time, TaxDome, ProConnect, QuickBooks, or any spreadsheet. AI maps the columns and shows you exactly what your workspace will look like — before you commit to anything.
            </p>
            <p className="text-xs text-indigo font-medium mt-3 inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
              Continue
              <ArrowRight
                className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </p>
          </div>
        </div>
      </Link>

      {/* OR divider — soft horizontal rule with a centered "or" label */}
      <div className="mt-card mb-card flex items-center gap-3">
        <span className="flex-1 h-px bg-line" aria-hidden />
        <span className="text-2xs uppercase tracking-wider text-ink-400 font-semibold">
          or
        </span>
        <span className="flex-1 h-px bg-line" aria-hidden />
      </div>

      {/* 3-tile row — QuickBooks, Xero, Add manually */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ConnectTile
          icon={<QboLogo />}
          title="Connect QuickBooks"
          detail="One OAuth click — pulls your client list."
          onClick={() => setOauthProvider("quickbooks")}
        />
        <ConnectTile
          icon={<XeroLogo />}
          title="Connect Xero"
          detail="Same as QuickBooks for international firms."
          onClick={() => setOauthProvider("xero")}
        />
        <ConnectTile
          icon={
            <span className="w-7 h-7 rounded-md bg-sunken border border-line flex items-center justify-center text-ink-700">
              <UserPlus className="w-4 h-4" aria-hidden />
            </span>
          }
          title="Add 5 manually"
          detail="For small books or kicking the tires."
          to="/onboarding/manual"
        />
      </div>

      {/* Demo + Skip — bottom escape hatches. Demo gets a soft pill
          treatment so curious users notice it without it competing
          with the primary upload flow. */}
      <div className="mt-section pt-card border-t border-line flex items-center gap-6 text-xs">
        <Link
          to="/onboarding/demo"
          className="group/demo inline-flex items-center gap-1.5 px-3 h-8 rounded-md bg-sunken hover:bg-line text-ink-700 hover:text-ink-900 font-medium transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo" aria-hidden />
          Try the demo workspace
          <ArrowRight
            className="w-3 h-3 transition-transform group-hover/demo:translate-x-0.5"
            aria-hidden
          />
        </Link>
        <button
          type="button"
          onClick={() => {
            updateSession({ onboardingComplete: true });
            navigate("/", { replace: true });
          }}
          className="text-ink-400 hover:text-ink-700 underline underline-offset-2 ml-auto"
        >
          Skip for now
        </button>
      </div>

      <OAuthWireframeModal
        provider={oauthProvider}
        onClose={() => setOauthProvider(null)}
      />
    </OnboardingShell>
  );
}

/** Unified tile — handles both router link (manual) and OAuth modal trigger (QBO/Xero). */
function ConnectTile({
  icon,
  title,
  detail,
  to,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  to?: string;
  onClick?: () => void;
}) {
  const className =
    "group/tile text-left bg-surface border border-line rounded-md p-4 hover:bg-sunken hover:shadow-pop transition-all flex items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2";
  const inner = (
    <>
      <span className="w-9 h-9 rounded-md flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-900">{title}</p>
        <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">{detail}</p>
      </div>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

function QboLogo() {
  return (
    <svg viewBox="0 0 32 32" className="w-7 h-7" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#2CA01C" />
      <path
        d="M9.5 12.5h7c2.5 0 4.5 2 4.5 4.5s-2 4.5-4.5 4.5h-2v3l-5-12Zm5 7h2c1.4 0 2.5-1.1 2.5-2.5s-1.1-2.5-2.5-2.5h-2v5Z"
        fill="white"
      />
    </svg>
  );
}

function XeroLogo() {
  return (
    <svg viewBox="0 0 32 32" className="w-7 h-7" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#13B5EA" />
      <path
        d="M11 11l5 5-5 5m10-10l-5 5 5 5"
        stroke="white"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
