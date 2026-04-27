import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { trpc } from "../../lib/api/client";
import { resetPasswordSchema } from "../../types/schemas";
import { AuthShell, AuthField, authInputClass } from "./AuthShell";

export function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: () => navigate("/login", { replace: true }),
    onError: (err) => setError(err.message),
  });

  if (!token) {
    return (
      <AuthShell title="Reset link missing">
        <p className="text-sm text-ink-700">
          Open the link from your reset email or{" "}
          <Link to="/forgot-password" className="text-ink-900 underline">
            request a new one
          </Link>
          .
        </p>
      </AuthShell>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    const parsed = resetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid password");
      return;
    }
    reset.mutate(parsed.data);
  };

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="At least 8 characters."
      footer={
        <Link to="/login" className="text-ink-900 underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3 text-sm">
        <AuthField label="New password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
            autoFocus
          />
        </AuthField>
        <AuthField label="Confirm new password" error={error ?? undefined}>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={authInputClass}
          />
        </AuthField>
        <button
          type="submit"
          disabled={reset.isPending}
          className="w-full text-sm px-3 py-1.5 rounded-md bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40"
        >
          {reset.isPending ? "Saving…" : "Update password"}
        </button>
      </form>
    </AuthShell>
  );
}
