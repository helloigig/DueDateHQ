import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../../lib/api/client";
import { forgotPasswordSchema } from "../../types/schemas";
import { AuthShell, AuthField, authInputClass } from "./AuthShell";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const forgot = trpc.auth.forgotPassword.useMutation({
    onError: (err) => setError(err.message),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    forgot.mutate(parsed.data);
  };

  if (forgot.isSuccess) {
    return (
      <AuthShell title="Check your email">
        <p className="text-sm text-ink-700">
          If <span className="font-medium">{email}</span> matches an account,
          we just sent a password-reset link. The link expires in 30 minutes.
        </p>
        <Link
          to="/login"
          className="mt-4 inline-block text-sm text-ink-900 underline"
        >
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link. The link works once and expires fast."
      footer={
        <Link to="/login" className="text-ink-900 underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3 text-sm">
        <AuthField label="Email" error={error ?? undefined}>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            className={authInputClass}
            autoFocus
          />
        </AuthField>
        <button
          type="submit"
          disabled={forgot.isPending}
          className="w-full text-sm px-3 py-1.5 rounded-md bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40"
        >
          {forgot.isPending ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </AuthShell>
  );
}
