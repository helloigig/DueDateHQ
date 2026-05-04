import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Upload,
  UserPlus,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { OnboardingShell } from "../../components/OnboardingShell";
import { OAuthWireframeModal } from "../../components/OAuthWireframeModal";
import { updateSession } from "../../data/session";

/**
 * Step 2 — bring your roster in. Restructured to make CSV the primary
 * affordance, with QBO/Xero (Tier 0 integrations) as the killer alternative
 * for CPAs who don't have a clean CSV at hand.
 *
 * Why QBO/Xero on the same screen as CSV: Yan Jing's "no CSV at hand"
 * scenario is the most common one. Forcing them through manual or demo when
 * QBO is one OAuth click away is wrong. PRD §6.4 Tier 0.
 *
 * Always-visible "Skip for now" footer: accountants want to poke around
 * before committing to a roster. The dashboard handles empty state cleanly,
 * and they can come back via the Onboarding-Layer-2 widget any time.
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
      {/* Primary — CSV upload */}
      <Link
        to="/onboarding/import"
        className="block bg-surface border-2 border-line rounded-md p-6 hover:border-accent hover:shadow-pop transition-all group max-w-5xl"
      >
        <div className="flex items-start gap-4">
          <span className="w-12 h-12 rounded-md bg-sunken border border-line flex items-center justify-center text-ink-700 shrink-0">
            <Upload className="w-5 h-5" aria-hidden />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-ink-900">
                Upload a CSV
              </h3>
              <span className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-warn-bg text-warn-ink border border-warn-border">
                Recommended
              </span>
            </div>
            <p className="text-sm text-ink-500 mt-1">
              Drag a roster from your existing tool. AI auto-maps the columns.
            </p>
          </div>
          <ArrowRight
            className="w-4 h-4 text-ink-400 mt-2 group-hover:text-ink-900 transition-colors"
            aria-hidden
          />
        </div>
      </Link>

      {/* 3-tile row — QuickBooks, Xero, Add manually */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 max-w-5xl">
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

      {/* Demo + Skip on the same line */}
      <div className="mt-8 pt-6 border-t border-line max-w-5xl flex items-center gap-6 text-xs">
        <Link
          to="/onboarding/demo"
          className="inline-flex items-center gap-1.5 text-ink-700 hover:text-ink-900"
        >
          <Sparkles className="w-3.5 h-3.5" aria-hidden />
          Try the demo workspace
        </Link>
        <button
          type="button"
          onClick={() => {
            updateSession({ onboardingComplete: true });
            navigate("/", { replace: true });
          }}
          className="text-ink-500 hover:text-ink-900 underline"
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
    "text-left bg-surface border border-line rounded-md p-4 hover:border-accent hover:shadow-pop transition-all flex items-start gap-3";
  const inner = (
    <>
      <span className="w-9 h-9 rounded-md flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-900">{title}</p>
        <p className="text-xs text-ink-500 mt-0.5">{detail}</p>
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
