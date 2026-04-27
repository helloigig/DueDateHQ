import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trpc } from "../lib/api/client";
import { loginSchema } from "../types/schemas";
import { signIn, type FirmSession } from "../data/session";
import { AuthShell, AuthField, authInputClass } from "./auth/AuthShell";

const TIERS: Array<{ id: FirmSession["tier"]; label: string; hint: string }> = [
  { id: "solo", label: "Solo", hint: "1 user · up to 80 clients" },
  { id: "pro", label: "Pro", hint: "1 user · unlimited clients" },
  { id: "team", label: "Team", hint: "Up to 5 users · assignment" },
];

export function Login() {
  const navigate = useNavigate();
  const [firmName, setFirmName] = useState("Mitchell CPA");
  const [userName, setUserName] = useState("Sarah Mitchell");
  const [email, setEmail] = useState("sarah@mitchellcpa.com");
  const [password, setPassword] = useState("demo");
  const [tier, setTier] = useState<FirmSession["tier"]>("solo");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const login = trpc.auth.login.useMutation({
    onSuccess: () => {
      // Mock-mode: persist locally so AppShell sees a session.
      // Real backend will set HttpOnly cookies and the session hook refetches.
      signIn({ firmName, userName, userEmail: email, tier });
      navigate("/", { replace: true });
    },
    onError: (err) => setSubmitError(err.message),
  });

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
    login.mutate(parsed.data);
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Data persists to this browser only in the demo build."
      footer={
        <span>
          New here?{" "}
          <Link to="/signup" className="text-ink-900 underline">
            Create a firm
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3 text-sm">
        <AuthField label="Firm name">
          <input
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            className={authInputClass}
            autoFocus
          />
        </AuthField>
        <AuthField label="Your name">
          <input
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className={authInputClass}
          />
        </AuthField>
        <AuthField label="Email" error={errors.email}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
          />
        </AuthField>
        <AuthField label="Password" error={errors.password}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
          />
        </AuthField>
        <div>
          <span className="text-xs font-medium text-ink-700 mb-1 block">
            Plan tier
          </span>
          <div className="grid grid-cols-3 gap-2">
            {TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTier(t.id)}
                className={`text-left px-3 py-2 rounded border text-xs ${
                  tier === t.id
                    ? "bg-accent text-canvas border-accent"
                    : "bg-surface text-ink-700 border-line hover:bg-sunken"
                }`}
              >
                <div className="font-medium">{t.label}</div>
                <div
                  className={tier === t.id ? "text-canvas/80" : "text-ink-500"}
                >
                  {t.hint}
                </div>
              </button>
            ))}
          </div>
        </div>

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
            disabled={login.isPending}
            className="text-sm px-3 py-1.5 rounded-md bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40"
          >
            {login.isPending ? "Signing in…" : "Continue"}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
