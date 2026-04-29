import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
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
] as const;

/**
 * Step 1 — set up the firm workspace. The framing here is explicit: the
 * Supabase user already exists from signup; this step *creates the firm
 * tenant* you're going to work in.
 *
 * Two fields:
 *   - Firm name: goes on outbound emails, audit exports, forwarding prefix.
 *     Mandatory.
 *   - Where you file: multi-state. Most CPAs file in 1-15 states, not just
 *     "based in." The first selected state is the home state (used for the
 *     return address on emails); the rest are filing jurisdictions that
 *     drive state-alert priority. PRD §6.6, post-Yan-Jing review.
 *
 * Deliberately removed:
 *   - "Your name" — inferred from email; editable in Settings.
 *   - Plan tier — defaults to Pro for trial; chosen in Settings → Billing.
 *   - Single-state dropdown — multi-state is the day-1 reality for any
 *     firm with >5 clients.
 */
export function OnboardingFirm() {
  const navigate = useNavigate();
  const session = useSession();
  const [firmName, setFirmName] = useState(
    session?.firmName === "_pending" ? "" : session?.firmName ?? ""
  );
  // Multi-state: pre-fill with whatever's in session (from a prior visit)
  // or default to ["CA"] as a sane starting point. The first item is treated
  // as the "home state" for return-address purposes.
  const [filingStates, setFilingStates] = useState<string[]>(
    session?.primaryStates && session.primaryStates.length > 0
      ? session.primaryStates
      : ["CA"]
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Real mode: provision the firm + public.users row in the backend.
  // Idempotent — re-runs on a user who's already provisioned just return
  // the existing firmId.
  const bootstrap = trpc.auth.bootstrap.useMutation({
    onError: (err) => setSubmitError(err.message),
  });

  const homeState = filingStates[0];

  const toggleState = (s: string) => {
    setFilingStates((prev) => {
      if (prev.includes(s)) {
        // Don't allow removing the last state — there must always be a home.
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== s);
      }
      return [...prev, s];
    });
  };

  const setAsHome = (s: string) => {
    setFilingStates((prev) => [s, ...prev.filter((x) => x !== s)]);
  };

  const goNext = () => {
    updateSession({
      firmName,
      primaryStates: filingStates,
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
          primaryStates: filingStates,
          displayName: session?.userName,
        });
      } catch {
        return;
      }
    }
    goNext();
  };

  return (
    <OnboardingShell
      step={1}
      totalSteps={3}
      estimate="~20 seconds"
      title="Set up your firm workspace"
      subtitle="Your account is created. Now we set up the firm — the tenant where your clients, deadlines, and filings live."
      brandLine="One account, one firm at MVP. Multi-firm membership ships in Phase 2 (next quarter)."
    >
      <div className="space-y-6 max-w-md">
        <Field
          label="Firm name"
          hint="Goes on outbound client emails, audit-trail exports, and the forwarding-address prefix."
        >
          <input
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            placeholder="Mitchell CPA"
            className="w-full border border-line rounded px-3 py-2 text-sm"
            autoFocus
          />
        </Field>

        <Field
          label="Where do you file?"
          hint={`Pick every state you handle filings in. The first one is your home state — its address goes on outbound emails. ${
            filingStates.length === 1
              ? "Most firms file in 3-15 states; you can add more anytime in Settings."
              : `You've picked ${filingStates.length} state${filingStates.length === 1 ? "" : "s"}.`
          }`}
        >
          <StateMultiSelect
            selected={filingStates}
            home={homeState}
            onToggle={toggleState}
            onSetHome={setAsHome}
          />
        </Field>

        {submitError && (
          <div className="text-xs text-danger-ink bg-danger-bg border border-danger-border rounded px-3 py-2">
            {submitError}
          </div>
        )}

        <button
          onClick={() => void next()}
          disabled={
            !firmName.trim() || filingStates.length === 0 || bootstrap.isPending
          }
          className="text-sm px-5 py-2 rounded bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {bootstrap.isPending ? "Creating workspace…" : "Continue"}
        </button>

        <div className="bg-info-bg/40 border border-info-border rounded-md px-3 py-2.5 text-2xs text-ink-700 leading-relaxed">
          <span className="font-medium text-ink-900">Trial:</span> Pro tier is
          free for 30 days — no card. After day 30 you pay or your data goes
          read-only. Pick a plan in Settings → Billing whenever you're ready.
        </div>
      </div>
    </OnboardingShell>
  );
}

function StateMultiSelect({
  selected,
  home,
  onToggle,
  onSetHome,
}: {
  selected: string[];
  home: string | undefined;
  onToggle: (s: string) => void;
  onSetHome: (s: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const f = filter.trim().toUpperCase();
    if (!f) return STATES;
    return STATES.filter((s) => s.includes(f));
  }, [filter]);

  return (
    <div>
      {/* Selected chips strip — shows the user's commitment at a glance */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((s) => (
            <span
              key={s}
              className={[
                "inline-flex items-center gap-1 text-2xs font-medium rounded px-1.5 py-1",
                s === home
                  ? "bg-accent text-canvas"
                  : "bg-sunken text-ink-700 border border-line",
              ].join(" ")}
            >
              {s === home && <Check className="w-2.5 h-2.5" aria-hidden />}
              {s}
              {s === home ? (
                <span className="text-2xs opacity-70 ml-0.5">home</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSetHome(s)}
                  className="text-2xs underline opacity-60 hover:opacity-100"
                  title="Make home state"
                >
                  set home
                </button>
              )}
              <button
                type="button"
                onClick={() => onToggle(s)}
                className="ml-0.5 text-2xs opacity-60 hover:opacity-100"
                title="Remove"
                disabled={selected.length === 1 && s === home}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter — type 'CA', 'TX', etc."
        className="w-full border border-line rounded px-3 py-2 text-sm mb-2"
      />

      {/* Grid of state codes — 8 cols on wide, 5 on narrow */}
      <div className="grid grid-cols-5 sm:grid-cols-8 gap-1 max-h-44 overflow-auto border border-line rounded p-1.5 bg-canvas">
        {filtered.map((s) => {
          const isSelected = selected.includes(s);
          const isHome = s === home;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onToggle(s)}
              className={[
                "text-2xs font-mono py-1.5 rounded transition-colors",
                isHome
                  ? "bg-accent text-canvas font-semibold"
                  : isSelected
                    ? "bg-sunken text-ink-900 font-medium border border-line"
                    : "text-ink-500 hover:bg-sunken hover:text-ink-900",
              ].join(" ")}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
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
