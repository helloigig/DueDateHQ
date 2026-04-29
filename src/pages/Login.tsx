import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, ArrowRight, ArrowLeft, Mail } from "lucide-react";
import { trpc } from "../lib/api/client";
import { loginSchema } from "../types/schemas";
import { signIn } from "../data/session";
import { actions } from "../data/store";
import { authInputClass } from "./auth/AuthShell";
import { env } from "../config";
import { supabase } from "../lib/supabase";

/**
 * Sign-in page — single-column shell.
 *
 * Auth ladder, in order of prominence:
 *   1. Email + 6-digit code (OTP) — primary, inline on this page. Why OTP
 *      instead of magic link: cross-device-safe (laptop sign-in, phone
 *      email), phishing-resistant (the code only works in the legit tab),
 *      familiar muscle memory from banking. Same Linear/Notion/Slack pattern.
 *   2. Password — secondary, collapsed under a "Use a password instead"
 *      details element. Still available because some firms have password
 *      managers and don't want to wait for an email.
 *   3. Demo workspace — shown only in mock mode; loads 49 fake clients
 *      under a wipeable demo session.
 *
 * Invited users (?invite=<token>) get a banner and a one-click jump to
 * /accept-invite/<token>; the "Create an account" footer link is hidden
 * because their path is "join the firm that invited you," not "spin up a
 * new firm."
 *
 * SAML / Google / Microsoft SSO live under Phase 2 (PRD §7.3) — not shown
 * until wired, because greyed-out buttons read as "broken."
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

  // Password mode — collapsed by default. Pre-fill demo creds in mock mode.
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState(env.useMockApi ? "demo" : "");
  const [pwEmail, setPwEmail] = useState(
    env.useMockApi ? "sarah@mitchellcpa.com" : "",
  );
  const [pwErrors, setPwErrors] = useState<{ email?: string; password?: string }>({});

  const trpcUtils = trpc.useUtils();
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  // ---------- OTP path (primary) ----------

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
        setSubmitError(error.message);
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
        // Mock: any 6-digit value succeeds. Treat first-time as a fresh
        // signup (lands in onboarding); demo email shortcut goes to demo.
        if (email === "demo@duedatehq.com" || email.endsWith("@duedatehq.com")) {
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
          // New user via OTP — empty store + go through onboarding
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
      // Invited user → land them on /accept-invite to bind to the firm
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

  // ---------- Password path (secondary) ----------

  const mockLogin = trpc.auth.login.useMutation({
    onSuccess: () => {
      signIn({
        firmName: "Mitchell CPA",
        userName: "Sarah Mitchell",
        userEmail: pwEmail,
        tier: "pro",
      });
      navigate("/", { replace: true });
    },
    onError: (err) => setSubmitError(err.message),
  });

  const realLogin = async (parsed: { email: string; password: string }) => {
    setPending(true);
    setSubmitError(null);
    try {
      const { error } = await supabase().auth.signInWithPassword(parsed);
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("email") && msg.includes("confirm")) {
          setSubmitError(
            "Check your inbox — you need to click the confirmation link before signing in.",
          );
        } else if (msg.includes("invalid") || msg.includes("credentials")) {
          setSubmitError("Email or password is wrong. Forgot it? Reset below.");
        } else {
          setSubmitError(error.message);
        }
        return;
      }
      await trpcUtils.auth.session.invalidate();
      const remote = await trpcUtils.auth.session.fetch();
      if (!remote) {
        signIn({
          firmName: "_pending",
          userName: parsed.email.split("@")[0] ?? "",
          userEmail: parsed.email,
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

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const parsed = loginSchema.safeParse({ email: pwEmail, password });
    if (!parsed.success) {
      const flat: typeof pwErrors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as "email" | "password";
        if (!flat[k]) flat[k] = issue.message;
      }
      setPwErrors(flat);
      return;
    }
    if (env.useMockApi) {
      mockLogin.mutate(parsed.data);
    } else {
      void realLogin(parsed.data);
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

  // ---------- Render ----------

  // Code-entry view — full screen replaces the form
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
          <h1 className="text-2xl font-semibold text-ink-900 mt-6">Sign in</h1>
          <p className="text-sm text-ink-500 mt-1">
            {inviteToken
              ? "You've been invited. Sign in to join the firm."
              : env.useMockApi
                ? "Demo workspace — type any email to start."
                : "Welcome back."}
          </p>

          {/* OTP — primary path */}
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

            <p className="text-2xs text-ink-400 text-center pt-1">
              We'll email you a 6-digit code. No password to remember.
            </p>
          </form>

          {/* Password — secondary path, collapsed */}
          <details
            className="mt-5 pt-5 border-t border-line"
            open={showPassword || undefined}
            onToggle={(e) => setShowPassword((e.target as HTMLDetailsElement).open)}
          >
            <summary className="text-xs text-ink-500 hover:text-ink-900 cursor-pointer list-none flex items-center gap-1.5">
              <span className="text-ink-400 group-open:rotate-90 transition-transform">›</span>
              Use a password instead
            </summary>
            <form onSubmit={submitPassword} className="space-y-3 text-sm mt-3">
              <Field label="Email" error={pwErrors.email}>
                <input
                  type="email"
                  value={pwEmail}
                  onChange={(e) => setPwEmail(e.target.value)}
                  className={authInputClass}
                />
              </Field>
              <Field label="Password" error={pwErrors.password}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={authInputClass}
                />
              </Field>
              <div className="flex items-center justify-between gap-2">
                <Link
                  to="/forgot-password"
                  className="text-xs text-ink-500 hover:text-ink-900"
                >
                  Forgot password?
                </Link>
                <button
                  type="submit"
                  disabled={mockLogin.isPending || pending}
                  className="text-sm px-4 py-1.5 rounded-md border border-line text-ink-700 hover:bg-sunken disabled:opacity-40"
                >
                  {mockLogin.isPending || pending ? "Signing in…" : "Sign in"}
                </button>
              </div>
            </form>
          </details>
        </div>

        {/* Demo workspace — only in mock mode */}
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
                  No account, no email — just see how it works.
                </p>
              </div>
              <ArrowRight
                className="w-4 h-4 text-ink-400 mt-2 group-hover:text-ink-900 transition-colors"
                aria-hidden
              />
            </div>
          </button>
        )}

        {/* Footer — invited users see a different prompt because their path
            is "join the firm that invited you," not "create a new firm". */}
        {inviteToken ? (
          <p className="text-xs text-ink-500 mt-6 text-center">
            Not the right account?{" "}
            <Link to="/login" className="text-ink-900 underline">
              Use a different email
            </Link>
          </p>
        ) : (
          <p className="text-xs text-ink-500 mt-6 text-center">
            New to DueDateHQ?{" "}
            <Link to="/signup" className="text-ink-900 underline">
              Create an account
            </Link>
            {" "}— 30-day trial, no credit card.
          </p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-700 mb-1 block">{label}</span>
      {children}
      {error && (
        <span className="text-2xs text-danger-ink mt-1 block">{error}</span>
      )}
    </label>
  );
}
