import { STATE_NAMES, type StateCode } from "../types";

/**
 * Client-scope state chip group (A14).
 * Primary state filled; each nexus state outlined.
 * Shown on Clients table rows and the ClientDetail header.
 */
export function StateChipGroup({
  primary,
  nexus,
}: {
  primary: StateCode;
  nexus: StateCode[];
}) {
  const base =
    "text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded font-medium";
  return (
    <div className="inline-flex items-center gap-1 flex-wrap">
      <span
        className={`${base} bg-ink-900 text-canvas`}
        title={`Primary state · ${STATE_NAMES[primary]}`}
      >
        {primary}
      </span>
      {nexus.map((s) => (
        <span
          key={s}
          className={`${base} border border-line-strong text-ink-500`}
          title={`Nexus · ${STATE_NAMES[s]}`}
        >
          {s}
        </span>
      ))}
    </div>
  );
}
