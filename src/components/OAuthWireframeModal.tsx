import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Lock, ShieldCheck } from "lucide-react";
import { actions } from "../data/store";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

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
    <Dialog
      open={provider !== null}
      onOpenChange={(o) => {
        if (!o && phase !== "connecting") onClose();
      }}
    >
      <DialogContent
        size="md"
        showClose={phase !== "connecting"}
        className="overflow-hidden p-0"
        onPointerDownOutside={(e) => {
          if (phase === "connecting") e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (phase === "connecting") e.preventDefault();
        }}
      >
        <header className="flex items-center px-5 py-3 border-b border-line">
          <span className="w-8 h-8 rounded-md flex items-center justify-center bg-sunken">
            {provider === "quickbooks" ? <QboLogo /> : <XeroLogo />}
          </span>
          <DialogTitle className="ml-3 text-sm font-semibold text-ink-900">
            Connect {name}
          </DialogTitle>
        </header>
        <DialogDescription className="sr-only">
          Authorize {name} to grant DueDateHQ scoped access to your client and
          entity data.
        </DialogDescription>

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
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={startConnecting} className="ml-auto">
                <Lock className="w-3.5 h-3.5" aria-hidden />
                Authorize {name}
              </Button>
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
                imported.
              </p>
            </div>
            <p className="text-xs text-ink-500">
              Next: review which tax forms each client files. We'll suggest a
              package per entity type (LLC → 1065, S-Corp → 1120-S, etc.); you
              can adjust before deadlines auto-generate.
            </p>
            <Button onClick={finish} className="w-full">
              Continue → review packages
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
