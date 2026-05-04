import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  ShieldCheck,
  Sparkles,
  Inbox,
  ArrowLeft,
} from "lucide-react";
import { signIn } from "../../data/session";
import { actions } from "../../data/store";
import {
  AuthField,
  AuthInput,
  AuthShell,
  BrandBar,
  FormError,
  HelpButton,
  InfoHint,
  PrimaryButton,
} from "./AuthShell";
import { env } from "../../config";
import { supabase } from "../../lib/supabase";

/**
 * Sign-UP — passwordless magic-link, first-time users only. Email → magic
 * link → click → /onboarding/firm.
 */
export function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "sent">("email");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function inferNames(emailValue: string) {
    const at = emailValue.indexOf("@");
    const local = at > 0 ? emailValue.slice(0, at) : "";
    const domain = at > 0 ? emailValue.slice(at + 1) : "";
    const userName = local
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const firmName = domain
      ? domain
          .split(".")[0]
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()) + " CPA"
      : "";
    return { userName, firmName };
  }

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

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!email.includes("@")) {
      setSubmitError("Enter a valid email.");
      return;
    }
    setPending(true);
    try {
      if (env.useMockAuth) {
        actions.resetToEmpty();
        const { userName, firmName } = inferNames(email);
        signIn({
          firmName: "_pending",
          userName: userName || (email.split("@")[0] ?? ""),
          userEmail: email,
          tier: "pro",
        });
        const raw = localStorage.getItem("duedatehq.session.v1");
        if (raw) {
          try {
            const s = JSON.parse(raw);
            s.onboardingComplete = false;
            s.suggestedFirmName = firmName;
            localStorage.setItem("duedatehq.session.v1", JSON.stringify(s));
          } catch {
            /* ignore */
          }
        }
        navigate("/onboarding/firm", { replace: true });
        return;
      }
      const { error } = await supabase().auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/onboarding/firm`,
        },
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("rate") || msg.includes("too many")) {
          setSubmitError(
            "Too many sign-up attempts in the last hour. Wait ~60 minutes or contact support.",
          );
        } else {
          setSubmitError(error.message);
        }
        return;
      }
      setStep("sent");
    } finally {
      setPending(false);
    }
  };

  if (step === "sent") {
    return (
      <AuthShell title="Check your email" subtitle={
        <>
          We sent a sign-up link to{" "}
          <span className="font-medium text-ink-900">{email}</span>. Click the
          link — we'll set up your firm in the next step.
        </>
      }>
        <button
          onClick={() => {
            setStep("email");
            setSubmitError(null);
          }}
          className="text-xs text-ink-500 hover:text-indigo inline-flex items-center gap-1 mb-6 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" aria-hidden /> Use a different email
        </button>

        <div className="flex items-center gap-3 bg-canvas border border-line rounded-md px-4 py-3">
          <span className="w-9 h-9 rounded-full bg-indigo-soft text-indigo flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4" aria-hidden />
          </span>
          <p className="text-sm text-ink-700 leading-snug">
            The link expires in 30 minutes. Onboarding picks up where you left off.
          </p>
        </div>

        {submitError && <div className="mt-4"><FormError>{submitError}</FormError></div>}

        <p className="text-2xs text-ink-400 mt-8 pt-6 border-t border-line">
          Didn't get it? Check spam, or{" "}
          <button
            onClick={() =>
              sendLink(new Event("submit") as unknown as React.FormEvent)
            }
            className="text-indigo hover:underline"
            disabled={pending}
          >
            {pending ? "resending…" : "resend the link"}
          </button>
          .
        </p>
      </AuthShell>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <BrandBar />
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Left — form */}
        <div className="flex items-start justify-center px-6">
          <div className="w-full max-w-md pt-16 pb-24">
            <header>
              <h1 className="text-display font-semibold text-ink-900 leading-tight">
                30 days free, then $49/mo
              </h1>
              <p className="text-sm text-ink-500 mt-2 leading-relaxed">
                We'll set up your firm workspace in the next step. Teammates
                join via invite later. No credit card; after day 30 you pay or
                your data goes read-only.
              </p>
            </header>

            <form onSubmit={sendLink} className="space-y-5 mt-8">
              <AuthField label="Work email">
                <AuthInput
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSubmitError(null);
                  }}
                  placeholder="you@yourfirm.com"
                  autoFocus
                />
              </AuthField>

              {/* Firm-already-exists detection (PRD: domain-based discovery) */}
              {knownDomain && (
                <InfoHint>
                  <p className="font-medium text-ink-900">
                    {knownDomain.firmName} already exists at this domain.
                  </p>
                  <p className="mt-1 text-info-ink">
                    Owner: {knownDomain.ownerName}.{" "}
                    <button
                      type="button"
                      onClick={() => alert("Request sent — wireframe stub")}
                      className="text-indigo font-medium hover:underline"
                    >
                      Request to join
                    </button>{" "}
                    or continue to create your own.
                  </p>
                </InfoHint>
              )}

              {submitError && <FormError>{submitError}</FormError>}

              <div>
                <PrimaryButton
                  type="submit"
                  disabled={!email}
                  loading={pending}
                >
                  {pending
                    ? "Sending link"
                    : env.useMockAuth
                      ? "Continue to firm setup"
                      : "Send sign-up link"}
                </PrimaryButton>
                <p className="text-2xs text-ink-400 mt-3">
                  By continuing you agree to the Terms and Privacy Policy.
                </p>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-line space-y-3 text-xs text-ink-500">
              <p>
                Joining an existing firm? Look for an invite email from your
                firm owner — the link takes you straight in.{" "}
                <Link to="/accept-invite" className="text-indigo font-medium hover:underline">
                  Lost the email?
                </Link>
              </p>
              <p>
                Already have an account?{" "}
                <Link to="/login" className="text-indigo font-medium hover:underline">
                  Sign in
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Right — Day-1 contract */}
        <div className="hidden lg:flex items-start justify-center bg-canvas border-l border-line px-10">
          <div className="w-full max-w-md pt-16 pb-24">
            <p className="text-2xs uppercase tracking-[0.18em] text-ink-500 font-semibold">
              What you get on Day 1
            </p>
            <h2 className="text-title font-semibold text-ink-900 mt-2 leading-snug">
              AI is useful right now — not someday.
            </h2>
            <p className="text-sm text-ink-500 mt-2 leading-relaxed">
              We don't apologize for cold start. The four substrates (entity,
              industry, state, cohort) make AI productive the minute your
              roster is in.
            </p>

            <ul className="mt-7 space-y-5">
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
              <p className="text-xs text-ink-500 leading-relaxed">
                <span className="font-medium text-ink-900">
                  30 days free, then $29–99/mo.
                </span>{" "}
                No card to start; you pay before day 31 or your data goes
                read-only. Counter to the annual-upfront model — we earn the
                conversion through usage, not credit-card capture.
              </p>
            </div>
          </div>
        </div>
      </main>
      <HelpButton />
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
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          accent
            ? "bg-warn-bg text-warn-ink border border-warn-border"
            : "bg-indigo-soft text-indigo",
        ].join(" ")}
      >
        {icon}
      </span>
      <div>
        <p className="text-sm font-medium text-ink-900">{title}</p>
        <p className="text-xs text-ink-500 mt-1 leading-relaxed">{detail}</p>
      </div>
    </li>
  );
}
