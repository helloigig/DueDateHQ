import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { OnboardingShell } from "../../components/OnboardingShell";
import { updateSession, useSession } from "../../data/session";
import { env } from "../../config";
import { trpc } from "../../lib/api/client";

// State code → full name. The picker shows full names because two-letter
// codes alone aren't meaningful enough at scan speed. Codes still appear
// in the chip strip (compact, visually distinct).
const STATES: ReadonlyArray<{ code: string; name: string }> = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

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
  const nameByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of STATES) m.set(s.code, s.name);
    return m;
  }, []);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return STATES;
    return STATES.filter(
      (s) =>
        s.code.toLowerCase().includes(f) ||
        s.name.toLowerCase().includes(f),
    );
  }, [filter]);

  return (
    <div>
      {/* Selected chips strip — codes for compactness, full name on hover */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((s) => (
            <span
              key={s}
              title={nameByCode.get(s) ?? s}
              className={[
                "inline-flex items-center gap-1 text-2xs font-medium rounded px-1.5 py-1",
                s === home
                  ? "bg-accent text-canvas"
                  : "bg-sunken text-ink-700 border border-line",
              ].join(" ")}
            >
              {s === home && <Check className="w-2.5 h-2.5" aria-hidden />}
              <span className="font-mono">{s}</span>
              <span className="text-2xs opacity-80">
                {nameByCode.get(s) ?? s}
              </span>
              {s === home ? (
                <span className="text-2xs opacity-70 ml-0.5">· home</span>
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
        placeholder="Search by name or code (e.g. 'California' or 'CA')"
        className="w-full border border-line rounded px-3 py-2 text-sm mb-2"
      />

      {/* Scrollable list of full state names. 2 columns on wide screens for
          density without sacrificing readability. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px max-h-72 overflow-auto border border-line rounded bg-canvas">
        {filtered.map(({ code, name }) => {
          const isSelected = selected.includes(code);
          const isHome = code === home;
          return (
            <button
              key={code}
              type="button"
              onClick={() => onToggle(code)}
              className={[
                "text-sm py-2 px-3 text-left transition-colors flex items-center gap-2 bg-surface",
                isHome
                  ? "bg-accent text-canvas font-medium hover:bg-accent-hover"
                  : isSelected
                    ? "bg-sunken text-ink-900 font-medium hover:bg-sunken/80"
                    : "text-ink-700 hover:bg-sunken",
              ].join(" ")}
            >
              <span
                className={[
                  "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                  isSelected
                    ? isHome
                      ? "bg-canvas border-canvas text-accent"
                      : "bg-accent border-accent text-canvas"
                    : "border-line bg-canvas",
                ].join(" ")}
              >
                {isSelected && <Check className="w-3 h-3" aria-hidden />}
              </span>
              <span className="flex-1">{name}</span>
              <span className="text-2xs font-mono opacity-50">{code}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full text-xs text-ink-500 px-3 py-3">
            No states match "{filter}".
          </p>
        )}
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
