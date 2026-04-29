import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import { trpc } from "../lib/api/client";
import { loginSchema } from "../types/schemas";
import { signIn } from "../data/session";
import { actions } from "../data/store";
import { authInputClass } from "./auth/AuthShell";
import { SsoButton } from "../components/SsoButton";
import { env } from "../config";
import { supabase } from "../lib/supabase";

/**
 * Sign-in — simplified to email + password (the firm is implicit from the
 * account, not a field).
 *
 * Two untraditional affordances kept prominent:
 *  - "Try the demo workspace" — for prospects who don't want to commit. Loads
 *    the seed data (49 clients + alerts + prior facts) under a demo session.
 *    PRD §3.17 onboarding option C.
 *  - "Create a firm" CTA — first-class, not buried.
 *
 * SSO is intentionally absent (Phase 2 for Team tier per PRD §7.3 SOC 2 path).
 */
export function Login() {
  const navigate = useNavigate();
  // Pre-fill the demo email + password ONLY in mock mode. In real mode the
  // login goes to Supabase Auth, so these fake creds would just produce a
  // wall of "invalid credentials" errors. Real mode starts empty.
  const [email, setEmail] = useState(env.useMockApi ? "sarah@mitchellcpa.com" : "");
  const [password, setPassword] = useState(env.useMockApi ? "demo" : "");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const trpcUtils = trpc.useUtils();
  const [pending, setPending] = useState(false);

  // Mock-mode login goes through the FE's mock adapter via trpc.auth.login.
  // Real mode uses Supabase Auth directly (the BE doesn't expose auth.login —
  // Supabase mints the JWT, the BE just verifies it). After either path, the
  // SessionProvider re-queries auth.session and routes the user.
  const mockLogin = trpc.auth.login.useMutation({
    onSuccess: () => {
      signIn({
        firmName: "Mitchell CPA",
        userName: "Sarah Mitchell",
        userEmail: email,
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
        setSubmitError(error.message);
        return;
      }
      // JWT now persisted by supabase-js. Pull fresh session from BE — if the
      // user hasn't bootstrapped a firm yet, this returns null and we route
      // to /onboarding/firm. Otherwise we have a real session and go home.
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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const flat: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as "email" | "password";
        if (!flat[k]) flat[k] = issue.message;
      }
      setErrors(flat);
      return;
    }
    if (env.useMockApi) {
      mockLogin.mutate(parsed.data);
    } else {
      void realLogin(parsed.data);
    }
  };

  const tryDemo = () => {
    // Reset to seeds + sign in as Sarah with onboarding pre-completed,
    // so the prospect lands directly on the dashboard.
    actions.resetToSeeds();
    signIn({
      firmName: "Mitchell CPA (demo)",
      userName: "Sarah Mitchell",
      userEmail: "demo@duedatehq.com",
      tier: "pro",
    });
    // Persist the onboardingComplete flag so they skip the wizard.
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

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-surface border border-line rounded-md p-8">
          <Link to="/login" className="text-sm font-semibold text-ink-900">
            DueDateHQ
          </Link>
          <h1 className="text-2xl font-semibold text-ink-900 mt-6">Sign in</h1>
          <p className="text-sm text-ink-500 mt-1">
            {env.useMockApi
              ? "Demo workspace — credentials pre-filled. No real account needed."
              : "Welcome back."}
          </p>

          {/* SSO providers — wireframe shows the Phase 2 plan honestly.
              The same OAuth surface that powers Method B inbound (PRD §7.4)
              becomes the login. SAML SSO is Team-tier-only per PRD §7.3. */}
          <div className="mt-6 grid grid-cols-2 gap-2">
            <SsoButton provider="google" disabled />
            <SsoButton provider="microsoft" disabled />
          </div>
          <p className="text-2xs text-ink-400 mt-2">
            Sign-in with Google · Microsoft — Phase 2. Same OAuth that powers
            Method B inbound mail routing.
          </p>

          <div className="my-5 flex items-center gap-3">
            <span className="flex-1 h-px bg-line" />
            <span className="text-2xs uppercase tracking-wider text-ink-400">
              or with email
            </span>
            <span className="flex-1 h-px bg-line" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3 text-sm">
            <Field label="Email" error={errors.email}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={authInputClass}
                autoFocus
              />
            </Field>
            <Field label="Password" error={errors.password}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={authInputClass}
              />
            </Field>

            {submitError && (
              <div className="text-xs text-danger-ink bg-danger-bg border border-danger-border rounded px-3 py-2">
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <Link
                to="/forgot-password"
                className="text-xs text-ink-500 hover:text-ink-900"
              >
                Forgot password?
              </Link>
              <button
                type="submit"
                disabled={mockLogin.isPending || pending}
                className="text-sm px-4 py-1.5 rounded-md bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40"
              >
                {mockLogin.isPending || pending ? "Signing in…" : "Sign in"}
              </button>
            </div>
          </form>

          <p className="text-2xs text-ink-400 mt-4 pt-4 border-t border-line">
            <span className="font-medium text-ink-500">SAML SSO</span> ships with
            Team tier (Phase 2, gated on SOC 2 Type II).
          </p>
        </div>

        {/* Demo workspace — only in mock mode. Wires to localStorage seeds;
            meaningless against a real backend, so we hide it then. */}
        {env.useMockApi && (
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

        <p className="text-xs text-ink-500 mt-6 text-center">
          New to DueDateHQ?{" "}
          <Link to="/signup" className="text-ink-900 underline">
            Create a firm
          </Link>
          {" "}— 30-day trial, no credit card.
        </p>
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
