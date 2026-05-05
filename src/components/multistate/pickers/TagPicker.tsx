import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  PHASE_0_SEEDED_STATES,
  US_STATES,
  type UsState,
} from "../../../data/usStates";

/**
 * Tag-autocomplete variant — type "ca" → [CA] tag added. Picked states
 * render as pill chips with X-to-remove. Cleanest end-state visual; higher
 * cognitive load on entry.
 */
export function TagPicker({
  selected,
  onToggle,
  onRemove,
}: {
  selected: string[];
  onToggle: (code: string) => void;
  onRemove: (code: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const stateByCode = new Map(US_STATES.map((s) => [s.code, s]));

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return US_STATES.filter(
      (s) =>
        !selected.includes(s.code) &&
        (s.code.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q)),
    ).slice(0, 8);
  }, [query, selected]);

  const addState = (state: UsState) => {
    onToggle(state.code);
    setQuery("");
    setActiveIdx(0);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const s = suggestions[activeIdx];
      if (s) addState(s);
    } else if (e.key === "Backspace" && query === "" && selected.length > 0) {
      // Pop the most recently added state
      onRemove(selected[selected.length - 1]!);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  };

  return (
    <div className="px-5 py-4">
      {/* Picked states + input row */}
      <div
        className="flex flex-wrap items-center gap-1.5 px-2.5 py-2 rounded-md border border-line bg-canvas/40 focus-within:border-indigo focus-within:ring-2 focus-within:ring-indigo focus-within:ring-offset-2 min-h-[44px] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((code) => {
          const state = stateByCode.get(code);
          if (!state) return null;
          const seeded = PHASE_0_SEEDED_STATES.has(code);
          return (
            <span
              key={code}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                seeded
                  ? "bg-accent/10 text-ink-900 border border-accent/30"
                  : "bg-sunken text-ink-600 border border-line"
              }`}
              title={`${state.name}${seeded ? "" : " — forms not seeded yet"}`}
            >
              <span className="font-mono">{code}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(code);
                }}
                aria-label={`Remove ${state.name}`}
                className="text-ink-400 hover:text-danger-ink"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIdx(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={
            selected.length === 0
              ? "Type a state name or 2-letter code…"
              : "Add another…"
          }
          className="flex-1 min-w-[120px] bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
        />
      </div>

      {/* Suggestion dropdown */}
      {suggestions.length > 0 && (
        <div className="mt-1 border border-line rounded-md bg-canvas shadow-overlay max-h-[280px] overflow-y-auto">
          <ul className="py-1">
            {suggestions.map((s, idx) => {
              const seeded = PHASE_0_SEEDED_STATES.has(s.code);
              return (
                <li key={s.code}>
                  <button
                    onClick={() => addState(s)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm ${
                      idx === activeIdx ? "bg-sunken" : ""
                    }`}
                  >
                    <span className="font-mono text-xs text-ink-500 w-7">
                      {s.code}
                    </span>
                    <span className="flex-1">{s.name}</span>
                    <span className="text-2xs text-ink-400">{s.region}</span>
                    {!seeded && (
                      <span className="text-2xs italic text-ink-400">P1</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selected.length === 0 && suggestions.length === 0 && (
        <p className="mt-3 text-xs text-ink-500">
          Tip: type a code (e.g. <span className="font-mono">ca</span>) or a
          name (e.g. <span className="font-mono">cali</span>) and press{" "}
          <kbd className="font-mono text-2xs border border-line rounded px-1 py-0.5">
            Enter
          </kbd>{" "}
          to add. <kbd className="font-mono text-2xs border border-line rounded px-1 py-0.5">
            Backspace
          </kbd>{" "}
          on an empty input removes the most recent.
        </p>
      )}
    </div>
  );
}
