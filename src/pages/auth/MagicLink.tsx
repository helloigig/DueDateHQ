import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, ArrowLeft } from "lucide-react";
import { authInputClass } from "./AuthShell";
import { env } from "../../config";
import { supabase } from "../../lib/supabase";
import { signIn } from "../../data/session";
import { actions } from "../../data/store";

/**
 * Magic-link sign-in (passwordless). Secondary affordance to password — the
 * user types their email, we send a one-time link via Supabase signInWithOtp,
 * they click it from their inbox, supabase-js detects the URL hash on return,
 * and the SessionProvider routes them home or to onboarding.
 *
 * In mock mode this is a sham: pressing "Send" just signs them in as the
 * demo Sarah without sending any email. Useful for testing the form copy +
 * UX without a real Supabase project.
 */
export function MagicLink() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    setPending(true);
    try {
      if (env.useMockApi) {
        // Mock: simulate "sent email, user clicked it, signed in" — useful
        // for testing the post-magic-link onboarding flow end-to-end without
        // a real inbox.
        actions.resetToSeeds();
        signIn({
          firmName: "Mitchell CPA (demo)",
          userName: email.split("@")[0] ?? "you",
          userEmail: email,
          tier: "pro",
        });
        navigate("/", { replace: true });
        return;
      }
      const { error } = await supabase().auth.signInWithOtp({
        email,
        options: {
          // After the user clicks the email link, Supabase redirects them
          // back here with the session in the URL hash. supabase-js picks
          // it up via detectSessionInUrl=true.
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) {
        setError(error.message);
        return;
      }
      setSent(true);
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-surface border border-line rounded-md p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-info-bg border border-info-border flex items-center justify-center text-info-ink">
            <Mail className="w-5 h-5" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold text-ink-900 mt-4">
            Check your email
          </h1>
          <p className="text-sm text-ink-500 mt-2">
            We sent a one-time sign-in link to{" "}
            <span className="font-medium text-ink-900">{email}</span>. Click it
            from your inbox to continue. The link expires in 1 hour.
          </p>
          <p className="text-2xs text-ink-400 mt-6">
            Didn't get it? Check spam, or{" "}
            <button
              onClick={() => setSent(false)}
              className="underline hover:no-underline"
            >
              try a different email
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
            Sign in with email
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            We'll email you a one-time link. No password to remember.
          </p>

          <form onSubmit={send} className="space-y-3 text-sm mt-6">
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
              {pending ? "Sending…" : "Send sign-in link"}
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
