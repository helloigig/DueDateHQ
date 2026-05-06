import { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import {
  Mail,
  Bell,
  User,
  Download,
  Upload,
  Users2,
  Trash2,
  Building2,
  Package,
  Plug,
  CreditCard,
  Zap,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Brain,
  TrendingDown,
  Sparkles,
  X as XIcon,
  Check,
  Plus,
  GitBranch,
  ArrowRight,
} from "lucide-react";
import { actions, useStore } from "../data/store";
import { useImportHistory } from "../hooks/useImports";
import { signOut, updateSession, useSession } from "../data/session";
import { trpc } from "../lib/api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErrorState } from "../components/ErrorState";
import { UpgradePrompt } from "../components/UpgradePrompt";
import { useFeatureFlags } from "../hooks/useFeatureFlags";
import {
  useReviewerQueue,
  useManualDetect,
  useApproveScraped,
  useRejectScraped,
} from "../hooks/useScraperReview";
import {
  useIntegrations,
  useIntegrationCatalog,
  useStartConnect,
  useDisconnect,
  useSyncNow,
} from "../hooks/useIntegrations";
import { useDriftReport, useAiStatus, useAiSummaryAll } from "../hooks/useDriftReport";
import { PriorYearUpload } from "../components/PriorYearUpload";
import { PwaInstallCard } from "../components/PwaInstallCard";
import {
  useReminderTemplates,
  useUpdateReminderTemplate,
} from "../hooks/useReminderTemplates";
import type { FirmSession } from "../data/session";
import { BUNDLES, type FilingBundle } from "../data/bundles";
import { ServicePackageModal } from "../components/ServicePackageModal";
import { useCustomBundles } from "../hooks/useCustomBundles";
import { useClients } from "../hooks/useClients";
import {
  useDependencyChains,
  type DependencyChain,
} from "../hooks/useDependencyChains";
import { DependencyChainEditor } from "../components/DependencyChainEditor";
import {
  computeEligibility,
  eligibilityLabel,
  type PhaseEligibility,
} from "../lib/phase2Eligibility";
import { SettingsFederalFormsPanel } from "./SettingsFederalFormsPanel";
import { PageContainer } from "../components/ui/PageContainer";
import { PageHeader } from "../components/ui/PageHeader";

const NAV = [
  { to: "/settings", label: "Account", icon: User, end: true },
  { to: "/settings/firm", label: "Firm", icon: Building2 },
  { to: "/settings/team", label: "Team", icon: Users2 },
  { to: "/settings/packages", label: "Service Packages", icon: Package },
  { to: "/settings/dependencies", label: "Dependencies", icon: GitBranch },
  { to: "/settings/reminders", label: "Reminder Templates", icon: Mail },
  { to: "/settings/integrations", label: "Integrations", icon: Plug },
  { to: "/settings/imports", label: "Imports", icon: Upload },
  { to: "/settings/billing", label: "Billing", icon: CreditCard },
  { to: "/settings/notifications", label: "Notifications", icon: Bell },
  { to: "/settings/alerts", label: "Alert digest", icon: Bell },
  { to: "/settings/ai", label: "AI eval", icon: Brain },
  { to: "/settings/federal-forms", label: "Federal forms", icon: ShieldCheck },
  { to: "/settings/data", label: "Data", icon: Download },
];

export function Settings() {
  return (
    <PageContainer variant="wide">
      <PageHeader title="Settings" />
      <div className="flex flex-col md:flex-row gap-card">
      <aside className="md:w-56 shrink-0">
        <nav className="flex md:flex-col gap-0.5 overflow-x-auto md:overflow-visible -mx-4 md:mx-0 px-4 md:px-0 pb-1 md:pb-0">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded text-sm whitespace-nowrap shrink-0 ${
                  isActive
                    ? "bg-sunken text-ink-900 font-medium"
                    : "text-ink-500 hover:bg-sunken hover:text-ink-900"
                }`
              }
            >
              <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        <Routes>
          <Route index element={<ProfilePanel />} />
          <Route path="firm" element={<FirmPanel />} />
          <Route path="packages" element={<ServicePackagesPanel />} />
          <Route path="dependencies" element={<DependenciesPanel />} />
          <Route path="reminders" element={<RemindersPanel />} />
          <Route path="integrations" element={<IntegrationsPanel />} />
          <Route path="billing" element={<BillingPanel />} />
          <Route path="alerts" element={<AlertsPanel />} />
          <Route path="notifications" element={<NotificationsPanel />} />
          <Route path="imports" element={<ImportsPanel />} />
          <Route path="team" element={<TeamPanel />} />
          <Route path="ai" element={<AiEvalPanel />} />
          <Route path="federal-forms" element={<SettingsFederalFormsPanel />} />
          <Route path="data" element={<DataPanel />} />
        </Routes>
      </div>
      </div>
    </PageContainer>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface border border-line rounded-md overflow-hidden mb-card">
      <header className="px-5 py-3 border-b border-line">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {description && (
          <p className="text-xs text-ink-500 mt-0.5">{description}</p>
        )}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 py-2 first:pt-0 last:pb-0">
      <dt className="w-40 shrink-0 text-xs uppercase tracking-wider text-ink-500 mt-0.5">
        {label}
      </dt>
      <dd className="text-sm text-ink-900 flex-1 min-w-0">{value}</dd>
    </div>
  );
}

function ProfilePanel() {
  const session = useSession();
  const navigate = useNavigate();
  if (!session) return null;

  const onSignOut = () => {
    // signOut handles the hard-reload to /login. No navigate needed —
    // a render between signOut and navigate can crash on stale state.
    void signOut();
  };

  const replayTour = () => {
    try {
      localStorage.removeItem("duedatehq.welcomeTour.dismissed.v1");
    } catch {
      /* ignore */
    }
    navigate("/");
  };

  return (
    <>
      <Card title="Profile" description="Your firm and user identity.">
        <dl>
          <Row label="Firm" value={session.firmName} />
          <Row label="Your name" value={session.userName} />
          <Row label="Email" value={session.userEmail} />
          <Row
            label="Plan"
            value={
              <span className="capitalize">
                {session.tier}
                <span className="ml-2 text-2xs text-ink-500">
                  {session.tier === "team"
                    ? "up to 5 users"
                    : session.tier === "pro"
                    ? "unlimited clients"
                    : "solo user"}
                </span>
              </span>
            }
          />
          <Row
            label="Signed in"
            value={new Date(session.signedInAt).toLocaleString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          />
        </dl>
      </Card>
      <Card
        title="Onboarding"
        description="Replay the first-run welcome banner and 60-second tour on the dashboard."
      >
        <button
          onClick={replayTour}
          className="text-sm px-3 py-1.5 rounded-md border border-line text-ink-700 hover:bg-sunken inline-flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" aria-hidden />
          Replay welcome tour
        </button>
      </Card>
      <Card title="Session">
        <button
          onClick={onSignOut}
          className="text-sm px-3 py-1.5 rounded-md border border-line text-ink-700 hover:bg-sunken"
        >
          Sign out
        </button>
      </Card>
    </>
  );
}

function AlertsPanel() {
  const session = useSession();
  const [digest, setDigest] = useState<FirmSession["digestMode"]>(
    session?.digestMode ?? "digest_8am"
  );
  if (!session) return null;

  const save = (next: FirmSession["digestMode"]) => {
    setDigest(next);
    updateSession({ digestMode: next });
  };

  return (
    <div className="space-y-6">
      <Card
        title="Alerts & email delivery"
        description="How state announcement alerts reach your inbox. In-app banners fire regardless."
      >
        <div className="space-y-2">
          <RadioRow
            checked={digest === "digest_8am"}
            onChange={() => save("digest_8am")}
            label="Daily 8am digest"
            hint="One email per morning with all state announcements from the last 24h."
          />
          <RadioRow
            checked={digest === "per_alert"}
            onChange={() => save("per_alert")}
            label="Per-alert email"
            hint="Email fires immediately when an announcement is detected."
          />
        </div>
        <p className="text-2xs text-ink-500 mt-4">
          SMS reminders are deferred to a later release — we won't half-build them.
        </p>
      </Card>

      <ReviewerQueueSection />
    </div>
  );
}

/**
 * Reviewer queue — low-confidence scraped notices waiting for human
 * approval before they project to firms. The "human review queue"
 * the architecture spec calls for, surfaced here in Settings → Alerts.
 *
 * Empty state is the most common — when the regex/LLM classifier is
 * confident, items skip review and go straight to firm projection.
 */
function ReviewerQueueSection() {
  const queue = useReviewerQueue();
  const detect = useManualDetect();
  const approve = useApproveScraped();
  const reject = useRejectScraped();
  const [feedback, setFeedback] = useState<string | null>(null);

  const onDetect = async () => {
    setFeedback(null);
    try {
      const result = await detect.mutateAsync();
      const newCount = result.new ?? 0;
      const lowConf = result.lowConfidence ?? 0;
      setFeedback(
        newCount > 0
          ? `Found ${newCount} new notice${newCount === 1 ? "" : "s"} (${lowConf} need review).`
          : "No new notices since last check.",
      );
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Detection failed — check logs.",
      );
    }
  };

  return (
    <Card
      title="Reviewer queue"
      description="State notices the scraper isn't confident about. Approve to project them to your firm; reject to discard."
    >
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={onDetect}
          disabled={detect.isPending}
          className="text-xs px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-sunken disabled:opacity-40"
        >
          {detect.isPending ? "Detecting…" : "Run detection now"}
        </button>
        <span className="text-2xs text-ink-500">
          The scraper runs hourly in the background — this triggers an extra
          cycle.
        </span>
      </div>
      {feedback && (
        <p className="text-2xs text-ink-700 bg-sunken/50 border border-line rounded px-2.5 py-1.5 mb-3">
          {feedback}
        </p>
      )}

      {queue.isLoading && (
        <p className="text-xs text-ink-500">Loading queue…</p>
      )}
      {queue.error && (
        <p className="text-xs text-danger-ink">
          Couldn't load queue: {queue.error.message}
        </p>
      )}
      {queue.data && queue.data.length === 0 && (
        <p className="text-xs text-ink-500">
          Queue is clear — no low-confidence notices waiting.
        </p>
      )}
      {queue.data && queue.data.length > 0 && (
        <ul className="divide-y divide-line border border-line rounded-md bg-canvas">
          {queue.data.map((row) => (
            <li key={row.id} className="px-3 py-2.5 flex items-start gap-3">
              <span className="text-2xs font-mono uppercase text-ink-500 w-9 shrink-0 mt-0.5">
                {row.stateCode}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-900">{row.title}</p>
                <p className="text-2xs text-ink-500 mt-0.5">
                  {row.authority}
                  {" · "}
                  {new Date(row.detectedAt).toLocaleDateString()}
                  {" · "}
                  <a
                    href={row.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-ink-900"
                  >
                    source
                  </a>
                </p>
                {row.summary && (
                  <p className="text-2xs text-ink-700 mt-1 line-clamp-2">
                    {row.summary}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => approve.mutate({ id: row.id })}
                  disabled={approve.isPending}
                  className="text-2xs px-2.5 py-1 rounded bg-ok-bg text-ok-ink border border-ok-border hover:bg-ok-bg/70 disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  onClick={() => reject.mutate({ id: row.id })}
                  disabled={reject.isPending}
                  className="text-2xs px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RadioRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded border cursor-pointer ${
        checked ? "border-accent bg-sunken" : "border-line hover:bg-sunken"
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-0.5"
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-ink-900">{label}</div>
        <div className="text-xs text-ink-500 mt-0.5">{hint}</div>
      </div>
    </label>
  );
}

/**
 * AI eval panel — drift detection over time, per mode.
 *
 * Reads aiInferences.driftReport for the selected mode (default A).
 * Shows:
 *   - Configured-or-not banner (BE reads ANTHROPIC_API_KEY)
 *   - Mode selector (only A and D will have data; B/C/E are
 *     deterministic so the BE doesn't log them)
 *   - Per-mode summary: latest acceptance + drift signal
 *   - 12-week sparkline of acceptance rates
 *   - Drift alert when latest week dropped >5pp below trailing mean
 *
 * Ops surface, not for everyday CPAs — sits in Settings → AI eval
 * for partners + ops to monitor model performance over time.
 */
const MODE_LABEL: Record<"A" | "B" | "C" | "D" | "E" | "F", string> = {
  A: "Classify inbound",
  B: "Predict timing",
  C: "Anomaly flags",
  D: "Draft emails",
  E: "Cross-year insights",
  F: "State announcements",
};

function AiEvalPanel() {
  const [mode, setMode] = useState<"A" | "B" | "C" | "D" | "E" | "F">("A");
  const status = useAiStatus();
  const drift = useDriftReport(mode);
  const summaryAll = useAiSummaryAll();

  const latest = drift.data?.weeks[drift.data.weeks.length - 1];
  const acceptancePct =
    latest?.acceptanceRate !== null && latest?.acceptanceRate !== undefined
      ? Math.round(latest.acceptanceRate * 100)
      : null;
  const driftPp =
    drift.data?.drift !== null && drift.data?.drift !== undefined
      ? Math.round(drift.data.drift * 100)
      : null;

  return (
    <div className="space-y-6">
      <Card
        title="AI configuration"
        description="Whether the backend has an Anthropic API key wired. Without it, AI procedures throw and the FE falls back to deterministic stubs."
      >
        {status.isLoading ? (
          <p className="text-sm text-ink-500">Checking…</p>
        ) : status.data?.configured ? (
          <p className="text-sm text-ok-ink inline-flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" aria-hidden />
            Anthropic configured. Inbound classification, email drafting, and
            scraper run on real Claude.
          </p>
        ) : (
          <div className="text-sm text-warn-ink bg-warn-bg/40 border border-warn-border rounded px-3 py-2">
            <p className="font-medium">AI not yet configured.</p>
            <p className="text-xs mt-1 text-warn-ink/90">
              Set <code className="font-mono">ANTHROPIC_API_KEY</code> in
              backend/.env.local to enable real Claude calls. Until then,
              classifications and email drafts use deterministic stubs.
            </p>
          </div>
        )}
      </Card>

      <Card
        title="AI capability eval"
        description="Acceptance / cost / latency for each AI capability over the firm's lifetime. Click a row for the time-series drift chart below. The single-letter ID stays for backend telemetry cross-reference."
      >
        {summaryAll.isLoading ? (
          <p className="text-sm text-ink-500">Loading capability summary…</p>
        ) : summaryAll.error ? (
          <p className="text-sm text-danger-ink">
            Couldn't load capability summary: {summaryAll.error.message}
          </p>
        ) : summaryAll.data ? (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-ink-500 uppercase tracking-wider">
                  <th className="text-left font-semibold px-2 py-1.5">Capability</th>
                  <th className="text-right font-semibold px-2 py-1.5">Calls</th>
                  <th className="text-right font-semibold px-2 py-1.5">Acted on</th>
                  <th className="text-right font-semibold px-2 py-1.5">Accept rate</th>
                  <th className="text-right font-semibold px-2 py-1.5">Cost</th>
                  <th className="text-right font-semibold px-2 py-1.5">p50 latency</th>
                  <th className="text-right font-semibold px-2 py-1.5">p95 latency</th>
                </tr>
              </thead>
              <tbody>
                {summaryAll.data.map((s) => {
                  const acceptPct =
                    s.acceptanceRate !== null
                      ? Math.round(s.acceptanceRate * 100)
                      : null;
                  return (
                    <tr
                      key={s.mode}
                      className={`border-t border-line cursor-pointer hover:bg-sunken/30 ${mode === s.mode ? "bg-sunken/40" : ""}`}
                      onClick={() => setMode(s.mode)}
                    >
                      <td className="px-2 py-2">
                        <span className="text-ink-900">{MODE_LABEL[s.mode]}</span>
                        <span
                          className="ml-2 text-2xs text-ink-400 font-mono"
                          title="Backend telemetry id"
                        >
                          {s.mode}
                        </span>
                      </td>
                      <td className="text-right tabular-nums px-2 py-2 text-ink-700">
                        {s.total}
                      </td>
                      <td className="text-right tabular-nums px-2 py-2 text-ink-500">
                        {s.actedOn}
                      </td>
                      <td className={`text-right tabular-nums px-2 py-2 font-medium ${
                        acceptPct === null
                          ? "text-ink-400"
                          : acceptPct >= 85
                            ? "text-ok-ink"
                            : acceptPct >= 70
                              ? "text-warn-ink"
                              : "text-danger-ink"
                      }`}>
                        {acceptPct === null ? "—" : `${acceptPct}%`}
                      </td>
                      <td className="text-right tabular-nums px-2 py-2 text-ink-500">
                        ${(s.totalCostCents / 100).toFixed(2)}
                      </td>
                      <td className="text-right tabular-nums px-2 py-2 text-ink-500">
                        {s.p50LatencyMs !== null ? `${s.p50LatencyMs}ms` : "—"}
                      </td>
                      <td className="text-right tabular-nums px-2 py-2 text-ink-500">
                        {s.p95LatencyMs !== null ? `${s.p95LatencyMs}ms` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Card
        title="Acceptance over time"
        description="What fraction of AI proposals you accept, bucketed by ISO week. Drift = latest week vs trailing 4-week mean. >5pp drop fires the alert below."
      >
        {/* Capability selector — six AI capabilities (state-monitor added in
            v0.8 amendment). Letter id is shown as a small font-mono suffix
            for engineer cross-reference with ai_inferences.mode. */}
        <div className="flex flex-wrap gap-1 mb-4">
          {(["A", "B", "C", "D", "E", "F"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={[
                "text-xs px-3 py-1 rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2",
                mode === m
                  ? "bg-ink-900 text-surface border-transparent font-medium"
                  : "border-line text-ink-500 hover:bg-sunken hover:text-ink-700",
              ].join(" ")}
            >
              {MODE_LABEL[m]}
              <span className="ml-1.5 text-2xs opacity-60 font-mono">
                {m}
              </span>
            </button>
          ))}
        </div>

        {drift.isLoading ? (
          <p className="text-sm text-ink-500">Loading drift report…</p>
        ) : drift.error ? (
          <p className="text-sm text-danger-ink">
            Couldn't load drift report: {drift.error.message}
          </p>
        ) : drift.data && drift.data.weeks.length === 0 ? (
          <p className="text-sm text-ink-500">
            No "{MODE_LABEL[mode]}" inferences logged yet. Once your firm
            starts confirming AI suggestions or sending drafts, this will
            populate.
          </p>
        ) : drift.data ? (
          <>
            {/* Headline numbers */}
            <div className="flex items-baseline gap-6 mb-4">
              <div>
                <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
                  Latest week
                </p>
                <p className="text-2xl font-semibold text-ink-900 tabular-nums mt-0.5">
                  {acceptancePct !== null ? `${acceptancePct}%` : "—"}
                </p>
                <p className="text-2xs text-ink-500 mt-0.5">
                  acceptance ({latest?.total ?? 0}{" "}
                  inference{latest?.total === 1 ? "" : "s"})
                </p>
              </div>
              <div>
                <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
                  Drift vs 4w mean
                </p>
                <p
                  className={[
                    "text-2xl font-semibold tabular-nums mt-0.5",
                    driftPp === null
                      ? "text-ink-400"
                      : driftPp < -5
                        ? "text-danger-ink"
                        : driftPp < 0
                          ? "text-warn-ink"
                          : "text-ok-ink",
                  ].join(" ")}
                >
                  {driftPp === null
                    ? "—"
                    : `${driftPp >= 0 ? "+" : ""}${driftPp}pp`}
                </p>
                <p className="text-2xs text-ink-500 mt-0.5">
                  {driftPp === null
                    ? "not enough history"
                    : driftPp < -5
                      ? "drift alert"
                      : "stable"}
                </p>
              </div>
            </div>

            {/* Drift alert callout */}
            {drift.data.alert && (
              <div className="bg-danger-bg/40 border border-danger-border rounded px-3 py-2.5 mb-4 flex items-start gap-2">
                <TrendingDown
                  className="w-4 h-4 text-danger-ink shrink-0 mt-0.5"
                  aria-hidden
                />
                <div className="text-xs text-danger-ink">
                  <p className="font-medium">Drift alert</p>
                  <p className="mt-0.5">
                    Latest acceptance dropped more than 5pp below the
                    trailing 4-week mean. "{MODE_LABEL[mode]}" may be
                    regressing — check recent inferences for misclassifications.
                  </p>
                </div>
              </div>
            )}

            {/* Sparkline — ASCII bars per week, calm + tabular */}
            <SparklineChart weeks={drift.data.weeks} />
          </>
        ) : null}
      </Card>

      <Card
        title="What gets logged"
        description="Every Anthropic call writes to ai_inferences with capability id + model + cost + latency + the input hash for grouping. CPA acceptance flips was_acted_on; this dashboard reads those flags."
      >
        <ul className="text-xs text-ink-500 space-y-1.5">
          <li>
            <span className="text-ink-700 font-medium">Classify inbound</span>
            <span className="text-ink-400 ml-1 font-mono text-2xs">A</span>{" "}
            — every inbound document. Logged on the BE inbound email handler.
          </li>
          <li>
            <span className="text-ink-700 font-medium">Draft emails</span>
            <span className="text-ink-400 ml-1 font-mono text-2xs">D</span>{" "}
            — every "Custom email…" click. Logged when the BE returns the
            draft.
          </li>
          <li>
            <span className="text-ink-700 font-medium">Scraper</span> — LLM
            lift on low-confidence regex hits. Logged under the anomaly
            capability (C) for now; promotes to its own capability id once
            volume justifies.
          </li>
          <li className="text-ink-400 italic mt-2">
            Predict timing, anomaly flags, and cross-year insights stay
            deterministic by design — their existing logic (history math,
            statistical anomaly, set-difference) is meaningful without an
            LLM round-trip.
          </li>
        </ul>
      </Card>
    </div>
  );
}

/**
 * Tiny sparkline — vertical bars per week, height proportional to
 * acceptance rate. 12 weeks max. Tabular numbers, no chart library.
 */
function SparklineChart({
  weeks,
}: {
  weeks: Array<{
    week: string;
    total: number;
    acceptanceRate: number | null;
  }>;
}) {
  return (
    <div>
      <div className="flex items-end gap-1 h-24 border-b border-line">
        {weeks.map((w) => {
          const h = w.acceptanceRate !== null ? w.acceptanceRate * 100 : 0;
          const isLatest = w === weeks[weeks.length - 1];
          return (
            <div
              key={w.week}
              className="flex-1 flex flex-col justify-end"
              title={`${w.week}: ${
                w.acceptanceRate !== null
                  ? `${Math.round(w.acceptanceRate * 100)}%`
                  : "no data"
              } (${w.total} inferences)`}
            >
              <div
                className={[
                  "rounded-t",
                  isLatest ? "bg-ink-900" : "bg-ink-300",
                ].join(" ")}
                style={{ height: `${Math.max(2, h * 0.95)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1">
        {weeks.map((w) => (
          <span
            key={w.week}
            className="flex-1 text-center text-2xs text-ink-400 font-mono tabular-nums truncate"
          >
            {w.week.split("-W")[1]}
          </span>
        ))}
      </div>
      <p className="text-2xs text-ink-400 mt-2">
        Week numbers (ISO). Hover a bar for the rate + inference count.
      </p>
    </div>
  );
}

function NotificationsPanel() {
  return (
    <div className="space-y-6">
      <DailyDigestCard />
      <AlertTriageCard />
      <Card
        title="In-app notifications"
        description="Controls what appears in the bell dropdown."
      >
        <p className="text-sm text-ink-500">
          All categories are enabled by default. Fine-grained toggles will appear
          here as we add notification types beyond state alerts and email
          bounces.
        </p>
      </Card>
    </div>
  );
}

/**
 * Settings card for the alert triage modal. The modal fires on first
 * /-page-land per browser session when there are state alerts that
 * arrived since the user's last_active_at and have at least one
 * matched client. Toggle off when it becomes noise — the freshness
 * chip in the Today page's "Alerts to act on today" section header
 * ("N new since last visit") continues to surface the same urgency
 * inline without the modal interruption.
 */
function AlertTriageCard() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.announcements.getTriageSettings.useQuery();
  const updateMut = trpc.announcements.updateTriageSettings.useMutation({
    onSuccess: () => void utils.announcements.getTriageSettings.invalidate(),
  });

  const enabled = settingsQuery.data?.enabled ?? true;

  return (
    <Card
      title="Triage on first land"
      description={
        enabled
          ? "When you land on Today, a modal surfaces any state alerts that arrived while you were away. Click into Alerts or dismiss to continue. The What-Changed banner on Today shows the same content non-modally regardless of this toggle."
          : "Off. New alerts since your last visit still appear as a banner on Today; we just don't open a modal."
      }
    >
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => updateMut.mutate({ enabled: e.target.checked })}
          disabled={updateMut.isPending}
          className="w-4 h-4"
        />
        <span className="text-ink-900 font-medium">
          Show triage modal on first land
        </span>
      </label>
    </Card>
  );
}

const DAY_LABELS: Array<{ key: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"; label: string }> = [
  { key: "mon", label: "M" },
  { key: "tue", label: "T" },
  { key: "wed", label: "W" },
  { key: "thu", label: "T" },
  { key: "fri", label: "F" },
  { key: "sat", label: "S" },
  { key: "sun", label: "S" },
];

/**
 * Settings card for the daily AM digest. Toggle, time-of-day picker,
 * day-of-week chips, and a "Send a preview now" button. Reads + writes
 * via `trpc.dailyDigest.*`. Recent runs are shown below the controls
 * so the user can verify the cron is firing without opening their inbox.
 */
function DailyDigestCard() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.dailyDigest.getSettings.useQuery();
  const recentRunsQuery = trpc.dailyDigest.listRecentRuns.useQuery();
  const updateMut = trpc.dailyDigest.updateSettings.useMutation({
    onSuccess: () => void utils.dailyDigest.getSettings.invalidate(),
  });
  const previewMut = trpc.dailyDigest.previewMyDigest.useMutation({
    onSuccess: () => void utils.dailyDigest.listRecentRuns.invalidate(),
  });

  const settings = settingsQuery.data;
  const [draft, setDraft] = useState<typeof settings | undefined>(settings);

  // Sync local draft state when the server returns. Without this, the
  // card renders the stale defaults the moment the query lands.
  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  if (!draft) {
    return (
      <Card title="Daily morning digest">
        <p className="text-sm text-ink-500">Loading…</p>
      </Card>
    );
  }

  const dirty =
    settings &&
    (settings.enabled !== draft.enabled ||
      settings.sendHour !== draft.sendHour ||
      JSON.stringify(settings.days) !== JSON.stringify(draft.days));

  const toggleDay = (key: (typeof DAY_LABELS)[number]["key"]) => {
    setDraft((d) =>
      d
        ? {
            ...d,
            days: d.days.includes(key)
              ? (d.days.filter((x) => x !== key) as typeof d.days)
              : ([...d.days, key] as typeof d.days),
          }
        : d,
    );
  };

  const recentRuns = recentRunsQuery.data ?? [];
  const lastSent = recentRuns.find((r) => r.status === "sent");

  return (
    <Card
      title="Daily morning digest"
      description={
        draft.enabled
          ? `Email summary of urgent tasks, new state alerts, and pending replies — sent at ${formatHour(draft.sendHour)} in your timezone on selected days. Skipped on quiet days.`
          : "Off. Turn on to get an email every morning summarizing what's urgent today."
      }
    >
      <div className="space-y-4">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) =>
              setDraft((d) => (d ? { ...d, enabled: e.target.checked } : d))
            }
            className="w-4 h-4"
          />
          <span className="text-ink-900 font-medium">Send me a morning digest</span>
        </label>

        {draft.enabled && (
          <div className="space-y-4 pl-7">
            <label className="block text-sm">
              <span className="text-2xs uppercase tracking-wider text-ink-500 font-semibold block mb-1.5">
                Send hour (your timezone)
              </span>
              <select
                value={draft.sendHour}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, sendHour: Number(e.target.value) } : d,
                  )
                }
                className="border border-line rounded px-2 py-1.5 text-sm bg-surface"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {formatHour(h)}
                  </option>
                ))}
              </select>
            </label>

            <div className="text-sm">
              <span className="text-2xs uppercase tracking-wider text-ink-500 font-semibold block mb-1.5">
                Days
              </span>
              <div className="flex gap-1">
                {DAY_LABELS.map((d) => {
                  const on = draft.days.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleDay(d.key)}
                      className={`w-9 h-9 rounded text-xs font-medium transition-colors ${
                        on
                          ? "bg-ink-900 text-white"
                          : "bg-surface border border-line text-ink-700 hover:bg-canvas"
                      }`}
                      aria-pressed={on}
                      aria-label={d.key}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => draft && updateMut.mutate(draft)}
            disabled={!dirty || updateMut.isPending}
            className="text-sm px-4 py-1.5 rounded bg-ink-900 text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            title={!dirty ? "No changes to save" : undefined}
          >
            {updateMut.isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => previewMut.mutate()}
            disabled={previewMut.isPending}
            className="text-sm px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-canvas disabled:opacity-40"
          >
            {previewMut.isPending ? "Sending…" : "Send a preview now"}
          </button>
          {previewMut.isSuccess && (
            <span className="text-xs text-ok-ink">
              Preview {previewMut.data.status === "sent" ? "sent" : previewMut.data.status}
            </span>
          )}
        </div>

        {recentRuns.length > 0 && (
          <div className="pt-4 border-t border-line">
            <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold mb-2">
              Recent sends
            </p>
            <ul className="text-xs text-ink-700 space-y-1">
              {recentRuns.slice(0, 7).map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <span className="font-mono text-ink-500 w-24 shrink-0">
                    {r.localDate}
                  </span>
                  <span className="w-20 shrink-0">
                    {r.status === "sent"
                      ? "✓ Sent"
                      : r.status === "skipped_quiet"
                        ? "Skipped (quiet)"
                        : r.status === "failed"
                          ? "Failed"
                          : r.status}
                  </span>
                  {r.status === "sent" && (
                    <span className="text-ink-500">
                      {r.urgentCount} urgent ·{" "}
                      {r.alertsCount} {r.alertsCount === 1 ? "alert" : "alerts"} ·{" "}
                      {r.repliesCount} {r.repliesCount === 1 ? "reply" : "replies"}
                    </span>
                  )}
                  {r.errorMessage && (
                    <span className="text-danger-ink truncate">
                      {r.errorMessage}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {!lastSent && (
              <p className="text-2xs text-ink-400 mt-2">
                No digests sent yet. Use "Send a preview now" to verify
                delivery, or wait for tomorrow's scheduled run.
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function formatHour(h: number): string {
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

function ImportsPanel() {
  const importHistoryQuery = useImportHistory();
  const imports = importHistoryQuery.data ?? [];
  const [confirming, setConfirming] = useState<string | null>(null);

  const active = useMemo(
    () => imports.filter((r) => r.status !== "undone"),
    [imports]
  );

  if (importHistoryQuery.isLoading) {
    return (
      <Card title="Imports">
        <p className="text-sm text-ink-500">Loading…</p>
      </Card>
    );
  }

  if (importHistoryQuery.error) {
    return (
      <Card title="Imports">
        <ErrorState
          compact
          title="Couldn't load import history."
          onRetry={() => importHistoryQuery.refetch()}
        />
      </Card>
    );
  }

  if (imports.length === 0) {
    return (
      <div className="space-y-6">
        <PriorYearUpload />
        <Card title="Imports">
          <p className="text-sm text-ink-500">
            No CSV imports yet. Try{" "}
            <NavLink to="/import" className="text-ink-900 underline">
              importing clients
            </NavLink>
            .
          </p>
        </Card>
      </div>
    );
  }

  const undoTarget = imports.find((r) => r.id === confirming);

  return (
    <>
      <PriorYearUpload />
      <Card
        title="Import history"
        description="Undo is available for 7 days after an import."
      >
        <ul className="divide-y divide-line -my-3">
          {imports.map((r) => {
            const recordedAt = r.committedAt ?? r.createdAt;
            const daysAgo = Math.floor(
              (Date.now() - new Date(recordedAt).getTime()) / 86_400_000
            );
            const undone = r.status === "undone";
            const undoable = !undone && daysAgo <= 7;
            return (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink-900 font-medium">
                    {r.clientsCreated} client
                    {r.clientsCreated === 1 ? "" : "s"} imported
                    {r.sourceFormat ? ` from ${r.sourceFormat}` : ""}
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {new Date(recordedAt).toLocaleString()} ·{" "}
                    {r.deadlinesCreated} deadline
                    {r.deadlinesCreated === 1 ? "" : "s"} generated
                    {r.rowsFailed > 0 && ` · ${r.rowsFailed} skipped`}
                    {undone && " · undone"}
                  </div>
                </div>
                <button
                  onClick={() => setConfirming(r.id)}
                  disabled={!undoable}
                  className="text-xs px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" aria-hidden />
                  {undone ? "Undone" : undoable ? "Undo" : "Expired"}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
      {active.length === 0 && (
        <p className="text-2xs text-ink-500 -mt-2">
          All imports have been undone.
        </p>
      )}
      <ConfirmDialog
        open={!!undoTarget}
        destructive
        title="Undo this import?"
        body={
          undoTarget ? (
            <>
              <p>
                This will remove{" "}
                <strong>{undoTarget.clientsCreated}</strong> client record
                {undoTarget.clientsCreated === 1 ? "" : "s"} and{" "}
                <strong>{undoTarget.deadlinesCreated}</strong> generated
                deadline{undoTarget.deadlinesCreated === 1 ? "" : "s"}.
              </p>
              <p className="mt-2 text-xs text-ink-500">
                Any notes or status changes made on those clients since import
                will be lost.
              </p>
            </>
          ) : null
        }
        confirmLabel="Undo import"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) actions.undoImport(confirming);
          setConfirming(null);
        }}
      />
    </>
  );
}

type TeamRole = "owner" | "admin" | "member" | "viewer";

const ROLE_DEF: Record<
  TeamRole,
  { label: string; tone: string; summary: string; details: string }
> = {
  owner: {
    label: "Owner",
    tone: "bg-ink-900 text-canvas",
    summary: "Full access · manages users + billing",
    details:
      "Edit firm settings, invite/remove teammates, change plan, edit service packages and reminder templates, all client + task data. The first signup is automatically the Owner.",
  },
  admin: {
    label: "Admin",
    tone: "bg-info-bg text-info-ink border border-info-border",
    summary: "Manages users · no billing",
    details:
      "All Member capabilities, plus invite/remove teammates and edit firm settings (service packages, reminder templates, federal-forms catalog reviewer). Cannot change the plan or update billing.",
  },
  member: {
    label: "Member",
    tone: "bg-sunken text-ink-700 border border-line",
    summary: "Full data access · cannot manage users or billing",
    details:
      "See and act on every client and task. Send reminders, confirm docs, resolve flags, edit reminder templates. Cannot invite teammates, change plan, or modify firm settings.",
  },
  viewer: {
    label: "Viewer",
    tone: "bg-canvas text-ink-500 border border-line",
    summary: "Read-only · audit trail consumer",
    details:
      "See client records, task progress, and the activity timeline. Cannot send emails, change states, edit templates, or invite teammates. Useful for auditors, advisors, or read-only stakeholders.",
  },
};

interface PendingInvite {
  id: string;
  email: string;
  role: TeamRole;
  /** Optional client-id allowlist — empty array = all clients (default).
   *  Phase 2 surface; only enforced once BE per-client ACL ships. */
  clientAllowlist: string[];
  invitedAt: string;
}

function TeamPanel() {
  const flags = useFeatureFlags();
  const session = useSession();
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [roleInput, setRoleInput] = useState<TeamRole>("member");
  const [accessMode, setAccessMode] =
    useState<"all_clients" | "specific_clients">("all_clients");
  const [allowlist, setAllowlist] = useState<Set<string>>(new Set());
  const clientsQuery = useClients();
  const allClients = clientsQuery.data?.items ?? [];

  if (!flags.canInviteTeammates) {
    return <UpgradePrompt feature="Team invites" requiredTier="pro" />;
  }

  const invite = () => {
    if (!emailInput.trim()) return;
    setPending((prev) => [
      {
        id: `inv-${Date.now()}`,
        email: emailInput.trim(),
        role: roleInput,
        clientAllowlist:
          accessMode === "specific_clients" ? Array.from(allowlist) : [],
        invitedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setEmailInput("");
    setAllowlist(new Set());
    setAccessMode("all_clients");
  };

  const revoke = (id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id));
  };

  const toggleClient = (id: string) =>
    setAllowlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <Card
        title="How collaboration works in DueDateHQ"
        description="The team model in one paragraph."
      >
        <div className="text-sm text-ink-700 space-y-2">
          <p>
            <span className="font-medium text-ink-900">Firm = workspace = tenant.</span>{" "}
            All clients, tasks, and deadlines live under your firm. Users are
            members of one firm at MVP (multi-firm comes later).
          </p>
          <p>
            <span className="font-medium text-ink-900">Each client has a relationship owner</span>{" "}
            (typically a partner). Each task has a <strong>preparer</strong>{" "}
            (does the work) and a <strong>reviewer</strong> (signs off — the
            §5.3 confirm). In solo firms all three are you. In small firms
            (2-5) the preparer is a junior CPA and the reviewer is a senior.
          </p>
          <p>
            <span className="font-medium text-ink-900">Coverage is implicit.</span>{" "}
            When a partner is on vacation, anyone can act on any task; the
            activity timeline records who did what for the audit pack. Filter
            the dashboard by assignee to see "what's on John's plate."
          </p>
          <p className="text-xs text-ink-500 pt-2">
            Coming in a later release: per-client access restrictions, formal
            handoff workflow (with auto-revert on return), and Specialist tags
            (international tax / S-corp / trust) for routing.
          </p>
        </div>
      </Card>

      <Card
        title="Roles"
        description="Four roles cover every collaboration shape. Owner ↔ Member is the default; Admin and Viewer are the new tiers for larger firms."
      >
        <ul className="divide-y divide-line">
          {(Object.keys(ROLE_DEF) as TeamRole[]).map((r) => {
            const def = ROLE_DEF[r];
            return (
              <li key={r} className="py-2.5 flex items-start gap-3">
                <span
                  className={`text-2xs uppercase tracking-wide px-2 py-0.5 rounded font-semibold mt-0.5 shrink-0 ${def.tone}`}
                >
                  {def.label}
                </span>
                <div className="flex-1 text-xs text-ink-700">
                  <p className="font-medium text-ink-900">{def.summary}</p>
                  <p className="text-ink-500 mt-0.5">{def.details}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-2xs text-ink-400 mt-3 pt-3 border-t border-line leading-relaxed">
          <span className="font-medium text-ink-700">Per-client access restrictions</span>{" "}
          (e.g., a Member who can only see clients in California): scoped per invite below.
          Server-side enforcement ships alongside; until then the UI scopes are advisory and
          the audit log records every access for review.
        </p>
      </Card>

      <Card
        title="Team members"
        description={`Invite up to ${flags.maxTeammates} teammate${
          flags.maxTeammates === 1 ? "" : "s"
        } and assign client ownership.`}
      >
        <ul className="divide-y divide-line">
          <li className="py-3 flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-accent text-canvas text-sm flex items-center justify-center font-medium">
              {session?.userInitials ?? "SM"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-900">
                {session?.userName ?? "You"}
              </p>
              <p className="text-xs text-ink-500">{session?.userEmail}</p>
            </div>
            <span className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-sunken text-ink-700 border border-line">
              Owner · you
            </span>
          </li>
        </ul>
      </Card>

      <Card
        title="Invite teammate"
        description="They'll get an email with a link to set their password and join."
      >
        <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-end">
          <Field label="Email">
            <input
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="teammate@firm.com"
              className="w-full h-9 bg-sunken border border-line rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 hover:border-line-strong"
            />
          </Field>
          <Field label="Role">
            <select
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value as TeamRole)}
              className="h-9 bg-surface border border-line rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 hover:border-line-strong"
            >
              {(Object.keys(ROLE_DEF) as TeamRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_DEF[r].label}
                </option>
              ))}
            </select>
          </Field>
          <button
            onClick={invite}
            disabled={!emailInput.trim()}
            className="text-sm px-3 py-1.5 rounded bg-indigo text-white hover:bg-indigo-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send invite
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-line">
          <p className="text-2xs uppercase tracking-wide text-ink-500 font-semibold mb-1.5">
            Client access scope
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setAccessMode("all_clients")}
              className={`text-xs px-2.5 py-1 rounded border ${
                accessMode === "all_clients"
                  ? "bg-info-bg text-info-ink border-info-border"
                  : "bg-surface border-line text-ink-700 hover:bg-sunken/40"
              }`}
            >
              All clients
            </button>
            <button
              type="button"
              onClick={() => setAccessMode("specific_clients")}
              className={`text-xs px-2.5 py-1 rounded border ${
                accessMode === "specific_clients"
                  ? "bg-info-bg text-info-ink border-info-border"
                  : "bg-surface border-line text-ink-700 hover:bg-sunken/40"
              }`}
            >
              Specific clients only ({allowlist.size})
            </button>
          </div>
          {accessMode === "specific_clients" && (
            <div className="mt-2 max-h-40 overflow-y-auto border border-line rounded bg-surface divide-y divide-line">
              {allClients.length === 0 ? (
                <p className="text-xs text-ink-500 italic px-3 py-2">
                  No clients yet — invite first, scope later.
                </p>
              ) : (
                allClients.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-sunken/40"
                  >
                    <input
                      type="checkbox"
                      checked={allowlist.has(c.id)}
                      onChange={() => toggleClient(c.id)}
                      className="w-3.5 h-3.5 accent-info-solid"
                    />
                    <span className="text-ink-900 font-medium">{c.name}</span>
                    <span className="text-ink-500">
                      · {c.entityType} · {c.primaryState}
                    </span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>
      </Card>

      {pending.length > 0 && (
        <Card
          title="Pending invites"
          description="They'll show up here until accepted or revoked."
        >
          <ul className="divide-y divide-line">
            {pending.map((p) => {
              const def = ROLE_DEF[p.role];
              return (
                <li
                  key={p.id}
                  className="py-2 flex items-center gap-3 text-sm flex-wrap"
                >
                  <Users2 className="w-4 h-4 text-ink-400 shrink-0" aria-hidden />
                  <span className="text-ink-900">{p.email}</span>
                  <span
                    className={`text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold ${def.tone}`}
                  >
                    {def.label}
                  </span>
                  {p.clientAllowlist.length > 0 ? (
                    <span
                      className="text-2xs px-1.5 py-0.5 rounded bg-warn-bg text-warn-ink border border-warn-border"
                      title={`Limited to ${p.clientAllowlist.length} clients`}
                    >
                      {p.clientAllowlist.length} client
                      {p.clientAllowlist.length === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="text-2xs text-ink-400">all clients</span>
                  )}
                  <span className="text-2xs text-ink-400 ml-auto">
                    {new Date(p.invitedAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => revoke(p.id)}
                    className="text-xs text-ink-500 hover:text-ink-900"
                  >
                    Revoke
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}

function DataPanel() {
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <>
      <Card
        title="Export all data"
        description="Download every client, deadline, and announcement as JSON."
      >
        <button
          onClick={() => {
            const blob = new Blob(
              [JSON.stringify(snapshot(), null, 2)],
              { type: "application/json" }
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "duedatehq-export.json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
          className="text-sm px-3 py-1.5 rounded-md border border-line text-ink-700 hover:bg-sunken"
        >
          Download JSON
        </button>
      </Card>

      <ExportHistoryCard />

      <Card
        title="Reset local data"
        description="Wipes your browser state and restores the demo seeds. Your firm profile stays."
      >
        <button
          onClick={() => setConfirmReset(true)}
          className="text-sm px-3 py-1.5 rounded-md bg-danger-solid text-canvas hover:bg-danger-ink"
        >
          Reset to demo seeds
        </button>
      </Card>
      <ConfirmDialog
        open={confirmReset}
        destructive
        title="Reset all local data?"
        body={
          <p>
            Clients, deadlines, notes, and activity you've created will be
            removed and replaced with the demo seed data.
          </p>
        }
        confirmLabel="Reset"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          actions.resetToSeeds();
          setConfirmReset(false);
        }}
      />
    </>
  );
}

/**
 * Export history — past export_runs row from the BE, ordered newest-first.
 * Surfaces async exports (CSV / PDF / etc.) initiated elsewhere in the
 * app so the CPA can re-download recent results instead of re-running.
 *
 * Wired to live BE: trpc.exports.list. Mock mode returns 4 example rows.
 */
function ExportHistoryCard() {
  const query = trpc.exports.list.useQuery();
  const rows = query.data ?? [];
  return (
    <Card
      title="Export history"
      description="Past async exports — CSV downloads, audit trails, etc. Click to re-download."
    >
      {query.isLoading ? (
        <p className="text-xs text-ink-500">Loading…</p>
      ) : query.error ? (
        <p className="text-xs text-danger-ink">
          Couldn't load — {query.error.message.slice(0, 80)}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-ink-500">
          No async exports yet. CSV downloads from Clients pages will appear
          here once they complete.
        </p>
      ) : (
        <ul className="divide-y divide-line text-xs">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-baseline gap-3 py-2 first:pt-0 last:pb-0"
            >
              <span className="text-ink-500 tabular-nums w-32 shrink-0">
                {formatExportDate(r.requestedAt)}
              </span>
              <span className="font-mono text-2xs uppercase tracking-wide text-ink-700 shrink-0">
                {r.kind.replace(/_/g, " ")}
              </span>
              <ExportStatusChip status={r.status} />
              <span className="ml-auto shrink-0">
                {r.status === "ready" && r.downloadUrl ? (
                  <a
                    href={r.downloadUrl}
                    download
                    className="text-info-ink hover:underline"
                  >
                    Download
                  </a>
                ) : r.status === "failed" ? (
                  <span
                    className="text-danger-ink"
                    title={r.errorMessage ?? undefined}
                  >
                    Failed
                  </span>
                ) : (
                  <span className="text-ink-400">Queued</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ExportStatusChip({
  status,
}: {
  status: "queued" | "ready" | "failed";
}) {
  const tones = {
    ready: "bg-ok-bg text-ok-ink",
    queued: "bg-sunken text-ink-500",
    failed: "bg-danger-bg text-danger-ink",
  } as const;
  return (
    <span
      className={`text-2xs px-1.5 py-0.5 rounded ${tones[status]} font-medium`}
    >
      {status}
    </span>
  );
}

function formatExportDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const ageMs = Date.now() - d.getTime();
  const hours = Math.floor(ageMs / 3_600_000);
  if (hours < 24) return hours < 1 ? "just now" : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function snapshot() {
  try {
    return JSON.parse(localStorage.getItem("duedatehq.store.v1") ?? "{}");
  } catch {
    return {};
  }
}

// -------- New v0.7 panels (IA §3.10-3.15) --------

function FirmPanel() {
  const session = useSession();
  const [firmName, setFirmName] = useState(session?.firmName ?? "");
  const [statesText, setStatesText] = useState(
    (session?.primaryStates ?? ["CA"]).join(", ")
  );
  const save = () => {
    updateSession({
      firmName,
      primaryStates: statesText
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    });
  };
  return (
    <>
      <Card title="Firm profile" description="Basic info shown in client emails and exports.">
        <div className="space-y-3">
          <Field label="Firm name">
            <input
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              className="w-full h-9 bg-sunken border border-line rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 hover:border-line-strong"
            />
          </Field>
          <Field label="Primary states served (comma-separated)">
            <input
              value={statesText}
              onChange={(e) => setStatesText(e.target.value)}
              className="w-full h-9 bg-sunken border border-line rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 hover:border-line-strong"
              placeholder="CA, NY, TX"
            />
          </Field>
          <Field label="Postal address (CAN-SPAM)">
            <input
              defaultValue="100 Market St, Suite 200, San Francisco, CA 94105"
              className="w-full h-9 bg-sunken border border-line rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 hover:border-line-strong"
            />
          </Field>
          <Field label="Time zone">
            <select className="h-9 bg-sunken border border-line rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 hover:border-line-strong">
              <option>America/Los_Angeles</option>
              <option>America/New_York</option>
              <option>America/Chicago</option>
              <option>America/Denver</option>
            </select>
          </Field>
          <button
            onClick={save}
            className="text-sm px-3 py-1.5 rounded bg-indigo text-white hover:bg-indigo-hover"
          >
            Save firm settings
          </button>
        </div>
      </Card>
      <Card title="Branding" description="Used on client-facing reminder emails (Pro+).">
        <Field label="Email signature">
          <textarea
            rows={3}
            defaultValue={`${session?.userName ?? "Sarah"}\n${session?.firmName ?? "Mitchell CPA"}`}
            className="w-full border border-line rounded px-2 py-1.5 text-sm font-sans"
          />
        </Field>
      </Card>
      {/* PWA install — self-gates when not installable / already installed,
          so the slot is invisible unless the prompt is genuinely available. */}
      <PwaInstallCard />
    </>
  );
}

function DependenciesPanel() {
  const { systemChains, customChains, upsert, remove } = useDependencyChains();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<DependencyChain | null>(null);
  const [isSystem, setIsSystem] = useState(false);

  const open = (chain: DependencyChain | null, systemFlag = false) => {
    setEditing(chain);
    setIsSystem(systemFlag);
    setEditorOpen(true);
  };

  return (
    <>
      <Card
        title="System chains"
        description="Pre-built relationships every firm gets Day-1. Click to inspect — they can't be edited (they encode the IRS-mandated waiting that's identical for every CPA)."
      >
        <ul className="divide-y divide-line">
          {systemChains.map((c) => (
            <ChainRow
              key={c.id}
              chain={c}
              onClick={() => open(c, true)}
              system
            />
          ))}
        </ul>
      </Card>

      <Card
        title="Custom chains"
        description='"Wait for X before Y" rules specific to your firm. The system enforces them across every applicable client.'
      >
        {customChains.length === 0 ? (
          <p className="text-sm text-ink-500">
            No custom chains yet.{" "}
            <button
              className="text-info-ink hover:underline"
              onClick={() => open(null)}
            >
              Add the first one
            </button>
            .
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {customChains.map((c) => (
              <ChainRow
                key={c.id}
                chain={c}
                onClick={() => open(c)}
              />
            ))}
          </ul>
        )}
        <div className="mt-3 pt-3 border-t border-line">
          <button
            onClick={() => open(null)}
            className="text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken"
          >
            <Plus className="w-3 h-3" aria-hidden />
            New dependency chain
          </button>
        </div>
      </Card>

      <DependencyChainEditor
        open={editorOpen}
        initial={editing ?? undefined}
        isSystemChain={isSystem}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
          setIsSystem(false);
        }}
        onSave={upsert}
        onDelete={remove}
      />
    </>
  );
}

function ChainRow({
  chain,
  onClick,
  system = false,
}: {
  chain: DependencyChain;
  onClick: () => void;
  system?: boolean;
}) {
  const refLabel = (r: { kind: string; ref: string }) => {
    if (!r.ref) return "—";
    if (r.kind === "form") return `Form ${r.ref}`;
    if (r.kind === "milestone") return r.ref.replace(/_/g, " ");
    return r.ref;
  };
  return (
    <li
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="py-3 -mx-5 px-5 flex items-start gap-3 cursor-pointer hover:bg-sunken/40 rounded"
    >
      <GitBranch
        className={`w-4 h-4 mt-0.5 ${system ? "text-ink-400" : "text-info-ink"}`}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-sm font-medium text-ink-900">{chain.name}</p>
          {!system && (
            <span className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-info-bg text-info-ink border border-info-border">
              Custom
            </span>
          )}
          <span
            className={`text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded ${
              chain.enforcement === "hard"
                ? "bg-warn-bg text-warn-ink border border-warn-border"
                : "bg-sunken text-ink-500 border border-line"
            }`}
          >
            {chain.enforcement}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-ink-700">
          <span className="px-1.5 py-0.5 rounded bg-sunken">
            {refLabel(chain.waitFor)}
          </span>
          <ArrowRight className="w-3 h-3 text-ink-400" aria-hidden />
          <span className="px-1.5 py-0.5 rounded bg-sunken">
            {refLabel(chain.blocks)}
          </span>
          {chain.bufferDays > 0 && (
            <span className="text-2xs text-ink-500">
              · {chain.bufferDays}d buffer
            </span>
          )}
        </div>
        {chain.description && (
          <p className="text-xs text-ink-500 mt-1">{chain.description}</p>
        )}
      </div>
    </li>
  );
}

function ServicePackagesPanel() {
  const { bundles: customBundles, upsert, remove } = useCustomBundles();
  const [modalState, setModalState] = useState<{
    open: boolean;
    mode: "view" | "edit" | "create";
    bundle?: FilingBundle;
    isSystem: boolean;
  }>({ open: false, mode: "view", isSystem: false });

  const closeModal = () =>
    setModalState((s) => ({ ...s, open: false }));

  const openView = (b: FilingBundle, isSystem: boolean) =>
    setModalState({ open: true, mode: "view", bundle: b, isSystem });
  const openEdit = (b: FilingBundle) =>
    setModalState({ open: true, mode: "edit", bundle: b, isSystem: false });
  const openCreate = () =>
    setModalState({ open: true, mode: "create", isSystem: false });

  return (
    <>
      <Card
        title="System packages"
        description="The 6 bundles ship with every firm Day-1. Click to preview, or clone to create a firm-custom version."
      >
        <ul className="divide-y divide-line">
          {BUNDLES.map((b) => (
            <li
              key={b.id}
              className="py-3 flex items-start gap-3 cursor-pointer hover:bg-sunken/40 -mx-5 px-5 rounded"
              onClick={() => openView(b, true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openView(b, true);
                }
              }}
            >
              <Package className="w-4 h-4 text-ink-400 mt-0.5" aria-hidden />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-900">{b.name}</p>
                <p className="text-xs text-ink-500 mt-0.5">{b.description}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {b.entityTypes.map((e) => (
                    <span
                      key={e}
                      className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-sunken text-ink-700"
                    >
                      {e}
                    </span>
                  ))}
                  <span className="text-2xs px-1.5 py-0.5 rounded text-ink-500 normal-case tracking-normal">
                    {b.templates.length}{" "}
                    {b.templates.length === 1 ? "filing" : "filings"}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openView(b, true);
                }}
                className="text-xs px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken shrink-0"
              >
                Preview
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title="Firm-custom packages"
        description="Tweak a system package or build one from scratch. Custom packages appear alongside system ones in AddDeadlineModal."
      >
        {customBundles.length === 0 ? (
          <p className="text-sm text-ink-500">
            No custom packages yet. Clone a system package above, or{" "}
            <button
              className="text-info-ink hover:underline"
              onClick={openCreate}
            >
              create one from scratch
            </button>
            .
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {customBundles.map((b) => (
              <li
                key={b.id}
                className="py-3 flex items-start gap-3 cursor-pointer hover:bg-sunken/40 -mx-5 px-5 rounded"
                onClick={() => openEdit(b)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openEdit(b);
                  }
                }}
              >
                <Package
                  className="w-4 h-4 text-info-ink mt-0.5"
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium text-ink-900">
                      {b.name}
                    </p>
                    <span className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-info-bg text-info-ink border border-info-border">
                      Custom
                    </span>
                  </div>
                  {b.description && (
                    <p className="text-xs text-ink-500 mt-0.5">
                      {b.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {b.entityTypes.map((e) => (
                      <span
                        key={e}
                        className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-sunken text-ink-700"
                      >
                        {e}
                      </span>
                    ))}
                    <span className="text-2xs px-1.5 py-0.5 rounded text-ink-500 normal-case tracking-normal">
                      {b.templates.length}{" "}
                      {b.templates.length === 1 ? "filing" : "filings"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(b);
                  }}
                  className="text-xs px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken shrink-0"
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 pt-3 border-t border-line">
          <button
            onClick={openCreate}
            className="text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken"
          >
            <Plus className="w-3 h-3" aria-hidden />
            New custom package
          </button>
        </div>
      </Card>

      <ServicePackageModal
        open={modalState.open}
        mode={modalState.mode}
        bundle={modalState.bundle}
        isSystemBundle={modalState.isSystem}
        onClose={closeModal}
        onSave={(b) => upsert(b)}
        onDelete={(id) => remove(id)}
      />
    </>
  );
}

function RemindersPanel() {
  const templates = useReminderTemplates();
  const update = useUpdateReminderTemplate();
  const session = useSession();
  const { emailDrafts, checklistItems } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = templates.find((t) => t.id === editingId) ?? null;

  // Per-template "used by N items" backlink (Yuqi audit 2026-05-05).
  // Builds AI trust by exposing the receipts: editing a template is no
  // longer like editing a void — the CPA sees how many active checklist
  // items would pick up the change. Match logic mirrors EmailDraftModal:
  // direct itemType first, then family fallback ("1099_int" → "1099_any").
  // Only counts items the client owes (not_requested + requested_waiting +
  // received_issue) — confirmed/n/a items aren't candidates for a chase
  // so including them would inflate the count.
  const usageByTemplateId = useMemo(() => {
    const out = new Map<string, number>();
    const pending = checklistItems.filter(
      (c) =>
        c.state === "not_requested" ||
        c.state === "requested_waiting" ||
        c.state === "received_issue",
    );
    for (const t of templates) {
      const tType = t.itemType;
      if (!tType) {
        out.set(t.id, 0);
        continue;
      }
      const family = tType.endsWith("_any") ? tType.split("_")[0] : null;
      const matchCount = pending.filter((ci) => {
        if (ci.itemType === tType) return true;
        if (family && ci.itemType.startsWith(`${family}_`)) return true;
        return false;
      }).length;
      out.set(t.id, matchCount);
    }
    return out;
  }, [templates, checklistItems]);

  // Compute eligibility once per render. Cheap — pure function over seed.
  const eligibilityById = useMemo(() => {
    const m = new Map<string, PhaseEligibility>();
    for (const t of templates) m.set(t.id, computeEligibility(t, emailDrafts));
    return m;
  }, [templates, emailDrafts]);

  const phase2Active = templates.filter((t) => t.phase === 2);
  const phase2Eligible = templates.filter(
    (t) => t.phase !== 2 && eligibilityById.get(t.id)?.eligible
  );
  const recentAutoSends = useMemo(
    () =>
      emailDrafts
        .filter((d) => d.sendMethod === "phase2_auto" && d.status === "sent")
        .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""))
        .slice(0, 5),
    [emailDrafts]
  );

  const paused = !!session?.phase2AutoSendPaused;
  const togglePause = () =>
    updateSession({ phase2AutoSendPaused: !paused });

  return (
    <>
      {/* Phase 2 status block — lives at the top of the Reminders page so
          the CPA always knows the auto-send state of their firm before
          they touch any template. */}
      <Phase2StatusCard
        paused={paused}
        onTogglePause={togglePause}
        activeCount={phase2Active.length}
        eligibleCount={phase2Eligible.length}
        autoSendsThisWeek={recentAutoSends.length}
      />

      <Card
        title="Reminder Templates"
        description="The 18 system templates ship with every firm Day-1 (PRD §7.6). Edit subject and body without affecting other firms. Each row shows current phase and what it'd take to graduate to Phase 2 auto-send."
      >
        <ul className="divide-y divide-line">
          {templates.map((t) => {
            const elig = eligibilityById.get(t.id);
            const isPhase2 = t.phase === 2;
            const usage = usageByTemplateId.get(t.id) ?? 0;
            return (
              <li key={t.id} className="py-3">
                <div className="flex items-start gap-3">
                  <Mail
                    className="w-4 h-4 text-ink-400 mt-0.5"
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-900">
                      {t.name ?? t.subject}
                    </p>
                    <p className="text-xs text-ink-500 mt-0.5">{t.subject}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-1.5 text-2xs uppercase tracking-wide">
                      {t.trigger && (
                        <span className="px-1.5 py-0.5 rounded bg-sunken text-ink-700">
                          {t.trigger}
                        </span>
                      )}
                      {t.cadence && (
                        <span className="px-1.5 py-0.5 rounded bg-sunken text-ink-700">
                          {t.cadence}
                        </span>
                      )}
                      <PhaseBadge
                        phase={t.phase ?? 1}
                        paused={isPhase2 && paused}
                      />
                      {!isPhase2 && elig && (
                        <span
                          className={`px-1.5 py-0.5 rounded border ${
                            elig.eligible
                              ? "bg-ok-bg text-ok-ink border-ok-border"
                              : "bg-sunken text-ink-500 border-line"
                          }`}
                        >
                          {eligibilityLabel(elig)}
                        </span>
                      )}
                      {/* Usage backlink — "Used by N items" */}
                      {usage > 0 ? (
                        <span
                          className="px-1.5 py-0.5 rounded bg-info-bg/60 text-info-ink border border-info-border tabular-nums normal-case tracking-normal"
                          title={`${usage} active checklist item${usage === 1 ? "" : "s"} would receive this template's chase`}
                        >
                          Used by {usage}{" "}
                          {usage === 1 ? "item" : "items"}
                        </span>
                      ) : (
                        <span
                          className="px-1.5 py-0.5 rounded bg-sunken text-ink-500 border border-line normal-case tracking-normal"
                          title="No active items match this template's itemType"
                        >
                          Unused
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingId(t.id)}
                    className="text-xs px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken"
                  >
                    Edit
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {recentAutoSends.length > 0 && (
        <Card
          title="Recent auto-sends"
          description="Phase 2 fires the system has executed without per-send approval. Audit trail keeps the actor field as 'ai (phase 2)' so review is unambiguous."
        >
          <ul className="divide-y divide-line">
            {recentAutoSends.map((d) => {
              const tmpl = templates.find((t) => t.id === d.templateId);
              return (
                <li
                  key={d.id}
                  className="py-2.5 flex items-start gap-3 text-sm"
                >
                  <Zap
                    className="w-3.5 h-3.5 text-info-ink mt-0.5 shrink-0"
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-ink-900 truncate">
                      {d.subject}
                    </p>
                    <p className="text-2xs text-ink-500 mt-0.5">
                      To {d.to}
                      {tmpl && <> · {tmpl.name ?? "template"}</>} ·{" "}
                      {d.sentAt
                        ? new Date(d.sentAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  <span className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-info-bg text-info-ink border border-info-border shrink-0">
                    auto-sent
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {editing && (
        <ReminderTemplateEditor
          template={editing}
          eligibility={eligibilityById.get(editing.id) ?? null}
          onSave={(patch) => {
            update(editing.id, patch);
            setEditingId(null);
          }}
          onClose={() => setEditingId(null)}
        />
      )}
    </>
  );
}

function PhaseBadge({
  phase,
  paused,
}: {
  phase: 1 | 2;
  paused: boolean;
}) {
  if (phase === 2) {
    return (
      <span
        className={`px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${
          paused
            ? "bg-warn-bg text-warn-ink border-warn-border"
            : "bg-info-bg text-info-ink border-info-border"
        }`}
      >
        {paused ? (
          <>
            <PauseCircle className="w-2.5 h-2.5" aria-hidden /> Phase 2 paused
          </>
        ) : (
          <>
            <Zap className="w-2.5 h-2.5" aria-hidden /> Phase 2 live
          </>
        )}
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 rounded border bg-sunken text-ink-700 border-line">
      Phase 1
    </span>
  );
}

function Phase2StatusCard({
  paused,
  onTogglePause,
  activeCount,
  eligibleCount,
  autoSendsThisWeek,
}: {
  paused: boolean;
  onTogglePause: () => void;
  activeCount: number;
  eligibleCount: number;
  autoSendsThisWeek: number;
}) {
  return (
    <section
      className={`bg-surface border rounded-md overflow-hidden ${
        paused ? "border-warn-border" : "border-line"
      }`}
      aria-label="Phase 2 auto-send status"
    >
      <header
        className={`px-5 py-3 border-b flex items-center gap-3 ${
          paused
            ? "border-warn-border bg-warn-bg/40"
            : "border-line bg-sunken/40"
        }`}
      >
        {paused ? (
          <PauseCircle className="w-4 h-4 text-warn-ink" aria-hidden />
        ) : (
          <ShieldCheck className="w-4 h-4 text-ok-ink" aria-hidden />
        )}
        <div className="flex-1 min-w-0">
          {/* Inline h3 inside a tinted status banner — not a section title.
              Card-level title slot is reserved for the surrounding panel
              header; this h3 names the localized control. */}
          <h3 className="text-sm font-semibold text-ink-900">
            Phase 2 auto-send
          </h3>
          <p className="text-2xs text-ink-500 mt-0.5">
            {paused ? (
              <>
                <span className="text-warn-ink font-medium">Paused.</span>{" "}
                The system is holding all auto-fires until you resume.
              </>
            ) : activeCount === 0 && autoSendsThisWeek === 0 ? (
              <>
                Live. No templates currently auto-send — nothing is firing
                without your review.
              </>
            ) : activeCount === 0 ? (
              <>
                Live. No templates are scheduled to auto-send right now —
                the {autoSendsThisWeek} send{autoSendsThisWeek === 1 ? "" : "s"}{" "}
                below ran earlier this week before the template was demoted.
              </>
            ) : (
              <>
                Live. {activeCount} template{activeCount === 1 ? "" : "s"}{" "}
                auto-fire on cadence; everything else still routes through
                you.
              </>
            )}
          </p>
        </div>
        <button
          onClick={onTogglePause}
          className={`text-xs px-3 py-1.5 rounded-md border inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 ${
            paused
              ? "bg-indigo text-white border-indigo hover:bg-indigo-hover"
              : "border-line text-ink-700 hover:bg-sunken"
          }`}
        >
          {paused ? (
            <>
              <PlayCircle className="w-3.5 h-3.5" aria-hidden />
              Resume auto-send
            </>
          ) : (
            <>
              <PauseCircle className="w-3.5 h-3.5" aria-hidden />
              Pause all auto-sends
            </>
          )}
        </button>
      </header>
      <div className="grid grid-cols-3 divide-x divide-line">
        <Stat
          label="Live templates"
          value={activeCount}
          tone={activeCount > 0 ? "info" : "muted"}
        />
        <Stat
          label="Eligible to promote"
          value={eligibleCount}
          tone={eligibleCount > 0 ? "ok" : "muted"}
        />
        <Stat
          label="Auto-sent this week"
          value={autoSendsThisWeek}
          tone="muted"
        />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "info" | "ok" | "muted";
}) {
  const valueClass =
    tone === "info"
      ? "text-info-ink"
      : tone === "ok"
        ? "text-ok-ink"
        : "text-ink-900";
  return (
    <div className="px-4 py-3">
      <p className="text-2xs uppercase tracking-wider text-ink-500">
        {label}
      </p>
      <p className={`text-xl font-semibold mt-0.5 tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

function ReminderTemplateEditor({
  template,
  eligibility,
  onSave,
  onClose,
}: {
  template: ReturnType<typeof useReminderTemplates>[number];
  eligibility: PhaseEligibility | null;
  onSave: (patch: Partial<typeof template>) => void;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body ?? "");
  const [phase, setPhase] = useState<1 | 2>(template.phase ?? 1);
  const eligible = !!eligibility?.eligible;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface border border-line rounded-lg shadow-overlay w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <header className="flex items-center px-5 py-3 border-b border-line">
          <h2 className="text-sm font-semibold text-ink-900">
            Edit · {template.name ?? "Template"}
          </h2>
          <button
            onClick={onClose}
            className="ml-auto inline-flex items-center text-ink-500 hover:text-ink-900"
            aria-label="Close"
          >
            <XIcon className="w-4 h-4" aria-hidden />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4 space-y-3">
          <Field label="Subject">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full h-9 bg-sunken border border-line rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 hover:border-line-strong"
            />
          </Field>
          <Field label="Body (variables: {{client_name}}, {{deadline_date}}, {{forwarding_email}}, etc.)">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full border border-line rounded px-2 py-2 text-sm font-sans"
            />
          </Field>
          <div
            className={`border rounded p-3 ${
              phase === 2 && eligible
                ? "bg-info-bg/30 border-info-border"
                : "bg-sunken/50 border-line"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-900">
                  Phase 2 auto-send
                </p>
                <p className="text-xs text-ink-500 mt-0.5">
                  When all three conditions are met, the system fires this
                  reminder on its own cadence. You stay in the audit trail
                  as the configuring CPA — actor on each fire reads "ai
                  (phase 2)."
                </p>
              </div>
              <button
                onClick={() => setPhase(phase === 2 ? 1 : 2)}
                disabled={!eligible && phase !== 2}
                className={`text-xs px-3 py-1.5 rounded shrink-0 ${
                  phase === 2
                    ? "bg-indigo text-white hover:bg-indigo-hover"
                    : "border border-line text-ink-700 hover:bg-sunken"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                title={
                  eligible || phase === 2
                    ? "Toggle Phase 2"
                    : "All three conditions must be met to enable"
                }
              >
                {phase === 2 ? "Enabled" : "Enable Phase 2"}
              </button>
            </div>

            {/* Three-condition breakdown — every condition shown, with its
                current status. Removes the mystery from "what does
                eligibility mean" and shows exactly what'd unlock it. */}
            {eligibility && (
              <ul className="mt-3 space-y-1.5 text-2xs">
                <ConditionRow
                  met={eligibility.patternPrecedent.met}
                  label="Pattern Precedent"
                  detail={
                    eligibility.patternPrecedent.met
                      ? `${eligibility.patternPrecedent.bestStreak} approved sends to one client`
                      : `${eligibility.patternPrecedent.bestStreak} of ${eligibility.patternPrecedent.threshold} approvals to a single client (no edits)`
                  }
                />
                <ConditionRow
                  met={eligibility.routineItem}
                  label="Routine Item"
                  detail={
                    eligibility.routineItem
                      ? `Standard system template — ${template.itemType ?? ""}`
                      : "Custom or non-system templates can't auto-send"
                  }
                />
                <ConditionRow
                  met={eligibility.timingWithinPrecedent}
                  label="Timing within Precedent"
                  detail={
                    eligibility.timingWithinPrecedent
                      ? `Recurring cadence — ${template.cadence ?? ""}`
                      : "First-touch (\"once\") templates always need CPA review"
                  }
                />
              </ul>
            )}
          </div>
        </div>
        <footer className="flex items-center px-5 py-3 border-t border-line gap-2 bg-sunken/20">
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded text-ink-500 hover:bg-sunken"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ subject, body, phase })}
            className="ml-auto text-sm px-4 py-1.5 rounded bg-indigo text-white hover:bg-indigo-hover"
          >
            Save changes
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Tier 0 OAuth providers — wired to the new BE OAuth flow.
 * QBO/Xero are two-way sync; Gmail/Outlook are send-only on day 1
 * (Method B full-read is Phase 2). Each card knows whether the BE
 * has client credentials configured (catalog) and surfaces "Connect"
 * vs "Coming soon" honestly.
 */
const TIER_0_PROVIDERS: Array<{
  kind: "qbo" | "xero" | "gmail" | "outlook";
  name: string;
  blurb: string;
}> = [
  {
    kind: "qbo",
    name: "QuickBooks Online",
    blurb: "Two-way sync for financial profiles and per-client anomaly anchors.",
  },
  {
    kind: "xero",
    name: "Xero",
    blurb: "Same as QBO for firms outside the US ecosystem.",
  },
  {
    kind: "gmail",
    name: "Gmail",
    blurb: "Send chase emails on your behalf. Full read scope ships next quarter.",
  },
  {
    kind: "outlook",
    name: "Outlook / Microsoft 365",
    blurb: "Same scope as Gmail.",
  },
];

function IntegrationsPanel() {
  const list = useIntegrations();
  const catalog = useIntegrationCatalog();
  const startConnect = useStartConnect();
  const disconnect = useDisconnect();
  const syncNow = useSyncNow();
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  // Index live integrations by kind for fast lookup
  const byKind = useMemo(() => {
    const m = new Map<string, NonNullable<typeof list.data>[number]>();
    for (const row of list.data ?? []) m.set(row.kind, row);
    return m;
  }, [list.data]);

  const onConnect = (kind: "qbo" | "xero" | "gmail" | "outlook") => {
    startConnect.mutate({
      kind,
      redirectTo: window.location.href,
    });
  };

  const onSync = async (provider: "qbo" | "xero") => {
    setSyncFeedback(null);
    try {
      const result = await syncNow.mutateAsync({ provider });
      const msg =
        result.fetched === 0
          ? "Already up to date."
          : `Synced ${result.fetched} customer${
              result.fetched === 1 ? "" : "s"
            } — ${result.inserted} new, ${result.updated} updated${
              result.errors > 0 ? `, ${result.errors} error(s)` : ""
            }.`;
      setSyncFeedback(msg);
    } catch (err) {
      setSyncFeedback(
        err instanceof Error ? err.message : "Sync failed",
      );
    }
  };

  return (
    <>
      <CalendarPushCard />
      <Card
        title="Connected sources"
        description="Each provider unlocks a specific capability — financial anchoring (QBO/Xero) or outbound email rerouting (Gmail/Outlook). Disconnect anytime."
      >
        {list.error && (
          <p className="text-xs text-danger-ink mb-3">
            Couldn't load integrations: {list.error.message}
          </p>
        )}
        {startConnect.error && (
          <p className="text-xs text-danger-ink mb-3">
            Connect failed: {startConnect.error.message}
          </p>
        )}
        {syncFeedback && (
          <p className="text-xs text-ink-700 bg-sunken/50 border border-line rounded px-2.5 py-1.5 mb-3">
            {syncFeedback}
          </p>
        )}
        <ul className="divide-y divide-line">
          {TIER_0_PROVIDERS.map((p) => {
            const live = byKind.get(p.kind);
            const cat = catalog.data?.find((c) => c.kind === p.kind);
            const configured = cat?.configured ?? false;
            // Sync button only for QBO/Xero rows that are connected.
            // Gmail/Outlook are send-only (Method A) and the inbox
            // poller (Method B) has its own on-demand button elsewhere.
            const supportsSync = p.kind === "qbo" || p.kind === "xero";
            return (
              <IntegrationRow
                key={p.kind}
                name={p.name}
                blurb={p.blurb}
                live={live}
                configured={configured}
                onConnect={() => onConnect(p.kind)}
                onDisconnect={() =>
                  live && disconnect.mutate({ id: live.id })
                }
                onSync={
                  supportsSync && live?.status === "connected"
                    ? () => onSync(p.kind as "qbo" | "xero")
                    : undefined
                }
                connecting={startConnect.isPending}
                disconnecting={disconnect.isPending}
                syncing={syncNow.isPending}
              />
            );
          })}
        </ul>
      </Card>

      <Card
        title="Coming next"
        description="Connectors on the roadmap — not yet wired. Tell us which would unblock you."
      >
        <ul className="text-sm text-ink-500 space-y-1.5">
          <li>
            · <span className="text-ink-700">Lacerte / UltraTax / Drake / ProSeries</span>
            {" "}— prior-year-return imports
          </li>
          <li>
            · <span className="text-ink-700">SharePoint</span> — write
            task summaries + audit packs back to your firm's archive
          </li>
          <li>
            · <span className="text-ink-700">Bloomberg / CCH publication feed</span>
            {" "}— read-only feed into the state-alert engine
          </li>
        </ul>
      </Card>

      <Card title="Not supported (intentional)">
        <ul className="text-sm text-ink-500 space-y-1.5">
          <li>· CCH Axcess — no usable API; customer base exiting.</li>
          <li>· Client payments — use Stripe / CPACharge directly.</li>
          <li>· Bank account access — PCI/regulatory complexity not justified.</li>
        </ul>
      </Card>
    </>
  );
}

/**
 * Push deadlines to the CPA's calendar. Different mental model from
 * the Tier-0 pull integrations (QBO/Xero/Gmail/Outlook): instead of
 * data coming IN to the dashboard, deadlines go OUT to the CPA's
 * existing planning surface. Per the "integrate, don't attract"
 * principle, calendar is the highest-priority push channel.
 *
 * Phase 1: one-way Google Calendar only. Outlook/Apple come later.
 */
function CalendarPushCard() {
  const utils = trpc.useUtils();
  const status = trpc.integrations.calendarStatus.useQuery();
  const list = trpc.integrations.list.useQuery();
  const startConnect = trpc.integrations.startConnect.useMutation({
    onSuccess: (r) => {
      if (r.authorizeUrl) window.location.href = r.authorizeUrl;
    },
  });
  const disconnect = trpc.integrations.disconnect.useMutation({
    onSuccess: () => {
      void utils.integrations.calendarStatus.invalidate();
      void utils.integrations.list.invalidate();
    },
  });
  const syncNow = trpc.integrations.syncCalendarNow.useMutation({
    onSuccess: () => void utils.integrations.calendarStatus.invalidate(),
  });

  const integration = list.data?.find((r) => r.kind === "google_calendar");
  const s = status.data;
  const connected = !!s?.connected;

  return (
    <Card
      title="Push deadlines to your calendar"
      description={
        connected
          ? "Filing deadlines mirror to your Google Calendar as all-day events with a 1-day-before reminder. Edits made here propagate; edits made in Calendar don't (yet)."
          : "We don't replace your calendar — we feed it. Connect Google Calendar and every filing deadline becomes a calendar event, ordered by the same dates we track here."
      }
    >
      {!connected ? (
        <div className="space-y-3">
          {startConnect.error && (
            <p className="text-xs text-danger-ink">
              Couldn't start: {startConnect.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={() =>
              startConnect.mutate({
                kind: "google_calendar",
                redirectTo: window.location.href,
              })
            }
            disabled={startConnect.isPending}
            className="text-sm px-4 py-2 rounded bg-ink-900 text-white hover:opacity-90 disabled:opacity-40"
          >
            {startConnect.isPending ? "Opening Google…" : "Connect Google Calendar"}
          </button>
          <p className="text-2xs text-ink-400">
            Outlook + Apple Calendar coming next quarter. Until then,
            export an .ics from any client page if you need them today.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline gap-3 text-sm">
            <span className="text-ok-ink font-medium">✓ Connected</span>
            <span className="text-ink-500">
              {s?.syncedCount ?? 0} of {s?.totalOpen ?? 0} open deadlines synced
            </span>
            {s?.lastSyncedAt && (
              <span className="text-2xs text-ink-400">
                · last synced {new Date(s.lastSyncedAt).toLocaleString()}
              </span>
            )}
          </div>
          {s?.lastError && (
            <p className="text-xs text-danger-ink bg-danger-bg/40 border border-danger-border/40 rounded px-2.5 py-1.5">
              {s.lastError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => syncNow.mutate()}
              disabled={syncNow.isPending}
              className="text-xs px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-canvas disabled:opacity-40"
            >
              {syncNow.isPending ? "Syncing…" : "Sync now"}
            </button>
            {syncNow.isSuccess && (
              <span className="text-xs text-ink-500">
                Pushed {syncNow.data.pushed} new · updated {syncNow.data.updated}
                {syncNow.data.errors > 0
                  ? ` · ${syncNow.data.errors} error(s)`
                  : ""}
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                integration && disconnect.mutate({ id: integration.id })
              }
              disabled={disconnect.isPending || !integration}
              className="ml-auto text-xs px-3 py-1.5 rounded border border-line text-ink-500 hover:text-danger-ink disabled:opacity-40"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function IntegrationRow({
  name,
  blurb,
  live,
  configured,
  onConnect,
  onDisconnect,
  onSync,
  connecting,
  disconnecting,
  syncing,
}: {
  name: string;
  blurb: string;
  live:
    | {
        id: string;
        status: "connected" | "disconnected" | "error";
        externalAccountId: string | null;
        lastSyncedAt: string | null;
        lastError: string | null;
        expiresAt: string | null;
      }
    | undefined;
  configured: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  /** When set, renders a "Sync now" button next to Disconnect. Only
   *  meaningful for QBO/Xero (data-pull providers); Gmail/Outlook
   *  use Method B's own poll button elsewhere. */
  onSync?: () => void;
  connecting: boolean;
  disconnecting: boolean;
  syncing?: boolean;
}) {
  // Three states: connected, disconnected (or never connected), error.
  // The visual hierarchy puts the action button on the right, mirroring
  // the rest of the Settings panels.
  const status: "connected" | "disconnected" | "error" =
    live?.status === "connected"
      ? "connected"
      : live?.status === "error"
        ? "error"
        : "disconnected";

  return (
    <li className="py-3 flex items-start gap-3">
      <Plug className="w-4 h-4 text-ink-400 mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-sm font-medium text-ink-900">{name}</p>
          <span
            className={`text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded border ${
              status === "connected"
                ? "bg-ok-bg text-ok-ink border-ok-border"
                : status === "error"
                  ? "bg-warn-bg text-warn-ink border-warn-border"
                  : "bg-sunken text-ink-500 border-line"
            }`}
          >
            {status === "disconnected" ? "not connected" : status}
          </span>
          {!configured && status !== "connected" && (
            <span
              className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded border bg-sunken/40 text-ink-400 border-line"
              title="Backend doesn't have OAuth credentials for this provider yet"
            >
              coming soon
            </span>
          )}
        </div>
        <p className="text-xs text-ink-500 mt-1">{blurb}</p>
        {status === "connected" && live && (
          <p className="text-2xs text-ink-500 mt-1">
            {live.externalAccountId && (
              <>Account {live.externalAccountId.slice(0, 12)}…</>
            )}
            {live.lastSyncedAt && (
              <>
                {" · last synced "}
                {new Date(live.lastSyncedAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </>
            )}
            {live.expiresAt && (
              <>
                {" · token valid until "}
                {new Date(live.expiresAt).toLocaleDateString()}
              </>
            )}
          </p>
        )}
        {status === "error" && live?.lastError && (
          <p className="text-2xs text-warn-ink mt-1">
            Last error: {live.lastError}
          </p>
        )}
      </div>
      {status === "connected" ? (
        <span className="flex items-center gap-1.5 shrink-0">
          {onSync && (
            <button
              onClick={onSync}
              disabled={syncing}
              className="text-xs px-3 py-1 rounded bg-indigo text-white hover:bg-indigo-hover disabled:opacity-40"
              title="Pull latest customers from this provider into your client list"
            >
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          )}
          <button
            onClick={onDisconnect}
            disabled={disconnecting}
            className="text-xs px-3 py-1 rounded border border-line text-ink-700 hover:bg-sunken disabled:opacity-40"
          >
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        </span>
      ) : (
        <button
          onClick={onConnect}
          disabled={!configured || connecting}
          className={[
            "text-xs px-3 py-1 rounded",
            !configured
              ? "border border-line text-ink-400 cursor-not-allowed"
              : "bg-indigo text-white hover:bg-indigo-hover",
          ].join(" ")}
          title={
            configured
              ? "Open the provider's OAuth consent screen"
              : "Backend OAuth credentials not configured for this provider"
          }
        >
          {connecting ? "Connecting…" : "Connect"}
        </button>
      )}
    </li>
  );
}

function BillingPanel() {
  const session = useSession();
  const tier = session?.tier ?? "solo";
  return (
    <>
      <Card
        title="Subscription"
        description="Monthly billing is the default. No annual lock-in (counter to TaxDome's annual upfront)."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <PricingCard tier="solo" current={tier === "solo"} price="$29/mo" cap="1 user · ≤ 50 clients" />
          <PricingCard tier="pro" current={tier === "pro"} price="$49/mo" cap="1-3 users · unlimited clients" highlight />
          <PricingCard tier="team" current={tier === "team"} price="$99/mo" cap="≤ 10 users · API (P4)" />
        </div>
      </Card>
      <Card title="Trial & lifecycle">
        <ul className="text-sm text-ink-700 space-y-1.5">
          <li>· 30-day trial, no credit card required.</li>
          <li>· Day 31 unpaid → 14-day read-only grace period.</li>
          <li>· Day 45 → soft-suspend, 90-day data retention.</li>
          <li>· Day 135 → hard-delete after export warning.</li>
          <li>· Seat overages blocked at invite.</li>
        </ul>
      </Card>
      <Card title="Invoices">
        <p className="text-sm text-ink-500">No invoices yet. Trial in progress.</p>
      </Card>
    </>
  );
}

function PricingCard({
  tier,
  current,
  price,
  cap,
  highlight,
}: {
  tier: string;
  current: boolean;
  price: string;
  cap: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border rounded p-3 ${
        highlight ? "border-accent" : "border-line"
      } ${current ? "bg-sunken/50" : "bg-surface"}`}
    >
      <p className="text-xs uppercase tracking-wider text-ink-500 font-semibold capitalize">
        {tier}
      </p>
      <p className="text-lg font-semibold text-ink-900 mt-1">{price}</p>
      <p className="text-xs text-ink-500 mt-0.5">{cap}</p>
      <button
        className={`mt-3 text-xs px-3 py-1 rounded w-full ${
          current
            ? "bg-sunken text-ink-500 cursor-default"
            : "border border-line text-ink-700 hover:bg-sunken"
        }`}
        disabled={current}
      >
        {current ? "Current plan" : `Switch to ${tier}`}
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-2xs uppercase tracking-wider text-ink-500 font-semibold block mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function ConditionRow({
  met,
  label,
  detail,
}: {
  met: boolean;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={`mt-0.5 inline-flex w-3.5 h-3.5 rounded-full items-center justify-center shrink-0 ${
          met
            ? "bg-ok-bg text-ok-ink border border-ok-border"
            : "bg-sunken text-ink-400 border border-line"
        }`}
        aria-hidden
      >
        {met ? <Check className="w-2.5 h-2.5" aria-hidden /> : <span className="w-1 h-1 rounded-full bg-current" />}
      </span>
      <div className="flex-1 min-w-0">
        <span
          className={`font-medium ${
            met ? "text-ink-900" : "text-ink-500"
          }`}
        >
          {label}
        </span>
        <span className="text-ink-500"> — {detail}</span>
      </div>
    </li>
  );
}
