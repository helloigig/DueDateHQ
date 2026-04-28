import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Search } from "lucide-react";
import { AddClientModal } from "../components/AddClientModal";
import { StateChipGroup } from "../components/StateChipGroup";
import { PageSkeleton } from "../components/skeletons/DashboardSkeleton";
import { ErrorState } from "../components/ErrorState";
import { useClients } from "../hooks/useClients";
import { useTriageDeadlines } from "../hooks/useDeadlines";
import { daysBetween, parseDate, TODAY } from "../data/dateHelpers";
import type { Deadline } from "../types";

export function Clients() {
  const clientsQuery = useClients();
  const triageQuery = useTriageDeadlines();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const clients = clientsQuery.data?.items ?? [];
  const deadlines = useMemo(() => {
    const triage = triageQuery.data;
    if (!triage) return [] as Deadline[];
    return [...triage.overdue, ...triage.thisWeek, ...triage.thisMonth, ...triage.longTerm];
  }, [triageQuery.data]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((client) =>
      [
        client.name,
        client.contactEmail,
        client.entityType,
        client.primaryState,
        ...(client.servicePackages ?? []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [clients, query]);

  if (clientsQuery.isLoading || triageQuery.isLoading) {
    return <PageSkeleton title="Loading clients…" />;
  }

  if (clientsQuery.error || triageQuery.error) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <ErrorState
          title="Couldn't load clients."
          message={
            (clientsQuery.error ?? triageQuery.error) instanceof Error
              ? (clientsQuery.error ?? triageQuery.error)?.message
              : undefined
          }
          onRetry={() => {
            clientsQuery.refetch();
            triageQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        <div className="border border-line bg-surface rounded-md p-8">
          <div className="text-xs uppercase tracking-wide text-ink-500">
            Client roster
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">
            No clients yet
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-600">
            Import Tier 1 is the first real unlock. Bring in a client list and
            the dashboard, alerts, and task layers all become useful at once.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/onboarding/layer-1"
              className="text-sm px-3 py-2 rounded-md bg-accent text-canvas hover:bg-accent-hover"
            >
              Start onboarding
            </Link>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
            >
              Add client manually
            </button>
          </div>
        </div>
        <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} />
      </div>
    );
  }

  const activeCount = clients.filter((client) => client.status === "active").length;
  const openTaskCount = deadlines.filter((deadline) => !isClosed(deadline)).length;
  const dueSoonCount = deadlines.filter((deadline) => {
    const diff = daysBetween(TODAY, parseDate(deadline.officialDueDate));
    return diff >= 0 && diff <= 7 && !isClosed(deadline);
  }).length;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <header className="border border-line bg-surface rounded-md p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-ink-500">
              Clients
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-ink-900">
              Firm roster and work surface
            </h1>
            <p className="mt-2 text-sm text-ink-600">
              Client detail is where per-client context lives. Task detail is
              where the actual document chase happens.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/import")}
              className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
            >
              Import clients
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="text-sm px-3 py-2 rounded-md bg-accent text-canvas hover:bg-accent-hover"
            >
              Add client
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatCard label="Active clients" value={activeCount} />
          <StatCard label="Open tasks" value={openTaskCount} />
          <StatCard label="Due in 7 days" value={dueSoonCount} />
        </div>
      </header>

      <section className="border border-line bg-surface rounded-md overflow-hidden">
        <div className="px-4 py-4 border-b border-line flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">All clients</h2>
            <p className="text-sm text-ink-600">
              Search by name, email, entity, state, or service package.
            </p>
          </div>
          <label className="relative block lg:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search clients"
              className="w-full pl-9 pr-3 py-2 rounded-md border border-line text-sm bg-surface"
            />
          </label>
        </div>

        <div className="divide-y divide-line">
          {filtered.map((client) => {
            const openDeadlines = deadlinesForClient(deadlines, client.id);
            const nextDeadline = openDeadlines[0] ?? null;
            const nextTaskHref =
              nextDeadline?.taskId != null
                ? `/clients/${client.id}/tasks/${nextDeadline.taskId}`
                : `/clients/${client.id}`;

            return (
              <div
                key={client.id}
                className="px-4 py-4 flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1.2fr)_220px_160px_170px_auto] xl:items-center"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/clients/${client.id}`}
                      className="text-sm font-medium text-ink-900 hover:underline"
                    >
                      {client.name}
                    </Link>
                    <span className="text-xs px-2 py-1 rounded border border-line text-ink-500">
                      {client.entityType}
                    </span>
                    <span className="text-xs px-2 py-1 rounded border border-line text-ink-500">
                      {client.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 items-center text-xs text-ink-500">
                    <span>{client.contactEmail}</span>
                    <span>·</span>
                    <span>
                      Packages:{" "}
                      {client.servicePackages.length > 0
                        ? client.servicePackages.join(", ")
                        : "none assigned"}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-ink-500">
                    States
                  </div>
                  <div className="mt-2">
                    <StateChipGroup
                      primary={client.primaryState}
                      nexus={client.nexusStates}
                    />
                  </div>
                </div>

                <DataBlock
                  label="Open tasks"
                  value={String(openDeadlines.length)}
                  helper={
                    openDeadlines.length === 0 ? "Nothing active" : "Across all buckets"
                  }
                />

                <DataBlock
                  label="Next due"
                  value={nextDeadline ? nextDeadline.officialDueDate : "—"}
                  helper={nextDeadline ? nextDeadline.form : "No open work"}
                />

                <div className="flex xl:justify-end">
                  <Link
                    to={nextTaskHref}
                    className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken inline-flex items-center gap-2"
                  >
                    {nextDeadline?.taskId ? "Open next task" : "Open client"}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-ink-500">
            No clients match “{query}”.
          </div>
        )}
      </section>

      <section className="border border-line bg-surface rounded-md p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-ink-900">
          <Building2 className="w-4 h-4" />
          Information architecture note
        </div>
        <p className="mt-2 text-sm text-ink-600">
          Client detail holds longitudinal context: contacts, documents,
          notes, and history. Task detail holds the live checklist and reminder
          loop. Keeping those layers separate is the point of the v0.7 model.
        </p>
      </section>

      <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function deadlinesForClient(deadlines: Deadline[], clientId: string) {
  return deadlines
    .filter((deadline) => deadline.clientId === clientId && !isClosed(deadline))
    .sort((a, b) => a.officialDueDate.localeCompare(b.officialDueDate));
}

function isClosed(deadline: Deadline) {
  return deadline.status === "completed" || deadline.status === "filed_extension";
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="border border-line rounded-md px-4 py-4">
      <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink-900">{value}</div>
    </div>
  );
}

function DataBlock({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-ink-900">{value}</div>
      <div className="text-xs text-ink-500">{helper}</div>
    </div>
  );
}
