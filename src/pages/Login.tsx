import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, ArrowRight, ArrowLeft, Mail } from "lucide-react";
import { trpc } from "../lib/api/client";
import { signIn } from "../data/session";
import { actions } from "../data/store";
import { authInputClass } from "./auth/AuthShell";
import { env } from "../config";
import { supabase } from "../lib/supabase";

/**
 * Sign-in / sign-up — UNIFIED OTP-only flow.
 *
 * One path, no passwords. The user types email → we email them a 6-digit
 * code → they type it back → they're in (existing user) or onboarding-bound
 * (new user). Same as Substack, sigma B2B norm.
 *
 * Why no password at all:
 *   - Password resets are the primary auth-failure mode for SMB users
 *     ("forgot my password" + email-deliverability issues = locked out)
 *   - One path is simpler than "OTP primary, password collapsed"
 *   - Supabase's signInWithOtp works for accounts that originally signed up
 *     with password — they just stop needing the password
 *
 * Why OTP code (not magic link):
 *   - Cross-device safe (laptop sign-in, phone email — type code anywhere)
 *   - Phishing-resistant (the code only works in the legit tab)
 *   - Familiar from banking
 *
 * Demo workspace path: only in mock mode, lets prospects skip auth entirely.
 *
 * Invitation flow: ?invite=<token> tells the page the user is joining an
 * existing firm, not creating a new one. Banner adjusts; routes to
 * /accept-invite after verify.
 */
export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const trpcUtils = trpc.useUtils();
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!email.includes("@")) {
      setSubmitError("Enter a valid email.");
      return;
    }
    setPending(true);
    try {
      if (env.useMockApi) {
        // Mock: skip Supabase, advance to code step. Any 6 digits will work.
        setStep("code");
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
        // Surface rate-limit + deliverability errors honestly. Supabase
        // free-tier limits to 4 emails per hour by default — easy to hit
        // when testing.
        const msg = error.message.toLowerCase();
        if (msg.includes("rate") || msg.includes("too many")) {
          setSubmitError(
            "Too many sign-in attempts in the last hour. Wait ~60 minutes or contact support.",
          );
        } else {
          setSubmitError(error.message);
        }
        return;
      }
      setStep("code");
    } finally {
      setPending(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const cleaned = code.replace(/\D/g, "");
    if (cleaned.length !== 6) {
      setSubmitError("The code is 6 digits.");
      return;
    }
    setPending(true);
    try {
      if (env.useMockApi) {
        // Mock: any 6-digit value succeeds. Demo email shortcut goes to
        // demo workspace; everything else is treated as a fresh signup.
        if (
          email === "demo@duedatehq.com" ||
          email === "sarah@mitchellcpa.com"
        ) {
          actions.resetToSeeds();
          signIn({
            firmName: "Mitchell CPA (demo)",
            userName: email.split("@")[0] ?? "you",
            userEmail: email,
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
        } else {
          signIn({
            firmName: "_pending",
            userName: email.split("@")[0] ?? "",
            userEmail: email,
            tier: "pro",
          });
          navigate(
            inviteToken ? `/accept-invite?token=${inviteToken}` : "/onboarding/firm",
            { replace: true },
          );
        }
        return;
      }
      const { error } = await supabase().auth.verifyOtp({
        email,
        token: cleaned,
        type: "email",
      });
      if (error) {
        setSubmitError(error.message);
        return;
      }
      await trpcUtils.auth.session.invalidate();
      const remote = await trpcUtils.auth.session.fetch();
      if (inviteToken) {
        signIn({
          firmName: "_pending",
          userName: email.split("@")[0] ?? "",
          userEmail: email,
          tier: "pro",
        });
        navigate(`/accept-invite?token=${inviteToken}`, { replace: true });
        return;
      }
      if (!remote) {
        signIn({
          firmName: "_pending",
          userName: email.split("@")[0] ?? "",
          userEmail: email,
          tier: "pro",
        });
        navigate("/onboarding/firm", { replace: true });
        return;
      }
      signIn({
        firmName: remote.firm.name,
        userName: remote.user.displayName ?? remote.user.email,
        userEmail: remote.user.email,
        tier: remote.firm.tier,
      });
      navigate("/", { replace: true });
    } finally {
      setPending(false);
    }
  };

  const tryDemo = () => {
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

  // Code-entry view
  if (step === "code") {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-surface border border-line rounded-md p-8">
          <button
            onClick={() => {
              setStep("email");
              setCode("");
              setSubmitError(null);
            }}
            className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" aria-hidden /> Use a different email
          </button>
          <div className="w-12 h-12 rounded-full bg-info-bg border border-info-border flex items-center justify-center text-info-ink mx-auto mt-3">
            <Mail className="w-5 h-5" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold text-ink-900 mt-4 text-center">
            Check your email
          </h1>
          <p className="text-sm text-ink-500 mt-2 text-center">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-ink-900">{email}</span>. Type it
            below — or click the link in the email if that's easier.
          </p>
          {env.useMockApi && (
            <p className="text-2xs text-warn-ink bg-warn-bg border border-warn-border rounded px-2 py-1 mt-3 text-center">
              Mock mode: any 6 digits will work (e.g., 000000).
            </p>
          )}

          <form onSubmit={verifyCode} className="space-y-3 mt-6">
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full text-center text-2xl tracking-[0.4em] font-mono py-3 border border-line rounded bg-canvas focus:outline-none focus:border-accent"
              autoComplete="one-time-code"
            />

            {submitError && (
              <div className="text-xs text-danger-ink bg-danger-bg border border-danger-border rounded px-3 py-2">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={pending || code.length !== 6}
              className="w-full text-sm px-3 py-2 rounded-md bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40"
            >
              {pending ? "Verifying…" : "Verify and continue"}
            </button>
          </form>

          <p className="text-2xs text-ink-400 mt-4 pt-4 border-t border-line text-center">
            Didn't get it? Check spam, or{" "}
            <button
              onClick={() =>
                sendCode(new Event("submit") as unknown as React.FormEvent)
              }
              className="underline hover:no-underline"
              disabled={pending}
            >
              resend the code
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
              ? "You've been invited. Type your email — we'll send a code."
              : env.useMockApi
                ? "Type any email to start. We'll email you a 6-digit code."
                : "Type your email — we'll send a 6-digit code. New here? We'll set you up."}
          </p>

          <form onSubmit={sendCode} className="space-y-3 text-sm mt-6">
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
              {pending ? "Sending code…" : "Send sign-in code"}
            </button>
          </form>

          <p className="text-2xs text-ink-400 mt-4 text-center">
            No password — just a code. New users get an account
            automatically.{" "}
            <span className="text-ink-500">30-day Pro trial, no card.</span>
          </p>
        </div>

        {/* Demo workspace — only in mock mode + not for invited users */}
        {env.useMockApi && !inviteToken && (
          <button
            onClick={tryDemo}
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
