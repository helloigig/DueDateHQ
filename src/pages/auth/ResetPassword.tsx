import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { trpc } from "../../lib/api/client";
import { resetPasswordSchema } from "../../types/schemas";
import { AuthShell, AuthField, authInputClass } from "./AuthShell";
import { env } from "../../config";
import { supabase } from "../../lib/supabase";

export function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Mock mode uses ?token=...; real mode uses Supabase recovery (tokens in
  // URL hash, auto-consumed by supabase-js → onAuthStateChange).
  const mockToken = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(env.useMockAuth);

  // Real mode: wait for supabase-js to parse the URL hash. It fires
  // PASSWORD_RECOVERY when the recovery link is valid; we also fall back to
  // checking the current session in case the event has already fired
  // before this mount.
  useEffect(() => {
    if (env.useMockAuth) return;
    let active = true;
    void supabase().auth.getSession().then(({ data }) => {
      if (active && data.session) setRecoveryReady(true);
    });
    const { data: sub } = supabase().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const mockReset = trpc.auth.resetPassword.useMutation({
    onSuccess: () => navigate("/login", { replace: true }),
    onError: (err) => setError(err.message),
  });

  const realReset = async () => {
    setPending(true);
    setError(null);
    try {
      const { error: err } = await supabase().auth.updateUser({ password });
      if (err) {
        setError(err.message);
        return;
      }
      // Sign the user out so they re-authenticate with the new password —
      // also prevents the recovery session from masquerading as a normal
      // login afterward.
      await supabase().auth.signOut();
      navigate("/login", { replace: true });
    } finally {
      setPending(false);
    }
  };

  if (env.useMockAuth && !mockToken) {
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

  if (!env.useMockAuth && !recoveryReady) {
    return (
      <AuthShell title="Verifying reset link…">
        <p className="text-sm text-ink-700">
          One moment — checking your reset link. If this hangs for more than
          a few seconds, the link may be expired or already used.{" "}
          <Link to="/forgot-password" className="text-ink-900 underline">
            Request a new one
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
    const parsed = resetPasswordSchema.safeParse({
      token: mockToken || "supabase-recovery", // unused in real mode
      password,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid password");
      return;
    }
    if (env.useMockAuth) {
      mockReset.mutate(parsed.data);
    } else {
      void realReset();
    }
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
          disabled={mockReset.isPending || pending}
          className="w-full text-sm px-3 py-1.5 rounded-md bg-indigo text-white hover:bg-indigo-hover disabled:opacity-40"
        >
          {mockReset.isPending || pending ? "Saving…" : "Update password"}
        </button>
      </form>
    </AuthShell>
  );
}
