import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, ArrowRight, ArrowLeft, Mail } from "lucide-react";
import { signIn } from "../data/session";
import { authInputClass } from "./auth/AuthShell";
import { env } from "../config";
import { supabase } from "../lib/supabase";

// Lazy: only loaded when the user actually triggers sign-in. Keeps the
// /login bundle small — `data/store` eagerly imports ~49 mock clients +
// deadlines + tasks which we don't need on the entry page.
async function loadActions() {
  const m = await import("../data/store");
  return m.actions;
}

/**
 * Sign-IN — passwordless magic-link flow for existing users only.
 *
 * Email → magic link → click → land on dashboard (skip onboarding). New
 * users belong on /signup, not here. Supabase enforces this via
 * `shouldCreateUser: false`, which surfaces an "account not found" error
 * if the email has never signed up.
 *
 * Mock mode: no real email; we sign in directly. Demo emails
 * (`demo@duedatehq.com`, `sarah@mitchellcpa.com`) load the seeded
 * 49-client demo. All other emails reuse whatever's already in localStorage
 * (their data) without resetting.
 *
 * Demo workspace button: shortcut that skips even the email step.
 *
 * Invitation flow: ?invite=<token> means the user is joining an existing
 * firm. Banner adjusts; routes to /accept-invite after verify.
 */
export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [step, setStep] = useState<"email" | "sent">("email");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!email.includes("@")) {
      setSubmitError("Enter a valid email.");
      return;
    }
    setPending(true);
    try {
      if (env.useMockAuth) {
        // Local sign-in path. We don't have a remote auth service, so we
        // accept the email as-is and route by intent: this page is sign-IN
        // (existing user) → land on the dashboard, skip onboarding. Demo
        // emails reload the seeded 49-client workspace; everything else
        // reuses whatever's already in the store.
        const isDemoEmail =
          email === "demo@duedatehq.com" || email === "sarah@mitchellcpa.com";
        if (isDemoEmail) {
          const actions = await loadActions();
          actions.resetToSeeds();
        }
        signIn({
          firmName: isDemoEmail ? "Mitchell CPA (demo)" : "Your firm",
          userName: email.split("@")[0] ?? "you",
          userEmail: email,
          tier: "pro",
        });
        const raw = localStorage.getItem("duedatehq.session.v1");
        if (raw) {
          try {
            const s = JSON.parse(raw);
            s.onboardingComplete = true;
            if (isDemoEmail) s.primaryStates = ["CA"];
            localStorage.setItem("duedatehq.session.v1", JSON.stringify(s));
          } catch {
            /* ignore */
          }
        }
        navigate(
          inviteToken ? `/accept-invite?token=${inviteToken}` : "/",
          { replace: true },
        );
        return;
      }
      const { error } = await supabase().auth.signInWithOtp({
        email,
        options: {
          // Sign-IN only — refuse to create a new user. Users without an
          // account get an "Email not confirmed / not found" error and
          // should head to /signup instead.
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}${inviteToken ? `/accept-invite?token=${inviteToken}` : "/"}`,
        },
      });
      if (error) {
        // Surface rate-limit + deliverability errors honestly. Supabase
        // free-tier limits to 4 emails per hour by default — easy to hit
        // when testing.
        const msg = error.message.toLowerCase();
        if (msg.includes("rate") || msg.includes("too many")) {
          setSubmitError(
            "Too many sign-in attempts in the last hour. Wait ~60 minutes or contact support.",
          );
        } else if (
          msg.includes("signup") ||
          msg.includes("not found") ||
          msg.includes("user not")
        ) {
          setSubmitError(
            "No account for that email. Sign up first.",
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

  const tryDemo = async () => {
    const actions = await loadActions();
    actions.resetToSeeds();
    signIn({
      firmName: "Mitchell CPA (demo)",
      userName: "Sarah Mitchell",
      userEmail: "demo@duedatehq.com",
      tier: "pro",
    });
    const raw = localStorage.getItem("duedatehq.session.v1");
    if (raw) {
      try {
        const s = JSON.parse(raw);
        s.onboardingComplete = true;
        s.primaryStates = ["CA"];
        localStorage.setItem("duedatehq.session.v1", JSON.stringify(s));
      } catch {
        /* ignore */
      }
    }
    navigate("/", { replace: true });
  };

  // Link-sent confirmation view
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
            We sent a sign-in link to{" "}
            <span className="font-medium text-ink-900">{email}</span>. Click
            the link to continue — you'll come back signed in.
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
                onSubmit(new Event("submit") as unknown as React.FormEvent)
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

  // Email-entry view (default)
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-surface border border-line rounded-md p-8">
          <Link to="/login" className="text-sm font-semibold text-ink-900">
            DueDateHQ
          </Link>
          <h1 className="text-2xl font-semibold text-ink-900 mt-6">
            {inviteToken ? "Sign in to join the firm" : "Sign in"}
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            {inviteToken
              ? "You've been invited. Type your email — we'll send a sign-in link."
              : env.useMockAuth
                ? "Type any email — mock mode signs you in instantly. New here? Use Sign up."
                : "Type your email — we'll send a sign-in link."}
          </p>

          <form onSubmit={onSubmit} className="space-y-3 text-sm mt-6">
            <label className="block">
              <span className="text-xs font-medium text-ink-700 mb-1 block">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={authInputClass}
                placeholder="you@yourfirm.com"
                autoFocus
              />
            </label>

            {submitError && (
              <div className="text-xs text-danger-ink bg-danger-bg border border-danger-border rounded px-3 py-2">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={pending || !email}
              className="w-full text-sm px-3 py-2 rounded-md bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40"
            >
              {pending ? "Sending link…" : "Send sign-in link"}
            </button>
          </form>

          <p className="text-2xs text-ink-400 mt-4 text-center">
            No password — just a link.{" "}
            <Link to="/signup" className="text-ink-700 underline hover:no-underline">
              New here? Sign up
            </Link>
            <span className="text-ink-500"> · 30-day Pro trial, no card.</span>
          </p>
        </div>

        {/* Demo workspace — only in mock mode + not for invited users */}
        {env.useMockData && !inviteToken && (
          <button
            onClick={() => void tryDemo()}
            className="w-full mt-3 bg-surface border border-line hover:border-accent rounded-md p-4 text-left transition-colors group"
          >
            <div className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-full bg-info-bg border border-info-border text-info-ink flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5" aria-hidden />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-900">
                  Try the demo workspace
                </p>
                <p className="text-xs text-ink-500 mt-0.5">
                  49 fake clients, live state alert, 3 years of prior history.
                  No email, no waiting — just see how it works.
                </p>
              </div>
              <ArrowRight
                className="w-4 h-4 text-ink-400 mt-2 group-hover:text-ink-900 transition-colors"
                aria-hidden
              />
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
