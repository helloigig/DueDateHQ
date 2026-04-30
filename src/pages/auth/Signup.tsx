import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  ShieldCheck,
  Sparkles,
  Inbox,
  ArrowLeft,
} from "lucide-react";
import { signIn } from "../../data/session";
import { actions } from "../../data/store";
import { authInputClass } from "./AuthShell";
import { env } from "../../config";
import { supabase } from "../../lib/supabase";

/**
 * Sign-UP — passwordless magic-link, first-time users only.
 *
 * Email → magic link → click → land on /onboarding/firm. Onboarding is
 * REQUIRED for new accounts (firm name, primary states, import path).
 * Existing users belong on /login, not here. Supabase enforces this via
 * `shouldCreateUser: true` — if the email already has an account, the
 * magic link signs them in but lands them on /onboarding/firm anyway, and
 * the bridge will route them through to dashboard if onboarding is already
 * complete.
 *
 * Mock mode: no real email; we sign in directly with `_pending` firm and
 * `actions.resetToEmpty()` so the new account starts clean (no leftover
 * demo seeds from a prior session in the same browser). Then route to
 * /onboarding/firm.
 */
export function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "sent">("email");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function inferNames(emailValue: string) {
    const at = emailValue.indexOf("@");
    const local = at > 0 ? emailValue.slice(0, at) : "";
    const domain = at > 0 ? emailValue.slice(at + 1) : "";
    const userName = local
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const firmName = domain
      ? domain
          .split(".")[0]
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()) + " CPA"
      : "";
    return { userName, firmName };
  }

  // Pre-fill firm + name from email — happens at onboarding/firm.
  // Wireframe: detect a known domain so the "Request to join" UX shows.
  const knownDomain = (() => {
    const at = email.indexOf("@");
    if (at < 0) return null;
    const domain = email.slice(at + 1).trim().toLowerCase();
    if (!domain) return null;
    const KNOWN: Record<string, { firmName: string; ownerName: string }> = {
      "mitchellcpa.com": { firmName: "Mitchell CPA", ownerName: "Sarah Mitchell" },
    };
    return KNOWN[domain] ?? null;
  })();

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!email.includes("@")) {
      setSubmitError("Enter a valid email.");
      return;
    }
    setPending(true);
    try {
      if (env.useMockAuth) {
        // Mock: clean store first so the new account doesn't inherit
        // demo data that may be left in localStorage from a prior session.
        actions.resetToEmpty();
        const { userName, firmName } = inferNames(email);
        signIn({
          firmName: "_pending",
          userName: userName || (email.split("@")[0] ?? ""),
          userEmail: email,
          tier: "pro",
        });
        // Persist the inferred firm name so OnboardingFirm pre-fills.
        const raw = localStorage.getItem("duedatehq.session.v1");
        if (raw) {
          try {
            const s = JSON.parse(raw);
            s.onboardingComplete = false;
            s.suggestedFirmName = firmName;
            localStorage.setItem("duedatehq.session.v1", JSON.stringify(s));
          } catch {
            /* ignore */
          }
        }
        navigate("/onboarding/firm", { replace: true });
        return;
      }
      const { error } = await supabase().auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/onboarding/firm`,
        },
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("rate") || msg.includes("too many")) {
          setSubmitError(
            "Too many sign-up attempts in the last hour. Wait ~60 minutes or contact support.",
          );
        } else {
          setSubmitError(error.message);
        }
        return;
      }
      setStep("sent");
    } finally {
      setPending(false);
    }
  };

  if (step === "sent") {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-surface border border-line rounded-md p-8 text-center">
          <button
            onClick={() => {
              setStep("email");
              setSubmitError(null);
            }}
            className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" aria-hidden /> Use a different email
          </button>
          <div className="w-14 h-14 rounded-full bg-info-bg border border-info-border flex items-center justify-center text-info-ink mx-auto mt-3">
            <Mail className="w-6 h-6" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold text-ink-900 mt-4">
            Check your email
          </h1>
          <p className="text-sm text-ink-500 mt-2">
            We sent a sign-up link to{" "}
            <span className="font-medium text-ink-900">{email}</span>. Click
            the link — we'll set up your firm in the next step.
          </p>

          {submitError && (
            <div className="text-xs text-danger-ink bg-danger-bg border border-danger-border rounded px-3 py-2 mt-4">
              {submitError}
            </div>
          )}

          <p className="text-2xs text-ink-400 mt-6 pt-4 border-t border-line">
            Didn't get it? Check spam, or{" "}
            <button
              onClick={() =>
                sendLink(new Event("submit") as unknown as React.FormEvent)
              }
              className="underline hover:no-underline"
              disabled={pending}
            >
              {pending ? "resending…" : "resend the link"}
            </button>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas grid grid-cols-1 lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col justify-center p-8 lg:p-12">
        <div className="max-w-sm mx-auto w-full">
          <Link to="/login" className="text-sm font-semibold text-ink-900">
            DueDateHQ
          </Link>
          <p className="text-2xs uppercase tracking-wider text-ink-500 mt-8 font-semibold">
            Sign up
          </p>
          <h1 className="text-2xl font-semibold text-ink-900 mt-1">
            30 days free, then $49/mo
          </h1>
          <p className="text-sm text-ink-500 mt-2">
            We'll set up your firm workspace in the next step. Teammates join
            via invite later. No credit card; after day 30 you pay or your
            data goes read-only.
          </p>

          <form onSubmit={sendLink} className="space-y-3 text-sm mt-6">
            <label className="block">
              <span className="text-xs font-medium text-ink-700 mb-1 block">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSubmitError(null);
                }}
                placeholder="you@yourfirm.com"
                className={authInputClass}
                autoFocus
              />
            </label>

            {/* Firm-already-exists detection (PRD: domain-based discovery) */}
            {knownDomain && (
              <div className="text-xs bg-info-bg border border-info-border rounded px-3 py-2 text-info-ink">
                <p className="font-medium">
                  {knownDomain.firmName} already exists at this domain.
                </p>
                <p className="mt-0.5">
                  Owner: {knownDomain.ownerName}.{" "}
                  <button
                    type="button"
                    onClick={() => alert("Request sent — wireframe stub")}
                    className="underline hover:no-underline"
                  >
                    Request to join
                  </button>
                  {" "}or continue to create your own.
                </p>
              </div>
            )}

            {submitError && (
              <div className="text-xs text-danger-ink bg-danger-bg border border-danger-border rounded px-3 py-2">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={pending || !email}
              className="w-full text-sm px-3 py-2 rounded-md bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40 mt-2"
            >
              {pending
                ? "Sending link…"
                : env.useMockAuth
                  ? "Continue → set up firm"
                  : "Send sign-up link"}
            </button>
            <p className="text-2xs text-ink-400 text-center">
              By continuing you agree to the Terms and Privacy Policy.
            </p>
          </form>

          <div className="mt-6 pt-6 border-t border-line space-y-3">
            {/* Joining an existing firm — email-link is primary. Owner clicks
                "invite Alice" in Settings → Team, Alice gets an email, click
                takes her to /accept-invite/<token>. */}
            <p className="text-xs text-ink-500">
              Joining an existing firm? Look for an invite email from your firm
              owner — the link takes you straight in.{" "}
              <Link to="/accept-invite" className="text-ink-900 underline">
                Lost the email?
              </Link>
            </p>

            <p className="text-xs text-ink-500">
              Already have an account?{" "}
              <Link to="/login" className="text-ink-900 underline">
                Sign in
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Right — Day-1 contract */}
      <div className="hidden lg:flex flex-col justify-center bg-sunken/40 border-l border-line p-12">
        <div className="max-w-md mx-auto">
          <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
            What you get on Day 1
          </p>
          <h2 className="text-xl font-semibold text-ink-900 mt-2 leading-snug">
            AI is useful right now — not someday.
          </h2>
          <p className="text-sm text-ink-500 mt-2 max-w-sm">
            We don't apologize for cold start. The four substrates (entity,
            industry, state, cohort) make AI productive the minute your roster
            is in.
          </p>

          <ul className="mt-6 space-y-4">
            <Promise
              icon={<Sparkles className="w-3.5 h-3.5" aria-hidden />}
              title="50-state deadline database, federal forms covered"
              detail="100% accuracy on federal, 99%+ on state. Every deadline links to its official source."
            />
            <Promise
              icon={<ShieldCheck className="w-3.5 h-3.5" aria-hidden />}
              title="24-hour state-alert SLA — or your money back"
              detail="If we miss a state extension within 24 hours of official announcement and your client incurs a penalty, that month is credited."
              accent
            />
            <Promise
              icon={<Inbox className="w-3.5 h-3.5" aria-hidden />}
              title="Per-task forwarding emails, no OAuth required"
              detail="Every task gets a unique address like emily-1040-X7fK@duedatehq.com. Client docs route to the right place automatically."
            />
            <Promise
              icon={<Mail className="w-3.5 h-3.5" aria-hidden />}
              title="AI-drafted reminders, you review and send"
              detail="Mode D writes the chase emails grounded in the client's history and your voice. You stay in the loop on every send."
            />
          </ul>

          <div className="mt-8 pt-6 border-t border-line">
            <p className="text-xs text-ink-500">
              <span className="font-medium text-ink-900">
                30 days free, then $29–99/mo.
              </span>{" "}
              No card to start; you pay before day 31 or your data goes
              read-only. Counter to the annual-upfront model you're used to —
              we earn the conversion through usage, not credit-card capture.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Promise({
  icon,
  title,
  detail,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={[
          "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          accent
            ? "bg-warn-bg text-warn-ink border border-warn-border"
            : "bg-surface text-ink-700 border border-line",
        ].join(" ")}
      >
        {icon}
      </span>
      <div>
        <p className="text-sm font-medium text-ink-900">{title}</p>
        <p className="text-xs text-ink-500 mt-0.5">{detail}</p>
      </div>
    </li>
  );
}
