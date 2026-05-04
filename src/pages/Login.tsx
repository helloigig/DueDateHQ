import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, ArrowRight, ArrowLeft, Mail } from "lucide-react";
import { signIn } from "../data/session";
import {
  AuthShell,
  AuthField,
  AuthInput,
  PrimaryButton,
  FormError,
  BrandBar,
  HelpButton,
} from "./auth/AuthShell";
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
 * Sign-IN — passwordless magic-link flow for existing users only. See
 * Signup.tsx for the new-account flow.
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
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}${inviteToken ? `/accept-invite?token=${inviteToken}` : "/"}`,
        },
      });
      if (error) {
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
          setSubmitError("No account for that email. Sign up first.");
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

  // Link-sent confirmation
  if (step === "sent") {
    return (
      <AuthShell title="Check your email" subtitle={
        <>
          We sent a sign-in link to{" "}
          <span className="font-medium text-ink-900">{email}</span>. Click the
          link to continue — you'll come back signed in.
        </>
      }>
        <button
          onClick={() => {
            setStep("email");
            setSubmitError(null);
          }}
          className="text-xs text-ink-500 hover:text-indigo inline-flex items-center gap-1 mb-6 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" aria-hidden /> Use a different email
        </button>
        <div className="flex items-center gap-3 bg-canvas border border-line rounded-md px-4 py-3">
          <span className="w-9 h-9 rounded-full bg-indigo-soft text-indigo flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4" aria-hidden />
          </span>
          <p className="text-sm text-ink-700 leading-snug">
            The link expires in 30 minutes and can only be used once.
          </p>
        </div>

        {submitError && <div className="mt-4"><FormError>{submitError}</FormError></div>}

        <p className="text-2xs text-ink-400 mt-8 pt-6 border-t border-line">
          Didn't get it? Check spam, or{" "}
          <button
            onClick={() =>
              onSubmit(new Event("submit") as unknown as React.FormEvent)
            }
            className="text-indigo hover:underline"
            disabled={pending}
          >
            {pending ? "resending…" : "resend the link"}
          </button>
          .
        </p>
      </AuthShell>
    );
  }

  // Email-entry view
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <BrandBar />
      <main className="flex-1 flex items-start justify-center px-6">
        <div className="w-full max-w-md pt-16 pb-24">
          <header>
            <h1 className="text-display font-semibold text-ink-900">
              {inviteToken ? "Sign in to join the firm" : "Sign in to DueDateHQ"}
            </h1>
            <p className="text-sm text-ink-500 mt-2 leading-relaxed">
              {inviteToken
                ? "You've been invited. Type your email — we'll send a sign-in link."
                : env.useMockAuth
                  ? "Type any email — mock mode signs you in instantly. New here? Use Sign up."
                  : "Type your email — we'll send a one-tap sign-in link. No password to remember."}
            </p>
          </header>

          <form onSubmit={onSubmit} className="space-y-5 mt-8">
            <AuthField label="Work email">
              <AuthInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourfirm.com"
                autoFocus
              />
            </AuthField>

            {submitError && <FormError>{submitError}</FormError>}

            <PrimaryButton
              type="submit"
              disabled={!email}
              loading={pending}
            >
              {pending ? "Sending link" : "Send sign-in link"}
            </PrimaryButton>
          </form>

          {/* Demo workspace — only in mock mode + not for invited users */}
          {env.useMockData && !inviteToken && (
            <button
              onClick={() => void tryDemo()}
              className="w-full mt-8 bg-canvas hover:bg-sunken border border-line hover:border-indigo/40 rounded-md p-4 text-left transition-colors group"
            >
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-indigo-soft text-indigo flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" aria-hidden />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900">
                    Try the demo workspace
                  </p>
                  <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">
                    49 fake clients, a live state alert, 3 years of prior
                    history. Skip the email — just see how it works.
                  </p>
                </div>
                <ArrowRight
                  className="w-4 h-4 text-ink-400 mt-2 group-hover:text-indigo transition-colors shrink-0"
                  aria-hidden
                />
              </div>
            </button>
          )}

          <div className="mt-8 pt-6 border-t border-line text-xs text-ink-500">
            <p>
              New to DueDateHQ?{" "}
              <Link to="/signup" className="text-indigo hover:underline font-medium">
                Create an account
              </Link>
              <span className="text-ink-400"> · 30-day Pro trial, no card</span>
            </p>
          </div>
        </div>
      </main>
      <HelpButton />
    </div>
  );
}
