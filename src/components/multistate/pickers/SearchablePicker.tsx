import { useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import {
  PHASE_0_SEEDED_STATES,
  REGIONS,
  US_STATES,
  type UsState,
} from "../../../data/usStates";

/**
 * Default picker variant — alphabetical, optionally grouped by region,
 * with search. Best for keyboard-driven CPAs scanning by name.
 */
export function SearchablePicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (code: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [groupByRegion, setGroupByRegion] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return US_STATES;
    return US_STATES.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q),
    );
  }, [query]);

  if (groupByRegion) {
    const byRegion = REGIONS.reduce(
      (acc, r) => {
        acc[r] = filtered.filter((s) => s.region === r);
        return acc;
      },
      {} as Record<UsState["region"], UsState[]>,
    );
    return (
      <div className="px-5 py-4">
        <Header
          query={query}
          setQuery={setQuery}
          groupByRegion={groupByRegion}
          setGroupByRegion={setGroupByRegion}
        />
        <div className="mt-4 space-y-4">
          {REGIONS.map((region) => {
            const states = byRegion[region];
            if (states.length === 0) return null;
            return (
              <section key={region}>
                <h3 className="text-2xs uppercase tracking-wider text-ink-500 font-semibold mb-2">
                  {region}{" "}
                  <span className="text-ink-400 font-normal">
                    ({states.length})
                  </span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {states.map((s) => (
                    <Row
                      key={s.code}
                      state={s}
                      checked={selected.includes(s.code)}
                      onToggle={() => onToggle(s.code)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <Header
        query={query}
        setQuery={setQuery}
        groupByRegion={groupByRegion}
        setGroupByRegion={setGroupByRegion}
      />
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {filtered
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((s) => (
            <Row
              key={s.code}
              state={s}
              checked={selected.includes(s.code)}
              onToggle={() => onToggle(s.code)}
            />
          ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-sm text-ink-500 mt-6 text-center">
          No states match "{query}"
        </p>
      )}
    </div>
  );
}

function Header({
  query,
  setQuery,
  groupByRegion,
  setGroupByRegion,
}: {
  query: string;
  setQuery: (q: string) => void;
  groupByRegion: boolean;
  setGroupByRegion: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md border border-line bg-canvas/40">
        <Search className="w-4 h-4 text-ink-400" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter states by name or code…"
          className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
        />
      </div>
      <button
        onClick={() => setGroupByRegion(!groupByRegion)}
        className={`text-2xs uppercase tracking-wider px-2.5 py-1.5 rounded border ${
          groupByRegion
            ? "bg-ink-900 text-canvas border-ink-900"
            : "bg-canvas text-ink-700 border-line hover:bg-sunken"
        }`}
      >
        Group by region
      </button>
    </div>
  );
}

function Row({
  state,
  checked,
  onToggle,
}: {
  state: UsState;
  checked: boolean;
  onToggle: () => void;
}) {
  const seeded = PHASE_0_SEEDED_STATES.has(state.code);
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-left text-sm transition-colors ${
        checked
          ? "bg-accent/10 border-accent text-ink-900"
          : "bg-canvas border-line text-ink-700 hover:bg-sunken hover:border-ink-300"
      }`}
      title={
        seeded
          ? undefined
          : `${state.name} — forms not seeded yet (Phase 1)`
      }
    >
      <span
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
          checked ? "bg-accent border-accent text-canvas" : "border-line"
        }`}
        aria-hidden
      >
        {checked ? <Check className="w-3 h-3" aria-hidden /> : null}
      </span>
      <span className="flex-1 min-w-0 truncate">
        <span className="font-mono font-medium">{state.code}</span>{" "}
        <span className="text-ink-500">{state.name}</span>
      </span>
      {!seeded && (
        <span className="text-2xs text-ink-400 italic" aria-hidden>
          P1
        </span>
      )}
    </button>
  );
}
