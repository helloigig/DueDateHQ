import { useMemo, useState } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { Mail, Bell, User, Download, Upload, Users2, Trash2 } from "lucide-react";
import { actions } from "../data/store";
import { useImportHistory } from "../hooks/useImports";
import { signOut, updateSession, useSession } from "../data/session";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErrorState } from "../components/ErrorState";
import { UpgradePrompt } from "../components/UpgradePrompt";
import { useFeatureFlags } from "../hooks/useFeatureFlags";
import type { FirmSession } from "../data/session";

const NAV = [
  { to: "/settings", label: "Profile", icon: User, end: true },
  { to: "/settings/alerts", label: "Alerts & email", icon: Mail },
  { to: "/settings/notifications", label: "Notifications", icon: Bell },
  { to: "/settings/imports", label: "Imports", icon: Upload },
  { to: "/settings/team", label: "Team", icon: Users2 },
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
          <Route path="alerts" element={<AlertsPanel />} />
          <Route path="notifications" element={<NotificationsPanel />} />
          <Route path="imports" element={<ImportsPanel />} />
          <Route path="team" element={<TeamPanel />} />
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
    signOut();
    navigate("/login", { replace: true });
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
      <Card title="Imports">
        <p className="text-sm text-ink-500">
          No CSV imports yet. Try{" "}
          <NavLink to="/import" className="text-ink-900 underline">
            importing clients
          </NavLink>
          .
        </p>
      </Card>
    );
  }

  const undoTarget = imports.find((r) => r.id === confirming);

  return (
    <>
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
              <p className="mt-2 text-xs text-slate-500">
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
  if (!flags.canInviteTeammates) {
    return (
      <UpgradePrompt feature="Team invites" requiredTier="pro" />
    );
  }
  return (
    <Card
      title="Team members"
      description={`Invite up to ${flags.maxTeammates} teammate${
        flags.maxTeammates === 1 ? "" : "s"
      } and assign client ownership.`}
    >
      <p className="text-sm text-ink-500">
        Team invite flow ships with the {flags.tier === "team" ? "Team" : "Pro"}{" "}
        tier release. You're on {flags.tier}.
      </p>
    </Card>
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
