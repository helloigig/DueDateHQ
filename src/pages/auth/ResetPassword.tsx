import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { trpc } from "../../lib/api/client";
import { resetPasswordSchema } from "../../types/schemas";
import {
  AuthShell,
  AuthField,
  AuthInput,
  PrimaryButton,
  FormError,
} from "./AuthShell";
import { env } from "../../config";
import { supabase } from "../../lib/supabase";

export function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mockToken = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(env.useMockAuth);

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
          <Link to="/forgot-password" className="text-indigo hover:underline font-medium">
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
        <p className="text-sm text-ink-700 leading-relaxed">
          One moment — checking your reset link. If this hangs for more than
          a few seconds, the link may be expired or already used.{" "}
          <Link to="/forgot-password" className="text-indigo hover:underline font-medium">
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
      token: mockToken || "supabase-recovery",
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
        <Link to="/login" className="text-indigo font-medium hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <AuthField label="New password">
          <AuthInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </AuthField>
        <AuthField label="Confirm new password" error={error ?? undefined}>
          <AuthInput
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </AuthField>

        {error && <FormError>{error}</FormError>}

        <PrimaryButton
          type="submit"
          loading={mockReset.isPending || pending}
          disabled={!password || !confirm}
        >
          {mockReset.isPending || pending ? "Saving" : "Update password"}
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
