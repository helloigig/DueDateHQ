import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { History as HistoryIcon, Filter } from "lucide-react";
import { trpc } from "../lib/api/client";
import { useClients } from "../hooks/useClients";
import { PageContainer } from "../components/ui/PageContainer";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterChip } from "../components/ui/FilterChip";

/**
 * /activity — firm-wide audit feed. Every event across every task in the
 * firm, ordered newest-first. Audit-trail surface (not a daily destination
 * per `feedback_lightweight_dashboard` — Sarah only checks this when
 * something looks wrong, not every day).
 *
 * Wired to live BE: `activity.list` returns rows joined to client + task
 * fields so each entry renders "Sarah Mitchell · 1040 NY · email_sent"
 * without follow-up lookups. Cursor-paginated (createdAt desc) with a
 * "Load more" affordance.
 */
export function Activity() {
  const [eventTypeFilter, setEventTypeFilter] = useState<string | null>(null);
  const [clientIdFilter, setClientIdFilter] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);

  const cursor = pages[pages.length - 1];
  const query = trpc.activity.list.useQuery({
    limit: 50,
    beforeCreatedAt: cursor,
    eventType: eventTypeFilter ?? undefined,
    clientId: clientIdFilter ?? undefined,
  });

  // First-page-only is the typical view; "Load more" appends pages by
  // walking nextCursor. We keep all loaded pages in component state so
  // toggling filters resets cleanly.
  const items = query.data?.items ?? [];
  const nextCursor = query.data?.nextCursor ?? null;

  const clientsQuery = useClients();
  const clientOptions = clientsQuery.data?.items ?? [];

  // Distinct event types in the current view — for the type filter chips.
  const eventTypes = useMemo(() => {
    const seen = new Set(items.map((r) => r.eventType));
    return Array.from(seen).sort();
  }, [items]);

  const onChangeFilter = (next: { type?: string | null; client?: string | null }) => {
    if (next.type !== undefined) setEventTypeFilter(next.type);
    if (next.client !== undefined) setClientIdFilter(next.client);
    setPages([]); // reset pagination
  };

  return (
    <PageContainer>
      <PageHeader
        title={
          <>
            <HistoryIcon className="inline w-5 h-5 mr-2 -mt-0.5" aria-hidden />
            Activity
          </>
        }
        meta={query.isLoading ? "loading…" : `${items.length} entries`}
      />
      <p className="text-sm text-ink-500 -mt-section mb-card">
        Audit feed — every action across the firm, newest first. Use it
        when something looks off; the Today page is the daily destination.
      </p>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-card flex-wrap">
        <Filter className="w-3.5 h-3.5 text-ink-500" aria-hidden />
        <FilterChip
          active={eventTypeFilter === null}
          onClick={() => onChangeFilter({ type: null })}
        >
          All types
        </FilterChip>
        {eventTypes.map((t) => (
          <FilterChip
            key={t}
            active={eventTypeFilter === t}
            onClick={() => onChangeFilter({ type: t })}
          >
            {t.replace(/_/g, " ")}
          </FilterChip>
        ))}
        <span className="text-ink-300 mx-1" aria-hidden>·</span>
        <select
          value={clientIdFilter ?? ""}
          onChange={(e) =>
            onChangeFilter({ client: e.target.value || null })
          }
          className="text-xs border border-line rounded px-2 py-1 bg-surface text-ink-700"
        >
          <option value="">All clients</option>
          {clientOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Feed */}
      {query.isLoading ? (
        <div className="text-sm text-ink-500 px-2 py-6">Loading activity…</div>
      ) : query.error ? (
        <div className="text-sm text-danger-ink px-2 py-6">
          Couldn't load activity — {query.error.message.slice(0, 80)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-line p-8 text-center text-sm text-ink-500">
          No activity yet matches these filters.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((row) => (
            <li
              key={`${row.id}-${row.createdAt}`}
              className="flex items-baseline gap-3 px-3 py-2 rounded border border-line bg-surface hover:bg-sunken/30"
            >
              <span className="text-2xs uppercase tracking-wide text-ink-500 font-medium tabular-nums shrink-0 w-32">
                {formatTime(row.createdAt)}
              </span>
              <span className="text-2xs px-1.5 py-0.5 rounded bg-sunken text-ink-700 font-mono shrink-0">
                {row.eventType}
              </span>
              <span className="text-sm font-medium text-ink-900 shrink-0">
                <Link
                  to={`/clients/${row.clientId}/tasks/${row.taskId}`}
                  className="hover:underline"
                >
                  {row.clientName}
                </Link>
              </span>
              <span className="text-2xs text-ink-500 shrink-0">
                {row.taskFormType.toUpperCase()} · {row.taskJurisdiction.toUpperCase()}
              </span>
              <span className="text-sm text-ink-700 truncate">
                {row.description}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {nextCursor && !query.isLoading && (
        <div className="mt-card text-center">
          <button
            type="button"
            onClick={() => setPages((p) => [...p, nextCursor])}
            className="text-xs px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-sunken"
          >
            Load older
          </button>
        </div>
      )}
    </PageContainer>
  );
}

function formatTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const now = Date.now();
  const ageMs = now - d.getTime();
  const hours = Math.floor(ageMs / 3_600_000);
  if (hours < 1) {
    const min = Math.max(1, Math.floor(ageMs / 60_000));
    return `${min}m ago`;
  }
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}
