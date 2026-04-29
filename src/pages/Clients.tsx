import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { AddClientModal } from "../components/AddClientModal";
import { StateChipGroup } from "../components/StateChipGroup";
import { MultiSelectChip } from "../components/MultiSelectChip";
import { SpotlightStrip, type SpotlightCard } from "../components/SpotlightStrip";
import { PageSkeleton } from "../components/skeletons/DashboardSkeleton";
import { ErrorState } from "../components/ErrorState";
import { useClients } from "../hooks/useClients";
import { useTriageDeadlines } from "../hooks/useDeadlines";
import { useAnnouncements } from "../hooks/useAnnouncements";
import { useFeatureFlags } from "../hooks/useFeatureFlags";
import { UpgradePrompt } from "../components/UpgradePrompt";
import { countdownLabel, parseDate, TODAY, daysBetween } from "../data/dateHelpers";
import {
  STATE_NAMES,
  type ClientStatus,
  type ClientTier,
  type EntityType,
  type StateCode,
} from "../types";

const ENTITY_OPTIONS: { value: EntityType; label: string }[] = [
  { value: "LLC", label: "LLC" },
  { value: "S-Corp", label: "S-Corp" },
  { value: "C-Corp", label: "C-Corp" },
  { value: "Individual", label: "Individual" },
  { value: "Partnership", label: "Partnership" },
  { value: "Trust", label: "Trust" },
];

const STATE_OPTIONS: { value: StateCode; label: string }[] = (
  Object.keys(STATE_NAMES) as StateCode[]
).map((code) => ({ value: code, label: `${code} · ${STATE_NAMES[code]}` }));

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "prospect", label: "Prospect" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

const TIER_OPTIONS: { value: ClientTier; label: string }[] = [
  { value: "premium", label: "Premium" },
  { value: "standard", label: "Standard" },
  { value: "custom", label: "Custom" },
];

const TIER_LABEL: Record<ClientTier, string> = {
  premium: "Premium",
  standard: "Standard",
  custom: "Custom",
};

type SortColumn = "name" | "entity" | "open" | "next";
type SortDir = "asc" | "desc";

interface Filters {
  entity: string[];
  state: string[];
  status: string[];
  tier: string[];
  servicePackage: string[];
}

const EMPTY_FILTERS: Filters = {
  entity: [],
  state: [],
  status: [],
  tier: [],
  servicePackage: [],
};

export function Clients() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sortCol, setSortCol] = useState<SortColumn>("open");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [addOpen, setAddOpen] = useState(false);
  const navigate = useNavigate();
  const flags = useFeatureFlags();

  const allClientsQuery = useClients();
  const allClients = allClientsQuery.data?.items ?? [];

  const clientsQuery = useClients({
    search: query || undefined,
    entityType: filters.entity.length ? filters.entity : undefined,
    state: filters.state.length ? filters.state : undefined,
    status: filters.status.length ? filters.status : undefined,
    tier: filters.tier.length ? filters.tier : undefined,
    servicePackage: filters.servicePackage.length
      ? filters.servicePackage
      : undefined,
  });
  const clients = clientsQuery.data?.items ?? [];

  const triageQuery = useTriageDeadlines();
  const deadlines = useMemo(() => {
    const t = triageQuery.data;
    if (!t) return [];
    return [...t.overdue, ...t.thisWeek, ...t.thisMonth, ...t.longTerm];
  }, [triageQuery.data]);
  const overdueDeadlines = triageQuery.data?.overdue ?? [];

  const announcementsQuery = useAnnouncements({ activeOnly: true });
  const announcements = announcementsQuery.data ?? [];

  const spotlightCards = useMemo<SpotlightCard[]>(() => {
    const cards: SpotlightCard[] = [];

    // 1) Needs attention now — clients with at least one overdue deadline.
    const overdueClientIds = new Set(overdueDeadlines.map((d) => d.clientId));
    const overdueClients = allClients.filter((c) => overdueClientIds.has(c.id));
    if (overdueClients.length > 0) {
      cards.push({
        key: "overdue",
        icon: "overdue",
        title: "Needs attention now",
        reason: `${overdueClients.length === 1 ? "1 client has" : `${overdueClients.length} clients have`} an overdue deadline.`,
        clients: overdueClients
          .slice(0, 3)
          .map((c) => ({ id: c.id, name: c.name })),
        totalCount: overdueClients.length,
      });
    }

    // 2) Premium, quiet — premium tier with no deadline in the next 30 days
    //    (drifting / under-served — worth a proactive check-in).
    const horizonIso = new Date(TODAY.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const nextDueByClient = new Map<string, string>();
    for (const d of deadlines) {
      if (d.status === "completed" || d.status === "filed_extension") continue;
      const prev = nextDueByClient.get(d.clientId);
      if (!prev || d.officialDueDate < prev) {
        nextDueByClient.set(d.clientId, d.officialDueDate);
      }
    }
    const quietPremium = allClients.filter((c) => {
      if (c.tier !== "premium" || c.status !== "active") return false;
      const next = nextDueByClient.get(c.id);
      return !next || next > horizonIso;
    });
    if (quietPremium.length > 0) {
      cards.push({
        key: "premium-quiet",
        icon: "quiet",
        title: "Premium, quiet",
        reason: `Premium clients with no deadline in the next 30 days — worth a proactive check-in.`,
        clients: quietPremium
          .slice(0, 3)
          .map((c) => ({ id: c.id, name: c.name })),
        totalCount: quietPremium.length,
        action: {
          label: "Filter to Premium",
          onClick: () =>
            setFilters((f) => ({ ...f, tier: ["premium"] })),
        },
      });
    }

    // 3) State alerts active — clients matched to a recent unread announcement.
    const alertClientIds = new Set<string>();
    for (const a of announcements) {
      if (a.dismissed) continue;
      for (const id of a.affectedClientIds) alertClientIds.add(id);
    }
    const alertClients = allClients.filter((c) => alertClientIds.has(c.id));
    if (alertClients.length > 0 && announcements.length > 0) {
      cards.push({
        key: "state-alert",
        icon: "alert",
        title: "State alert active",
        reason: `${announcements.length === 1 ? "1 announcement matches" : `${announcements.length} announcements match`} clients in your book.`,
        clients: alertClients
          .slice(0, 3)
          .map((c) => ({ id: c.id, name: c.name })),
        totalCount: alertClients.length,
      });
    }

    return cards;
  }, [allClients, overdueDeadlines, deadlines, announcements]);

  const atLimit =
    flags.hasClientLimit &&
    flags.clientLimit !== null &&
    allClients.length >= flags.clientLimit;

  const packageOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const c of allClients) for (const p of c.servicePackages) seen.add(p);
    return [...seen].sort().map((p) => ({ value: p, label: p }));
  }, [allClients]);

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

  const sorted = useMemo(() => {
    const dirMul = sortDir === "asc" ? 1 : -1;
    const rows = clients.map((c) => {
      const next = nextDeadlineFor(c.id);
      return { c, openCount: countOpenDeadlines(c.id), next };
    });
    rows.sort((a, b) => {
      switch (sortCol) {
        case "name":
          return a.c.name.localeCompare(b.c.name) * dirMul;
        case "entity":
          return a.c.entityType.localeCompare(b.c.entityType) * dirMul;
        case "open":
          return (a.openCount - b.openCount) * dirMul;
        case "next": {
          const aDate = a.next?.officialDueDate ?? "9999-12-31";
          const bDate = b.next?.officialDueDate ?? "9999-12-31";
          return aDate.localeCompare(bDate) * dirMul;
        }
      }
    });
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, deadlines, sortCol, sortDir]);

  const activeFilterCount =
    filters.entity.length +
    filters.state.length +
    filters.status.length +
    filters.tier.length +
    filters.servicePackage.length;
  const hasFilters = activeFilterCount > 0 || query.length > 0;

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setQuery("");
  };

  const toggleSort = (col: SortColumn) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir(col === "name" || col === "entity" ? "asc" : "desc");
    }
  };

  if (allClientsQuery.isLoading && !allClientsQuery.data) {
    return <PageSkeleton title="Loading clients…" />;
  }
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

  if (allClients.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Single-purpose direct empty state. The user came to /clients
            deliberately to manage clients — give them one strong action,
            not a re-onboarding menu. */}
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-ink-900">Clients</h1>
          <p className="text-sm text-ink-500 mt-1">
            Your roster is empty.
          </p>
        </header>
        <div className="bg-surface border border-line rounded-md px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-ink-900">
            Add your first client
          </h2>
          <p className="text-sm text-ink-500 mt-1.5 max-w-md mx-auto">
            One client, two minutes. Once they're in, deadlines auto-generate
            from the filing bundle you pick.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="mt-5 text-sm font-medium px-4 py-2 rounded-md bg-accent text-canvas hover:bg-accent-hover"
          >
            + Add a client
          </button>
          <p className="text-xs text-ink-500 mt-4">
            Or{" "}
            <button
              onClick={() => navigate("/import")}
              className="text-ink-900 underline hover:no-underline"
            >
              import in bulk from a CSV →
            </button>
          </p>
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
          {clients.length} of {allClients.length}
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

      <SpotlightStrip cards={spotlightCards} />

      <div className="flex items-center gap-2 flex-wrap">
        <MultiSelectChip
          label="Entity"
          options={ENTITY_OPTIONS}
          selected={filters.entity}
          onChange={(next) => setFilters((f) => ({ ...f, entity: next }))}
        />
        <MultiSelectChip
          label="State"
          options={STATE_OPTIONS}
          selected={filters.state}
          onChange={(next) => setFilters((f) => ({ ...f, state: next }))}
        />
        <MultiSelectChip
          label="Status"
          options={STATUS_OPTIONS}
          selected={filters.status}
          onChange={(next) => setFilters((f) => ({ ...f, status: next }))}
        />
        <MultiSelectChip
          label="Tier"
          options={TIER_OPTIONS}
          selected={filters.tier}
          onChange={(next) => setFilters((f) => ({ ...f, tier: next }))}
        />
        <MultiSelectChip
          label="Package"
          options={packageOptions}
          selected={filters.servicePackage}
          onChange={(next) => setFilters((f) => ({ ...f, servicePackage: next }))}
        />
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-ink-500 hover:text-ink-900 underline underline-offset-2 ml-1"
          >
            Clear all
          </button>
        )}
      </div>

      {atLimit && (
        <div>
          <UpgradePrompt
            feature={`Adding more than ${flags.clientLimit} clients`}
            requiredTier="pro"
            inline
          />
        </div>
      )}

      <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} />

      <div className="bg-surface border border-line rounded-md overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-sunken text-2xs uppercase tracking-wider text-ink-700">
            <tr>
              <SortableTh col="name" sortCol={sortCol} sortDir={sortDir} onClick={toggleSort} align="left">
                Name
              </SortableTh>
              <th className="text-left px-4 py-2 font-semibold">Tier</th>
              <SortableTh col="open" sortCol={sortCol} sortDir={sortDir} onClick={toggleSort} align="right">
                Open
              </SortableTh>
              <SortableTh col="next" sortCol={sortCol} sortDir={sortDir} onClick={toggleSort} align="right">
                Next deadline
              </SortableTh>
              <th className="text-left px-4 py-2 font-semibold">States</th>
              <SortableTh col="entity" sortCol={sortCol} sortDir={sortDir} onClick={toggleSort} align="left">
                Entity
              </SortableTh>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ c, openCount, next }) => {
              const nextDays = next
                ? daysBetween(TODAY, parseDate(next.officialDueDate))
                : null;
              const isOverdue = nextDays !== null && nextDays < 0;
              const href = `/clients/${c.id}`;
              const onRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
                // If the click landed on a real interactive child, let it handle itself.
                if ((e.target as HTMLElement).closest("a, button, input, [role='option']")) return;
                // If the user dragged to select text, don't navigate.
                if (window.getSelection()?.toString()) return;
                if (e.metaKey || e.ctrlKey || e.button === 1) {
                  window.open(href, "_blank", "noopener,noreferrer");
                } else {
                  navigate(href);
                }
              };
              return (
                <tr
                  key={c.id}
                  onClick={onRowClick}
                  className="border-b border-line last:border-b-0 hover:bg-sunken cursor-pointer"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      to={href}
                      className="text-ink-900 font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <TierPill tier={c.tier} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-700 tabular-nums">
                    {openCount}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right tabular-nums ${
                      isOverdue ? "text-danger-ink font-medium" : "text-ink-700"
                    }`}
                  >
                    {next ? countdownLabel(next.officialDueDate) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StateChipGroup
                      primary={c.primaryState}
                      nexus={c.nexusStates}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-ink-700">{c.entityType}</td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <p className="text-sm text-ink-700 font-medium">
                    {hasFilters
                      ? "No clients match the current filters."
                      : "No clients."}
                  </p>
                  {hasFilters && (
                    <button
                      onClick={clearAll}
                      className="mt-3 text-sm px-3 py-1.5 rounded-md border border-line text-ink-700 hover:bg-sunken"
                    >
                      Clear all
                    </button>
                  )}
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

function SortableTh({
  col,
  sortCol,
  sortDir,
  onClick,
  align,
  children,
}: {
  col: SortColumn;
  sortCol: SortColumn;
  sortDir: SortDir;
  onClick: (col: SortColumn) => void;
  align: "left" | "right";
  children: React.ReactNode;
}) {
  const active = sortCol === col;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={`px-4 py-2 font-semibold ${
        align === "right" ? "text-right" : "text-left"
      }`}
      aria-sort={
        active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onClick(col)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink-900 ${
          active ? "text-ink-900" : "text-ink-700"
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        <span>{children}</span>
        <Icon className="w-3 h-3" aria-hidden />
      </button>
    </th>
  );
}

function TierPill({ tier }: { tier: ClientTier | undefined }) {
  if (!tier) return <span className="text-ink-500">—</span>;
  const tone =
    tier === "premium"
      ? "bg-accent/10 text-accent border-accent/30"
      : tier === "custom"
        ? "bg-warn-bg text-warn-ink border-warn-border"
        : "bg-sunken text-ink-700 border-line";
  return (
    <span
      className={`inline-flex items-center text-2xs font-medium px-1.5 py-0.5 rounded border ${tone}`}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

