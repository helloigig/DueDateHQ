import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { trpc } from "../../lib/api/client";
import { signupSchema, type SignupInput } from "../../types/schemas";
import { signIn } from "../../data/session";
import { AuthShell, AuthField, authInputClass } from "./AuthShell";

export function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState<SignupInput>({
    email: "",
    password: "",
    firmName: "",
    userName: "",
    tier: "solo",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SignupInput, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const signup = trpc.auth.signup.useMutation({
    onSuccess: () => {
      // Mock-mode shortcut: persist a local session immediately so the user
      // lands on the app. Real backend will rely on cookies + auth.session refetch.
      signIn({
        firmName: form.firmName,
        userName: form.userName,
        userEmail: form.email,
        tier: form.tier,
      });
      navigate("/", { replace: true });
    },
    onError: (err) => setSubmitError(err.message),
  });

  const update = <K extends keyof SignupInput>(key: K, val: SignupInput[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setSubmitError(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      const flat: typeof errors = {};
      for (const issue of (parsed.error as z.ZodError).issues) {
        const k = issue.path[0] as keyof SignupInput;
        if (!flat[k]) flat[k] = issue.message;
      }
      setErrors(flat);
      return;
    }
    signup.mutate(parsed.data);
  };

  return (
    <AuthShell
      title="Create your firm"
      subtitle="No credit card. 14-day trial across all tiers."
      footer={
        <span>
          Already have an account?{" "}
          <Link to="/login" className="text-ink-900 underline">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3 text-sm">
        <AuthField label="Firm name" error={errors.firmName}>
          <input
            value={form.firmName}
            onChange={(e) => update("firmName", e.target.value)}
            className={authInputClass}
            autoFocus
          />
        </AuthField>
        <AuthField label="Your name" error={errors.userName}>
          <input
            value={form.userName}
            onChange={(e) => update("userName", e.target.value)}
            className={authInputClass}
          />
        </AuthField>
        <AuthField label="Email" error={errors.email}>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className={authInputClass}
          />
        </AuthField>
        <AuthField label="Password (min 8 chars)" error={errors.password}>
          <input
            type="password"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
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
          disabled={signup.isPending}
          className="w-full text-sm px-3 py-1.5 rounded-md bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40"
        >
          {signup.isPending ? "Creating…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
