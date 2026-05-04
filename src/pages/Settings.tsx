import { useMemo, useState } from "react";
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
} from "lucide-react";
import { actions, useStore } from "../data/store";
import { useImportHistory } from "../hooks/useImports";
import { signOut, updateSession, useSession } from "../data/session";
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
import { BUNDLES } from "../data/bundles";
import {
  computeEligibility,
  eligibilityLabel,
  type PhaseEligibility,
} from "../lib/phase2Eligibility";
import { SettingsFederalFormsPanel } from "./SettingsFederalFormsPanel";

const NAV = [
  { to: "/settings", label: "Account", icon: User, end: true },
  { to: "/settings/firm", label: "Firm", icon: Building2 },
  { to: "/settings/team", label: "Team", icon: Users2 },
  { to: "/settings/packages", label: "Service Packages", icon: Package },
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
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 flex flex-col md:flex-row gap-6">
      <aside className="md:w-56 shrink-0">
        <h1 className="text-lg font-semibold text-ink-900 mb-3">Settings</h1>
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
    <section className="bg-surface border border-line rounded-md overflow-hidden mb-5">
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
            value={new Date(session.signedInAt).toLocaleString()}
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
          SMS reminders are deferred to Phase 2 — we won't half-build them.
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
            Anthropic configured. Mode A + D + scraper run on real Claude.
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
        title="All modes overview"
        description="Acceptance / cost / latency for each AI mode (A-F) over the firm's lifetime. Each row is a separate Mode; click into one for the time-series drift chart below."
      >
        {summaryAll.isLoading ? (
          <p className="text-sm text-ink-500">Loading mode summary…</p>
        ) : summaryAll.error ? (
          <p className="text-sm text-danger-ink">
            Couldn't load mode summary: {summaryAll.error.message}
          </p>
        ) : summaryAll.data ? (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-ink-500 uppercase tracking-wider">
                  <th className="text-left font-semibold px-2 py-1.5">Mode</th>
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
                      <td className="px-2 py-2 font-mono">
                        Mode {s.mode}
                        <span className="ml-2 text-2xs text-ink-400 font-sans">
                          {MODE_LABEL[s.mode]}
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
        {/* Mode selector — full A-F set per v0.8 amendment (Mode F added) */}
        <div className="flex flex-wrap gap-1 mb-4">
          {(["A", "B", "C", "D", "E", "F"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={[
                "text-xs px-3 py-1 rounded border",
                mode === m
                  ? "bg-sunken text-ink-900 border-ink-900 font-medium"
                  : "border-line text-ink-500 hover:bg-sunken hover:text-ink-700",
              ].join(" ")}
            >
              Mode {m}
              <span className="ml-1.5 text-2xs opacity-70">
                {MODE_LABEL[m]}
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
            No Mode {mode} inferences logged yet. Once your firm starts
            confirming AI suggestions or sending drafts, this will populate.
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
                    trailing 4-week mean. Mode {mode} may be regressing —
                    check recent inferences for misclassifications.
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
        description="Every Anthropic call writes to ai_inferences with mode + model + cost + latency + the input hash for grouping. CPA acceptance flips was_acted_on; this dashboard reads those flags."
      >
        <ul className="text-xs text-ink-500 space-y-1.5">
          <li>
            <span className="font-mono text-ink-700">Mode A</span>{" "}
            (classify) — every inbound document. Logged on the BE inbound
            email handler.
          </li>
          <li>
            <span className="font-mono text-ink-700">Mode D</span>{" "}
            (draft email) — every "Custom email…" click. Logged when the
            BE returns the draft.
          </li>
          <li>
            <span className="font-mono text-ink-700">Scraper</span> — LLM
            lift on low-confidence regex hits. Logged with mode='C' for now
            (worth a separate mode bucket once volume justifies).
          </li>
          <li className="text-ink-400 italic mt-2">
            Modes B / C / E stay deterministic by design — their existing
            logic (history math, statistical anomaly, set-difference) is
            meaningful without an LLM round-trip.
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
  );
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

function TeamPanel() {
  const flags = useFeatureFlags();
  const session = useSession();
  const [pending, setPending] = useState<
    Array<{ id: string; email: string; role: "owner" | "member"; invitedAt: string }>
  >([]);
  const [emailInput, setEmailInput] = useState("");
  const [roleInput, setRoleInput] = useState<"owner" | "member">("member");

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
        invitedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setEmailInput("");
  };

  const revoke = (id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id));
  };

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
            members of one firm at MVP (multi-firm is Phase 2).
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
            What ships in Phase 2: per-client access restrictions, formal
            handoff workflow (with auto-revert on return), and Specialist tags
            (international tax / S-corp / trust) for routing.
          </p>
        </div>
      </Card>

      <Card
        title="Roles at MVP"
        description="Two roles only at this stage. Admin / Viewer / client-level access ship in Phase 2."
      >
        <ul className="divide-y divide-line">
          <li className="py-2.5 flex items-start gap-3">
            <span className="text-2xs uppercase tracking-wide px-2 py-0.5 rounded bg-ink-900 text-canvas font-semibold mt-0.5">
              Owner
            </span>
            <div className="flex-1 text-xs text-ink-700">
              <p className="font-medium text-ink-900">Full access · manages users + billing</p>
              <p className="text-ink-500 mt-0.5">
                Edit firm settings, invite/remove teammates, change plan, edit
                service packages and reminder templates, all client + task data.
                The first signup is automatically the Owner.
              </p>
            </div>
          </li>
          <li className="py-2.5 flex items-start gap-3">
            <span className="text-2xs uppercase tracking-wide px-2 py-0.5 rounded bg-sunken text-ink-700 border border-line font-semibold mt-0.5">
              Member
            </span>
            <div className="flex-1 text-xs text-ink-700">
              <p className="font-medium text-ink-900">Full data access · cannot manage users or billing</p>
              <p className="text-ink-500 mt-0.5">
                See and act on every client and task. Send reminders, confirm
                docs, resolve flags, edit reminder templates. Cannot invite
                teammates, change plan, or modify firm settings.
              </p>
            </div>
          </li>
        </ul>
        <p className="text-2xs text-ink-400 mt-3 pt-3 border-t border-line">
          Phase 2 adds <span className="font-medium text-ink-700">Admin</span> (manage users, no billing) and{" "}
          <span className="font-medium text-ink-700">Viewer</span> (read-only audit-trail consumer).
          Per-client access restrictions also Phase 2. Multiple assignees per task
          (preparer + reviewer roles) Phase 2.
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
              className="w-full border border-line rounded px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Role">
            <select
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value as "owner" | "member")}
              className="border border-line rounded px-2 py-1.5 text-sm bg-surface"
            >
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
          </Field>
          <button
            onClick={invite}
            disabled={!emailInput.trim()}
            className="text-sm px-3 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send invite
          </button>
        </div>
      </Card>

      {pending.length > 0 && (
        <Card
          title="Pending invites"
          description="They'll show up here until accepted or revoked."
        >
          <ul className="divide-y divide-line">
            {pending.map((p) => (
              <li
                key={p.id}
                className="py-2 flex items-center gap-3 text-sm"
              >
                <Users2 className="w-4 h-4 text-ink-400" aria-hidden />
                <span className="text-ink-900">{p.email}</span>
                <span className="text-2xs uppercase tracking-wide text-ink-500">
                  {p.role}
                </span>
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
            ))}
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
              className="w-full border border-line rounded px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Primary states served (comma-separated)">
            <input
              value={statesText}
              onChange={(e) => setStatesText(e.target.value)}
              className="w-full border border-line rounded px-2 py-1.5 text-sm"
              placeholder="CA, NY, TX"
            />
          </Field>
          <Field label="Postal address (CAN-SPAM)">
            <input
              defaultValue="100 Market St, Suite 200, San Francisco, CA 94105"
              className="w-full border border-line rounded px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Time zone">
            <select className="border border-line rounded px-2 py-1.5 text-sm">
              <option>America/Los_Angeles</option>
              <option>America/New_York</option>
              <option>America/Chicago</option>
              <option>America/Denver</option>
            </select>
          </Field>
          <button
            onClick={save}
            className="text-sm px-3 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover"
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

function ServicePackagesPanel() {
  return (
    <Card
      title="Service Packages"
      description="System-defined bundles you can apply to any client. Custom packages coming in P1."
    >
      <ul className="divide-y divide-line">
        {BUNDLES.map((b) => (
          <li key={b.id} className="py-3 flex items-start gap-3">
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
              </div>
            </div>
            <button
              className="text-xs px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken"
              title="Cloning is wireframe-only — backend wires this in P0"
            >
              Clone
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RemindersPanel() {
  const templates = useReminderTemplates();
  const update = useUpdateReminderTemplate();
  const session = useSession();
  const { emailDrafts } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = templates.find((t) => t.id === editingId) ?? null;

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
          <h2 className="text-sm font-semibold text-ink-900">
            Phase 2 auto-send
          </h2>
          <p className="text-2xs text-ink-500 mt-0.5">
            {paused ? (
              <>
                <span className="text-warn-ink font-medium">Paused.</span>{" "}
                The system is holding all auto-fires until you resume.
              </>
            ) : activeCount === 0 ? (
              <>
                Live. No templates currently auto-send — nothing is firing
                without your review.
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
          className={`text-xs px-3 py-1.5 rounded border inline-flex items-center gap-1.5 ${
            paused
              ? "bg-accent text-canvas border-accent hover:bg-accent-hover"
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
            className="ml-auto text-ink-500 hover:text-ink-900 text-sm"
          >
            ✕
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4 space-y-3">
          <Field label="Subject">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-line rounded px-2 py-1.5 text-sm"
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
                    ? "bg-accent text-canvas hover:bg-accent-hover"
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
            className="ml-auto text-sm px-4 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover"
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
              className="text-xs px-3 py-1 rounded bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40"
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
              : "bg-accent text-canvas hover:bg-accent-hover",
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
        className={`mt-0.5 inline-flex w-3.5 h-3.5 rounded-full items-center justify-center text-2xs shrink-0 ${
          met
            ? "bg-ok-bg text-ok-ink border border-ok-border"
            : "bg-sunken text-ink-400 border border-line"
        }`}
        aria-hidden
      >
        {met ? "✓" : "·"}
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
