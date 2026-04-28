import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, ExternalLink, Search } from "lucide-react";
import { useStore } from "../data/store";

/**
 * Public /changes page — historical state announcement archive (PRD §10.4 P1).
 * Open without login. Serves two purposes:
 *
 *   1. SEO — every announcement is a real, citable URL with the official
 *      source link. Search engines pick up "{state} {form} extension 2026"
 *      queries and find DueDateHQ's clean parsed corpus.
 *   2. Trust — anyone can verify our parsing accuracy against the official
 *      authority. Builds confidence before signup.
 *
 * Filterable by state, type, year. Each row links to its source. No login
 * required — the bar above shows "sign in" / "create firm" CTAs.
 */
export function Changes() {
  const { announcements } = useStore();
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const states = useMemo(() => {
    const set = new Set<string>();
    for (const a of announcements) set.add(a.stateCode);
    return Array.from(set).sort();
  }, [announcements]);

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const a of announcements) set.add(a.type);
    return Array.from(set).sort();
  }, [announcements]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return announcements
      .filter((a) => stateFilter === "all" || a.stateCode === stateFilter)
      .filter((a) => typeFilter === "all" || a.type === typeFilter)
      .filter(
        (a) =>
          q === "" ||
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.stateCode.toLowerCase().includes(q)
      )
      .sort((a, b) => b.issuanceDate.localeCompare(a.issuanceDate));
  }, [announcements, stateFilter, typeFilter, search]);

  // Group by year-month for the SEO-friendly archive feel
  const grouped = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const a of filtered) {
      const key = a.issuanceDate.slice(0, 7); // YYYY-MM
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(a);
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div className="min-h-screen bg-canvas">
      {/* Public header — looks different from app, signals "marketing/SEO" */}
      <header className="border-b border-line bg-surface">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/" className="text-base font-semibold text-ink-900">
            DueDateHQ
          </Link>
          <span className="text-2xs text-ink-400 uppercase tracking-wider">
            State tax change archive
          </span>
          <span className="ml-auto flex items-center gap-3 text-sm">
            <Link
              to="/login"
              className="text-ink-500 hover:text-ink-900"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="px-3 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover"
            >
              Start free trial
            </Link>
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <section>
          <h1 className="text-2xl font-semibold text-ink-900">
            State tax announcements — every authority, every change
          </h1>
          <p className="text-sm text-ink-500 mt-2 max-w-2xl">
            We monitor 50 state Departments of Revenue + DC + Secretaries of
            State. Every announcement is parsed within 24 hours, with
            structured impact (counties, entity types, tax types, new
            deadlines) and a link to the official source. Two-year backfill,
            updated continuously.
          </p>
          <p className="text-xs text-ink-500 mt-3">
            <span className="text-ink-900 font-medium">Want this matched to your clients automatically?</span>{" "}
            <Link to="/signup" className="text-ink-900 underline hover:no-underline">
              Try DueDateHQ free for 30 days
            </Link>
            {" "}— we'll surface the changes affecting your portfolio within hours, not headlines.
          </p>
        </section>

        {/* Filters */}
        <section className="bg-surface border border-line rounded-md p-4 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search by state, title, type — "California winter storm", "PTE election", etc.'
              className="w-full pl-9 pr-3 py-2 rounded-md border border-line text-sm bg-surface placeholder:text-ink-400"
            />
          </div>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="text-sm px-3 py-2 rounded-md border border-line bg-surface"
          >
            <option value="all">All states</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm px-3 py-2 rounded-md border border-line bg-surface"
          >
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </section>

        {/* Results */}
        {grouped.length === 0 ? (
          <div className="bg-surface border border-line rounded-md p-8 text-center text-sm text-ink-500">
            No announcements match these filters.
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([month, items]) => (
              <section key={month}>
                <header className="flex items-baseline gap-2 mb-2 pb-1 border-b border-line">
                  <Calendar className="w-3.5 h-3.5 text-ink-500" aria-hidden />
                  <h2 className="text-sm font-semibold text-ink-900">
                    {formatMonth(month)}
                  </h2>
                  <span className="text-2xs text-ink-500">
                    {items.length} change{items.length === 1 ? "" : "s"}
                  </span>
                </header>
                <ul className="divide-y divide-line bg-surface border border-line rounded-md overflow-hidden">
                  {items.map((a) => (
                    <li key={a.id} className="px-4 py-3">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-sunken text-ink-700 border border-line font-semibold">
                          {a.stateCode}
                        </span>
                        <span className="text-2xs uppercase tracking-wider text-ink-500">
                          {a.type.replace(/_/g, " ")}
                        </span>
                        <span className="text-2xs text-ink-400">
                          · published {a.issuanceDate}
                        </span>
                      </div>
                      <p className="text-sm text-ink-900 font-medium mt-1">
                        {a.title}
                      </p>
                      <p className="text-xs text-ink-700 mt-1">{a.summary}</p>
                      <div className="text-2xs text-ink-500 mt-2 flex items-center flex-wrap gap-x-2">
                        <span>
                          <span className="text-ink-400">Authority:</span>{" "}
                          {a.authority}
                        </span>
                        {a.newDeadline && (
                          <>
                            <span className="text-ink-300">·</span>
                            <span>
                              <span className="text-ink-400">New deadline:</span>{" "}
                              {a.newDeadline}
                            </span>
                          </>
                        )}
                        {a.counties.length > 0 && (
                          <>
                            <span className="text-ink-300">·</span>
                            <span>
                              {a.counties.length === 1
                                ? `${a.counties[0]} County`
                                : `${a.counties.length} counties`}
                            </span>
                          </>
                        )}
                        <span className="text-ink-300">·</span>
                        <a
                          href={a.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-ink-700 hover:text-ink-900 hover:underline"
                        >
                          Official source
                          <ExternalLink className="w-2.5 h-2.5" aria-hidden />
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <footer className="pt-8 mt-12 border-t border-line text-xs text-ink-500">
          <p>
            <span className="text-ink-900 font-medium">Two-year archive · 50 states + DC.</span>{" "}
            Detection SLA: 95% within 24 hours of official publication.
          </p>
          <p className="mt-2">
            Want this matched to your clients automatically?{" "}
            <Link to="/signup" className="text-ink-900 underline hover:no-underline">
              Try DueDateHQ
            </Link>{" "}
            · 30 days free, no credit card.
          </p>
        </footer>
      </main>
    </div>
  );
}

function formatMonth(yyyymm: string): string {
  const [year, month] = yyyymm.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}
