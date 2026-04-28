import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AddClientModal } from "../components/AddClientModal";
import { StateChipGroup } from "../components/StateChipGroup";
import { PageSkeleton } from "../components/skeletons/DashboardSkeleton";
import { ErrorState } from "../components/ErrorState";
import { useClients } from "../hooks/useClients";
import { useTriageDeadlines } from "../hooks/useDeadlines";
import { useFeatureFlags } from "../hooks/useFeatureFlags";
import { UpgradePrompt } from "../components/UpgradePrompt";
import { countdownLabel, parseDate, TODAY, daysBetween } from "../data/dateHelpers";

export function Clients() {
  const clientsQuery = useClients();
  const triageQuery = useTriageDeadlines();
  const clients = clientsQuery.data?.items ?? [];
  const deadlines = useMemo(() => {
    const t = triageQuery.data;
    if (!t) return [];
    return [...t.overdue, ...t.thisWeek, ...t.thisMonth, ...t.longTerm];
  }, [triageQuery.data]);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const navigate = useNavigate();
  const flags = useFeatureFlags();
  const atLimit =
    flags.hasClientLimit &&
    flags.clientLimit !== null &&
    clients.length >= flags.clientLimit;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.contactEmail.toLowerCase().includes(q) ||
        c.primaryState.toLowerCase().includes(q) ||
        c.entityType.toLowerCase().includes(q)
    );
  }, [clients, query]);

  const countOpenDeadlines = (clientId: string) =>
    deadlines.filter(
      (d) =>
        d.clientId === clientId &&
        d.status !== "completed" &&
        d.status !== "filed_extension"
    ).length;

  const nextDeadlineFor = (clientId: string) => {
    const open = deadlines
      .filter(
        (d) =>
          d.clientId === clientId &&
          d.status !== "completed" &&
          d.status !== "filed_extension"
      )
      .sort((a, b) => a.officialDueDate.localeCompare(b.officialDueDate));
    return open[0] ?? null;
  };

  if (clientsQuery.isLoading) return <PageSkeleton title="Loading clients…" />;
  if (clientsQuery.error) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
        <ErrorState
          title="Couldn't load clients."
          message={
            clientsQuery.error instanceof Error
              ? clientsQuery.error.message
              : undefined
          }
          onRetry={() => clientsQuery.refetch()}
        />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="bg-surface border border-line rounded-md px-6 py-16 text-center">
          <p className="text-sm text-ink-700 font-medium">Let's get your clients in.</p>
          <p className="text-xs text-ink-500 mt-1">
            Bulk import, quick add, or try a sample workspace.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => navigate("/import")}
              className="text-sm px-3 py-1.5 rounded-md bg-accent text-canvas hover:bg-accent-hover"
            >
              Import CSV
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="text-sm px-3 py-1.5 rounded-md border border-line text-ink-700 hover:bg-sunken"
            >
              Add 5 manually
            </button>
            <button
              onClick={() => navigate("/import?demo=1")}
              className="text-sm px-3 py-1.5 rounded-md border border-line text-ink-700 hover:bg-sunken"
            >
              Try demo data
            </button>
          </div>
        </div>
        <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} />
      </div>
    );
  }

  const activeCount = clients.filter((c) => c.status === "active").length;
  const openTaskCount = deadlines.filter(
    (d) => d.status !== "completed" && d.status !== "filed_extension"
  ).length;
  const dueSoonCount = deadlines.filter((d) => {
    const diff = daysBetween(TODAY, parseDate(d.officialDueDate));
    return diff >= 0 && diff <= 7 && d.status !== "completed" && d.status !== "filed_extension";
  }).length;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <header>
        <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
          Clients
        </p>
        <h1 className="text-2xl font-semibold text-ink-900 mt-1">
          Firm roster and work surface
        </h1>
        <p className="text-sm text-ink-500 mt-2 max-w-2xl">
          Each client carries entity, jurisdictions, service packages, and a
          per-task forwarding address. Click a row to open the client view; the
          open-task count tells you what's still moving.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <StatCard label="Active clients" value={activeCount} helper="Excludes archived and inactive" />
          <StatCard label="Open tasks" value={openTaskCount} helper="Across the entire roster" />
          <StatCard label="Due in 7 days" value={dueSoonCount} helper="Urgency window" />
        </div>
      </header>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by name, email, state, or entity…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 md:w-80 text-sm px-3 py-2 rounded-md border border-line bg-surface text-ink-900 placeholder:text-ink-400"
        />
        <span className="text-xs text-ink-500 ml-auto">
          {filtered.length} of {clients.length}
        </span>
        <button
          onClick={() => navigate("/import")}
          className="hidden md:inline-flex text-sm px-3 py-1.5 rounded-md border border-line text-ink-700 hover:bg-sunken"
        >
          Import CSV
        </button>
        <button
          onClick={() => setAddOpen(true)}
          disabled={atLimit}
          title={atLimit ? `Solo plan limit (${flags.clientLimit}) reached` : undefined}
          className="text-sm px-3 py-1.5 rounded-md bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add client
        </button>
      </div>

      {atLimit && (
        <div className="mb-4">
          <UpgradePrompt
            feature={`Adding more than ${flags.clientLimit} clients`}
            requiredTier="pro"
            inline
          />
        </div>
      )}

      <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} />

      <div className="bg-surface border border-line rounded-md overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-sunken text-2xs uppercase tracking-wider text-ink-700">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Name</th>
              <th className="text-left px-4 py-2 font-semibold">Entity</th>
              <th className="text-left px-4 py-2 font-semibold">States</th>
              <th className="text-right px-4 py-2 font-semibold">Open</th>
              <th className="text-right px-4 py-2 font-semibold">Next deadline</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const next = nextDeadlineFor(c.id);
              const nextDays = next
                ? daysBetween(TODAY, parseDate(next.officialDueDate))
                : null;
              const isOverdue = nextDays !== null && nextDays < 0;
              return (
                <tr
                  key={c.id}
                  className="border-b border-line last:border-b-0 hover:bg-sunken"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/clients/${c.id}`}
                      className="text-ink-900 font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-ink-700">{c.entityType}</td>
                  <td className="px-4 py-2.5">
                    <StateChipGroup
                      primary={c.primaryState}
                      nexus={c.nexusStates}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-700 tabular-nums">
                    {countOpenDeadlines(c.id)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right tabular-nums ${
                      isOverdue ? "text-danger-ink font-medium" : "text-ink-700"
                    }`}
                  >
                    {next ? countdownLabel(next.officialDueDate) : "—"}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <p className="text-sm text-ink-700 font-medium">
                    No clients match "{query}".
                  </p>
                  <button
                    onClick={() => setQuery("")}
                    className="mt-3 text-sm px-3 py-1.5 rounded-md border border-line text-ink-700 hover:bg-sunken"
                  >
                    Clear filter
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper?: string;
}) {
  return (
    <div className="border border-line rounded-md p-3 bg-surface">
      <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
        {label}
      </p>
      <p className="text-xl font-semibold text-ink-900 mt-1 tabular-nums">
        {value}
      </p>
      {helper && (
        <p className="text-2xs text-ink-500 mt-0.5">{helper}</p>
      )}
    </div>
  );
}

