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
      subtitle="The fastest way is a CSV. No CSV? Connect QuickBooks or Xero instead — same outcome."
    >
      <div className="space-y-6">
        {/* Primary affordance — upload CSV, big and obvious */}
        <Link
          to="/onboarding/import"
          className="block bg-canvas border border-indigo/30 rounded-md p-5 hover:bg-indigo-soft/40 hover:border-indigo transition-colors group"
        >
          <div className="flex items-start gap-4">
            <span className="w-11 h-11 rounded-md bg-indigo-soft text-indigo flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5" aria-hidden />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-ink-900">
                  Upload your client roster
                </h3>
                <span className="text-2xs uppercase tracking-wide px-2 py-0.5 rounded-pill bg-indigo text-white font-semibold">
                  Recommended
                </span>
              </div>
              <p className="text-sm text-ink-500 mt-1 leading-relaxed">
                Drag a CSV from File In Time, TaxDome, Drake, ProConnect, or
                Excel. AI auto-maps the columns. ~2 minutes.
              </p>
            </div>
            <ArrowRight
              className="w-4 h-4 text-ink-400 mt-2 group-hover:text-indigo transition-colors shrink-0"
              aria-hidden
            />
          </div>
        </Link>

        {/* Three peers on one row — Connect QuickBooks, Connect Xero,
            Add 5 manually. All three are valid alternatives to CSV; surfacing
            them at equal weight matches how the user actually thinks. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ConnectChoice
            provider="quickbooks"
            title="Connect QuickBooks"
            detail="Pulls clients + entity types in one click."
            onClick={() => setOauthProvider("quickbooks")}
          />
          <ConnectChoice
            provider="xero"
            title="Connect Xero"
            detail="Same one-click sync for Xero firms."
            onClick={() => setOauthProvider("xero")}
          />
          <ManualChoice />
        </div>

        {/* Demo + skip on a single subdued line — both are escape hatches,
            neither deserves a card. Demo seeds 49 fake clients; skip lands
            you on an empty dashboard with the same options surfaced later. */}
        <div className="flex items-center gap-3 text-xs text-ink-500">
          <Link
            to="/onboarding/demo"
            className="inline-flex items-center gap-1.5 hover:text-indigo underline"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            Try the demo workspace
          </Link>
          <span className="text-ink-300" aria-hidden>·</span>
          <button
            type="button"
            onClick={() => {
              updateSession({ onboardingComplete: true });
              navigate("/", { replace: true });
            }}
            className="hover:text-indigo underline"
          >
            Skip for now
          </button>
        </div>
      </div>

      <OAuthWireframeModal
        provider={oauthProvider}
        onClose={() => setOauthProvider(null)}
      />
    </OnboardingShell>
  );
}

function ConnectChoice({
  provider,
  title,
  detail,
  onClick,
}: {
  provider: "quickbooks" | "xero";
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-canvas border border-line rounded-md p-4 hover:border-indigo/40 hover:bg-surface transition-colors flex items-start gap-3"
    >
      <span className="w-9 h-9 rounded-md flex items-center justify-center shrink-0">
        {provider === "quickbooks" ? <QboLogo /> : <XeroLogo />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-900">{title}</p>
        <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">{detail}</p>
      </div>
    </button>
  );
}

function ManualChoice() {
  return (
    <Link
      to="/onboarding/manual"
      className="bg-canvas border border-line rounded-md p-4 hover:border-indigo/40 hover:bg-surface transition-colors flex items-start gap-3"
    >
      <span className="w-9 h-9 rounded-md bg-indigo-soft/60 flex items-center justify-center text-indigo shrink-0">
        <UserPlus className="w-4 h-4" aria-hidden />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-900">Add 5 manually</p>
        <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">
          For small books or skeptics.
        </p>
      </div>
    </Link>
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
