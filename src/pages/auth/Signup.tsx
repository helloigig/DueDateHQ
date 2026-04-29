import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  Mail,
  ShieldCheck,
  Sparkles,
  Inbox,
  Eye,
  EyeOff,
} from "lucide-react";
import { trpc } from "../../lib/api/client";
import { signupSchema, type SignupInput } from "../../types/schemas";
import { signIn } from "../../data/session";
import { authInputClass } from "./AuthShell";
import { SsoButton } from "../../components/SsoButton";

/**
 * Sign-up — minimum-viable entry: just email + password (or SSO). The firm
 * name, your name, plan tier, and states all happen in onboarding. We
 * pre-fill them from the email domain there. No duplicated input.
 *
 * Trial defaults to Pro. The user can downgrade to Solo / upgrade to Team
 * in Settings → Billing once their roster is in.
 */
export function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof SignupInput, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const passwordStrength = scorePassword(password);

  // Pre-fill firm + name from email — happens at onboarding/firm.
  // Wireframe: detect a known domain so the "Request to join" UX shows.
  const knownDomain = (() => {
    const at = email.indexOf("@");
    if (at < 0) return null;
    const domain = email.slice(at + 1).trim().toLowerCase();
    if (!domain) return null;
    const KNOWN: Record<string, { firmName: string; ownerName: string }> = {
      "mitchellcpa.com": { firmName: "Mitchell CPA", ownerName: "Sarah Mitchell" },
    };
    return KNOWN[domain] ?? null;
  })();

  const signup = trpc.auth.signup.useMutation({
    onSuccess: () => {
      // Pre-fill placeholders; onboarding/firm fills the rest.
      const at = email.indexOf("@");
      const local = at > 0 ? email.slice(0, at) : "";
      const domain = at > 0 ? email.slice(at + 1) : "";
      const inferredName = local
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const inferredFirm = domain
        ? domain
            .split(".")[0]
            .replace(/[-_]+/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()) + " CPA"
        : "";
      signIn({
        firmName: inferredFirm,
        userName: inferredName,
        userEmail: email,
        tier: "pro",
      });
      navigate("/onboarding/firm", { replace: true });
    },
    onError: (err) => setSubmitError(err.message),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    // Use a small subset of the schema (email + password only) for now.
    const parsed = signupSchema.safeParse({
      email,
      password,
      firmName: "_pending",
      userName: "_pending",
      tier: "pro",
    });
    if (!parsed.success) {
      const flat: typeof errors = {};
      for (const issue of (parsed.error as z.ZodError).issues) {
        const k = issue.path[0] as keyof SignupInput;
        if (k === "email" || k === "password") flat[k] = issue.message;
      }
      setErrors(flat);
      return;
    }
    signup.mutate(parsed.data);
  };

  return (
    <div className="min-h-screen bg-canvas grid grid-cols-1 lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col justify-center p-8 lg:p-12">
        <div className="max-w-sm mx-auto w-full">
          <Link to="/login" className="text-sm font-semibold text-ink-900">
            DueDateHQ
          </Link>
          <p className="text-2xs uppercase tracking-wider text-ink-500 mt-8 font-semibold">
            Create your firm workspace
          </p>
          <h1 className="text-2xl font-semibold text-ink-900 mt-1">
            30 days free, then $49/mo
          </h1>
          <p className="text-sm text-ink-500 mt-2">
            Your account creates a firm workspace where you're the owner.
            Teammates join via invite later. No credit card to start; after
            day 30 you pay or your data goes read-only.
          </p>

          {/* SSO — Phase 2 affordance */}
          <div className="mt-6 grid grid-cols-2 gap-2">
            <SsoButton provider="google" disabled />
            <SsoButton provider="microsoft" disabled />
          </div>
          <div className="my-5 flex items-center gap-3">
            <span className="flex-1 h-px bg-line" />
            <span className="text-2xs uppercase tracking-wider text-ink-400">
              or with email
            </span>
            <span className="flex-1 h-px bg-line" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3 text-sm">
            <Field label="Email" error={errors.email}>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((er) => ({ ...er, email: undefined }));
                  setSubmitError(null);
                }}
                placeholder="you@yourfirm.com"
                className={authInputClass}
                autoFocus
              />
            </Field>
            <Field label="Password" error={errors.password}>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((er) => ({ ...er, password: undefined }));
                    setSubmitError(null);
                  }}
                  className={authInputClass + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-0.5"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-3.5 h-3.5" aria-hidden />
                  ) : (
                    <Eye className="w-3.5 h-3.5" aria-hidden />
                  )}
                </button>
              </div>
              <PasswordStrength score={passwordStrength} length={password.length} />
            </Field>

            {/* Firm-already-exists detection (PRD: domain-based discovery) */}
            {knownDomain && (
              <div className="text-xs bg-info-bg border border-info-border rounded px-3 py-2 text-info-ink">
                <p className="font-medium">
                  {knownDomain.firmName} already exists at this domain.
                </p>
                <p className="mt-0.5">
                  Owner: {knownDomain.ownerName}.{" "}
                  <button
                    type="button"
                    onClick={() => alert("Request sent — wireframe stub")}
                    className="underline hover:no-underline"
                  >
                    Request to join
                  </button>
                  {" "}or continue to create your own.
                </p>
              </div>
            )}

            {submitError && (
              <div className="text-xs text-danger-ink bg-danger-bg border border-danger-border rounded px-3 py-2">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={signup.isPending}
              className="w-full text-sm px-3 py-2 rounded-md bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40 mt-2"
            >
              {signup.isPending ? "Creating…" : "Continue → set up firm"}
            </button>
            <p className="text-2xs text-ink-400 text-center">
              By continuing you agree to the Terms and Privacy Policy.
            </p>
          </form>

          <div className="mt-6 pt-6 border-t border-line space-y-3">
            <details className="group">
              <summary className="text-xs text-ink-500 cursor-pointer hover:text-ink-900 list-none flex items-center gap-1.5">
                <span className="text-ink-400 group-open:rotate-90 transition-transform">›</span>
                Joining an existing firm? Enter an invite code
              </summary>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="6-character code from your firm owner"
                  maxLength={6}
                  className="flex-1 px-2.5 py-1.5 rounded border border-line bg-surface text-sm font-mono uppercase placeholder:text-ink-400 placeholder:font-sans placeholder:normal-case"
                />
                <button
                  type="button"
                  onClick={() => alert("Invite-code redemption stubbed in this wireframe build")}
                  className="text-xs px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-sunken"
                >
                  Redeem
                </button>
              </div>
              <p className="text-2xs text-ink-400 mt-1.5">
                Or use the link your firm owner emailed you. Both go to the
                same place.
              </p>
            </details>

            <p className="text-xs text-ink-500">
              Already have an account?{" "}
              <Link to="/login" className="text-ink-900 underline">
                Sign in
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Right — Day-1 contract */}
      <div className="hidden lg:flex flex-col justify-center bg-sunken/40 border-l border-line p-12">
        <div className="max-w-md mx-auto">
          <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
            What you get on Day 1
          </p>
          <h2 className="text-xl font-semibold text-ink-900 mt-2 leading-snug">
            AI is useful right now — not someday.
          </h2>
          <p className="text-sm text-ink-500 mt-2 max-w-sm">
            We don't apologize for cold start. The four substrates (entity,
            industry, state, cohort) make AI productive the minute your roster
            is in.
          </p>

          <ul className="mt-6 space-y-4">
            <Promise
              icon={<Sparkles className="w-3.5 h-3.5" aria-hidden />}
              title="50-state deadline database, federal forms covered"
              detail="100% accuracy on federal, 99%+ on state. Every deadline links to its official source."
            />
            <Promise
              icon={<ShieldCheck className="w-3.5 h-3.5" aria-hidden />}
              title="24-hour state-alert SLA — or your money back"
              detail="If we miss a state extension within 24 hours of official announcement and your client incurs a penalty, that month is credited."
              accent
            />
            <Promise
              icon={<Inbox className="w-3.5 h-3.5" aria-hidden />}
              title="Per-task forwarding emails, no OAuth required"
              detail="Every task gets a unique address like emily-1040-X7fK@duedatehq.com. Client docs route to the right place automatically."
            />
            <Promise
              icon={<Mail className="w-3.5 h-3.5" aria-hidden />}
              title="AI-drafted reminders, you review and send"
              detail="Mode D writes the chase emails grounded in the client's history and your voice. You stay in the loop on every send."
            />
          </ul>

          <div className="mt-8 pt-6 border-t border-line">
            <p className="text-xs text-ink-500">
              <span className="font-medium text-ink-900">
                30 days free, then $29–99/mo.
              </span>{" "}
              No card to start; you pay before day 31 or your data goes
              read-only. Counter to the annual-upfront model you're used to —
              we earn the conversion through usage, not credit-card capture.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  error,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-700 mb-1 block">{label}</span>
      {children}
      {hint && !error && (
        <span className="text-2xs text-ink-400 mt-1 block">{hint}</span>
      )}
      {error && (
        <span className="text-2xs text-danger-ink mt-1 block">{error}</span>
      )}
    </label>
  );
}

/**
 * 0-4 password score. Cheap heuristic — production should use zxcvbn.
 * 0: empty / too short. 1: weak. 2: ok. 3: strong. 4: very strong.
 */
function scorePassword(p: string): number {
  if (!p) return 0;
  if (p.length < 8) return 0;
  let score = 1;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (p.length >= 12) score = Math.min(4, score + 1);
  return Math.min(4, score);
}

function PasswordStrength({ score, length }: { score: number; length: number }) {
  if (length === 0) {
    return (
      <p className="text-2xs text-ink-400 mt-1">
        Minimum 8 characters. Mix in numbers and symbols for safety.
      </p>
    );
  }
  if (length < 8) {
    return (
      <p className="text-2xs text-warn-ink mt-1">
        {8 - length} more character{8 - length === 1 ? "" : "s"} needed.
      </p>
    );
  }
  const labels = ["—", "Weak", "OK", "Strong", "Very strong"];
  const colors = [
    "bg-line",
    "bg-warn-solid",
    "bg-warn-solid",
    "bg-ok-solid",
    "bg-ok-solid",
  ];
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i <= score ? colors[score] : "bg-line"
            }`}
          />
        ))}
      </div>
      <p
        className={`text-2xs mt-1 ${
          score >= 3
            ? "text-ok-ink"
            : score >= 2
            ? "text-warn-ink"
            : "text-warn-ink"
        }`}
      >
        Strength: {labels[score]}
      </p>
    </div>
  );
}

function Promise({
  icon,
  title,
  detail,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={[
          "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          accent
            ? "bg-warn-bg text-warn-ink border border-warn-border"
            : "bg-surface text-ink-700 border border-line",
        ].join(" ")}
      >
        {icon}
      </span>
      <div>
        <p className="text-sm font-medium text-ink-900">{title}</p>
        <p className="text-xs text-ink-500 mt-0.5">{detail}</p>
      </div>
    </li>
  );
}
