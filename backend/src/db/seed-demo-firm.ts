/**
 * Demo firm content seeder. Mirrors the 51-client roster + deadline set
 * from the FE's mock-mode fixtures (src/data/mockClients.ts and
 * src/data/mockDeadlines.ts) so the deployed real-backend product gives
 * the same impressive first impression as the local mock-mode preview.
 *
 * Called from `auth.bootstrapDemo` (tRPC) — fires when a user signs in
 * as demo@duedatehq.com so the firm always converges on the seeded set.
 *
 * What's seeded (in dependency order):
 *   1. Clients — 51 rows
 *   2. Deadlines — ~70 rows, internal_target_date = official - 7d
 *   3. Tasks — one per active/overdue/in-progress deadline (so Timeline
 *      and the Today summary tiles have something to count)
 *   4. TaskMilestones — 5 per task (initial_meeting → file), status
 *      derived deterministically from target_date vs today so the fleet
 *      stack renders a believable mix of done / in-progress / not-started
 *   5. ChecklistItems — 4 per task in a deterministic role-mix (Mode A
 *      received-unreviewed, Mode B requested-waiting, Mode C
 *      received-issue, etc.) so todoItems.list aggregates to a populated
 *      Action queue
 *   6. EmailDrafts — Mode D draft-ready rows for ~1 in 7 tasks
 *
 * Idempotency:
 *   • Clients: idempotent on (firm_id, name). Re-runs skip existing rows.
 *   • Deadlines: idempotent on (firm_id, client_id, form_type, official_due_date).
 *   • Tasks: idempotent on (deadline_id) — at most one task per deadline.
 *   • Milestones: idempotent on (task_id, milestone_type).
 *   • ChecklistItems: idempotent on (task_id, label).
 *   • EmailDrafts: idempotent on (task_id, subject).
 *
 * Re-running this function after edits will INSERT new rows but won't
 * UPDATE existing ones — treat the seed as immutable once landed. To
 * change a row, ship a follow-up mutation (or wipe the demo firm and
 * re-seed; clients are firm-scoped so cascade-delete cleans up cleanly).
 */
import { and, eq, inArray } from "drizzle-orm";
import type { db as DbType } from "./client.js";
import {
  checklistItems,
  clients,
  deadlines,
  emailDrafts,
  taskMilestones,
  tasks,
} from "./schema.js";

interface DemoClient {
  /** Stable handle so deadlines can reference clients before insert. */
  key: string;
  name: string;
  entityType: string;
  primaryState: string;
  nexusStates: string[];
  contactEmail: string | null;
  contactPhone: string | null;
  status: "active" | "inactive" | "prospect" | "archived";
  tier: string;
  county: string;
  notes?: string;
  aiSummaryOverride?: string;
}

interface DemoDeadline {
  clientKey: string;
  formType: string;
  jurisdiction: string;
  officialDueDate: string; // YYYY-MM-DD
  status:
    | "not_started"
    | "in_progress"
    | "completed"
    | "deferred"
    | "filed_extension"
    | "overdue";
}

const DEMO_CLIENTS: DemoClient[] = [
  // California (11)
  { key: "c-ca-01", name: "Riverside Holdings LLC", entityType: "LLC", primaryState: "CA", nexusStates: ["NY", "TX"], contactEmail: "ops@riverside-holdings.com", contactPhone: "(415) 555-0182", status: "active", tier: "premium", county: "San Francisco" },
  { key: "c-ca-02", name: "Pacific Ridge S-Corp", entityType: "S-Corp", primaryState: "CA", nexusStates: [], contactEmail: "kyle@pacificridge.co", contactPhone: null, status: "active", tier: "standard", county: "Los Angeles" },
  {
    key: "c-ca-03",
    name: "Mark Sullivan",
    entityType: "Individual",
    primaryState: "CA",
    nexusStates: [],
    contactEmail: "mark.sullivan@gmail.com",
    contactPhone: "(510) 555-0294",
    status: "prospect",
    tier: "standard",
    county: "Alameda",
    aiSummaryOverride:
      "Reliable docs every Feb except K-1 (early Aug). 5-year Schedule E rental property — flag if missing. Prefers casual emails, hates phone calls.",
  },
  { key: "c-ca-04", name: "Sierra Vista Partners", entityType: "Partnership", primaryState: "CA", nexusStates: [], contactEmail: "accounting@sierravista.partners", contactPhone: null, status: "prospect", tier: "standard", county: "San Diego" },
  { key: "c-ca-05", name: "Bayview Dental C-Corp", entityType: "C-Corp", primaryState: "CA", nexusStates: [], contactEmail: "finance@bayviewdental.com", contactPhone: null, status: "active", tier: "premium", county: "San Francisco" },
  { key: "c-ca-06", name: "Nguyen Family Trust", entityType: "Trust", primaryState: "CA", nexusStates: [], contactEmail: "trustee@nguyenlaw.com", contactPhone: null, status: "active", tier: "custom", county: "Santa Clara" },
  { key: "c-ca-07", name: "Coastal Tech LLC", entityType: "LLC", primaryState: "CA", nexusStates: ["NY"], contactEmail: "lisa@coastaltech.io", contactPhone: null, status: "active", tier: "premium", county: "San Diego" },
  { key: "c-ca-08", name: "Anne Dupont", entityType: "Individual", primaryState: "CA", nexusStates: [], contactEmail: "adupont@outlook.com", contactPhone: null, status: "active", tier: "standard", county: "San Francisco" },
  { key: "c-ca-09", name: "Orchard Foods LLC", entityType: "LLC", primaryState: "CA", nexusStates: [], contactEmail: "hello@orchardfoods.com", contactPhone: null, status: "active", tier: "standard", county: "Sonoma" },
  { key: "c-ca-10", name: "Granite Ventures S-Corp", entityType: "S-Corp", primaryState: "CA", nexusStates: [], contactEmail: "ken@graniteventures.com", contactPhone: null, status: "active", tier: "premium", county: "Los Angeles" },
  { key: "c-ca-11", name: "Sequoia Pediatrics Inc", entityType: "C-Corp", primaryState: "CA", nexusStates: [], contactEmail: "billing@sequoiapeds.com", contactPhone: "(650) 555-0184", status: "inactive", tier: "standard", county: "San Mateo" },
  // New York (9)
  { key: "c-ny-01", name: "Harbor Group LLC", entityType: "LLC", primaryState: "NY", nexusStates: ["FL"], contactEmail: "admin@harborgroup.nyc", contactPhone: null, status: "active", tier: "premium", county: "New York" },
  { key: "c-ny-02", name: "Sofia Alvarez", entityType: "Individual", primaryState: "NY", nexusStates: [], contactEmail: "sofia.alvarez@gmail.com", contactPhone: null, status: "active", tier: "standard", county: "Kings" },
  { key: "c-ny-03", name: "Brooklyn Press Partnership", entityType: "Partnership", primaryState: "NY", nexusStates: [], contactEmail: "ap@brooklynpress.com", contactPhone: null, status: "active", tier: "standard", county: "Kings" },
  { key: "c-ny-04", name: "Empire Advisory S-Corp", entityType: "S-Corp", primaryState: "NY", nexusStates: [], contactEmail: "rachel@empireadvisory.com", contactPhone: null, status: "active", tier: "premium", county: "New York" },
  { key: "c-ny-05", name: "Hudson Valley Trust", entityType: "Trust", primaryState: "NY", nexusStates: [], contactEmail: "trust@hvlaw.com", contactPhone: null, status: "active", tier: "custom", county: "Westchester" },
  {
    key: "c-ny-06",
    name: "Madison Labs C-Corp",
    entityType: "C-Corp",
    primaryState: "NY",
    nexusStates: ["CA", "TX", "FL"],
    contactEmail: "cfo@madisonlabs.io",
    contactPhone: "(212) 555-0903",
    status: "active",
    tier: "premium",
    county: "New York",
    notes: "Series B closed Q1 — RSU vesting starts Q3. Schedule year-end planning call in November.",
  },
  { key: "c-ny-07", name: "Daniel O'Brien", entityType: "Individual", primaryState: "NY", nexusStates: [], contactEmail: "dobrien@fastmail.com", contactPhone: null, status: "archived", tier: "standard", county: "Queens" },
  { key: "c-ny-08", name: "Uptown Realty LLC", entityType: "LLC", primaryState: "NY", nexusStates: [], contactEmail: "books@uptown-realty.com", contactPhone: null, status: "active", tier: "standard", county: "New York" },
  { key: "c-ny-09", name: "Tribeca Atelier LLC", entityType: "LLC", primaryState: "NY", nexusStates: [], contactEmail: null, contactPhone: null, status: "archived", tier: "standard", county: "New York" },
  // Texas (8)
  { key: "c-tx-01", name: "Lone Star Construction LLC", entityType: "LLC", primaryState: "TX", nexusStates: ["LA"], contactEmail: "ap@lonestarconstruction.com", contactPhone: null, status: "active", tier: "premium", county: "Harris" },
  { key: "c-tx-02", name: "Patel Holdings LLC", entityType: "LLC", primaryState: "TX", nexusStates: ["CA"], contactEmail: "nikhil@patelholdings.com", contactPhone: null, status: "active", tier: "standard", county: "Dallas" },
  { key: "c-tx-03", name: "Austin Makers S-Corp", entityType: "S-Corp", primaryState: "TX", nexusStates: [], contactEmail: "finance@austinmakers.co", contactPhone: null, status: "active", tier: "standard", county: "Travis" },
  { key: "c-tx-04", name: "Davis Family", entityType: "Individual", primaryState: "TX", nexusStates: [], contactEmail: "rdavis@gmail.com", contactPhone: null, status: "inactive", tier: "standard", county: "Tarrant" },
  { key: "c-tx-05", name: "Hill Country Winery Partnership", entityType: "Partnership", primaryState: "TX", nexusStates: [], contactEmail: "accounting@hillcountrywinery.com", contactPhone: null, status: "active", tier: "standard", county: "Gillespie" },
  { key: "c-tx-06", name: "Rio Grande Trading C-Corp", entityType: "C-Corp", primaryState: "TX", nexusStates: [], contactEmail: "cfo@riograndetrading.com", contactPhone: null, status: "active", tier: "premium", county: "El Paso" },
  { key: "c-tx-07", name: "Whitman Family Trust", entityType: "Trust", primaryState: "TX", nexusStates: [], contactEmail: "trust@whitman-family.com", contactPhone: null, status: "archived", tier: "standard", county: "Harris" },
  { key: "c-tx-08", name: "Juniper Oil & Gas LLC", entityType: "LLC", primaryState: "TX", nexusStates: ["LA", "FL"], contactEmail: "ap@juniperog.com", contactPhone: null, status: "active", tier: "premium", county: "Midland" },
  // Louisiana (7)
  {
    key: "c-la-01",
    name: "Acme Bayou LLC",
    entityType: "LLC",
    primaryState: "LA",
    nexusStates: [],
    contactEmail: "rob@acmebayou.com",
    contactPhone: "(504) 555-0731",
    status: "active",
    tier: "standard",
    county: "Orleans",
    notes: "K-1 from Apex Fund LP arrives early August every year. Don't chase before Aug 1 — it stresses Rob and the timeline never moves.",
  },
  { key: "c-la-02", name: "Crescent City Media S-Corp", entityType: "S-Corp", primaryState: "LA", nexusStates: ["TX", "FL"], contactEmail: "finance@crescentcitymedia.com", contactPhone: null, status: "active", tier: "premium", county: "Orleans" },
  { key: "c-la-03", name: "Jim Boudreaux", entityType: "Individual", primaryState: "LA", nexusStates: [], contactEmail: "jim.boudreaux@yahoo.com", contactPhone: null, status: "active", tier: "standard", county: "St. Bernard" },
  { key: "c-la-04", name: "Lafitte Holdings LLC", entityType: "LLC", primaryState: "LA", nexusStates: [], contactEmail: "admin@lafitteholdings.com", contactPhone: null, status: "active", tier: "standard", county: "Jefferson" },
  { key: "c-la-05", name: "Marie Theriot", entityType: "Individual", primaryState: "LA", nexusStates: [], contactEmail: "marie.theriot@gmail.com", contactPhone: null, status: "prospect", tier: "standard", county: "Jefferson" },
  { key: "c-la-06", name: "Bayou Engineering Partnership", entityType: "Partnership", primaryState: "LA", nexusStates: [], contactEmail: "accounting@bayoueng.com", contactPhone: null, status: "active", tier: "standard", county: "Orleans" },
  { key: "c-la-07", name: "Mississippi Valley Trust", entityType: "Trust", primaryState: "LA", nexusStates: [], contactEmail: "trust@mvtrustco.com", contactPhone: null, status: "active", tier: "custom", county: "East Baton Rouge" },
  // Florida (7)
  { key: "c-fl-01", name: "Miami Seaside LLC", entityType: "LLC", primaryState: "FL", nexusStates: ["NY"], contactEmail: "ops@miamiseaside.com", contactPhone: null, status: "active", tier: "standard", county: "Miami-Dade" },
  { key: "c-fl-02", name: "Suncoast Advisors S-Corp", entityType: "S-Corp", primaryState: "FL", nexusStates: ["NY", "TX"], contactEmail: "priya@suncoastadvisors.com", contactPhone: null, status: "active", tier: "premium", county: "Pinellas" },
  { key: "c-fl-03", name: "Carlos Mendoza", entityType: "Individual", primaryState: "FL", nexusStates: [], contactEmail: "carlos.m@hotmail.com", contactPhone: null, status: "active", tier: "standard", county: "Miami-Dade" },
  { key: "c-fl-04", name: "Everglade Logistics C-Corp", entityType: "C-Corp", primaryState: "FL", nexusStates: [], contactEmail: "cfo@evergladelogistics.com", contactPhone: null, status: "active", tier: "premium", county: "Broward" },
  { key: "c-fl-05", name: "Palm Grove Partnership", entityType: "Partnership", primaryState: "FL", nexusStates: [], contactEmail: "accounting@palmgrove.com", contactPhone: null, status: "active", tier: "standard", county: "Orange" },
  { key: "c-fl-06", name: "Keys Marine LLC", entityType: "LLC", primaryState: "FL", nexusStates: [], contactEmail: "ap@keysmarine.com", contactPhone: null, status: "active", tier: "standard", county: "Monroe" },
  { key: "c-fl-07", name: "Johnson Family", entityType: "Individual", primaryState: "FL", nexusStates: [], contactEmail: "johnson.family@gmail.com", contactPhone: "(813) 555-0429", status: "inactive", tier: "standard", county: "Hillsborough" },
  // Multi-state footprint (8)
  { key: "c-ga-01", name: "Peachtree Robotics S-Corp", entityType: "S-Corp", primaryState: "GA", nexusStates: ["CA", "NY", "TX"], contactEmail: "finance@peachtreerobotics.io", contactPhone: "(404) 555-0277", status: "active", tier: "premium", county: "Fulton" },
  { key: "c-ga-02", name: "Olivia Bennett", entityType: "Individual", primaryState: "GA", nexusStates: [], contactEmail: "olivia.bennett@protonmail.com", contactPhone: "(770) 555-0813", status: "active", tier: "premium", county: "DeKalb" },
  { key: "c-il-01", name: "Lakeshore Realty LLC", entityType: "LLC", primaryState: "IL", nexusStates: ["FL", "TX"], contactEmail: "ap@lakeshore-realty.com", contactPhone: "(312) 555-0610", status: "active", tier: "premium", county: "Cook" },
  { key: "c-il-02", name: "Daniel Voss", entityType: "Individual", primaryState: "IL", nexusStates: [], contactEmail: "dvoss@lakeshore-realty.com", contactPhone: "(312) 555-0611", status: "active", tier: "premium", county: "Cook" },
  { key: "c-pa-01", name: "Allegheny Forge C-Corp", entityType: "C-Corp", primaryState: "PA", nexusStates: ["NJ"], contactEmail: "cfo@alleghenyforge.com", contactPhone: "(412) 555-0188", status: "active", tier: "premium", county: "Allegheny" },
  { key: "c-nj-01", name: "Hudson River Consulting Partnership", entityType: "Partnership", primaryState: "NJ", nexusStates: ["NY"], contactEmail: "books@hudsonriver.consulting", contactPhone: "(201) 555-0473", status: "active", tier: "standard", county: "Hudson" },
  { key: "c-ma-01", name: "Beacon Hill Family Trust", entityType: "Trust", primaryState: "MA", nexusStates: [], contactEmail: "trustee@beaconhilllaw.com", contactPhone: "(617) 555-0240", status: "active", tier: "custom", county: "Suffolk" },
  { key: "c-or-01", name: "Cascade Brewing S-Corp", entityType: "S-Corp", primaryState: "OR", nexusStates: ["WA"], contactEmail: "finance@cascadebrewing.co", contactPhone: "(503) 555-0962", status: "active", tier: "standard", county: "Multnomah" },
  { key: "c-mi-01", name: "Great Lakes Manufacturing C-Corp", entityType: "C-Corp", primaryState: "MI", nexusStates: ["IL"], contactEmail: "cfo@greatlakesmfg.com", contactPhone: "(248) 555-0317", status: "prospect", tier: "premium", county: "Oakland" },
];

// Anchored to 2026-05-05 — same anchor as src/data/dateHelpers.ts so the
// "behind / this week / this month" buckets match the FE's mock-mode
// reference frame. Bumping `TODAY` requires re-anchoring this array.
const DEMO_DEADLINES: DemoDeadline[] = [
  // OVERDUE (6)
  { clientKey: "c-ca-01", formType: "CA 568 (LLC)", jurisdiction: "CA", officialDueDate: "2026-04-20", status: "overdue" },
  { clientKey: "c-ca-03", formType: "Q1 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-04-15", status: "overdue" },
  { clientKey: "c-tx-08", formType: "TX Franchise", jurisdiction: "TX", officialDueDate: "2026-05-01", status: "overdue" },
  { clientKey: "c-fl-02", formType: "F-1120 (FL corporate)", jurisdiction: "FL", officialDueDate: "2026-05-01", status: "overdue" },
  { clientKey: "c-ny-04", formType: "NY CT-3-S", jurisdiction: "NY", officialDueDate: "2026-05-02", status: "overdue" },
  { clientKey: "c-la-02", formType: "LA CIFT-620", jurisdiction: "LA", officialDueDate: "2026-05-04", status: "overdue" },
  // THIS WEEK (10)
  { clientKey: "c-ca-02", formType: "CA 100S (S-Corp)", jurisdiction: "CA", officialDueDate: "2026-05-05", status: "in_progress" },
  { clientKey: "c-ny-01", formType: "NY IT-204-LL", jurisdiction: "NY", officialDueDate: "2026-05-05", status: "in_progress" },
  { clientKey: "c-tx-01", formType: "TX Franchise", jurisdiction: "TX", officialDueDate: "2026-05-06", status: "not_started" },
  { clientKey: "c-tx-03", formType: "1120-S (federal)", jurisdiction: "federal", officialDueDate: "2026-05-06", status: "not_started" },
  { clientKey: "c-la-03", formType: "LA IT-540 (individual)", jurisdiction: "LA", officialDueDate: "2026-05-07", status: "not_started" },
  { clientKey: "c-fl-01", formType: "F-1120 (FL corporate)", jurisdiction: "FL", officialDueDate: "2026-05-08", status: "not_started" },
  { clientKey: "c-pa-01", formType: "PA RCT-101 (corporate)", jurisdiction: "PA", officialDueDate: "2026-05-08", status: "in_progress" },
  { clientKey: "c-ga-01", formType: "GA 600S (S-Corp)", jurisdiction: "GA", officialDueDate: "2026-05-08", status: "not_started" },
  { clientKey: "c-il-01", formType: "IL-1065 (partnership)", jurisdiction: "IL", officialDueDate: "2026-05-10", status: "not_started" },
  { clientKey: "c-or-01", formType: "OR-20-S (S-Corp)", jurisdiction: "OR", officialDueDate: "2026-05-10", status: "not_started" },
  // THIS MONTH (24)
  { clientKey: "c-ca-05", formType: "1120 (federal)", jurisdiction: "federal", officialDueDate: "2026-05-11", status: "not_started" },
  { clientKey: "c-ny-03", formType: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2026-05-12", status: "not_started" },
  { clientKey: "c-ny-04", formType: "NY CT-3-S", jurisdiction: "NY", officialDueDate: "2026-05-12", status: "not_started" },
  { clientKey: "c-tx-01", formType: "TX Franchise", jurisdiction: "TX", officialDueDate: "2026-05-13", status: "not_started" },
  { clientKey: "c-la-04", formType: "LA IT-565 (partnership)", jurisdiction: "LA", officialDueDate: "2026-05-14", status: "not_started" },
  { clientKey: "c-fl-04", formType: "F-1120 (FL corporate)", jurisdiction: "FL", officialDueDate: "2026-05-15", status: "not_started" },
  { clientKey: "c-ca-06", formType: "1041 (trust)", jurisdiction: "federal", officialDueDate: "2026-05-15", status: "not_started" },
  { clientKey: "c-tx-05", formType: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2026-05-15", status: "not_started" },
  { clientKey: "c-ca-08", formType: "1040 (extension filing)", jurisdiction: "federal", officialDueDate: "2026-05-18", status: "not_started" },
  { clientKey: "c-ny-05", formType: "1041 (trust)", jurisdiction: "federal", officialDueDate: "2026-05-19", status: "not_started" },
  { clientKey: "c-la-05", formType: "LA IT-540 (extension)", jurisdiction: "LA", officialDueDate: "2026-05-20", status: "not_started" },
  { clientKey: "c-tx-06", formType: "TX Franchise", jurisdiction: "TX", officialDueDate: "2026-05-21", status: "not_started" },
  { clientKey: "c-fl-03", formType: "1040 (federal)", jurisdiction: "federal", officialDueDate: "2026-05-22", status: "not_started" },
  { clientKey: "c-ca-09", formType: "CA 568 (LLC)", jurisdiction: "CA", officialDueDate: "2026-05-22", status: "not_started" },
  { clientKey: "c-nj-01", formType: "NJ-1065 (partnership)", jurisdiction: "NJ", officialDueDate: "2026-05-22", status: "not_started" },
  { clientKey: "c-ma-01", formType: "MA Form 2 (trust)", jurisdiction: "MA", officialDueDate: "2026-05-22", status: "not_started" },
  { clientKey: "c-ny-06", formType: "NY CT-3 (C-Corp)", jurisdiction: "NY", officialDueDate: "2026-05-26", status: "not_started" },
  { clientKey: "c-la-06", formType: "LA IT-565 (partnership)", jurisdiction: "LA", officialDueDate: "2026-05-27", status: "not_started" },
  { clientKey: "c-tx-07", formType: "1041 (trust)", jurisdiction: "federal", officialDueDate: "2026-05-28", status: "not_started" },
  { clientKey: "c-fl-05", formType: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2026-05-29", status: "not_started" },
  { clientKey: "c-mi-01", formType: "MI CIT (C-Corp)", jurisdiction: "MI", officialDueDate: "2026-05-29", status: "not_started" },
  { clientKey: "c-ga-02", formType: "GA 500 (individual)", jurisdiction: "GA", officialDueDate: "2026-05-29", status: "not_started" },
  { clientKey: "c-il-02", formType: "IL-1040 (individual)", jurisdiction: "IL", officialDueDate: "2026-05-29", status: "not_started" },
  { clientKey: "c-pa-01", formType: "PA RCT-101 (final)", jurisdiction: "PA", officialDueDate: "2026-05-31", status: "not_started" },
  // LONG TERM Jun-Dec (sample — Q2 estimates + extensions)
  { clientKey: "c-ca-03", formType: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientKey: "c-ny-02", formType: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientKey: "c-tx-04", formType: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientKey: "c-la-03", formType: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientKey: "c-fl-03", formType: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientKey: "c-ga-02", formType: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientKey: "c-il-02", formType: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientKey: "c-ca-10", formType: "CA PTE election", jurisdiction: "CA", officialDueDate: "2026-07-15", status: "not_started" },
  { clientKey: "c-ny-01", formType: "NY PTE estimate", jurisdiction: "NY", officialDueDate: "2026-07-15", status: "not_started" },
  { clientKey: "c-or-01", formType: "OR PTE election", jurisdiction: "OR", officialDueDate: "2026-07-15", status: "not_started" },
  { clientKey: "c-tx-08", formType: "TX Franchise (extension)", jurisdiction: "TX", officialDueDate: "2026-08-15", status: "not_started" },
  { clientKey: "c-ca-04", formType: "CA 568 (LLC)", jurisdiction: "CA", officialDueDate: "2026-08-17", status: "not_started" },
  // Sep 15 — extended 1065 / 1120-S
  { clientKey: "c-ca-01", formType: "1065 (extension)", jurisdiction: "federal", officialDueDate: "2026-09-15", status: "not_started" },
  { clientKey: "c-ny-03", formType: "1065 (extension)", jurisdiction: "federal", officialDueDate: "2026-09-15", status: "not_started" },
  { clientKey: "c-tx-05", formType: "1065 (extension)", jurisdiction: "federal", officialDueDate: "2026-09-15", status: "not_started" },
  { clientKey: "c-fl-05", formType: "1065 (extension)", jurisdiction: "federal", officialDueDate: "2026-09-15", status: "not_started" },
  { clientKey: "c-nj-01", formType: "1065 (extension)", jurisdiction: "federal", officialDueDate: "2026-09-15", status: "not_started" },
  // Oct 15 — extended individual / C-Corp (Mark Sullivan = the linked target)
  { clientKey: "c-ca-03", formType: "1040 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientKey: "c-ca-05", formType: "1120 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientKey: "c-ny-06", formType: "1120 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientKey: "c-tx-06", formType: "1120 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientKey: "c-pa-01", formType: "1120 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientKey: "c-mi-01", formType: "1120 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  // Filed extensions (lifecycle examples)
  { clientKey: "c-ca-03", formType: "1040 (federal)", jurisdiction: "federal", officialDueDate: "2026-04-15", status: "filed_extension" },
  { clientKey: "c-ny-04", formType: "1120-S (federal)", jurisdiction: "federal", officialDueDate: "2026-03-15", status: "filed_extension" },
  { clientKey: "c-ca-07", formType: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2026-03-15", status: "filed_extension" },
  // Completed (history)
  { clientKey: "c-la-01", formType: "1120-S (federal)", jurisdiction: "federal", officialDueDate: "2026-03-15", status: "completed" },
  { clientKey: "c-la-01", formType: "LA CIFT-620", jurisdiction: "LA", officialDueDate: "2026-04-15", status: "completed" },
  { clientKey: "c-ny-02", formType: "1040 (federal)", jurisdiction: "federal", officialDueDate: "2026-04-15", status: "completed" },
  { clientKey: "c-ga-02", formType: "1040 (federal)", jurisdiction: "federal", officialDueDate: "2026-04-15", status: "completed" },
  { clientKey: "c-il-02", formType: "1040 (federal)", jurisdiction: "federal", officialDueDate: "2026-04-15", status: "completed" },
  // Deferred
  { clientKey: "c-ca-04", formType: "Sales tax Q1 (CA CDTFA)", jurisdiction: "CA", officialDueDate: "2026-04-30", status: "deferred" },
  { clientKey: "c-tx-02", formType: "TX Franchise (Q1)", jurisdiction: "TX", officialDueDate: "2026-04-30", status: "deferred" },
];

interface SeedResult {
  clientsInserted: number;
  clientsExisting: number;
  clientsCleared: number;
  deadlinesInserted: number;
  deadlinesExisting: number;
  deadlinesBackfilled: number;
  tasksInserted: number;
  tasksExisting: number;
  milestonesInserted: number;
  checklistsInserted: number;
  draftsInserted: number;
}

// "Today" anchor for milestone/checklist status derivation. Defaults to
// real now() but the test harness can override so seed snapshots stay
// stable across runs without smearing on each calendar day.
const SEED_TODAY = new Date(
  process.env.DEMO_SEED_TODAY ?? new Date().toISOString().slice(0, 10),
);
const MS_PER_DAY = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) =>
  new Date(d.getTime() + n * MS_PER_DAY);
const daysBetween = (a: Date, b: Date) =>
  Math.round((a.getTime() - b.getTime()) / MS_PER_DAY);

// Deterministic 6-char base36 hash for forwardingEmailLocalPart. Must be
// stable across re-runs (so re-seeds don't allocate new rows) and globally
// unique (the column has a UNIQUE constraint).
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 6).padStart(6, "0");
}

function slug(s: string, max = 16) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, max) || "x";
}

function forwardingLocalPart(
  firmId: string,
  clientName: string,
  formType: string,
  dueDate: string,
) {
  const tail = djb2(`${firmId}|${clientName}|${formType}|${dueDate}`);
  const first = clientName.split(" ")[0] ?? "task";
  return `${slug(first)}-${slug(formType)}-${tail}`;
}

// Statuses considered "live work" — the seed only spawns tasks +
// milestones + checklists for these. Completed/filed_extension/deferred
// deadlines stay as historical context (Clients page, prior-year facts).
const ACTIVE_DEADLINE_STATUSES = new Set([
  "not_started",
  "in_progress",
  "overdue",
]);

type DeadlineStatus = DemoDeadline["status"];

// Five-step default milestone schedule. Targets are deltas relative to
// the official due date — clamped to 0 so an overdue deadline still
// renders sensible past targets.
const MILESTONE_SCHEDULE: Array<{
  type:
    | "initial_meeting"
    | "collect_materials"
    | "prepare_workpapers"
    | "internal_review"
    | "client_review"
    | "file";
  daysBefore: number;
}> = [
  { type: "collect_materials", daysBefore: 45 },
  { type: "prepare_workpapers", daysBefore: 21 },
  { type: "internal_review", daysBefore: 14 },
  { type: "client_review", daysBefore: 7 },
  { type: "file", daysBefore: 0 },
];

// Five role mixes for checklist items. Index = task position (stable
// after sorting by deadline + form), so the same demo firm always has
// the same items in the same shape after re-seed.
//
// Each role array has 4 items so the FE DotStack renders 4 dots —
// matches the "1 of 4 received and waiting your confirm" copy.
type ChecklistRole = {
  state:
    | "not_requested"
    | "requested_waiting"
    | "received_unreviewed"
    | "received_confirmed"
    | "received_issue";
  /** -1 = no reminder yet (not_requested role). Other values are days ago. */
  remindedDaysAgo: number;
  aiConfidence: string | null;
  aiFlagReason: string | null;
};

const CHECKLIST_ROLES: ChecklistRole[][] = [
  // 0: "all received unreviewed" — Mode A piles 4 confirms onto Today.
  [
    { state: "received_unreviewed", remindedDaysAgo: 2, aiConfidence: "0.92", aiFlagReason: null },
    { state: "received_unreviewed", remindedDaysAgo: 2, aiConfidence: "0.88", aiFlagReason: null },
    { state: "received_unreviewed", remindedDaysAgo: 2, aiConfidence: "0.95", aiFlagReason: null },
    { state: "received_unreviewed", remindedDaysAgo: 2, aiConfidence: "0.81", aiFlagReason: null },
  ],
  // 1: "all waiting" — Mode B chase row, last reminder 5d ago.
  [
    { state: "requested_waiting", remindedDaysAgo: 5, aiConfidence: null, aiFlagReason: null },
    { state: "requested_waiting", remindedDaysAgo: 5, aiConfidence: null, aiFlagReason: null },
    { state: "requested_waiting", remindedDaysAgo: 5, aiConfidence: null, aiFlagReason: null },
    { state: "requested_waiting", remindedDaysAgo: 5, aiConfidence: null, aiFlagReason: null },
  ],
  // 2: "mixed" — Mode C anomaly + Mode B chase + 1 confirmed.
  [
    { state: "received_issue", remindedDaysAgo: 3, aiConfidence: "0.62", aiFlagReason: "Amount differs from prior year by >20% — confirm with client" },
    { state: "requested_waiting", remindedDaysAgo: 8, aiConfidence: null, aiFlagReason: null },
    { state: "requested_waiting", remindedDaysAgo: 8, aiConfidence: null, aiFlagReason: null },
    { state: "received_confirmed", remindedDaysAgo: -1, aiConfidence: null, aiFlagReason: null },
  ],
  // 3: "fresh" — T-21 hit, never asked yet (Mode B with not_requested).
  [
    { state: "not_requested", remindedDaysAgo: -1, aiConfidence: null, aiFlagReason: null },
    { state: "not_requested", remindedDaysAgo: -1, aiConfidence: null, aiFlagReason: null },
    { state: "not_requested", remindedDaysAgo: -1, aiConfidence: null, aiFlagReason: null },
    { state: "not_requested", remindedDaysAgo: -1, aiConfidence: null, aiFlagReason: null },
  ],
  // 4: "advanced" — mostly confirmed, one Mode A item still waiting.
  [
    { state: "received_confirmed", remindedDaysAgo: -1, aiConfidence: null, aiFlagReason: null },
    { state: "received_confirmed", remindedDaysAgo: -1, aiConfidence: null, aiFlagReason: null },
    { state: "received_confirmed", remindedDaysAgo: -1, aiConfidence: null, aiFlagReason: null },
    { state: "received_unreviewed", remindedDaysAgo: 1, aiConfidence: "0.79", aiFlagReason: null },
  ],
];

// Common-document checklist labels — picked per task index so different
// tasks have different shopping lists. Item type is best-effort categorical
// for the FE to colour code; not load-bearing.
const CHECKLIST_LABELS: Array<{ label: string; itemType: string }> = [
  { label: "W-2 (current year)", itemType: "income" },
  { label: "1099-NEC", itemType: "income" },
  { label: "1099-INT / 1099-DIV", itemType: "income" },
  { label: "K-1 schedule", itemType: "income" },
  { label: "Bank statements (Q4)", itemType: "support" },
  { label: "Mortgage interest (1098)", itemType: "deduction" },
  { label: "Charitable contribution receipts", itemType: "deduction" },
  { label: "Prior-year return (PDF)", itemType: "support" },
  { label: "QuickBooks export", itemType: "support" },
  { label: "Vehicle mileage log", itemType: "deduction" },
  { label: "Health insurance 1095", itemType: "support" },
  { label: "Estimated payment record", itemType: "payment" },
];

/**
 * Idempotently seed the demo firm with 51 clients + ~70 deadlines + the
 * downstream task/milestone/checklist/draft chain. Safe to call repeatedly:
 *
 *   • New rows insert with the keys listed at the top of this file.
 *   • Existing deadlines without internal_target_date get it backfilled
 *     (one-shot UPDATE) so firms seeded before that field shipped pick
 *     it up without a destructive reset.
 *   • All other existing rows are left alone.
 *
 * Pass `reseed: true` to cascade-delete every client in the firm before
 * re-seeding (caller is responsible for restricting that to a demo
 * context — there is no firm-id check in here). Cascade chain: clients
 * → deadlines → tasks → milestones / checklists / drafts / activity.
 * The firm row + user rows stay so the auth session keeps working.
 *
 * Note: takes the db handle as a parameter so this can be invoked from
 * any tRPC ctx (which supplies db) or a CLI script.
 */
export async function seedDemoFirm({
  db,
  firmId,
  reseed = false,
}: {
  db: typeof DbType;
  firmId: string;
  reseed?: boolean;
}): Promise<SeedResult> {
  let clientsInserted = 0;
  let clientsExisting = 0;
  let clientsCleared = 0;
  let deadlinesInserted = 0;
  let deadlinesExisting = 0;
  let deadlinesBackfilled = 0;

  // Reset path — wipe firm-scoped content so the seed runs from clean
  // state. onDelete: cascade on every dependent FK takes care of
  // deadlines → tasks → milestones / checklists / drafts / activity in
  // a single delete. Firm + user rows survive.
  if (reseed) {
    const cleared = await db
      .delete(clients)
      .where(eq(clients.firmId, firmId))
      .returning({ id: clients.id });
    clientsCleared = cleared.length;
  }

  // Index existing clients by name so we can reuse their ids when seeding
  // deadlines without doing a per-row lookup.
  const existingClients = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.firmId, firmId));
  const idByName = new Map(existingClients.map((c) => [c.name, c.id]));
  const idByKey = new Map<string, string>();

  for (const c of DEMO_CLIENTS) {
    const existingId = idByName.get(c.name);
    if (existingId) {
      idByKey.set(c.key, existingId);
      clientsExisting++;
      continue;
    }
    const [inserted] = await db
      .insert(clients)
      .values({
        firmId,
        name: c.name,
        entityType: c.entityType,
        primaryState: c.primaryState,
        nexusStates: c.nexusStates,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
        status: c.status,
        tier: c.tier,
        county: c.county,
        notes: c.notes ?? null,
        aiSummaryOverride: c.aiSummaryOverride ?? null,
      })
      .returning({ id: clients.id });
    if (!inserted) continue;
    idByKey.set(c.key, inserted.id);
    clientsInserted++;
  }

  // Index existing deadlines so we don't re-create the same row on re-run.
  // Also pull internal_target_date so we can backfill rows where it's
  // null — firms seeded before that column was populated would otherwise
  // never get the "Behind plan" tile to fire.
  const existingDeadlines = await db
    .select({
      id: deadlines.id,
      clientId: deadlines.clientId,
      formType: deadlines.formType,
      officialDueDate: deadlines.officialDueDate,
      internalTargetDate: deadlines.internalTargetDate,
    })
    .from(deadlines)
    .where(eq(deadlines.firmId, firmId));
  const deadlineKey = (clientId: string, formType: string, due: string) =>
    `${clientId}|${formType}|${due}`;
  const existingDeadlineSet = new Set(
    existingDeadlines.map((d) =>
      deadlineKey(d.clientId, d.formType, d.officialDueDate),
    ),
  );

  // One-shot backfill: any existing deadline missing internal_target_date
  // gets it set to (official - 7d). Idempotent — once filled, the WHERE
  // skips it. Done before the insert pass so the new-deadline insert
  // path can rely on no-op-update semantics if we ever hit the same row.
  for (const d of existingDeadlines) {
    if (d.internalTargetDate) continue;
    const internalTargetDate = isoDate(addDays(new Date(d.officialDueDate), -7));
    await db
      .update(deadlines)
      .set({ internalTargetDate })
      .where(eq(deadlines.id, d.id));
    deadlinesBackfilled++;
  }

  for (const d of DEMO_DEADLINES) {
    const clientId = idByKey.get(d.clientKey);
    if (!clientId) continue;
    const k = deadlineKey(clientId, d.formType, d.officialDueDate);
    if (existingDeadlineSet.has(k)) {
      deadlinesExisting++;
      continue;
    }
    // Internal target = official - 7 days. Drives the Dashboard's
    // "Behind plan" tile (counts open tasks where today > internal target
    // but ≤ official deadline). Without this, a healthy firm whose
    // deadlines are all 1-2 weeks out would show 0 across every signal
    // tile despite being mid-chase.
    const officialDate = new Date(d.officialDueDate);
    const internalTargetDate = isoDate(addDays(officialDate, -7));
    await db.insert(deadlines).values({
      firmId,
      clientId,
      // The product treats deadlines as 1:1 with a service-template instance
      // when one exists, but the demo seed deliberately bypasses templates
      // — letting us control statuses (overdue / filed_extension / etc.)
      // without re-running the deadline-generator.
      serviceTemplateId: null,
      // Period is required (NOT NULL) — use the calendar year for annuals.
      // Quarterly forms still get a year-only period; the FE doesn't depend
      // on this field for any UI affordance (it's an audit shape).
      period: d.officialDueDate.slice(0, 4),
      formType: d.formType,
      jurisdiction: d.jurisdiction,
      officialDueDate: d.officialDueDate,
      adjustedDueDate: d.officialDueDate,
      internalTargetDate,
      status: d.status,
    });
    deadlinesInserted++;
  }

  // ───────────────────────────────────────────────────────────────────
  // Tasks + milestones + checklists + drafts
  //
  // Re-fetch deadlines after the insert pass so we have ids for both
  // pre-existing and freshly inserted rows. Limit to ACTIVE statuses —
  // the seed deliberately leaves completed/filed/deferred deadlines
  // task-less so the historical buckets read as "already filed, no open
  // work" rather than "Sarah forgot to mark these done".
  // ───────────────────────────────────────────────────────────────────
  const allDeadlines = await db
    .select({
      id: deadlines.id,
      clientId: deadlines.clientId,
      formType: deadlines.formType,
      officialDueDate: deadlines.officialDueDate,
      status: deadlines.status,
    })
    .from(deadlines)
    .where(eq(deadlines.firmId, firmId));

  // Stable ordering — matches CHECKLIST_ROLES indexing so re-runs land in
  // the same role mix per task.
  const activeDeadlines = allDeadlines
    .filter((d) =>
      ACTIVE_DEADLINE_STATUSES.has(d.status as DeadlineStatus),
    )
    .sort((a, b) =>
      a.officialDueDate === b.officialDueDate
        ? a.formType.localeCompare(b.formType)
        : a.officialDueDate.localeCompare(b.officialDueDate),
    );

  // Index existing tasks by deadlineId so we don't double-spawn.
  const activeDeadlineIds = activeDeadlines.map((d) => d.id);
  const existingTasks = activeDeadlineIds.length
    ? await db
        .select({
          id: tasks.id,
          deadlineId: tasks.deadlineId,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.firmId, firmId),
            inArray(tasks.deadlineId, activeDeadlineIds),
          ),
        )
    : [];
  const taskIdByDeadline = new Map(
    existingTasks.map((t) => [t.deadlineId, t.id]),
  );

  // Resolve client name per deadline (needed for forwarding-email + draft
  // recipient). Build once so we don't N+1 the loop.
  const clientNameById = new Map(
    (
      await db
        .select({ id: clients.id, name: clients.name, email: clients.contactEmail })
        .from(clients)
        .where(eq(clients.firmId, firmId))
    ).map((c) => [c.id, { name: c.name, email: c.email }]),
  );

  let tasksInserted = 0;
  let tasksExisting = 0;

  for (const d of activeDeadlines) {
    if (taskIdByDeadline.has(d.id)) {
      tasksExisting++;
      continue;
    }
    const c = clientNameById.get(d.clientId);
    if (!c) continue;
    const local = forwardingLocalPart(
      firmId,
      c.name,
      d.formType,
      d.officialDueDate,
    );
    // Default task status = not_started; flip to overdue/in_progress to
    // match the parent deadline so the tasks list reflects the underlying
    // urgency without a follow-up update pass.
    const initialTaskStatus =
      d.status === "overdue"
        ? "overdue"
        : d.status === "in_progress"
          ? "in_progress"
          : "not_started";
    const [inserted] = await db
      .insert(tasks)
      .values({
        firmId,
        deadlineId: d.id,
        forwardingEmailLocalPart: local,
        status: initialTaskStatus,
      })
      .returning({ id: tasks.id });
    if (!inserted) continue;
    taskIdByDeadline.set(d.id, inserted.id);
    tasksInserted++;
  }

  // ───────────────────────────────────────────────────────────────────
  // Milestones — 5 per task, status derived from target_date vs today.
  // ───────────────────────────────────────────────────────────────────
  const taskIdList = Array.from(taskIdByDeadline.values());
  const existingMilestones = taskIdList.length
    ? await db
        .select({
          taskId: taskMilestones.taskId,
          milestoneType: taskMilestones.milestoneType,
        })
        .from(taskMilestones)
        .where(
          and(
            eq(taskMilestones.firmId, firmId),
            inArray(taskMilestones.taskId, taskIdList),
          ),
        )
    : [];
  const existingMilestoneSet = new Set(
    existingMilestones.map((m) => `${m.taskId}|${m.milestoneType}`),
  );

  let milestonesInserted = 0;

  for (const d of activeDeadlines) {
    const taskId = taskIdByDeadline.get(d.id);
    if (!taskId) continue;
    const officialDate = new Date(d.officialDueDate);

    for (let idx = 0; idx < MILESTONE_SCHEDULE.length; idx++) {
      const step = MILESTONE_SCHEDULE[idx]!;
      if (existingMilestoneSet.has(`${taskId}|${step.type}`)) continue;
      const target = addDays(officialDate, -step.daysBefore);
      const targetIso = isoDate(target);
      // Status mapping:
      //   target > today + 7d → not_started
      //   target ∈ [today-2d, today+7d] → in_progress
      //   target < today - 2d → done (with completedDate = targetIso)
      const delta = daysBetween(target, SEED_TODAY);
      let status:
        | "not_started"
        | "in_progress"
        | "done"
        | "blocked"
        | "overdue" = "not_started";
      let completedDate: string | null = null;
      if (delta < -2) {
        status = "done";
        completedDate = targetIso;
      } else if (delta <= 7) {
        status = "in_progress";
      }
      // The final "file" milestone is special — only mark it done if the
      // parent deadline itself is completed. Otherwise leave as
      // not_started even if the target date is past, so an overdue task
      // doesn't pretend it's filed.
      if (step.type === "file" && d.status !== "completed") {
        status = delta < 0 ? "overdue" : "not_started";
        completedDate = null;
      }
      await db.insert(taskMilestones).values({
        firmId,
        taskId,
        milestoneType: step.type,
        targetDate: targetIso,
        completedDate,
        displayOrder: idx,
        proposedBy: "ai",
        status,
      });
      milestonesInserted++;
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // Checklists — 4 items per task in a deterministic role mix. Drives
  // todoItems.list (Today's Action queue) — Mode A confirms, Mode B
  // chase rows, Mode C anomaly flags.
  // ───────────────────────────────────────────────────────────────────
  const existingChecklists = taskIdList.length
    ? await db
        .select({
          taskId: checklistItems.taskId,
          label: checklistItems.label,
        })
        .from(checklistItems)
        .where(
          and(
            eq(checklistItems.firmId, firmId),
            inArray(checklistItems.taskId, taskIdList),
          ),
        )
    : [];
  const existingChecklistSet = new Set(
    existingChecklists.map((c) => `${c.taskId}|${c.label}`),
  );

  let checklistsInserted = 0;

  for (let i = 0; i < activeDeadlines.length; i++) {
    const d = activeDeadlines[i]!;
    const taskId = taskIdByDeadline.get(d.id);
    if (!taskId) continue;
    const role = CHECKLIST_ROLES[i % CHECKLIST_ROLES.length]!;
    // Stagger which 4 labels each task pulls so different tasks ask for
    // different documents — keeps the demo varied at a glance.
    const labelStart = (i * 3) % CHECKLIST_LABELS.length;
    for (let j = 0; j < role.length; j++) {
      const labelDef =
        CHECKLIST_LABELS[(labelStart + j) % CHECKLIST_LABELS.length]!;
      if (existingChecklistSet.has(`${taskId}|${labelDef.label}`)) continue;
      const r = role[j]!;
      const lastReminderAt =
        r.remindedDaysAgo >= 0
          ? addDays(SEED_TODAY, -r.remindedDaysAgo)
          : null;
      // received_confirmed has the §5.3 invariant — only a user can
      // confirm. Mark the actor as user (we don't have a user id in
      // scope; null on stateChangedByUserId is allowed). All other
      // states are written by system here.
      const stateChangedByKind =
        r.state === "received_confirmed" ? "user" : "system";
      await db.insert(checklistItems).values({
        firmId,
        taskId,
        label: labelDef.label,
        itemType: labelDef.itemType,
        sortOrder: j,
        state: r.state,
        stateChangedByKind,
        aiConfidence: r.aiConfidence,
        aiFlagReason: r.aiFlagReason,
        // received_issue surfaces aiFlagSeverity in the FE — set medium
        // so it renders as amber rather than uncategorised.
        aiFlagSeverity: r.aiFlagReason ? "medium" : null,
        lastReminderAt,
      });
      checklistsInserted++;
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // Email drafts — Mode D draft-ready, ~1 in 7 active tasks. Surfaces
  // as "Review draft · …" rows in Today's Action queue.
  // ───────────────────────────────────────────────────────────────────
  const existingDrafts = taskIdList.length
    ? await db
        .select({
          taskId: emailDrafts.taskId,
          subject: emailDrafts.subject,
        })
        .from(emailDrafts)
        .where(
          and(
            eq(emailDrafts.firmId, firmId),
            inArray(emailDrafts.taskId, taskIdList),
          ),
        )
    : [];
  const existingDraftSet = new Set(
    existingDrafts.map((d) => `${d.taskId}|${d.subject}`),
  );

  let draftsInserted = 0;

  for (let i = 0; i < activeDeadlines.length; i++) {
    if (i % 7 !== 0) continue;
    const d = activeDeadlines[i]!;
    const taskId = taskIdByDeadline.get(d.id);
    if (!taskId) continue;
    const c = clientNameById.get(d.clientId);
    if (!c?.email) continue;
    const subject = `Quick update on your ${d.formType}`;
    if (existingDraftSet.has(`${taskId}|${subject}`)) continue;
    const body = [
      `Hi — just a heads up that your ${d.formType} is due ${d.officialDueDate}.`,
      "",
      "I've drafted the response below. A few items are still outstanding; please review and reply with anything we missed.",
      "",
      "— Sarah",
    ].join("\n");
    await db.insert(emailDrafts).values({
      firmId,
      taskId,
      status: "draft",
      toAddress: c.email,
      subject,
      body,
      tone: "neutral",
    });
    draftsInserted++;
  }

  // Defensive — silence unused-import warning when no rows match.
  void and;

  return {
    clientsInserted,
    clientsExisting,
    clientsCleared,
    deadlinesInserted,
    deadlinesExisting,
    deadlinesBackfilled,
    tasksInserted,
    tasksExisting,
    milestonesInserted,
    checklistsInserted,
    draftsInserted,
  };
}
