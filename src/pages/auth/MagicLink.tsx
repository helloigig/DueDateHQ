import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, ArrowLeft } from "lucide-react";
import { authInputClass } from "./AuthShell";
import { env } from "../../config";
import { supabase } from "../../lib/supabase";
import { signIn } from "../../data/session";
import { actions } from "../../data/store";
import { trpc } from "../../lib/api/client";

/**
 * Passwordless sign-in via email OTP — the primary auth path.
 *
 * Two-step flow:
 *   1. User types email → we call Supabase signInWithOtp, which emails them
 *      a 6-digit code AND a magic-link URL. Either works.
 *   2. User types the code back into the app → we verify it via
 *      verifyOtp({ type: "email" }) and they're in.
 *
 * Why OTP code, not magic link as primary:
 *   - Cross-device safe (laptop sign-in, phone email, no clicking in the
 *     wrong device's browser)
 *   - Phishing-resistant (the code only works if you enter it in the
 *     legit tab — magic links can be ridden by attackers who intercept
 *     the URL)
 *   - Faster on mobile (paste 6 digits vs tap link → opens browser →
 *     extra round-trip)
 *   - Familiar muscle memory (bank, brokerage, Stripe Express all use it)
 *
 * The route is still /magic-link for URL stability; the form is OTP-first
 * but the email also contains a clickable link, so users who prefer that
 * path can still use it.
 *
 * In mock mode this is a sham: pressing "Send code" + entering any 6-digit
 * value signs them in as a demo Sarah. Useful for testing without Supabase.
 */
export function MagicLink() {
  const navigate = useNavigate();
  const trpcUtils = trpc.useUtils();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the code input when we move to step 2
  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) {
      setError("Enter a valid email.");
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
          // shouldCreateUser=true means this same flow handles signup. The
          // user goes through onboarding-firm bootstrap once verified.
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/onboarding/firm`,
        },
      });
      if (error) {
        setError(error.message);
        return;
      }
      setStep("code");
    } finally {
      setPending(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleaned = code.replace(/\D/g, "");
    if (cleaned.length !== 6) {
      setError("The code is 6 digits.");
      return;
    }
    setPending(true);
    try {
      if (env.useMockApi) {
        // Mock: any 6-digit value succeeds. Sign in as the email-localpart
        // user; reset to seeds so they get a populated demo.
        actions.resetToSeeds();
        signIn({
          firmName: "Mitchell CPA (demo)",
          userName: email.split("@")[0] ?? "you",
          userEmail: email,
          tier: "pro",
        });
        // Persist onboardingComplete so they land on dashboard, not wizard
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
      const { error } = await supabase().auth.verifyOtp({
        email,
        token: cleaned,
        type: "email",
      });
      if (error) {
        setError(error.message);
        return;
      }
      // JWT is now persisted by supabase-js. Pull fresh session from BE.
      await trpcUtils.auth.session.invalidate();
      const remote = await trpcUtils.auth.session.fetch();
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

  if (step === "code") {
    // Link-only path per UX feedback — skip the 6-digit OTP input entirely.
    // Users click the link in their email; SupabaseAuthBridge catches the
    // SIGNED_IN event on redirect and signs them in. Mock mode (which can't
    // send real emails) keeps the OTP fallback below for local testing.
    //
    // Build-time gate via import.meta.env.DEV instead of runtime env check —
    // Vite replaces this with literal `false` in prod builds, so the entire
    // OTP form below gets tree-shaken out. Guarantees prod cannot render
    // the OTP form regardless of misconfigured env vars or cache.
    if (!import.meta.env.DEV || !env.useMockApi) {
      return (
        <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-surface border border-line rounded-md p-8 text-center">
            <button
              onClick={() => {
                setStep("email");
                setError(null);
              }}
              className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 absolute"
            >
              <ArrowLeft className="w-3 h-3" aria-hidden /> Use a different email
            </button>
            <div className="w-14 h-14 rounded-full bg-info-bg border border-info-border flex items-center justify-center text-info-ink mx-auto mt-2">
              <Mail className="w-6 h-6" aria-hidden />
            </div>
            <h1 className="text-xl font-semibold text-ink-900 mt-5">
              Check your email
            </h1>
            <p className="text-sm text-ink-500 mt-2">
              We sent a sign-in link to{" "}
              <span className="font-medium text-ink-900">{email}</span>.
              Click the link to continue — you'll come back signed in.
            </p>

            <p className="text-2xs text-ink-400 mt-6 pt-4 border-t border-line">
              Didn't get it? Check spam, or{" "}
              <button
                onClick={() => sendCode(new Event("submit") as unknown as React.FormEvent)}
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
    // Mock-mode fallback — keeps the OTP form so local testing still works
    // without a real Supabase email send.
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-surface border border-line rounded-md p-8">
          <button
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" aria-hidden /> Use a different email
          </button>
          <div className="w-12 h-12 rounded-full bg-info-bg border border-info-border flex items-center justify-center text-info-ink mx-auto mt-3">
            <Mail className="w-5 h-5" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold text-ink-900 mt-4 text-center">
            Check your email (mock)
          </h1>
          <p className="text-sm text-ink-500 mt-2 text-center">
            Mock mode — type any 6 digits below to sign in as a demo user.
          </p>

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

            {error && (
              <div className="text-xs text-danger-ink bg-danger-bg border border-danger-border rounded px-3 py-2">
                {error}
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-surface border border-line rounded-md p-8">
          <Link
            to="/login"
            className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" aria-hidden /> Back to sign in
          </Link>
          <h1 className="text-2xl font-semibold text-ink-900 mt-3">
            Sign in with a code
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            We'll email you a 6-digit code. No password to remember.
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

            {error && (
              <div className="text-xs text-danger-ink bg-danger-bg border border-danger-border rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending || !email}
              className="w-full text-sm px-3 py-2 rounded-md bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40"
            >
              {pending ? "Sending…" : "Send sign-in code"}
            </button>
          </form>

          <p className="text-2xs text-ink-400 mt-4 pt-4 border-t border-line">
            Prefer a password?{" "}
            <Link to="/login" className="text-ink-900 underline">
              Sign in with password instead
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
