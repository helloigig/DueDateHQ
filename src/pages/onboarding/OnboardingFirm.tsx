import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { OnboardingShell } from "../../components/OnboardingShell";
import { updateSession, useSession } from "../../data/session";
import { env } from "../../config";
import { trpc } from "../../lib/api/client";
import { US_STATES } from "../../data/usStates";

// Common US time zones — covers ~99% of CPA firms. Auto-detected zones
// outside this list still appear (we add them dynamically below the list).
const COMMON_TIMEZONES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Phoenix", label: "Mountain — no DST (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
];

// Tile-grid US map: an 8×11 grid in roughly correct geography (NYT/WaPo
// data-viz convention). Empty cells are gaps. Lets a CPA click states by
// region rather than scrolling an alphabetical list.
const STATE_GRID: string[][] = [
  ["", "", "", "", "", "", "", "", "", "", "ME"],
  ["AK", "", "", "", "", "", "", "", "VT", "NH", ""],
  ["", "", "", "", "", "", "", "", "MA", "", ""],
  ["WA", "MT", "ND", "MN", "IL", "WI", "MI", "", "NY", "RI", "CT"],
  ["OR", "ID", "SD", "IA", "IN", "OH", "PA", "NJ", "", "", ""],
  ["CA", "NV", "UT", "WY", "MO", "KY", "WV", "VA", "MD", "DC", "DE"],
  ["", "AZ", "CO", "NE", "KS", "TN", "NC", "SC", "", "", ""],
  ["", "", "NM", "OK", "AR", "MS", "AL", "GA", "", "", ""],
  ["HI", "", "", "TX", "LA", "", "", "", "FL", "", ""],
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
  // Time zone — auto-detected from the browser's Intl API; user can change.
  // Defaults matter: if a CPA in PT lands here and the system's UTC clock
  // says "due today" relative to NY, the planning day is broken.
  const [timeZone, setTimeZone] = useState<string>(
    session?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  // Calendar provider — Phase 1 stub. Selecting a provider here doesn't
  // start OAuth yet; we just record intent so the dashboard can show the
  // "Connect calendar" affordance contextually.
  const [calendarProvider, setCalendarProvider] = useState<
    "google" | "outlook" | "apple" | "none"
  >(session?.calendarProvider ?? "none");
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
      timeZone,
      calendarProvider,
    });
    navigate("/onboarding/choose-path");
  };

  const next = async () => {
    setSubmitError(null);
    // Bootstrap requires a real Supabase JWT, not real *data*. Gating on
    // useMockAuth is correct — useMockData was a typo that skipped
    // provisioning whenever the dev/staging override flipped data to mock
    // while keeping auth real, leaving the firm row absent and every
    // subsequent firmProcedure throwing PRECONDITION_FAILED.
    if (!env.useMockAuth) {
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

        {/* Time zone + calendar in a 2-column grid — both affect daily flow.
            Time zone drives "due today" math; calendar push gets deadlines
            into the partner's existing planning surface. Everything else
            (logo, EIN, address) lives in Settings → Firm. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Time zone"
            hint="Used for 'due today' and 'this week' calculations."
          >
            <select
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              className="w-full border border-line rounded px-3 py-2 text-sm bg-surface"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
              {/* If the auto-detected zone isn't in the common list, show it
                  too so we don't silently overwrite */}
              {!COMMON_TIMEZONES.some((tz) => tz.value === timeZone) && (
                <option value={timeZone}>{timeZone}</option>
              )}
            </select>
          </Field>

          <Field
            label="Push deadlines to your calendar"
            hint="We'll add a 'Connect' button on your dashboard. Optional, change anytime."
          >
            <select
              value={calendarProvider}
              onChange={(e) =>
                setCalendarProvider(
                  e.target.value as "google" | "outlook" | "apple" | "none",
                )
              }
              className="w-full border border-line rounded px-3 py-2 text-sm bg-surface"
            >
              <option value="none">No — just keep them here</option>
              <option value="google">Google Calendar</option>
              <option value="outlook">Outlook / Microsoft 365</option>
              <option value="apple">Apple Calendar (iCloud)</option>
            </select>
          </Field>
        </div>

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
          className="text-sm px-5 py-2 rounded bg-indigo text-white hover:bg-indigo-hover disabled:opacity-40 disabled:cursor-not-allowed"
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
  const [hoverCode, setHoverCode] = useState<string | null>(null);
  const stateByCode = useMemo(() => {
    const m = new Map<string, { code: string; name: string }>();
    for (const s of US_STATES) m.set(s.code, s);
    return m;
  }, []);
  const hoveredState = hoverCode ? stateByCode.get(hoverCode) : null;
  const isPicked = (code: string) => selected.includes(code);

  return (
    <div className="space-y-3">
      {/* Selected-states chip strip — visible commitment, with home-state
          designation. Click 'set home' to swap which state's address goes
          on outbound emails. */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => {
            const meta = stateByCode.get(s);
            const isHome = s === home;
            return (
              <span
                key={s}
                title={meta?.name ?? s}
                className={[
                  "inline-flex items-center gap-1 text-2xs font-medium rounded px-2 py-1",
                  isHome
                    ? "bg-accent text-canvas"
                    : "bg-sunken text-ink-700 border border-line",
                ].join(" ")}
              >
                {isHome && <Check className="w-2.5 h-2.5" aria-hidden />}
                <span className="font-mono">{s}</span>
                <span className="opacity-80">{meta?.name ?? ""}</span>
                {isHome ? (
                  <span className="opacity-70 ml-0.5">· home</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSetHome(s)}
                    className="underline opacity-60 hover:opacity-100"
                    title="Make home state — this address goes on outbound emails"
                  >
                    set home
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onToggle(s)}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                  title="Remove"
                  disabled={selected.length === 1 && isHome}
                  aria-label={`Remove ${meta?.name ?? s}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Tile-grid US map. Approximate 8×11 NYT/WaPo data-viz layout —
          states sit in roughly the right geographic position. Click to
          toggle. Picked states fill with accent; home state shows a check
          glyph and a thicker ring. */}
      <div className="bg-canvas border border-line rounded-md p-4">
        <div className="space-y-1">
          {STATE_GRID.map((row, ri) => (
            <div key={ri} className="flex gap-1 justify-center">
              {row.map((code, ci) => {
                if (!code) {
                  return <div key={ci} className="w-9 h-9" aria-hidden />;
                }
                const meta = stateByCode.get(code);
                if (!meta) {
                  return <div key={ci} className="w-9 h-9" aria-hidden />;
                }
                const picked = isPicked(code);
                const isHome = code === home;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => onToggle(code)}
                    onMouseEnter={() => setHoverCode(code)}
                    onMouseLeave={() =>
                      setHoverCode((h) => (h === code ? null : h))
                    }
                    title={meta.name + (isHome ? " — home state" : "")}
                    aria-label={`${meta.name}${picked ? ", selected" : ""}${isHome ? ", home state" : ""}`}
                    aria-pressed={picked}
                    className={[
                      "w-9 h-9 rounded text-2xs font-mono font-semibold transition-all relative",
                      isHome
                        ? "bg-accent text-canvas ring-2 ring-offset-1 ring-accent shadow-sm"
                        : picked
                          ? "bg-accent/90 text-canvas hover:bg-accent shadow-sm"
                          : "bg-surface border border-line text-ink-700 hover:bg-sunken hover:border-ink-400",
                    ].join(" ")}
                  >
                    {code}
                    {isHome && (
                      <Check
                        className="absolute -top-0.5 -right-0.5 w-3 h-3 text-canvas bg-ink-900 rounded-full p-0.5"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Hover hint + legend */}
      <div className="flex items-center justify-between text-2xs flex-wrap gap-2">
        <div className="text-ink-500 min-h-[1.25em]">
          {hoveredState ? (
            <>
              <span className="font-mono font-semibold">
                {hoveredState.code}
              </span>{" "}
              · {hoveredState.name}
            </>
          ) : (
            "Click a state to add or remove it. Set one as your home."
          )}
        </div>
        <div className="flex items-center gap-3 text-ink-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-accent" /> picked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-surface border border-line" />{" "}
            available
          </span>
        </div>
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
