import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Inbox,
  Link2,
  Sparkles,
} from "lucide-react";
import { useCommitImport } from "../hooks/useImports";
import { useAvailableIntegrations, useConnectIntegration, useIntegrations } from "../hooks/useIntegrations";
import { DETECTED_ROWS } from "../data/mockImportData";
import { signIn, useSession } from "../data/session";
import {
  STATE_NAMES,
  STATE_CODES,
  type StateCode,
} from "../types";
import type { FirmSession } from "../data/session";

const FIRM_SIZES: Array<{ id: string; label: string; hint: string }> = [
  { id: "solo", label: "Solo", hint: "Just me" },
  { id: "small", label: "2–3 person", hint: "Owner + bookkeeper / admin" },
  { id: "team", label: "4–10 person", hint: "Senior + staff associates" },
  { id: "boutique", label: "10+", hint: "Multi-partner boutique firm" },
];

const ROLES: Array<{ id: string; label: string }> = [
  { id: "owner", label: "Owner / partner" },
  { id: "manager", label: "Senior / manager" },
  { id: "staff", label: "Staff / associate" },
  { id: "admin", label: "Admin / bookkeeper" },
];

export function OnboardingFirm() {
  const navigate = useNavigate();
  const session = useSession();
  const [firmName, setFirmName] = useState(session?.firmName ?? "");
  const [primaryStates, setPrimaryStates] = useState<StateCode[]>([]);
  const [firmSize, setFirmSize] = useState("solo");
  const [role, setRole] = useState("owner");
  const [tier, setTier] = useState<FirmSession["tier"]>(session?.tier ?? "solo");

  const canContinue = firmName.trim().length > 0 && primaryStates.length > 0;

  const togglePrimaryState = (code: StateCode) => {
    setPrimaryStates((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const continueToLayer1 = () => {
    // Persist firm-shape to local session so the rest of the flow + sidebar
    // pick it up immediately. Real backend will own this once /trpc/firm.update lands.
    if (session) {
      signIn({
        firmName: firmName.trim(),
        userName: session.userName,
        userEmail: session.userEmail,
        tier,
      });
    }
    navigate("/onboarding/layer-1");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <header className="border border-line bg-surface rounded-md p-5">
        <div className="text-xs uppercase tracking-wide text-ink-500">
          Onboarding · Firm setup
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-ink-900">
          Tell us about your firm
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-600">
          We use this to scope state alerts, suggest service packages, and pre-pick
          reminder cadences. You can change any of it in Settings later.
        </p>
      </header>

      <section className="border border-line bg-surface rounded-md p-5 space-y-5">
        <div>
          <label className="block">
            <span className="text-xs font-medium text-ink-700 mb-1 block">
              Firm name
            </span>
            <input
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="e.g. Mitchell CPA"
              className="w-full px-3 py-2 rounded-md border border-line bg-surface text-sm"
              autoFocus
            />
          </label>
        </div>

        <div>
          <span className="text-xs font-medium text-ink-700 mb-2 block">
            Primary states
            <span className="ml-1 text-ink-400 font-normal">
              (where most of your clients file)
            </span>
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1 -m-1">
            {STATE_CODES.map((code) => {
              const on = primaryStates.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => togglePrimaryState(code)}
                  title={STATE_NAMES[code] ?? code}
                  className={`text-xs px-2 py-1 rounded border ${
                    on
                      ? "bg-accent text-canvas border-accent"
                      : "bg-surface text-ink-700 border-line hover:bg-sunken"
                  }`}
                >
                  {code}
                </button>
              );
            })}
          </div>
          {primaryStates.length > 0 && (
            <p className="mt-2 text-xs text-ink-500">
              {primaryStates.length} state{primaryStates.length === 1 ? "" : "s"}
              {" "}selected — alerts will scope to these.
            </p>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <span className="text-xs font-medium text-ink-700 mb-2 block">
              Firm size
            </span>
            <div className="space-y-1">
              {FIRM_SIZES.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-2 rounded border cursor-pointer ${
                    firmSize === opt.id
                      ? "border-accent bg-sunken"
                      : "border-line hover:bg-sunken"
                  }`}
                >
                  <input
                    type="radio"
                    name="firm-size"
                    checked={firmSize === opt.id}
                    onChange={() => setFirmSize(opt.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink-900">{opt.label}</div>
                    <div className="text-2xs text-ink-500">{opt.hint}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-ink-700 mb-2 block">
              Your role
            </span>
            <div className="space-y-1">
              {ROLES.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 p-2 rounded border cursor-pointer ${
                    role === opt.id
                      ? "border-accent bg-sunken"
                      : "border-line hover:bg-sunken"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    checked={role === opt.id}
                    onChange={() => setRole(opt.id)}
                  />
                  <span className="text-sm text-ink-900">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div>
          <span className="text-xs font-medium text-ink-700 mb-2 block">
            Plan tier
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(["solo", "pro", "team"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTier(id)}
                className={`text-left px-3 py-2 rounded border text-xs ${
                  tier === id
                    ? "bg-accent text-canvas border-accent"
                    : "bg-surface text-ink-700 border-line hover:bg-sunken"
                }`}
              >
                <div className="font-medium capitalize">{id}</div>
                <div className={tier === id ? "text-canvas/80" : "text-ink-500"}>
                  {id === "solo" && "1 user · ≤ 50 clients"}
                  {id === "pro" && "1–3 users · unlimited"}
                  {id === "team" && "≤ 10 users · API"}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="text-sm text-ink-500 hover:text-ink-900"
        >
          Skip for now
        </Link>
        <button
          type="button"
          disabled={!canContinue}
          onClick={continueToLayer1}
          className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-md bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue to Layer 1
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function OnboardingLayer1() {
  const navigate = useNavigate();
  const commitImport = useCommitImport();
  const [sampleLoaded, setSampleLoaded] = useState(false);

  const readyRows = useMemo(
    () => DETECTED_ROWS.filter((row) => row.issues.length === 0),
    []
  );

  const loadSampleWorkspace = () => {
    commitImport.mutate(
      {
        rows: readyRows,
        source: "excel",
        skippedCount: DETECTED_ROWS.length - readyRows.length,
      },
      {
        onSuccess: () => {
          setSampleLoaded(true);
          window.setTimeout(() => navigate("/"), 500);
        },
      }
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <header className="border border-line bg-surface rounded-md p-5">
        <div className="text-xs uppercase tracking-wide text-ink-500">
          Onboarding Layer 1
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-ink-900">
          Get to first value in 5 minutes
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-600">
          Start with a simple roster import or a sample workspace. The goal of
          this step is a working dashboard with real deadlines, task groupings,
          state alerts, and substrate-based checklist generation.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <ActionCard
          icon={Sparkles}
          title="Load sample workspace"
          eyebrow="Fastest path"
          copy="Seed clients, tasks, alerts, and reminder history so you can see the full product shape immediately."
          actionLabel={
            commitImport.isPending
              ? "Loading sample workspace…"
              : sampleLoaded
              ? "Opening dashboard…"
              : "Use sample data"
          }
          onAction={loadSampleWorkspace}
          disabled={commitImport.isPending}
          footer="Best for product walkthroughs and QA."
        />
        <ActionCard
          icon={FileSpreadsheet}
          title="Import client roster CSV"
          eyebrow="Import Tier 1"
          copy="Upload client name, entity type, primary state, and service type. This unlocks a real dashboard without any integrations."
          actionLabel="Open CSV importer"
          to="/import"
          footer="Supports loose exports from Excel, File In Time, TaxDome, and similar tools."
        />
        <ActionCard
          icon={Database}
          title="Add a few clients manually"
          eyebrow="Fallback path"
          copy="If you only need to test a handful of accounts, start with manual client creation and add deadlines from each client page."
          actionLabel="Go to clients"
          to="/clients"
          footer="Good for a quick pilot without cleaning a CSV first."
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="border border-line bg-surface rounded-md p-5">
          <h2 className="text-sm font-semibold text-ink-900">
            What Layer 1 should unlock
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              "Dashboard grouped into Overdue, This Week, This Month, Long Term",
              "Auto-seeded service package suggestions and checklist baselines",
              "State alerts matched against your imported roster",
              "Task detail with checklist state machine and reminder drafting",
            ].map((item) => (
              <div
                key={item}
                className="border border-line rounded-md px-3 py-3 text-sm text-ink-700 flex gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-ink-900 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-line bg-surface rounded-md p-5">
          <h2 className="text-sm font-semibold text-ink-900">Next after this</h2>
          <p className="mt-2 text-sm text-ink-600">
            Layer 2 is where one connected source turns a generic workspace into
            client-specific timing, anomaly, and reminder behavior.
          </p>
          <Link
            to="/onboarding/layer-2"
            className="mt-4 inline-flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
          >
            Continue to Layer 2
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

export function OnboardingLayer2() {
  const navigate = useNavigate();
  const integrationsQuery = useIntegrations();
  const availableQuery = useAvailableIntegrations();
  const connectIntegration = useConnectIntegration();

  const integrations = integrationsQuery.data ?? [];
  const available = availableQuery.data ?? [];

  const connectedTypes = new Set(
    integrations
      .filter((item) => item.status === "connected")
      .map((item) => item.type)
  );

  const recommended = available.filter((item) =>
    ["qbo", "xero", "prior_year_pdf"].includes(item.type)
  );
  const enrichment = available.filter(
    (item) => !["qbo", "xero", "prior_year_pdf"].includes(item.type)
  );

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <header className="border border-line bg-surface rounded-md p-5">
        <div className="text-xs uppercase tracking-wide text-ink-500">
          Onboarding Layer 2
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-ink-900">
          Connect one source to unlock personalized intelligence
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-600">
          This step is about depth, not breadth. One connected source is enough
          to unlock better reminder timing, anomaly baselines, and richer task
          context. The rest can follow over time.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-4">
          <IntegrationGroup
            title="Recommended first connections"
            description="Choose one of these to complete Layer 2."
            items={recommended}
            connectedTypes={connectedTypes}
            onConnect={(type) =>
              connectIntegration.mutate(type, {
                onSuccess: () => integrationsQuery.refetch(),
              })
            }
            pendingType={connectIntegration.variables?.type}
            isPending={connectIntegration.isPending}
          />

          <IntegrationGroup
            title="Follow-on enrichment"
            description="These deepen reminders, audit export, and client intelligence over time."
            items={enrichment}
            connectedTypes={connectedTypes}
            onConnect={(type) =>
              connectIntegration.mutate(type, {
                onSuccess: () => integrationsQuery.refetch(),
              })
            }
            pendingType={connectIntegration.variables?.type}
            isPending={connectIntegration.isPending}
          />
        </div>

        <aside className="space-y-4">
          <div className="border border-line bg-surface rounded-md p-5">
            <h2 className="text-sm font-semibold text-ink-900">
              What Layer 2 unlocks
            </h2>
            <div className="mt-4 space-y-3">
              <UnlockRow
                icon={Inbox}
                title="Mode B timing"
                copy="Expected arrival windows and follow-up timing become client-aware instead of purely substrate-based."
              />
              <UnlockRow
                icon={Sparkles}
                title="Mode C anomalies"
                copy="Incoming facts can be compared against prior-year baselines so questionable docs land as issues, not just unreviewed."
              />
              <UnlockRow
                icon={Link2}
                title="Mode D reminders"
                copy="Reminder drafts cite richer sources and better match how the firm already communicates."
              />
            </div>
          </div>

          <div className="border border-line bg-surface rounded-md p-5">
            <h2 className="text-sm font-semibold text-ink-900">
              Current progress
            </h2>
            <p className="mt-2 text-sm text-ink-600">
              {connectedTypes.size === 0
                ? "No integrations connected yet."
                : `${connectedTypes.size} integration${
                    connectedTypes.size === 1 ? "" : "s"
                  } connected.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {integrations.length === 0 ? (
                <span className="text-xs text-ink-500">Nothing connected yet.</span>
              ) : (
                integrations.map((item) => (
                  <span
                    key={item.id}
                    className="text-xs px-2 py-1 rounded border border-line text-ink-700"
                  >
                    {item.type} · {item.status}
                  </span>
                ))
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => navigate("/")}
                className="text-sm px-3 py-2 rounded-md bg-accent text-canvas hover:bg-accent-hover"
              >
                Go to dashboard
              </button>
              <Link
                to="/settings/integrations"
                className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
              >
                Open integrations settings
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  eyebrow,
  title,
  copy,
  actionLabel,
  to,
  onAction,
  disabled,
  footer,
}: {
  icon: typeof Sparkles;
  eyebrow: string;
  title: string;
  copy: string;
  actionLabel: string;
  to?: string;
  onAction?: () => void;
  disabled?: boolean;
  footer: string;
}) {
  const content = (
    <>
      <div className="w-9 h-9 rounded-md border border-line flex items-center justify-center">
        <Icon className="w-4 h-4 text-ink-900" />
      </div>
      <div className="mt-4 text-xs uppercase tracking-wide text-ink-500">
        {eyebrow}
      </div>
      <h2 className="mt-1 text-lg font-semibold text-ink-900">{title}</h2>
      <p className="mt-2 text-sm text-ink-600">{copy}</p>
      <div className="mt-5">
        <span className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-line">
          {actionLabel}
          <ArrowRight className="w-4 h-4" />
        </span>
      </div>
      <p className="mt-4 text-xs text-ink-500">{footer}</p>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="border border-line bg-surface rounded-md p-5 hover:bg-sunken transition-colors"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onAction}
      disabled={disabled}
      className="text-left border border-line bg-surface rounded-md p-5 hover:bg-sunken transition-colors disabled:opacity-60 disabled:cursor-wait"
    >
      {content}
    </button>
  );
}

function IntegrationGroup({
  title,
  description,
  items,
  connectedTypes,
  onConnect,
  pendingType,
  isPending,
}: {
  title: string;
  description: string;
  items: Array<{ type: string; tier: number; label: string }>;
  connectedTypes: Set<string>;
  onConnect: (input: { type: string }) => void;
  pendingType?: string;
  isPending: boolean;
}) {
  return (
    <section className="border border-line bg-surface rounded-md overflow-hidden">
      <header className="px-5 py-4 border-b border-line">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        <p className="mt-1 text-sm text-ink-600">{description}</p>
      </header>
      <div className="divide-y divide-line">
        {items.map((item) => {
          const connected = connectedTypes.has(item.type);
          const pending = isPending && pendingType === item.type;
          return (
            <div
              key={item.type}
              className="px-5 py-4 flex flex-col gap-3 md:flex-row md:items-center"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-ink-900">
                  {item.label}
                </div>
                <div className="mt-1 text-xs text-ink-500">
                  Tier {item.tier} integration ·{" "}
                  {connected
                    ? "connected"
                    : item.type === "prior_year_pdf"
                    ? "upload-style enrichment"
                    : "connect to unlock client-specific context"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onConnect({ type: item.type })}
                disabled={connected || pending}
                className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken disabled:opacity-60"
              >
                {connected ? "Connected" : pending ? "Connecting…" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function UnlockRow({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof Sparkles;
  title: string;
  copy: string;
}) {
  return (
    <div className="border border-line rounded-md px-3 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-ink-900">
        <Icon className="w-4 h-4" />
        {title}
      </div>
      <p className="mt-1 text-sm text-ink-600">{copy}</p>
    </div>
  );
}
