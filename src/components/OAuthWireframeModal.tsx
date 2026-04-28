import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Lock, ShieldCheck, X } from "lucide-react";
import { actions } from "../data/store";

type Provider = "quickbooks" | "xero";

interface Props {
  provider: Provider | null;
  onClose: () => void;
}

const PROVIDER_NAMES: Record<Provider, string> = {
  quickbooks: "QuickBooks Online",
  xero: "Xero",
};

const SCOPES: Record<Provider, string[]> = {
  quickbooks: [
    "Read your client list and entity types",
    "Read financial profile (income / expense categories)",
    "Write task summaries to memo fields (never touches accounting numbers)",
  ],
  xero: [
    "Read your contact list (clients)",
    "Read entity types and tax registrations",
    "Write task summaries to memo fields (never touches accounting numbers)",
  ],
};

/**
 * Wireframe-grade OAuth flow for Tier 0 connectors. Shows the three states
 * a real OAuth handshake passes through:
 *
 *   1. Consent — the scope list that addresses Yan Jing's "I have 40 tools"
 *      concern. Explicit about what we read vs. write.
 *   2. Connecting — simulated 1.2s handshake.
 *   3. Connected — confirmation + count of imported records.
 *
 * In production this is replaced by the real provider's OAuth URL + callback.
 * Per PRD §6.5: we own task state; QBO owns accounting numbers; we never
 * write to fields the provider system owns.
 */
export function OAuthWireframeModal({ provider, onClose }: Props) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"consent" | "connecting" | "connected">(
    "consent"
  );
  const [imported, setImported] = useState<{
    clients: number;
    facts: number;
  } | null>(null);

  useEffect(() => {
    if (!provider) setPhase("consent");
  }, [provider]);

  if (!provider) return null;
  const name = PROVIDER_NAMES[provider];

  const startConnecting = () => {
    setPhase("connecting");
    // Simulate the OAuth round-trip + initial sync
    setTimeout(() => {
      // Wireframe: load demo seeds so the user sees real data after OAuth.
      actions.resetToSeeds();
      // In production we'd run a sync job and report the actual numbers.
      setImported({
        clients: 47,
        facts: 142, // approx prior-year facts pulled
      });
      setPhase("connected");
    }, 1400);
  };

  const finish = () => {
    onClose();
    navigate("/onboarding/packages");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && phase !== "connecting") onClose();
      }}
    >
      <div className="bg-surface border border-line rounded-lg shadow-overlay w-full max-w-md overflow-hidden">
        <header className="flex items-center px-5 py-3 border-b border-line">
          <span className="w-8 h-8 rounded-md flex items-center justify-center bg-sunken">
            {provider === "quickbooks" ? <QboLogo /> : <XeroLogo />}
          </span>
          <h2 className="ml-3 text-sm font-semibold text-ink-900">
            Connect {name}
          </h2>
          {phase !== "connecting" && (
            <button
              onClick={onClose}
              className="ml-auto text-ink-500 hover:text-ink-900"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </header>

        {phase === "consent" && (
          <div className="px-5 py-4 space-y-3">
            <p className="text-sm text-ink-700">
              DueDateHQ will request access to:
            </p>
            <ul className="space-y-2">
              {SCOPES[provider].map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-ink-700">
                  <Check className="w-3.5 h-3.5 text-ok-solid mt-0.5 shrink-0" aria-hidden />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <div className="bg-sunken/40 border border-line rounded p-3 flex items-start gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-ink-700 mt-0.5 shrink-0" aria-hidden />
              <p className="text-2xs text-ink-700">
                <span className="font-medium text-ink-900">Source-of-truth respected.</span>{" "}
                {name} owns your accounting numbers. DueDateHQ owns task state.
                We don't overwrite numeric fields. PRD §6.5.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={onClose}
                className="text-sm px-3 py-1.5 rounded text-ink-500 hover:bg-sunken"
              >
                Cancel
              </button>
              <button
                onClick={startConnecting}
                className="ml-auto text-sm px-4 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" aria-hidden />
                Authorize {name}
              </button>
            </div>
            <p className="text-2xs text-ink-400 text-center pt-1">
              Wireframe build — no real OAuth handshake. Production redirects to {name}.
            </p>
          </div>
        )}

        {phase === "connecting" && (
          <div className="px-5 py-10 text-center">
            <div className="w-10 h-10 mx-auto rounded-full border-2 border-line border-t-accent animate-spin" />
            <p className="text-sm text-ink-700 mt-4 font-medium">
              Connecting to {name}…
            </p>
            <p className="text-xs text-ink-500 mt-1">
              Pulling client list and entity types.
            </p>
          </div>
        )}

        {phase === "connected" && imported && (
          <div className="px-5 py-5 space-y-3">
            <div className="flex items-center gap-2 text-ok-ink">
              <Check className="w-5 h-5" aria-hidden />
              <p className="text-base font-semibold">Connected.</p>
            </div>
            <div className="bg-ok-bg/40 border border-ok-border rounded p-3 space-y-1">
              <p className="text-xs text-ok-ink">
                <span className="font-semibold tabular-nums">{imported.clients}</span> clients pulled in.
              </p>
              <p className="text-xs text-ok-ink">
                <span className="font-semibold tabular-nums">{imported.facts}</span> prior-year facts
                imported (powers Mode B/C/E).
              </p>
            </div>
            <p className="text-xs text-ink-500">
              Next: confirm AI-suggested service packages.
            </p>
            <button
              onClick={finish}
              className="w-full text-sm px-4 py-2 rounded bg-accent text-canvas hover:bg-accent-hover"
            >
              Continue →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function QboLogo() {
  return (
    <svg viewBox="0 0 32 32" className="w-6 h-6" aria-hidden>
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
    <svg viewBox="0 0 32 32" className="w-6 h-6" aria-hidden>
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
