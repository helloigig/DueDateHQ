import { useState } from "react";
import { US_STATES, PHASE_0_SEEDED_STATES } from "../../../data/usStates";

/**
 * Map variant — clickable US grid (an approximate 8×11 layout that mimics
 * the rough geography). Picked states fill with brand color. Hover shows
 * full state name. Visual; great for "show me what I picked."
 *
 * This is NOT a true SVG map (we'd need a topojson + d3 for that). It's a
 * grid layout that orients states in roughly correct compass positions.
 * Phase 1: replace with a real SVG using us-atlas + react-simple-maps.
 */

// Roughly geographic 8-row × 11-col grid. Empty strings = no state.
// Compiled from a standard tile-grid layout used in NYT/WaPo data viz.
const GRID: string[][] = [
  ["", "", "", "", "", "", "", "", "", "", "ME"],
  ["AK", "", "", "", "", "", "", "", "VT", "NH", ""],
  ["", "", "", "", "", "", "", "", "MA", "", ""],
  ["WA", "MT", "ND", "MN", "IL", "WI", "MI", "", "NY", "RI", "CT"],
  ["OR", "ID", "SD", "IA", "IN", "OH", "PA", "NJ", "", "", ""],
  ["CA", "NV", "UT", "WY", "MO", "KY", "WV", "VA", "MD", "DC", "DE"],
  ["", "AZ", "CO", "NE", "KS", "TN", "NC", "SC", "", "", ""],
  ["", "", "NM", "OK", "AR", "MS", "AL", "GA", "", "", ""],
  ["HI", "", "", "TX", "LA", "", "", "", "FL", "", ""],
];

export function MapPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (code: string) => void;
}) {
  const [hoverCode, setHoverCode] = useState<string | null>(null);
  const stateByCode = new Map(US_STATES.map((s) => [s.code, s]));
  const hoveredState = hoverCode ? stateByCode.get(hoverCode) : null;
  const isPicked = (code: string) => selected.includes(code);

  return (
    <div className="px-5 py-4">
      <div className="bg-canvas/40 border border-line rounded-md p-4">
        <div className="space-y-1">
          {GRID.map((row, ri) => (
            <div key={ri} className="flex gap-1 justify-center">
              {row.map((code, ci) => {
                if (!code) {
                  return <div key={ci} className="w-9 h-9" aria-hidden />;
                }
                const state = stateByCode.get(code);
                if (!state) {
                  return <div key={ci} className="w-9 h-9" aria-hidden />;
                }
                const picked = isPicked(code);
                const seeded = PHASE_0_SEEDED_STATES.has(code);
                return (
                  <button
                    key={code}
                    onClick={() => onToggle(code)}
                    onMouseEnter={() => setHoverCode(code)}
                    onMouseLeave={() =>
                      setHoverCode((h) => (h === code ? null : h))
                    }
                    title={`${state.name}${seeded ? "" : " (no templates yet)"}`}
                    className={[
                      "w-9 h-9 rounded text-2xs font-mono font-semibold transition-all relative",
                      picked
                        ? "bg-accent text-canvas shadow-sm scale-105"
                        : seeded
                          ? "bg-canvas border border-line text-ink-700 hover:bg-sunken hover:border-ink-400"
                          : "bg-sunken/40 border border-line/50 text-ink-300 hover:bg-sunken",
                    ].join(" ")}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Hover info / legend */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <div className="text-ink-500 min-h-[1.5em]">
          {hoveredState
            ? `${hoveredState.code} — ${hoveredState.name}${
                PHASE_0_SEEDED_STATES.has(hoveredState.code)
                  ? ""
                  : " (forms not seeded yet)"
              }`
            : "Click a state to pick. Click again to remove."}
        </div>
        <div className="flex items-center gap-3 text-ink-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-accent" /> picked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-canvas border border-line" />{" "}
            available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-sunken/40 border border-line/50" />{" "}
            P1
          </span>
        </div>
      </div>
    </div>
  );
}
