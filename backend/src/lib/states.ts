/**
 * 2-letter US state + DC + territory codes. The DB stores plain TEXT —
 * this is the validation gate at API boundaries. PRD v0.7 §10.3 calls for
 * 50-state coverage; this enum is the canonical source of truth across
 * `auth.bootstrap`, `clients.create`, etc.
 */
export const ALL_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DC", "DE", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

export type StateCode = (typeof ALL_STATES)[number];

export function isStateCode(s: string): s is StateCode {
  return (ALL_STATES as readonly string[]).includes(s);
}
