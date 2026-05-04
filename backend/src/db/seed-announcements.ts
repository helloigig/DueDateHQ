/**
 * Demo state-announcement seeder. The Cloudflare Workers scraper that
 * produces real announcements isn't deployed yet, so without this every
 * fresh DB ships with an empty `/alerts` page in real mode. We insert a
 * small set of plausible system-wide announcements (stateCode + authority
 * + dates that look real) so the alert feed, banner, and bell are
 * exercisable end-to-end against the live BE.
 *
 * Idempotent on (sourceUrl): re-running won't double-insert. When the
 * scraper deploys, these rows can be deleted (they have hardcoded
 * sourceUrls under https://demo.duedatehq.space/announcements/...).
 */
import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { announcements } from "./schema.js";

interface DemoAnnouncement {
  stateCode: string;
  authority: string;
  title: string;
  summary: string;
  type:
    | "disaster_extension"
    | "penalty_relief"
    | "pte_change"
    | "form_change"
    | "rate_change"
    | "nexus_change";
  taxType: string | null;
  retroactive: boolean;
  counties: string[];
  entityTypes: string[];
  taxTypes: string[];
  oldDeadline: string | null;
  newDeadline: string | null;
  effectiveDate: string | null;
  sourceUrl: string;
  sourceAuthority: string;
  parseConfidence: "high" | "medium" | "low";
  publishedAt: Date;
}

const DEMO_ANNOUNCEMENTS: DemoAnnouncement[] = [
  {
    stateCode: "CA",
    authority: "California Franchise Tax Board",
    title: "FTB extends 2026 Q1 estimated payment deadline for LA wildfire counties",
    summary:
      "FTB has postponed the April 15 deadline to October 15, 2026 for individuals and businesses in declared-disaster counties. Affects estimated payments, partnership and S-corp returns, and individual returns.",
    type: "disaster_extension",
    taxType: "income",
    retroactive: false,
    counties: ["Los Angeles", "Ventura"],
    entityTypes: ["Individual", "S-Corp", "Partnership"],
    taxTypes: ["income"],
    oldDeadline: "2026-04-15",
    newDeadline: "2026-10-15",
    effectiveDate: "2026-01-12",
    sourceUrl: "https://demo.duedatehq.space/announcements/ca-ftb-disaster-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-01-12T18:00:00Z"),
  },
  {
    stateCode: "NY",
    authority: "New York Department of Taxation and Finance",
    title: "NY PTE-T election deadline shifted to March 15, 2026",
    summary:
      "The annual pass-through entity tax election window now closes March 15 (previously March 31). Applies to S-corporations and partnerships electing for tax year 2026.",
    type: "pte_change",
    taxType: "pte",
    retroactive: false,
    counties: [],
    entityTypes: ["S-Corp", "Partnership"],
    taxTypes: ["pte"],
    oldDeadline: "2026-03-31",
    newDeadline: "2026-03-15",
    effectiveDate: "2026-02-01",
    sourceUrl: "https://demo.duedatehq.space/announcements/ny-pte-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-02-01T13:00:00Z"),
  },
  {
    stateCode: "TX",
    authority: "Texas Comptroller of Public Accounts",
    title: "TX franchise tax No-Tax-Due threshold raised to $2.47M",
    summary:
      "Effective for reports due May 15, 2026, the no-tax-due revenue threshold rises from $1.23M to $2.47M. Entities below the new threshold can file the simplified PIR-only return.",
    type: "form_change",
    taxType: "franchise",
    retroactive: false,
    counties: [],
    entityTypes: ["LLC", "S-Corp", "C-Corp", "Partnership"],
    taxTypes: ["franchise"],
    oldDeadline: null,
    newDeadline: null,
    effectiveDate: "2026-01-01",
    sourceUrl: "https://demo.duedatehq.space/announcements/tx-franchise-threshold-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-01-08T16:30:00Z"),
  },
  {
    stateCode: "IL",
    authority: "Illinois Department of Revenue",
    title: "IL waives Q1 2026 estimated-payment underpayment penalties",
    summary:
      "Penalty relief granted for the April 15 estimated payment for individuals affected by ongoing IDOR system migration delays. Interest still accrues on unpaid balances.",
    type: "penalty_relief",
    taxType: "income",
    retroactive: true,
    counties: [],
    entityTypes: ["Individual"],
    taxTypes: ["income"],
    oldDeadline: null,
    newDeadline: null,
    effectiveDate: "2026-04-15",
    sourceUrl: "https://demo.duedatehq.space/announcements/il-q1-penalty-relief-2026",
    sourceAuthority: "primary",
    parseConfidence: "medium",
    publishedAt: new Date("2026-04-08T20:15:00Z"),
  },
  {
    stateCode: "FL",
    authority: "Florida Department of Revenue",
    title: "FL sales-tax filing frequency change for $5K–$20K annual filers",
    summary:
      "Florida is moving annual sales-tax filers in the $5,000–$20,000 collection band to quarterly filing starting July 1, 2026. Affected accounts will receive notice from FDOR by May 15.",
    type: "rate_change",
    taxType: "sales",
    retroactive: false,
    counties: [],
    entityTypes: ["LLC", "S-Corp", "C-Corp"],
    taxTypes: ["sales"],
    oldDeadline: null,
    newDeadline: null,
    effectiveDate: "2026-07-01",
    sourceUrl: "https://demo.duedatehq.space/announcements/fl-sales-frequency-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-04-22T14:00:00Z"),
  },
];

export async function seedAnnouncements(): Promise<{
  inserted: number;
  skipped: number;
}> {
  let inserted = 0;
  let skipped = 0;

  for (const a of DEMO_ANNOUNCEMENTS) {
    const existing = await db
      .select({ id: announcements.id })
      .from(announcements)
      .where(eq(announcements.sourceUrl, a.sourceUrl))
      .limit(1);
    if (existing.length > 0) {
      skipped++;
      continue;
    }
    await db.insert(announcements).values({
      stateCode: a.stateCode,
      authority: a.authority,
      title: a.title,
      summary: a.summary,
      type: a.type,
      taxType: a.taxType,
      retroactive: a.retroactive,
      counties: a.counties,
      entityTypes: a.entityTypes,
      taxTypes: a.taxTypes,
      oldDeadline: a.oldDeadline,
      newDeadline: a.newDeadline,
      effectiveDate: a.effectiveDate,
      sourceUrl: a.sourceUrl,
      sourceAuthority: a.sourceAuthority,
      parseConfidence: a.parseConfidence,
      publishedAt: a.publishedAt,
    });
    inserted++;
  }

  return { inserted, skipped };
}
