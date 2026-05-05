import { useState } from "react";
import { ChevronDown, ChevronRight, X, Check } from "lucide-react";
import {
  PHASE_0_SEEDED_STATES,
  REGIONS,
  statesByRegion,
  US_STATES,
} from "../../../data/usStates";

/**
 * Two-pane variant — left: state catalog grouped by region (collapsible
 * sections). Right: live list of picks with X-to-remove. Best for power
 * users with 8+ states; keeps the picks visible while you scroll the
 * catalog.
 */
export function TwoPanePicker({
  selected,
  onToggle,
  onRemove,
}: {
  selected: string[];
  onToggle: (code: string) => void;
  onRemove: (code: string) => void;
}) {
  const grouped = statesByRegion();
  const [openRegions, setOpenRegions] = useState<Set<string>>(
    new Set(REGIONS),
  );
  const stateByCode = new Map(US_STATES.map((s) => [s.code, s]));

  const toggleRegion = (region: string) => {
    setOpenRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-0 min-h-[400px]">
      {/* Left: catalog */}
      <div className="px-5 py-4 border-r border-line">
        <div className="space-y-3">
          {REGIONS.map((region) => {
            const states = grouped[region];
            if (states.length === 0) return null;
            const isOpen = openRegions.has(region);
            const pickedInRegion = states.filter((s) =>
              selected.includes(s.code),
            ).length;
            return (
              <section key={region}>
                <button
                  onClick={() => toggleRegion(region)}
                  className="w-full flex items-center gap-2 text-left py-1"
                >
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-ink-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-ink-500" />
                  )}
                  <span className="text-2xs uppercase tracking-wider text-ink-700 font-semibold flex-1">
                    {region}
                  </span>
                  <span className="text-2xs text-ink-400">
                    {pickedInRegion}/{states.length}
                  </span>
                </button>
                {isOpen && (
                  <div className="grid grid-cols-2 gap-1 mt-1.5 ml-5">
                    {states.map((s) => {
                      const picked = selected.includes(s.code);
                      const seeded = PHASE_0_SEEDED_STATES.has(s.code);
                      return (
                        <button
                          key={s.code}
                          onClick={() => onToggle(s.code)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded text-left text-xs ${
                            picked
                              ? "bg-accent/10 text-ink-900 font-medium"
                              : "text-ink-700 hover:bg-sunken"
                          }`}
                        >
                          <span
                            className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${
                              picked
                                ? "bg-accent border-accent text-canvas"
                                : "border-line"
                            }`}
                          >
                            {picked ? <Check className="w-2 h-2" aria-hidden /> : null}
                          </span>
                          <span className="font-mono">{s.code}</span>
                          <span className="truncate">{s.name}</span>
                          {!seeded && (
                            <span className="ml-auto text-2xs text-ink-400 italic">
                              P1
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* Right: picks */}
      <aside className="px-3 py-4 bg-canvas/30">
        <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold mb-2">
          Your picks ({selected.length})
        </p>
        {selected.length === 0 ? (
          <p className="text-xs text-ink-400 italic">
            Click a state from the catalog to add it here.
          </p>
        ) : (
          <ul className="space-y-1">
            {selected.map((code) => {
              const state = stateByCode.get(code);
              if (!state) return null;
              return (
                <li
                  key={code}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-canvas border border-line text-xs"
                >
                  <span className="font-mono font-medium">{code}</span>
                  <span className="flex-1 truncate text-ink-600">
                    {state.name}
                  </span>
                  <button
                    onClick={() => onRemove(code)}
                    aria-label={`Remove ${state.name}`}
                    className="text-ink-400 hover:text-danger-ink p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}
