import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  TrendingUp,
  Plug,
  ShieldCheck,
  AlertTriangle,
  Mail,
} from "lucide-react";
import { OnboardingShell } from "../../components/OnboardingShell";
import { updateSession } from "../../data/session";
import { useStore } from "../../data/store";

/**
 * Onboarding done. The proof-of-Day-1 moment.
 *
 * Two jobs:
 *   1. Show what just lit up (real numbers from the store, not promises)
 *   2. Set the AI-authority expectations *before* the CPA encounters them
 *      in the chase loop, so the green/yellow/red gradient feels familiar
 *      not surprising.
 *
 * Forever-no list (PRD §1.7): never apologize for cold start. The framing is
 * "here's what's already working," not "AI will get smarter."
 *
 * Internal vocabulary (Layer 1, Layer 2, etc.) lives in the spec but never
 * appears in user-facing copy here.
 */
export function OnboardingDone() {
  const navigate = useNavigate();
  const { clients, deadlines, announcements, aiInsights, tasks } = useStore();

  const stats = {
    clients: clients.filter((c) => c.status === "active").length,
    deadlines: deadlines.filter(
      (d) => d.status !== "completed" && d.status !== "filed_extension"
    ).length,
    activeAlerts: announcements.filter(
      (a) => !a.dismissed && a.affectedClientIds.length > 0
    ).length,
    insights: aiInsights.filter((i) => i.status === "open").length,
    forwardingAddresses: tasks.length,
  };

  const finish = () => {
    updateSession({ onboardingComplete: true });
    navigate("/", { replace: true });
  };

  return (
    <OnboardingShell
      step={3}
      totalSteps={3}
      estimate="done"
      title="You're set up."
      subtitle="Here's what just lit up — every number below is real, not a promise."
      brandLine="Connecting one more source (QuickBooks, Gmail, or a prior return) compounds the value. Never required, always optional."
    >
      <div className="space-y-5">
        {/* What's working */}
        <section className="bg-surface border border-line rounded-md overflow-hidden">
          <header className="px-5 py-3 border-b border-line bg-sunken/40">
            <div className="flex items-center gap-2">
              <CheckCircle2
                className="w-4 h-4 text-ok-solid"
                aria-hidden
              />
              <h3 className="text-sm font-semibold text-ink-900">
                Live now
              </h3>
              <span className="text-2xs text-ink-400 ml-auto">
                Day-1 substrate-driven
              </span>
            </div>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-line">
            <Stat
              n={stats.clients}
              label="Active clients"
              detail="Imported, validated, ready to triage."
            />
            <Stat
              n={stats.deadlines}
              label="Open deadlines"
              detail="Auto-generated from service packages + 50-state DB."
            />
            <Stat
              n={stats.activeAlerts}
              label="State alerts affecting you"
              detail="Already filtered to your portfolio. The wedge is live."
            />
            <Stat
              n={stats.forwardingAddresses}
              label="Per-task forwarding addresses"
              detail="Method A — every task has a unique inbound address."
            />
          </div>
          {stats.insights > 0 && (
            <div className="px-5 py-3 border-t border-line bg-info-bg/30 flex items-start gap-3">
              <TrendingUp
                className="w-3.5 h-3.5 text-info-ink mt-0.5"
                aria-hidden
              />
              <p className="text-xs text-info-ink">
                <span className="font-medium">
                  {stats.insights} advisory opportunit
                  {stats.insights === 1 ? "y" : "ies"} surfaced.
                </span>{" "}
                Cross-year pattern recognition is already running. Look for
                the "Advisory opportunities" section on your dashboard —
                that's the lever for moving from preparer to advisor.
              </p>
            </div>
          )}
        </section>

        {/* What to expect from AI — green/yellow/red gradient */}
        <section className="bg-surface border border-line rounded-md overflow-hidden">
          <header className="px-5 py-3 border-b border-line">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className="w-4 h-4 text-ink-700"
                aria-hidden
              />
              <h3 className="text-sm font-semibold text-ink-900">
                What to expect from AI
              </h3>
              <span className="text-2xs text-ink-400 ml-auto">
                How AI shows up across your work
              </span>
            </div>
            <p className="text-xs text-ink-500 mt-1">
              AI never makes decisions for you. It surfaces information you
              couldn't see before, faster.
            </p>
          </header>
          <ul className="divide-y divide-line">
            <ZoneRow
              tone="green"
              title="Green zone — AI acts, you can override"
              detail="Sorting tasks, suggesting reminder timing, classifying which checklist item an inbound document matches."
            />
            <ZoneRow
              tone="yellow"
              title="Yellow zone — AI proposes, you approve"
              detail="Email drafts, anomaly flags, advisory triggers, applying state alerts to client lists. Most of your daily UX lives here."
            />
            <ZoneRow
              tone="red"
              title="Red zone — AI never opines"
              detail="Tax owed, audit risk, legal interpretation, financial advice. Your professional judgment, not ours."
            />
          </ul>
          <footer className="px-5 py-2 text-2xs text-ink-400 bg-sunken/30 border-t border-line">
            We never auto-confirm a checklist item — every confirmation is
            your explicit click.
          </footer>
        </section>

        {/* What unlocks next */}
        <section className="bg-surface border border-line rounded-md overflow-hidden">
          <header className="px-5 py-3 border-b border-line">
            <h3 className="text-sm font-semibold text-ink-900">
              Connect one more source — optional, anytime
            </h3>
            <p className="text-xs text-ink-500 mt-1">
              Each connection unlocks new capabilities. The dashboard widget
              will resurface these on your own timeline — no rush.
            </p>
          </header>
          <ul className="divide-y divide-line">
            <UnlockRow
              icon={<Plug className="w-3.5 h-3.5" aria-hidden />}
              title="Connect QuickBooks"
              detail="Unlocks financial profiles for your clients — richer per-client signals begin forming. ~30 seconds of OAuth."
            />
            <UnlockRow
              icon={<AlertTriangle className="w-3.5 h-3.5" aria-hidden />}
              title="Upload one prior-year return"
              detail="One PDF activates cross-year insights and per-client timing. The biggest single capability unlock."
            />
            <UnlockRow
              icon={<Mail className="w-3.5 h-3.5" aria-hidden />}
              title="Connect Gmail or Outlook"
              detail="Inbound replies route automatically and your draft emails sound like you, not like a template."
            />
          </ul>
        </section>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={finish}
            className="text-sm px-5 py-2 rounded-md bg-accent text-canvas hover:bg-accent-hover"
          >
            Open dashboard
          </button>
          <p className="text-xs text-ink-500">
            Total elapsed: well under 5 minutes. Median triage session target:
            3-5 minutes.
          </p>
        </div>
      </div>
    </OnboardingShell>
  );
}

function Stat({
  n,
  label,
  detail,
}: {
  n: number;
  label: string;
  detail: string;
}) {
  return (
    <div className="bg-surface px-5 py-4">
      <p className="text-3xl font-semibold text-ink-900 tabular-nums">{n}</p>
      <p className="text-xs uppercase tracking-wider text-ink-500 font-semibold mt-1">
        {label}
      </p>
      <p className="text-xs text-ink-500 mt-1">{detail}</p>
    </div>
  );
}

function ZoneRow({
  tone,
  title,
  detail,
}: {
  tone: "green" | "yellow" | "red";
  title: string;
  detail: string;
}) {
  const styles =
    tone === "green"
      ? "bg-ok-bg text-ok-ink border-ok-border"
      : tone === "yellow"
      ? "bg-warn-bg text-warn-ink border-warn-border"
      : "bg-danger-bg text-danger-ink border-danger-border";
  return (
    <li className="px-5 py-3 flex items-start gap-3">
      <span
        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
          tone === "green"
            ? "bg-ok-solid"
            : tone === "yellow"
            ? "bg-warn-solid"
            : "bg-danger-solid"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-900 flex items-center gap-2">
          <span
            className={`text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded border ${styles}`}
          >
            {tone}
          </span>
          {title.replace(/^.*?— /, "")}
        </p>
        <p className="text-xs text-ink-500 mt-1">{detail}</p>
      </div>
    </li>
  );
}

function UnlockRow({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <li className="px-5 py-3 flex items-start gap-3">
      <span className="w-6 h-6 rounded-full bg-sunken border border-line flex items-center justify-center text-ink-700 shrink-0 mt-0.5">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-900">{title}</p>
        <p className="text-xs text-ink-500 mt-0.5">{detail}</p>
      </div>
    </li>
  );
}
