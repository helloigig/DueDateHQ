import { useMemo, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  BadgeDollarSign,
  Building2,
  CreditCard,
  FolderSync,
  Link2,
  Mail,
  Shield,
  Users2,
} from "lucide-react";
import { trpc } from "../lib/api/client";
import { useFirm } from "../hooks/useFirm";
import { useImportHistory, useUndoImport } from "../hooks/useImports";
import {
  useAvailableIntegrations,
  useConnectIntegration,
  useDisconnectIntegration,
  useIntegrations,
  useSyncIntegration,
} from "../hooks/useIntegrations";
import { useReminderTemplates, useUpdateReminderTemplate } from "../hooks/useReminderTemplates";
import { useServicePackages } from "../hooks/useServicePackages";
import { signOut, updateSession, useSession, type FirmSession } from "../data/session";
import { useRemoteSession } from "../hooks/useSession";
import type { ReminderTemplate } from "../types";

const NAV = [
  { to: "firm", label: "Firm", icon: Building2 },
  { to: "team", label: "Team", icon: Users2 },
  { to: "packages", label: "Service Packages", icon: BadgeDollarSign },
  { to: "reminders", label: "Reminders", icon: Mail },
  { to: "integrations", label: "Integrations", icon: Link2 },
  { to: "imports", label: "Imports", icon: FolderSync },
  { to: "billing", label: "Billing", icon: CreditCard },
  { to: "account", label: "Account", icon: Shield },
];

export function Settings() {
  const remoteSession = useRemoteSession();
  const summary = useMemo(() => {
    const firm = remoteSession.data?.firm;
    if (!firm) return null;
    return [
      `${firm.tier} plan`,
      firm.subscriptionStatus.replace(/_/g, " "),
      firm.primaryStates.length > 0
        ? `${firm.primaryStates.length} primary state${
            firm.primaryStates.length === 1 ? "" : "s"
          }`
        : "no states set",
    ];
  }, [remoteSession.data]);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <header className="border border-line bg-surface rounded-md p-5">
        <div className="text-xs uppercase tracking-wide text-ink-500">
          Settings
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-ink-900">
          Configure the firm behind the workflow
        </h1>
        <p className="mt-2 text-sm text-ink-600 max-w-3xl">
          This is where DueDateHQ picks up firm identity, team access, service
          package baselines, reminder templates, integrations, and billing
          limits.
        </p>
        {summary && (
          <div className="mt-4 flex flex-wrap gap-2">
            {summary.map((item) => (
              <span
                key={item}
                className="text-xs px-2 py-1 rounded border border-line text-ink-600"
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="border border-line bg-surface rounded-md overflow-hidden h-fit">
          <nav className="divide-y divide-line">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 text-sm ${
                    isActive
                      ? "bg-sunken text-ink-900 font-medium"
                      : "text-ink-600 hover:bg-sunken"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          <Routes>
            <Route index element={<Navigate to="firm" replace />} />
            <Route path="firm" element={<FirmPanel />} />
            <Route path="team" element={<TeamPanel />} />
            <Route path="packages" element={<PackagesPanel />} />
            <Route path="reminders" element={<RemindersPanel />} />
            <Route path="integrations" element={<IntegrationsPanel />} />
            <Route path="imports" element={<ImportsPanel />} />
            <Route path="billing" element={<BillingPanel />} />
            <Route path="account" element={<AccountPanel />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function FirmPanel() {
  const { firm, isLoading } = useFirm();
  const sessionQuery = useRemoteSession();

  if (isLoading) {
    return <Surface title="Firm">Loading…</Surface>;
  }

  if (!firm || !sessionQuery.data) {
    return <Surface title="Firm">Firm details are unavailable.</Surface>;
  }

  return (
    <div className="space-y-4">
      <Surface
        title="Firm profile"
        description="Tenant-level identity and limits used across onboarding, reminders, and alerts."
      >
        <KeyValueGrid
          rows={[
            ["Name", firm.name],
            ["Tier", firm.tier],
            ["Subscription", firm.subscriptionStatus.replace(/_/g, " ")],
            ["Primary states", firm.primaryStates.join(", ") || "None set"],
            ["Client limit", firm.clientLimit === null ? "Unlimited" : String(firm.clientLimit)],
            ["Seat limit", String(firm.seatLimit)],
          ]}
        />
      </Surface>

      <Surface
        title="Branding surfaces"
        description="Wireframe-level for now, but these values already flow into outbound email and account identity."
      >
        <KeyValueGrid
          rows={[
            [
              "Email signature",
              sessionQuery.data.firm.branding?.emailSignature ??
                "Best, Sarah Mitchell\nMitchell CPA",
            ],
            [
              "Primary color",
              sessionQuery.data.firm.branding?.primaryColor ?? "Not customized",
            ],
            ["Logo", sessionQuery.data.firm.logoStorageKey ?? "No logo uploaded"],
          ]}
        />
      </Surface>
    </div>
  );
}

function TeamPanel() {
  const teamQuery = trpc.team.list.useQuery();
  const invite = trpc.team.invite.useMutation({
    onSuccess: () => teamQuery.refetch(),
  });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "member">("member");

  return (
    <div className="space-y-4">
      <Surface
        title="Team access"
        description="Owners can manage firm settings. Members work tasks, review checklist items, and send reminders."
      >
        <form
          className="grid gap-3 md:grid-cols-[1fr_180px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            if (!email.trim()) return;
            invite.mutate(
              { email: email.trim(), role },
              {
                onSuccess: () => {
                  setEmail("");
                  setRole("member");
                },
              }
            );
          }}
        >
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@firm.com"
            className="px-3 py-2 rounded-md border border-line text-sm"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as "owner" | "member")}
            className="px-3 py-2 rounded-md border border-line text-sm bg-surface"
          >
            <option value="member">Member</option>
            <option value="owner">Owner</option>
          </select>
          <button
            type="submit"
            disabled={invite.isPending}
            className="text-sm px-3 py-2 rounded-md bg-accent text-canvas hover:bg-accent-hover disabled:opacity-60"
          >
            {invite.isPending ? "Inviting…" : "Invite teammate"}
          </button>
        </form>
      </Surface>

      <Surface title="Current team">
        <div className="divide-y divide-line">
          {(teamQuery.data ?? []).map((member) => (
            <div
              key={member.id}
              className="py-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="text-sm font-medium text-ink-900">
                  {member.displayName ?? member.email}
                </div>
                <div className="text-xs text-ink-500">{member.email}</div>
              </div>
              <div className="text-xs text-ink-500">
                {member.role} · Last active {member.lastActiveAt ?? "recently"}
              </div>
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}

function PackagesPanel() {
  const packagesQuery = useServicePackages();
  const packages = packagesQuery.data ?? [];

  return (
    <Surface
      title="Service packages"
      description="The Mode A baseline starts here. Packages determine which deadlines and checklist items appear on client tasks."
    >
      <div className="space-y-3">
        {packages.map((pkg) => (
          <div key={pkg.id} className="border border-line rounded-md p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-ink-900">{pkg.name}</h3>
              <span className="text-xs px-2 py-1 rounded border border-line text-ink-500">
                {pkg.isSystem ? "System" : "Custom"}
              </span>
            </div>
            {pkg.description && (
              <p className="mt-2 text-sm text-ink-600">{pkg.description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-500">
              <span className="px-2 py-1 rounded bg-sunken">
                Entities: {pkg.applicableEntityTypes.join(", ") || "Any"}
              </span>
              <span className="px-2 py-1 rounded bg-sunken">
                States: {pkg.applicableStates.join(", ") || "Any"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function RemindersPanel() {
  const templatesQuery = useReminderTemplates();
  const updateTemplate = useUpdateReminderTemplate();

  return (
    <Surface
      title="Reminder templates"
      description="These are the Phase 1 drafts that feed the email modal. Tone switching happens at send time; the template is the baseline."
    >
      <div className="space-y-4">
        {(templatesQuery.data ?? []).map((template) => (
          <ReminderTemplateEditor
            key={template.id}
            template={template}
            onSave={(patch) =>
              updateTemplate.mutate({ id: template.id, patch })
            }
            saving={updateTemplate.isPending && updateTemplate.variables?.id === template.id}
          />
        ))}
      </div>
    </Surface>
  );
}

function IntegrationsPanel() {
  const integrationsQuery = useIntegrations();
  const availableQuery = useAvailableIntegrations();
  const connect = useConnectIntegration();
  const syncNow = useSyncIntegration();
  const disconnect = useDisconnectIntegration();
  const integrations = integrationsQuery.data ?? [];
  const available = availableQuery.data ?? [];

  return (
    <div className="space-y-4">
      <Surface
        title="Connected sources"
        description="This is the Layer 2 and Layer 3 growth surface: roster first, then one source, then ongoing enrichment."
      >
        <div className="space-y-3">
          {available.map((item) => {
            const existing = integrations.find((row) => row.type === item.type);
            return (
              <div
                key={item.type}
                className="border border-line rounded-md p-4 flex flex-col gap-3 md:flex-row md:items-center"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-ink-900">
                    {item.label}
                  </div>
                  <div className="mt-1 text-xs text-ink-500">
                    Tier {item.tier} ·{" "}
                    {existing
                      ? `status ${existing.status}`
                      : "not connected"}
                    {existing?.lastSyncAt
                      ? ` · last sync ${new Date(existing.lastSyncAt).toLocaleString()}`
                      : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {existing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => syncNow.mutate({ id: existing.id })}
                        className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
                      >
                        Sync now
                      </button>
                      <button
                        type="button"
                        onClick={() => disconnect.mutate({ id: existing.id })}
                        className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => connect.mutate({ type: item.type })}
                      className="text-sm px-3 py-2 rounded-md bg-accent text-canvas hover:bg-accent-hover"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Surface>
    </div>
  );
}

function ImportsPanel() {
  const historyQuery = useImportHistory();
  const undoImport = useUndoImport();
  const rows = historyQuery.data ?? [];

  return (
    <Surface
      title="Import history"
      description="Import Tier 1 is the signup unlock. Tiers 2-4 build on it over time."
    >
      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="text-sm text-ink-500">No imports recorded yet.</div>
        ) : (
          rows.map((run) => (
            <div key={run.id} className="border border-line rounded-md p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-medium text-ink-900">
                    {run.originalFilename ?? "Imported dataset"}
                  </div>
                  <div className="mt-1 text-xs text-ink-500">
                    {run.sourceFormat ?? "unknown source"} · {run.status} ·{" "}
                    {new Date(run.createdAt).toLocaleString()}
                  </div>
                </div>
                {run.status !== "undone" && (
                  <button
                    type="button"
                    onClick={() => undoImport.mutate({ id: run.id })}
                    className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
                  >
                    Undo import
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-500">
                <span className="px-2 py-1 rounded bg-sunken">
                  Clients created: {run.clientsCreated}
                </span>
                <span className="px-2 py-1 rounded bg-sunken">
                  Deadlines created: {run.deadlinesCreated}
                </span>
                <span className="px-2 py-1 rounded bg-sunken">
                  Rows failed: {run.rowsFailed}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </Surface>
  );
}

function BillingPanel() {
  const sessionQuery = useRemoteSession();
  const firm = sessionQuery.data?.firm;

  return (
    <div className="space-y-4">
      <Surface
        title="Plan and limits"
        description="Simple wireframe billing for now, but it matches the real firm tier and seat model."
      >
        {firm ? (
          <KeyValueGrid
            rows={[
              ["Plan", firm.tier],
              ["Subscription", firm.subscriptionStatus.replace(/_/g, " ")],
              ["Trial ends", firm.trialEndsAt ?? "N/A"],
              ["Seat limit", String(firm.seatLimit)],
              ["Client limit", firm.clientLimit === null ? "Unlimited" : String(firm.clientLimit)],
            ]}
          />
        ) : (
          <div className="text-sm text-ink-500">Billing details unavailable.</div>
        )}
      </Surface>
      <Surface title="Commercial posture">
        <p className="text-sm text-ink-600">
          The wedge is alerts, but the body is document chasing. This page is
          intentionally spare for now; the working limits already enforce the
          firm plan model underneath.
        </p>
      </Surface>
    </div>
  );
}

function AccountPanel() {
  const navigate = useNavigate();
  const localSession = useSession();
  const [digestMode, setDigestMode] = useState<FirmSession["digestMode"]>(
    localSession?.digestMode ?? "digest_8am"
  );

  return (
    <div className="space-y-4">
      <Surface
        title="Account"
        description="User identity and delivery preferences for the current signed-in CPA."
      >
        {localSession ? (
          <KeyValueGrid
            rows={[
              ["Name", localSession.userName],
              ["Email", localSession.userEmail],
              ["Firm", localSession.firmName],
              ["Signed in", new Date(localSession.signedInAt).toLocaleString()],
            ]}
          />
        ) : (
          <div className="text-sm text-ink-500">No active local session.</div>
        )}
      </Surface>

      <Surface title="Alert delivery">
        <div className="space-y-2">
          {[
            {
              value: "digest_8am" as const,
              label: "Daily 8am digest",
              copy: "One message covering new alerts and queued reminders.",
            },
            {
              value: "per_alert" as const,
              label: "Per-alert email",
              copy: "Send an email whenever a new state alert lands.",
            },
          ].map((option) => (
            <label
              key={option.value}
              className={`block border rounded-md px-3 py-3 cursor-pointer ${
                digestMode === option.value
                  ? "border-ink-900 bg-sunken"
                  : "border-line"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  checked={digestMode === option.value}
                  onChange={() => {
                    setDigestMode(option.value);
                    updateSession({ digestMode: option.value });
                  }}
                />
                <div>
                  <div className="text-sm font-medium text-ink-900">
                    {option.label}
                  </div>
                  <div className="text-xs text-ink-500">{option.copy}</div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </Surface>

      <Surface title="Session controls">
        <button
          type="button"
          onClick={() => {
            signOut();
            navigate("/login", { replace: true });
          }}
          className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
        >
          Sign out
        </button>
      </Surface>
    </div>
  );
}

function ReminderTemplateEditor({
  template,
  onSave,
  saving,
}: {
  template: ReminderTemplate;
  onSave: (patch: Partial<ReminderTemplate>) => void;
  saving: boolean;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.bodyMdx);
  const [active, setActive] = useState(template.active);

  return (
    <div className="border border-line rounded-md p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-medium text-ink-900">
            {template.templateKey.replace(/_/g, " ")}
          </div>
          <div className="text-xs text-ink-500">
            Template id {template.id.slice(0, 8)} · package{" "}
            {template.packageId ?? "all"}
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Active
        </label>
      </div>
      <div className="mt-4 space-y-3">
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="w-full px-3 py-2 rounded-md border border-line text-sm"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={7}
          className="w-full px-3 py-2 rounded-md border border-line text-sm"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => onSave({ subject, bodyMdx: body, active })}
          className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
        >
          {saving ? "Saving…" : "Save template"}
        </button>
      </div>
    </div>
  );
}

function Surface({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-line bg-surface rounded-md overflow-hidden">
      <header className="px-5 py-4 border-b border-line">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-ink-600">{description}</p>
        )}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function KeyValueGrid({
  rows,
}: {
  rows: Array<[label: string, value: string]>;
}) {
  return (
    <dl className="grid gap-3 md:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="border border-line rounded-md px-3 py-3">
          <dt className="text-xs uppercase tracking-wide text-ink-500">
            {label}
          </dt>
          <dd className="mt-1 text-sm text-ink-900 whitespace-pre-wrap">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
