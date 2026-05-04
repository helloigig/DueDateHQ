import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../../lib/api/client";
import { forgotPasswordSchema } from "../../types/schemas";
import {
  AuthShell,
  AuthField,
  AuthInput,
  PrimaryButton,
  FormError,
} from "./AuthShell";
import { env } from "../../config";
import { supabase } from "../../lib/supabase";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  const mockForgot = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => setSuccess(true),
    onError: (err) => setError(err.message),
  });

  const realForgot = async (parsed: { email: string }) => {
    setPending(true);
    setError(null);
    try {
      const { error: err } = await supabase().auth.resetPasswordForEmail(
        parsed.email,
        { redirectTo: `${window.location.origin}/reset-password` },
      );
      if (err) {
        setError(err.message);
        return;
      }
      setSuccess(true);
    } finally {
      setPending(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    if (env.useMockAuth) {
      mockForgot.mutate(parsed.data);
    } else {
      void realForgot(parsed.data);
    }
  };

  if (success || mockForgot.isSuccess) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={
          <>
            If <span className="font-medium text-ink-900">{email}</span>{" "}
            matches an account, we just sent a password-reset link. The link
            expires in 30 minutes.
          </>
        }
      >
        <Link to="/login" className="text-sm text-indigo hover:underline font-medium">
          ← Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link. The link works once and expires fast."
      footer={
        <Link to="/login" className="text-indigo font-medium hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <AuthField label="Email" error={error ?? undefined}>
          <AuthInput
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="you@yourfirm.com"
            autoFocus
          />
        </AuthField>

        {error && !mockForgot.isPending && (
          <FormError>{error}</FormError>
        )}

        <PrimaryButton
          type="submit"
          loading={mockForgot.isPending || pending}
          disabled={!email}
        >
          {mockForgot.isPending || pending ? "Sending" : "Send reset link"}
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
