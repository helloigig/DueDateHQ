/**
 * 50 US states + DC, with names and regional grouping. Used by the
 * multi-state filing wizard so we don't depend on the narrow `StateCode`
 * union (which is intentionally restricted to the 5 Phase 0 states).
 */
export interface UsState {
  code: string; // 2-letter
  name: string;
  region: "Northeast" | "South" | "Midwest" | "West" | "DC";
}

export const US_STATES: UsState[] = [
  // Northeast
  { code: "CT", name: "Connecticut", region: "Northeast" },
  { code: "ME", name: "Maine", region: "Northeast" },
  { code: "MA", name: "Massachusetts", region: "Northeast" },
  { code: "NH", name: "New Hampshire", region: "Northeast" },
  { code: "NJ", name: "New Jersey", region: "Northeast" },
  { code: "NY", name: "New York", region: "Northeast" },
  { code: "PA", name: "Pennsylvania", region: "Northeast" },
  { code: "RI", name: "Rhode Island", region: "Northeast" },
  { code: "VT", name: "Vermont", region: "Northeast" },
  // South
  { code: "AL", name: "Alabama", region: "South" },
  { code: "AR", name: "Arkansas", region: "South" },
  { code: "DE", name: "Delaware", region: "South" },
  { code: "FL", name: "Florida", region: "South" },
  { code: "GA", name: "Georgia", region: "South" },
  { code: "KY", name: "Kentucky", region: "South" },
  { code: "LA", name: "Louisiana", region: "South" },
  { code: "MD", name: "Maryland", region: "South" },
  { code: "MS", name: "Mississippi", region: "South" },
  { code: "NC", name: "North Carolina", region: "South" },
  { code: "OK", name: "Oklahoma", region: "South" },
  { code: "SC", name: "South Carolina", region: "South" },
  { code: "TN", name: "Tennessee", region: "South" },
  { code: "TX", name: "Texas", region: "South" },
  { code: "VA", name: "Virginia", region: "South" },
  { code: "WV", name: "West Virginia", region: "South" },
  // Midwest
  { code: "IL", name: "Illinois", region: "Midwest" },
  { code: "IN", name: "Indiana", region: "Midwest" },
  { code: "IA", name: "Iowa", region: "Midwest" },
  { code: "KS", name: "Kansas", region: "Midwest" },
  { code: "MI", name: "Michigan", region: "Midwest" },
  { code: "MN", name: "Minnesota", region: "Midwest" },
  { code: "MO", name: "Missouri", region: "Midwest" },
  { code: "NE", name: "Nebraska", region: "Midwest" },
  { code: "ND", name: "North Dakota", region: "Midwest" },
  { code: "OH", name: "Ohio", region: "Midwest" },
  { code: "SD", name: "South Dakota", region: "Midwest" },
  { code: "WI", name: "Wisconsin", region: "Midwest" },
  // West
  { code: "AK", name: "Alaska", region: "West" },
  { code: "AZ", name: "Arizona", region: "West" },
  { code: "CA", name: "California", region: "West" },
  { code: "CO", name: "Colorado", region: "West" },
  { code: "HI", name: "Hawaii", region: "West" },
  { code: "ID", name: "Idaho", region: "West" },
  { code: "MT", name: "Montana", region: "West" },
  { code: "NV", name: "Nevada", region: "West" },
  { code: "NM", name: "New Mexico", region: "West" },
  { code: "OR", name: "Oregon", region: "West" },
  { code: "UT", name: "Utah", region: "West" },
  { code: "WA", name: "Washington", region: "West" },
  { code: "WY", name: "Wyoming", region: "West" },
  // DC
  { code: "DC", name: "District of Columbia", region: "DC" },
];

export const REGIONS: UsState["region"][] = [
  "Northeast",
  "South",
  "Midwest",
  "West",
  "DC",
];

/**
 * States that have at least one BE-seeded service template (Phase 0).
 * Used to gray out states with "no templates yet" tooltip in the picker.
 * Keep in sync with backend/src/db/seed-data.ts → TEMPLATES jurisdictions.
 */
export const PHASE_0_SEEDED_STATES = new Set([
  "CA", "NY", "TX", "LA", "FL", "IL", "PA", "GA", "NJ", "MA",
]);

export function statesByRegion(): Record<UsState["region"], UsState[]> {
  const out = {} as Record<UsState["region"], UsState[]>;
  for (const r of REGIONS) out[r] = [];
  for (const s of US_STATES) out[s.region].push(s);
  for (const r of REGIONS) out[r].sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export function findState(code: string): UsState | undefined {
  return US_STATES.find((s) => s.code === code.toUpperCase());
}
