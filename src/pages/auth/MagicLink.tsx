import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, ArrowLeft } from "lucide-react";
import { authInputClass } from "./AuthShell";
import { env } from "../../config";
import { supabase } from "../../lib/supabase";
import { signIn } from "../../data/session";
import { actions } from "../../data/store";

/**
 * /magic-link is deprecated. The unified passwordless flow now lives at
 * /login (sign in) and /signup (new account). This route stays in App.tsx
 * to avoid 404s from old emails or bookmarks; it just redirects.
 */
export function MagicLink() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        // Mock: skip Supabase entirely — just sign the user in directly
        // (no real email goes out from local dev anyway).
        mockSignIn();
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

  // Mock-mode local-dev shortcut. Production sign-in flow is purely
  // link-based (SupabaseAuthBridge handles SIGNED_IN events).
  const mockSignIn = () => {
    if (!env.useMockApi) return;
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
  };

  if (step === "code") {
    // Link-only path. The OTP form is permanently removed — every previous
    // attempt to gate it (env.useMockApi, import.meta.env.DEV) failed to
    // tree-shake the dead branch. The simplest fix: there is no else.
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
