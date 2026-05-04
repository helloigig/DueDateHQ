import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { trpc } from "../../lib/api/client";
import { acceptInviteSchema } from "../../types/schemas";
import { signIn } from "../../data/session";
import {
  AuthShell,
  AuthField,
  AuthInput,
  PrimaryButton,
  FormError,
} from "./AuthShell";

interface InvitePreview {
  firmName: string;
  inviterName: string;
  role: "owner" | "member";
  email: string;
}

export function AcceptInvite() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const preview: InvitePreview | null = useMemo(() => {
    if (!token) return null;
    return {
      firmName: "Mitchell CPA",
      inviterName: "Sarah Mitchell",
      role: "member",
      email: "teammate@mitchellcpa.com",
    };
  }, [token]);

  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ userName?: string; password?: string }>(
    {}
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const accept = trpc.auth.acceptInvite.useMutation({
    onSuccess: () => {
      if (!preview) return;
      signIn({
        firmName: preview.firmName,
        userName,
        userEmail: preview.email,
        tier: "team",
      });
      navigate("/", { replace: true });
    },
    onError: (err) => setSubmitError(err.message),
  });

  if (!token || !preview) {
    return (
      <AuthShell title="Invite link missing or expired">
        <p className="text-sm text-ink-700 leading-relaxed">
          Ask your firm owner to send a fresh invitation, or{" "}
          <Link to="/login" className="text-indigo font-medium hover:underline">
            sign in
          </Link>{" "}
          if you already have an account.
        </p>
      </AuthShell>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const parsed = acceptInviteSchema.safeParse({ token, password, userName });
    if (!parsed.success) {
      const flat: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as "userName" | "password";
        if (!flat[k]) flat[k] = issue.message;
      }
      setErrors(flat);
      return;
    }
    accept.mutate(parsed.data);
  };

  return (
    <AuthShell
      title={`Join ${preview.firmName}`}
      subtitle={
        <>
          <span className="font-medium text-ink-900">{preview.inviterName}</span>{" "}
          invited you as <span className="font-medium text-ink-900">{preview.role}</span>.
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <AuthField label="Email">
          <AuthInput value={preview.email} disabled className="opacity-60" />
        </AuthField>
        <AuthField label="Your name" error={errors.userName}>
          <AuthInput
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Sam Castillo"
            autoFocus
          />
        </AuthField>
        <AuthField label="Password" hint="At least 8 characters." error={errors.password}>
          <AuthInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </AuthField>

        {submitError && <FormError>{submitError}</FormError>}

        <PrimaryButton
          type="submit"
          loading={accept.isPending}
          disabled={!userName || !password}
        >
          {accept.isPending ? "Joining" : "Accept and join"}
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
