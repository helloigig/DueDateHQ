import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { signIn } from "../data/session";
import { authInputClass } from "./auth/AuthShell";
import { env } from "../config";
import { supabase } from "../lib/supabase";
import { trpc } from "../lib/api/client";
import { SsoButton } from "../components/SsoButton";

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
  const createDemoSession = trpc.auth.createDemoSession.useMutation();

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
    // Mock-mode: the local store carries the seeded 51-client roster
    // already, so we just sign in locally and land on Today. No
    // network hop, no email round-trip — instant demo.
    if (env.useMockAuth) {
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
      return;
    }

    // Real-mode: ask the BE to mint a one-click sign-in URL via
    // Supabase admin API (auth.admin.generateLink), then navigate to
    // it. This bypasses Supabase's email-deliverability check on the
    // synthetic demo@duedatehq.com address — no real inbox required.
    // SupabaseAuthBridge picks up the SIGNED_IN event after the
    // redirect and calls auth.bootstrapDemo to populate the firm.
    setSubmitError(null);
    setPending(true);
    try {
      localStorage.setItem("duedatehq.bootstrap_demo_pending", "1");
      const { actionLink } = await createDemoSession.mutateAsync();
      window.location.href = actionLink;
    } catch (err) {
      localStorage.removeItem("duedatehq.bootstrap_demo_pending");
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(
        msg.includes("fetch") || msg.includes("network")
          ? "Couldn't reach the demo service. Try again in a moment."
          : msg,
      );
      setPending(false);
    }
    // Note: `setPending(false)` only runs on error — on success we
    // navigate away so the spinner state doesn't matter.
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
              className="w-full text-sm px-3 py-2 rounded-md bg-indigo text-white hover:bg-indigo-hover disabled:opacity-40"
            >
              {pending ? "Sending link…" : "Send sign-in link"}
            </button>
          </form>

          {/* SSO — visible-but-disabled. OAuth wiring is on the roadmap;
              we surface the buttons so CPAs see the path exists, with a
              "Soon" badge so they don't try to click. */}
          <div className="flex items-center gap-2 my-4">
            <span className="flex-1 h-px bg-line" aria-hidden />
            <span className="text-2xs uppercase tracking-wider text-ink-400 font-semibold">
              or
            </span>
            <span className="flex-1 h-px bg-line" aria-hidden />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SsoButton provider="google" />
            <SsoButton provider="microsoft" />
          </div>

          <p className="text-2xs text-ink-400 mt-4 text-center">
            No password — just a link.{" "}
            <Link to="/signup" className="text-ink-700 underline hover:no-underline">
              New here? Sign up
            </Link>
            <span className="text-ink-500"> · 30-day Pro trial, no card.</span>
          </p>
        </div>

        {/* Demo workspace — quiet inline link, not a CTA card. Real
            users have a job to do (sign in or sign up); the demo is a
            secondary path for prospects, so it gets the smallest
            visual weight that still makes it discoverable.
            Hidden when following an invite (the user is joining a
            specific firm and shouldn't be detoured into the demo). */}
        {!inviteToken && (
          <p className="text-2xs text-ink-400 mt-3 text-center">
            <button
              onClick={() => void tryDemo()}
              disabled={pending}
              className="text-ink-500 underline hover:text-ink-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Or try the demo workspace
            </button>{" "}
            <span className="text-ink-400">
              · 51 fake clients, no signup
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
