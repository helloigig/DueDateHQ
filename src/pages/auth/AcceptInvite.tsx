import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { trpc } from "../../lib/api/client";
import { acceptInviteSchema } from "../../types/schemas";
import { signIn } from "../../data/session";
import { AuthShell, AuthField, authInputClass } from "./AuthShell";

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

  // Mock invite preview — backend will return this from a public lookup.
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
        <p className="text-sm text-ink-700">
          Ask your firm owner to send a fresh invitation, or{" "}
          <Link to="/login" className="text-ink-900 underline">
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
      subtitle={`${preview.inviterName} invited you as ${preview.role}.`}
    >
      <form onSubmit={onSubmit} className="space-y-3 text-sm">
        <AuthField label="Email">
          <input
            value={preview.email}
            disabled
            className={authInputClass + " opacity-60"}
          />
        </AuthField>
        <AuthField label="Your name" error={errors.userName}>
          <input
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className={authInputClass}
            autoFocus
          />
        </AuthField>
        <AuthField label="Password (min 8 chars)" error={errors.password}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
          />
        </AuthField>

        {submitError && (
          <div className="text-xs text-danger-ink bg-danger-bg border border-danger-border rounded px-3 py-2">
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={accept.isPending}
          className="w-full text-sm px-3 py-1.5 rounded-md bg-indigo text-white hover:bg-indigo-hover disabled:opacity-40"
        >
          {accept.isPending ? "Joining…" : "Accept and join"}
        </button>
      </form>
    </AuthShell>
  );
}
