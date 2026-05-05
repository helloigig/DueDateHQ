import { STATE_NAMES, type StateCode } from "../types";

/**
 * Client-scope state chip group (A14).
 * Primary state filled; first two nexus states outlined; remainder collapsed to a +N pill.
 * Shown on Clients table rows and the ClientDetail header.
 */
export function StateChipGroup({
  primary,
  nexus,
  maxVisibleNexus = 2,
}: {
  primary: StateCode;
  nexus: StateCode[] | null | undefined;
  maxVisibleNexus?: number;
}) {
  const base =
    "text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded font-medium";
  // Defensive default — imported clients with NULL nexus_states crash without
  // this guard (BE returns array but old or partial-import data sometimes
  // surfaces undefined; this is the safer contract).
  const safeNexus = Array.isArray(nexus) ? nexus : [];
  const visible = safeNexus.slice(0, maxVisibleNexus);
  const overflow = safeNexus.slice(maxVisibleNexus);
  return (
    <div className="inline-flex items-center gap-1">
      <span
        className={`${base} bg-ink-900 text-canvas`}
        title={`Primary state · ${STATE_NAMES[primary]}`}
      >
        {primary}
      </span>
      {visible.map((s) => (
        <span
          key={s}
          className={`${base} border border-line-strong text-ink-500`}
          title={`Nexus · ${STATE_NAMES[s]}`}
        >
          {s}
        </span>
      ))}
      {overflow.length > 0 && (
        <span
          className={`${base} border border-line-strong text-ink-500 tabular-nums`}
          title={`Nexus · ${overflow.map((s) => STATE_NAMES[s]).join(", ")}`}
        >
          +{overflow.length}
        </span>
      )}
    </div>
  );
}
