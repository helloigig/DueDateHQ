import type { ImportedFact } from "../types";
import { clients as seedClients } from "./mockClients";

/**
 * 2-3 prior years of facts per client. Powers arrival-timing (per-client arrival
 * timing) and anomaly-detector (anomaly thresholds) and cross-year-insighter (cross-year insights)
 * per PRD §6.6 Import Tier 3.
 *
 * Distribution chosen so a handful of clients show realistic patterns:
 * - One client (c-ca-03 / Mark Sullivan) has 5 years of Schedule E that
 *   disappears this year — cross-year-insighter flagship insight.
 * - W-2 clients have stable Feb arrival timing.
 * - K-1 partnerships arrive in early August.
 */

interface FactSeed {
  itemType: string;
  monthDay: string;
  amount?: number;
  note?: string;
}

const PRIOR_YEARS = [2024, 2023, 2022];

function isoFor(year: number, monthDay: string): string {
  return `${year}-${monthDay}`;
}

const FACT_TEMPLATES: Record<string, FactSeed[]> = {
  Individual: [
    { itemType: "wage_w2", monthDay: "02-05", amount: 120000 },
    { itemType: "1099_div", monthDay: "02-12", amount: 1860 },
    { itemType: "1099_int", monthDay: "02-08", amount: 1860 },
    { itemType: "k1", monthDay: "08-06", note: "Apex Fund" },
  ],
  LLC: [
    { itemType: "partnership_books", monthDay: "02-15" },
    { itemType: "partner_capital", monthDay: "02-25" },
    { itemType: "k1", monthDay: "08-08" },
  ],
  "S-Corp": [
    { itemType: "scorp_books", monthDay: "02-10" },
    { itemType: "scorp_distribution", monthDay: "03-01" },
  ],
  Partnership: [
    { itemType: "partnership_books", monthDay: "02-18" },
    { itemType: "partner_capital", monthDay: "03-04" },
  ],
  "C-Corp": [
    { itemType: "ccorp_books", monthDay: "02-22" },
    { itemType: "schedule_m3", monthDay: "03-10" },
  ],
  Trust: [
    { itemType: "trust_distribution", monthDay: "03-15" },
  ],
};

function makeFactsForClient(
  clientId: string,
  entityType: keyof typeof FACT_TEMPLATES
): ImportedFact[] {
  const out: ImportedFact[] = [];
  const templates = FACT_TEMPLATES[entityType] ?? [];
  for (const year of PRIOR_YEARS) {
    for (const t of templates) {
      out.push({
        id: `if-${clientId}-${year}-${t.itemType}`,
        clientId,
        year,
        itemType: t.itemType,
        observedDate: isoFor(year, t.monthDay),
        observedAmount: t.amount,
        note: t.note,
      });
    }
  }
  return out;
}

export const importedFacts: ImportedFact[] = (() => {
  const all: ImportedFact[] = [];
  for (const client of seedClients) {
    const e = client.entityType as keyof typeof FACT_TEMPLATES;
    if (FACT_TEMPLATES[e]) {
      all.push(...makeFactsForClient(client.id, e));
    }
  }
  // Special case for cross-year-insighter: c-ca-03 (Mark Sullivan) has 5 years of
  // Schedule E that the current return lacks. The cross-year insight
  // surfaces "Did the property sell?"
  for (const year of [2024, 2023, 2022, 2021, 2020]) {
    all.push({
      id: `if-c-ca-03-${year}-schedule_e`,
      clientId: "c-ca-03",
      year,
      itemType: "schedule_e",
      observedDate: `${year}-03-15`,
      note: "Sunset Beach rental — gross $42K",
    });
  }
  return all;
})();
