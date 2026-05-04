import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { OnboardingShell } from "../../components/OnboardingShell";
import {
  AuthField,
  AuthInput,
  FormError,
  PrimaryButton,
  authInputClass,
} from "../auth/AuthShell";
import { updateSession, useSession } from "../../data/session";
import { env } from "../../config";
import { trpc } from "../../lib/api/client";
import { US_STATES } from "../../data/usStates";

const COMMON_TIMEZONES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Phoenix", label: "Mountain — no DST (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
];

// Tile-grid US map: 8×11 grid in roughly correct geography. Empty cells are
// gaps. Lets a CPA click states by region rather than scrolling a list.
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

export function OnboardingFirm() {
  const navigate = useNavigate();
  const session = useSession();
  const [firmName, setFirmName] = useState(
    session?.firmName === "_pending" ? "" : session?.firmName ?? ""
  );
  const [filingStates, setFilingStates] = useState<string[]>(
    session?.primaryStates && session.primaryStates.length > 0
      ? session.primaryStates
      : ["CA"]
  );
  const [timeZone, setTimeZone] = useState<string>(
    session?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [calendarProvider, setCalendarProvider] = useState<
    "google" | "outlook" | "apple" | "none"
  >(session?.calendarProvider ?? "none");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const bootstrap = trpc.auth.bootstrap.useMutation({
    onError: (err) => setSubmitError(err.message),
  });

  const homeState = filingStates[0];

  const toggleState = (s: string) => {
    setFilingStates((prev) => {
      if (prev.includes(s)) {
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
      title="Set up your firm workspace"
      subtitle="Your account is created. Now we set up the firm — the tenant where your clients, deadlines, and filings live."
      brandLine="One account, one firm at MVP. Multi-firm membership ships in Phase 2 (next quarter)."
    >
      <div className="space-y-7">
        <AuthField
          label="Firm name"
          hint="Goes on outbound client emails, audit-trail exports, and the forwarding-address prefix."
        >
          <AuthInput
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            placeholder="Mitchell CPA"
            autoFocus
          />
        </AuthField>

        <AuthField
          label="Where do you file?"
          hint={
            filingStates.length === 1
              ? undefined
              : `${filingStates.length} states picked.`
          }
        >
          <StateMultiSelect
            selected={filingStates}
            home={homeState}
            onToggle={toggleState}
            onSetHome={setAsHome}
          />
        </AuthField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <AuthField
            label="Time zone"
            hint="Used for 'due today' and 'this week' calculations."
          >
            <select
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              className={authInputClass}
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
              {!COMMON_TIMEZONES.some((tz) => tz.value === timeZone) && (
                <option value={timeZone}>{timeZone}</option>
              )}
            </select>
          </AuthField>

          <AuthField
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
              className={authInputClass}
            >
              <option value="none">No — just keep them here</option>
              <option value="google">Google Calendar</option>
              <option value="outlook">Outlook / Microsoft 365</option>
              <option value="apple">Apple Calendar (iCloud)</option>
            </select>
          </AuthField>
        </div>

        {submitError && <FormError>{submitError}</FormError>}

        <PrimaryButton
          onClick={() => void next()}
          disabled={!firmName.trim() || filingStates.length === 0}
          loading={bootstrap.isPending}
        >
          {bootstrap.isPending ? "Creating workspace" : "Continue"}
        </PrimaryButton>
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
    <div className="space-y-3 mt-1">
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
                  "inline-flex items-center gap-1 text-2xs font-medium rounded-pill px-2.5 py-1",
                  isHome
                    ? "bg-indigo text-white"
                    : "bg-canvas text-ink-700 border border-line",
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
                    className="underline opacity-70 hover:opacity-100"
                    title="Make home state — this address goes on outbound emails"
                  >
                    set home
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onToggle(s)}
                  className="ml-0.5 opacity-70 hover:opacity-100"
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
                      "w-9 h-9 rounded-md text-2xs font-mono font-semibold transition-all relative",
                      isHome
                        ? "bg-indigo text-white ring-2 ring-offset-1 ring-indigo shadow-sm"
                        : picked
                          ? "bg-indigo/85 text-white hover:bg-indigo shadow-sm"
                          : "bg-surface border border-line text-ink-700 hover:bg-sunken hover:border-indigo/40",
                    ].join(" ")}
                  >
                    {code}
                    {isHome && (
                      <Check
                        className="absolute -top-0.5 -right-0.5 w-3 h-3 text-white bg-ink-900 rounded-full p-0.5"
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

      {/* Hover label only — legend and resting copy were intuitive enough
          to drop per dogfooding feedback. The hover line keeps the
          state-name affordance present without filling space at rest. */}
      <div className="text-2xs text-ink-500 min-h-[1.25em]">
        {hoveredState && (
          <>
            <span className="font-mono font-semibold">
              {hoveredState.code}
            </span>{" "}
            · {hoveredState.name}
          </>
        )}
      </div>
    </div>
  );
}
