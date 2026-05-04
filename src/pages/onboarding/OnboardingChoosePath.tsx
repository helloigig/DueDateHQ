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
      estimate="~60 seconds"
      title="Bring your roster in"
      subtitle="The fastest way is a CSV. No CSV? Connect QuickBooks or Xero instead — same outcome."
      brandLine="Customer-visible language: 'upload' for files, 'connect' for OAuth. Never 'import.'"
    >
      <div className="space-y-7">
        {/* Primary affordance — CSV upload, big and obvious */}
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
                  Upload a CSV
                </h3>
                <span className="text-2xs uppercase tracking-wide px-2 py-0.5 rounded-pill bg-indigo text-white font-semibold">
                  Recommended
                </span>
              </div>
              <p className="text-sm text-ink-500 mt-1 leading-relaxed">
                Drag a roster from File In Time, TaxDome, Drake, ProConnect,
                QuickBooks export, or plain Excel. AI auto-maps the columns. ~2 minutes.
              </p>
            </div>
            <ArrowRight
              className="w-4 h-4 text-ink-400 mt-2 group-hover:text-indigo transition-colors shrink-0"
              aria-hidden
            />
          </div>
        </Link>

        {/* Secondary: connect existing software */}
        <div>
          <p className="text-2xs uppercase tracking-[0.18em] text-ink-500 font-semibold mb-3">
            No CSV at hand?
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ConnectChoice
              provider="quickbooks"
              title="Connect QuickBooks"
              detail="Pulls your client list with entity types in one OAuth click. Tier 0 two-way sync."
              onClick={() => setOauthProvider("quickbooks")}
            />
            <ConnectChoice
              provider="xero"
              title="Connect Xero"
              detail="Same as QuickBooks for international firms. Tier 0 two-way sync."
              onClick={() => setOauthProvider("xero")}
            />
          </div>
          <p className="text-2xs text-ink-400 mt-2 leading-relaxed">
            Both unlock financial profiles and Mode B/C/E anchors immediately.
            Phase 2 OAuth in this build.
          </p>
        </div>

        {/* Tertiary: small books or kicking the tires */}
        <div>
          <p className="text-2xs uppercase tracking-[0.18em] text-ink-500 font-semibold mb-3">
            Or — start small
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SecondaryChoice
              to="/onboarding/manual"
              icon={<UserPlus className="w-4 h-4" aria-hidden />}
              title="Add 5 manually"
              detail="For small books or skeptics. ~60s per client."
            />
            <SecondaryChoice
              to="/onboarding/demo"
              icon={<Sparkles className="w-4 h-4" aria-hidden />}
              title="Try the demo workspace"
              detail="49 fake clients + a live state alert. Wipeable anytime."
            />
          </div>
        </div>

        {/* Skip-for-now footer */}
        <div className="pt-6 border-t border-line">
          <button
            type="button"
            onClick={() => {
              updateSession({ onboardingComplete: true });
              navigate("/", { replace: true });
            }}
            className="text-xs text-ink-500 hover:text-indigo underline"
          >
            Skip for now — I'll add clients later
          </button>
          <p className="text-2xs text-ink-400 mt-1.5 leading-relaxed">
            Your dashboard works empty. You can connect a source from Settings
            → Integrations whenever you're ready.
          </p>
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

function SecondaryChoice({
  to,
  icon,
  title,
  detail,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      to={to}
      className="bg-canvas border border-line rounded-md p-4 hover:border-indigo/40 hover:bg-surface transition-colors flex items-start gap-3"
    >
      <span className="w-9 h-9 rounded-md bg-indigo-soft/60 flex items-center justify-center text-indigo shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-900">{title}</p>
        <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">{detail}</p>
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
