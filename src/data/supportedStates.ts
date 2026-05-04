/**
 * Single source of truth for which states the product supports today.
 *
 * "Supported" means: the state has service templates seeded in
 * `backend/src/db/seed-data.ts`, so assigning a service package to a
 * client in that state will spawn deadlines, tasks, checklists, and
 * milestones. Picking an unsupported state currently produces nothing
 * — the dropdown is silently inert, which the dogfooding feedback
 * (2026-05-04) called out as "the product is not functioning."
 *
 * Until we extend `seed-data.ts` to cover the remaining 40 states, all
 * state-picker UIs must gate on `isSupportedState(code)` so the user
 * can't pick something that won't generate filings.
 *
 * When you add a state's service templates, append its code here.
 * Federal-only filings (1040, 1120, 1065, etc.) work everywhere — this
 * gating affects state-jurisdiction selection only.
 */

export const SUPPORTED_STATE_CODES = [
  "CA",
  "FL",
  "GA",
  "IL",
  "LA",
  "MA",
  "NJ",
  "NY",
  "PA",
  "TX",
] as const;

export type SupportedStateCode = (typeof SUPPORTED_STATE_CODES)[number];

const SUPPORTED_SET = new Set<string>(SUPPORTED_STATE_CODES);

export function isSupportedState(code: string | null | undefined): boolean {
  if (!code) return false;
  return SUPPORTED_SET.has(code.toUpperCase());
}

/**
 * Tooltip / aria-label string for a disabled state picker. Matches the
 * voice rules in DESIGN.md — short, factual, no apology copy.
 */
export const UNSUPPORTED_STATE_HINT =
  "We don't generate filings for this state yet. Coming soon.";
