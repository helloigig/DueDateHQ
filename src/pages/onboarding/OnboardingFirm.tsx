import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingShell } from "../../components/OnboardingShell";
import { updateSession, useSession } from "../../data/session";
import { env } from "../../config";
import { trpc } from "../../lib/api/client";

const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

/**
 * Step 1 — confirm the firm. Stripped to genuine essentials per Q1, Q2, Q5:
 *
 *   - Firm name: confirm what we inferred from email (the only edit they'd
 *     reasonably need).
 *   - Where the firm is based: ONE state, singular. Other states they serve
 *     get derived from the roster after import. PRD §6.6.
 *
 * Removed:
 *   - "Your name" — inferred from email; user can edit in Settings later.
 *   - "Firm size / plan tier" — defaults to Pro for trial. Pricing decision
 *     lives in Settings → Billing where it actually matters financially.
 *   - "States you serve" (plural) — derived from CSV after import.
 *
 * The framing of this whole step is "confirm what we know," not "fill out
 * a profile." Two fields, ten seconds.
 */
export function OnboardingFirm() {
  const navigate = useNavigate();
  const session = useSession();
  const [firmName, setFirmName] = useState(session?.firmName === "_pending" ? "" : session?.firmName ?? "");
  const [homeState, setHomeState] = useState<string>(
    session?.primaryStates?.[0] ?? "CA"
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Real mode: provision the firm + public.users row in the backend.
  // Idempotent — re-runs on a user who's already provisioned just return
  // the existing firmId.
  const bootstrap = trpc.auth.bootstrap.useMutation({
    onError: (err) => setSubmitError(err.message),
  });

  const goNext = () => {
    updateSession({
      firmName,
      primaryStates: [homeState],
      tier: session?.tier ?? "pro",
    });
    navigate("/onboarding/choose-path");
  };

  const next = async () => {
    setSubmitError(null);
    if (!env.useMockApi) {
      try {
        await bootstrap.mutateAsync({
          firmName: firmName.trim(),
          primaryStates: [homeState],
          displayName: session?.userName,
        });
      } catch {
        // onError set submitError — bail without navigating.
        return;
      }
    }
    goNext();
  };

  return (
    <OnboardingShell
      step={1}
      totalSteps={3}
      estimate="~10 seconds"
      title="Confirm your firm"
      subtitle="We inferred this from your email. Two fields — change anything that's wrong."
      brandLine="Account = workspace at MVP. The firm record is the tenant; you're its owner. Multi-firm membership is Phase 2."
    >
      <div className="space-y-5 max-w-md">
        <Field label="Firm name" hint="Goes on client emails, audit-trail exports, and forwarding-address prefixes.">
          <input
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            placeholder="Mitchell CPA"
            className="w-full border border-line rounded px-3 py-2 text-sm"
            autoFocus
          />
        </Field>

        <Field
          label="Where is your firm based?"
          hint="Drives state-alert priority. Other states you serve get added automatically from your roster after upload."
        >
          <select
            value={homeState}
            onChange={(e) => setHomeState(e.target.value)}
            className="w-full border border-line rounded px-3 py-2 text-sm bg-surface"
          >
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        {submitError && (
          <div className="text-xs text-danger-ink bg-danger-bg border border-danger-border rounded px-3 py-2">
            {submitError}
          </div>
        )}

        <button
          onClick={() => void next()}
          disabled={!firmName.trim() || bootstrap.isPending}
          className="text-sm px-5 py-2 rounded bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {bootstrap.isPending ? "Creating workspace…" : "Continue"}
        </button>

        <p className="text-2xs text-ink-400 mt-2">
          Trial defaults to Pro. Pick the plan that fits in Settings → Billing
          before day 30 — no decision now.
        </p>
      </div>
    </OnboardingShell>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-ink-500 font-semibold block mb-1.5">
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-2xs text-ink-400 mt-1.5 block">{hint}</span>
      )}
    </label>
  );
}
