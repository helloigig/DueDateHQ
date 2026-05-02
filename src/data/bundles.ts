import type { Deadline, EntityType, StateCode } from "../types";
import { TODAY } from "./dateHelpers";

export type JurisdictionSlot = "federal" | "primary" | "nexus";

export interface DeadlineTemplate {
  form: string;
  jurisdiction: JurisdictionSlot;
  /** 1-indexed calendar month */
  month: number;
  /** 1-indexed calendar day */
  day: number;
  /** If true, generate for the CURRENT tax year. If false, NEXT tax year. */
  currentYear?: boolean;
}

export interface FilingBundle {
  id: string;
  name: string;
  description: string;
  entityTypes: EntityType[];
  templates: DeadlineTemplate[];
}

export const BUNDLES: FilingBundle[] = [
  {
    id: "individual-pte",
    name: "Individual + PTE",
    description: "Form 1040 + Q1–Q4 estimates + state PTE election.",
    entityTypes: ["Individual"],
    templates: [
      { form: "1040 (federal)", jurisdiction: "federal", month: 4, day: 15 },
      { form: "Q1 estimate (federal)", jurisdiction: "federal", month: 4, day: 15, currentYear: true },
      { form: "Q2 estimate (federal)", jurisdiction: "federal", month: 6, day: 15, currentYear: true },
      { form: "Q3 estimate (federal)", jurisdiction: "federal", month: 9, day: 15, currentYear: true },
      { form: "Q4 estimate (federal)", jurisdiction: "federal", month: 1, day: 15 },
      { form: "State income tax return", jurisdiction: "primary", month: 4, day: 15 },
    ],
  },
  {
    id: "scorp-standard",
    name: "S-Corp Standard",
    description: "Form 1120-S + state corporate + PTE election.",
    entityTypes: ["S-Corp"],
    templates: [
      { form: "1120-S (federal)", jurisdiction: "federal", month: 3, day: 15 },
      { form: "State S-Corp return", jurisdiction: "primary", month: 3, day: 15 },
      { form: "PTE election", jurisdiction: "primary", month: 3, day: 15 },
      { form: "State nexus filing", jurisdiction: "nexus", month: 4, day: 15 },
    ],
  },
  {
    id: "ccorp-standard",
    name: "C-Corp Standard",
    description: "Form 1120 + quarterly estimates + state corporate.",
    entityTypes: ["C-Corp"],
    templates: [
      { form: "1120 (federal)", jurisdiction: "federal", month: 4, day: 15 },
      { form: "Q1 estimate (federal)", jurisdiction: "federal", month: 4, day: 15, currentYear: true },
      { form: "Q2 estimate (federal)", jurisdiction: "federal", month: 6, day: 15, currentYear: true },
      { form: "Q3 estimate (federal)", jurisdiction: "federal", month: 9, day: 15, currentYear: true },
      { form: "Q4 estimate (federal)", jurisdiction: "federal", month: 12, day: 15, currentYear: true },
      { form: "State C-Corp return", jurisdiction: "primary", month: 4, day: 15 },
    ],
  },
  {
    id: "partnership-standard",
    name: "Partnership Standard",
    description: "Form 1065 + state partnership + PTE election.",
    entityTypes: ["Partnership"],
    templates: [
      { form: "1065 (federal)", jurisdiction: "federal", month: 3, day: 15 },
      { form: "State partnership return", jurisdiction: "primary", month: 3, day: 15 },
      { form: "PTE election", jurisdiction: "primary", month: 3, day: 15 },
      { form: "State nexus filing", jurisdiction: "nexus", month: 4, day: 15 },
    ],
  },
  {
    id: "multi-state-llc",
    name: "Multi-state LLC",
    description: "LLC federal pass-through + primary state + each nexus state.",
    entityTypes: ["LLC"],
    templates: [
      { form: "1065 (federal)", jurisdiction: "federal", month: 3, day: 15 },
      { form: "LLC annual report", jurisdiction: "primary", month: 4, day: 15 },
      { form: "State LLC filing", jurisdiction: "nexus", month: 4, day: 15 },
      { form: "Sales tax Q", jurisdiction: "primary", month: 4, day: 30, currentYear: true },
    ],
  },
  {
    id: "trust-annual",
    name: "Trust Annual",
    description: "Form 1041 + state fiduciary return.",
    entityTypes: ["Trust"],
    templates: [
      { form: "1041 (trust)", jurisdiction: "federal", month: 4, day: 15 },
      { form: "State fiduciary return", jurisdiction: "primary", month: 4, day: 15 },
    ],
  },
];

export function bundleById(id: string): FilingBundle | undefined {
  return BUNDLES.find((b) => b.id === id);
}

/**
 * Resolve a service-package string to its bundle definition. Clients store
 * package strings by display name (e.g. "S-Corp Standard"), not by id, so
 * the FE needs a name-keyed lookup to render the bundle's composition.
 * Returns undefined for firm-custom packages that don't match a system bundle.
 */
export function bundleByName(name: string): FilingBundle | undefined {
  return BUNDLES.find((b) => b.name === name);
}

export function suggestBundleForEntity(entity: EntityType): FilingBundle {
  // Pick first bundle that supports this entity type.
  return BUNDLES.find((b) => b.entityTypes.includes(entity)) ?? BUNDLES[0];
}

/**
 * Expand a bundle against a specific client (entity + primary state + nexus states)
 * into concrete deadlines. Deadlines are generated for the CURRENT tax year
 * if already passed → next year; otherwise current year.
 */
export interface GenerateContext {
  clientId: string;
  primaryState: StateCode;
  nexusStates: StateCode[];
  nowIso?: string;
}

export function generateDeadlinesFromBundle(
  bundle: FilingBundle,
  ctx: GenerateContext
): Omit<Deadline, "id">[] {
  const today = ctx.nowIso ? new Date(ctx.nowIso) : new Date(TODAY);
  const currentYear = today.getFullYear();
  const nextYear = currentYear + 1;
  const out: Omit<Deadline, "id">[] = [];

  for (const t of bundle.templates) {
    const jurisdictions: Array<"federal" | StateCode> =
      t.jurisdiction === "federal"
        ? ["federal"]
        : t.jurisdiction === "primary"
        ? [ctx.primaryState]
        : ctx.nexusStates.slice();

    for (const j of jurisdictions) {
      // Pick year: if the month/day has already passed this year, go to next year.
      const thisYear = new Date(currentYear, t.month - 1, t.day);
      const useNext = t.currentYear ? false : thisYear.getTime() <= today.getTime();
      const year = useNext ? nextYear : currentYear;
      const iso = `${year}-${String(t.month).padStart(2, "0")}-${String(
        t.day
      ).padStart(2, "0")}`;
      out.push({
        clientId: ctx.clientId,
        form: t.form,
        jurisdiction: j,
        officialDueDate: iso,
        status: "not_started",
        bundleId: bundle.id,
      });
    }
  }

  return out;
}
