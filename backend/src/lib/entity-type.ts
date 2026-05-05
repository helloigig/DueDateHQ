/**
 * Single source of truth for entity-type canonicalisation across the BE.
 *
 * The schema enum (clients.entity_type) stores snake_case strings:
 *   individual | llc | s_corp | c_corp | partnership | trust | non_profit
 *
 * Older seed data + CSV exports use display-case strings:
 *   "Individual" | "LLC" | "S-Corp" | "C-Corp" | "Partnership" | "Trust"
 *
 * Anywhere a comparison is needed (CSV import, package suggester,
 * backfill scripts) callers must pass both sides through this
 * normalizer, otherwise `["Individual"].includes("individual")` returns
 * false and packages silently fail to match — exactly the bug that left
 * 41 prod clients without deadlines on 2026-05-04.
 */
export const ENTITY_TYPES = [
  "individual",
  "llc",
  "s_corp",
  "c_corp",
  "partnership",
  "trust",
  "non_profit",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * Map any reasonable entity-type spelling to the canonical snake_case
 * enum value. Returns the input unchanged when no mapping applies, so
 * callers wanting strict validation should still gate the result with a
 * Zod enum check.
 */
export function normalizeEntityType(input: unknown): string {
  if (typeof input !== "string") return String(input);
  const lowered = input.toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  const map: Record<string, EntityType> = {
    individual: "individual",
    llc: "llc",
    s_corp: "s_corp",
    scorp: "s_corp",
    c_corp: "c_corp",
    ccorp: "c_corp",
    partnership: "partnership",
    trust: "trust",
    non_profit: "non_profit",
    nonprofit: "non_profit",
  };
  return map[lowered] ?? input;
}

/**
 * Returns true if `applicable` (which may be in any case format from
 * legacy seed data) matches `target` (which is always the canonical
 * snake_case enum stored on clients.entity_type).
 */
export function entityTypeMatches(
  applicable: ReadonlyArray<string>,
  target: string,
): boolean {
  return applicable.some((et) => normalizeEntityType(et) === target);
}
