import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, ArrowLeft } from "lucide-react";
import {
  AuthShell,
  AuthField,
  AuthInput,
  PrimaryButton,
  FormError,
} from "./AuthShell";
import { env } from "../../config";
import { supabase } from "../../lib/supabase";
import { signIn } from "../../data/session";
import { actions } from "../../data/store";

/**
 * /magic-link is the legacy passwordless route. The unified flow now lives at
 * /login (sign in) and /signup (new account). This route stays in App.tsx to
 * avoid 404s from old emails or bookmarks.
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
        mockSignIn();
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
        setError(error.message);
        return;
      }
      setStep("code");
    } finally {
      setPending(false);
    }
  };

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
            setError(null);
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

        <p className="text-2xs text-ink-400 mt-8 pt-6 border-t border-line">
          Didn't get it? Check spam, or{" "}
          <button
            onClick={() => sendCode(new Event("submit") as unknown as React.FormEvent)}
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

  return (
    <AuthShell
      title="Sign in with a link"
      subtitle="We'll email you a one-tap sign-in link. No password to remember."
      footer={
        <Link to="/login" className="text-indigo font-medium hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      <form onSubmit={sendCode} className="space-y-5">
        <AuthField label="Work email">
          <AuthInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourfirm.com"
            autoFocus
          />
        </AuthField>

        {error && <FormError>{error}</FormError>}

        <PrimaryButton type="submit" loading={pending} disabled={!email}>
          {pending ? "Sending" : "Send sign-in link"}
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
