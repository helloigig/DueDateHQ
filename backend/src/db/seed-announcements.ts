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
  {
    stateCode: "LA",
    authority: "Louisiana Department of Revenue",
    title: "LA Q1 2026 individual income filing deadline pushed to June 15",
    summary:
      "Louisiana DOR has moved the April 15 individual income tax filing deadline to June 15, 2026 for parishes affected by the March 2026 severe-weather declaration. Penalty and interest waived for affected filers.",
    type: "disaster_extension",
    taxType: "income",
    retroactive: false,
    counties: ["Orleans", "Jefferson", "St. Tammany"],
    entityTypes: ["Individual"],
    taxTypes: ["income"],
    oldDeadline: "2026-04-15",
    newDeadline: "2026-06-15",
    effectiveDate: "2026-03-20",
    sourceUrl: "https://demo.duedatehq.space/announcements/la-disaster-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-03-20T15:00:00Z"),
  },
  {
    stateCode: "PA",
    authority: "Pennsylvania Department of Revenue",
    title: "PA REV-1500 inheritance tax form revised — new safe-harbor election line",
    summary:
      "PA DOR has issued a revised REV-1500 with a new line 17b for the family-business safe-harbor election. Returns filed using the prior version after July 1, 2026 will be accepted but flagged for follow-up.",
    type: "form_change",
    taxType: "inheritance",
    retroactive: false,
    counties: [],
    entityTypes: ["Individual", "Trust"],
    taxTypes: ["inheritance"],
    oldDeadline: null,
    newDeadline: null,
    effectiveDate: "2026-07-01",
    sourceUrl: "https://demo.duedatehq.space/announcements/pa-rev1500-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-04-15T09:30:00Z"),
  },
  {
    stateCode: "GA",
    authority: "Georgia Department of Revenue",
    title: "GA flat individual rate drops to 5.19% for 2026",
    summary:
      "Per HB 1437 acceleration, Georgia's flat individual income rate moves from 5.39% to 5.19% effective for tax year 2026. Affects estimated payments and full-year returns; PR notices in withholding tables already reflect the new rate.",
    type: "rate_change",
    taxType: "income",
    retroactive: false,
    counties: [],
    entityTypes: ["Individual", "S-Corp", "Partnership"],
    taxTypes: ["income"],
    oldDeadline: null,
    newDeadline: null,
    effectiveDate: "2026-01-01",
    sourceUrl: "https://demo.duedatehq.space/announcements/ga-rate-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-01-05T14:00:00Z"),
  },
  {
    stateCode: "NJ",
    authority: "New Jersey Division of Taxation",
    title: "NJ BAIT election window extended to April 15, 2026",
    summary:
      "The 2026 NJ Business Alternative Income Tax election deadline is extended from March 15 to April 15. S-corporations and partnerships that previously declined to elect can revisit through the new window without penalty.",
    type: "pte_change",
    taxType: "pte",
    retroactive: false,
    counties: [],
    entityTypes: ["S-Corp", "Partnership"],
    taxTypes: ["pte"],
    oldDeadline: "2026-03-15",
    newDeadline: "2026-04-15",
    effectiveDate: "2026-03-01",
    sourceUrl: "https://demo.duedatehq.space/announcements/nj-bait-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-03-01T11:00:00Z"),
  },
  {
    stateCode: "MA",
    authority: "Massachusetts Department of Revenue",
    title: "MA economic-nexus threshold drops to $100K starting Jan 2027",
    summary:
      "MA DOR will lower the sales-and-use tax economic-nexus threshold from $500,000 in MA-sourced sales to $100,000 with no transaction count, effective January 1, 2027. Out-of-state sellers approaching the new threshold should begin registration review now.",
    type: "nexus_change",
    taxType: "sales",
    retroactive: false,
    counties: [],
    entityTypes: ["LLC", "S-Corp", "C-Corp", "Partnership"],
    taxTypes: ["sales"],
    oldDeadline: null,
    newDeadline: null,
    effectiveDate: "2027-01-01",
    sourceUrl: "https://demo.duedatehq.space/announcements/ma-nexus-2027",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-04-30T16:00:00Z"),
  },

  // ─────────────────────────────────────────────────────────────────────
  // 2026-05 refresh — mirrors src/data/mockAnnouncements.ts so real-mode
  // alert feed matches the demo-mode richness. Detection times spread
  // around 2026-05-04/05 so the escalation tier (fresh / reminder /
  // escalated / blocking) renders a varied list, and the blockbuster
  // CA storm relief is the freshest item at the top of the feed.
  // ─────────────────────────────────────────────────────────────────────

  // BLOCKBUSTER — sweeps every CA + nexus-CA client.
  {
    stateCode: "CA",
    authority: "California Franchise Tax Board",
    title: "Statewide storm relief — 18 NorCal counties extended to Aug 17",
    summary:
      "California has extended filing and payment deadlines for individuals and businesses in 18 Northern California counties affected by the April-May storm system. Affected returns and payments due May 5 - July 15 are postponed to August 17, 2026. IRS has issued matching federal relief.",
    type: "disaster_extension",
    taxType: "multiple",
    retroactive: false,
    counties: [
      "Alameda", "Contra Costa", "Marin", "Mendocino", "Monterey",
      "Napa", "Sacramento", "San Benito", "San Francisco", "San Joaquin",
      "San Mateo", "Santa Clara", "Santa Cruz", "Solano", "Sonoma",
      "Stanislaus", "Sutter", "Yolo",
    ],
    entityTypes: ["LLC", "S-Corp", "C-Corp", "Individual", "Partnership", "Trust"],
    taxTypes: ["State income", "PTE election", "Quarterly estimates", "Sales tax"],
    oldDeadline: "2026-05-05",
    newDeadline: "2026-08-17",
    effectiveDate: "2026-05-05",
    sourceUrl: "https://demo.duedatehq.space/announcements/ca-storm-relief-may-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-05-05T08:00:00Z"),
  },
  {
    stateCode: "LA",
    authority: "Louisiana Department of Revenue",
    title: "Hurricane Delta disaster extension",
    summary:
      "Louisiana has granted an automatic filing and payment extension for taxpayers in federally declared disaster areas. Orleans, Jefferson, and St. Bernard parishes qualify. Affected filings due Oct 15, 2026 are postponed to Feb 15, 2027.",
    type: "disaster_extension",
    taxType: "multiple",
    retroactive: false,
    counties: ["Orleans", "Jefferson", "St. Bernard"],
    entityTypes: ["LLC", "S-Corp", "Individual", "Partnership"],
    taxTypes: ["State income", "PTE election", "Quarterly estimates"],
    oldDeadline: "2026-10-15",
    newDeadline: "2027-02-15",
    effectiveDate: "2026-05-04",
    sourceUrl: "https://demo.duedatehq.space/announcements/la-hurricane-delta-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-05-04T13:00:00Z"),
  },
  {
    stateCode: "CA",
    authority: "California Franchise Tax Board",
    title: "PTE election deadline extended to July 31",
    summary:
      "California FTB has extended the 2026 Pass-Through Entity (PTE) election deadline from June 15 to July 31 for qualifying S-Corps, LLCs taxed as partnerships, and partnerships. No separate application required; payment postmark controls.",
    type: "pte_change",
    taxType: "income",
    retroactive: false,
    counties: [],
    entityTypes: ["S-Corp", "LLC", "Partnership"],
    taxTypes: ["PTE election"],
    oldDeadline: "2026-06-15",
    newDeadline: "2026-07-31",
    effectiveDate: "2026-05-04",
    sourceUrl: "https://demo.duedatehq.space/announcements/ca-pte-election-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-05-04T05:00:00Z"),
  },
  {
    stateCode: "NY",
    authority: "New York Department of Taxation and Finance",
    title: "Economic nexus threshold lowered to $300,000",
    summary:
      "New York has lowered its economic nexus threshold from $500,000 to $300,000 in receipts for sales tax purposes, effective Q3 2026. LLCs and partnerships with receipts over the new threshold must register for NY sales tax.",
    type: "nexus_change",
    taxType: "sales",
    retroactive: false,
    counties: [],
    entityTypes: ["LLC", "Partnership", "S-Corp"],
    taxTypes: ["Sales tax nexus"],
    oldDeadline: null,
    newDeadline: null,
    effectiveDate: "2026-07-01",
    sourceUrl: "https://demo.duedatehq.space/announcements/ny-nexus-threshold-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-05-03T04:00:00Z"),
  },
  {
    stateCode: "TX",
    authority: "Texas Comptroller of Public Accounts",
    title: "Late-filing penalty waiver for May 15 Franchise filings",
    summary:
      "Texas Comptroller is offering a one-time penalty waiver for Franchise Tax filings due May 15, 2026. Penalties automatically waived on returns filed by May 31. No separate application required.",
    type: "penalty_relief",
    taxType: "franchise",
    retroactive: false,
    counties: [],
    entityTypes: ["LLC", "S-Corp", "C-Corp", "Partnership"],
    taxTypes: ["Franchise Tax"],
    oldDeadline: "2026-05-15",
    newDeadline: "2026-05-31",
    effectiveDate: "2026-05-15",
    sourceUrl: "https://demo.duedatehq.space/announcements/tx-penalty-waiver-may-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-05-01T17:00:00Z"),
  },
  // Low-confidence match — Sarah needs to verify before action.
  {
    stateCode: "GA",
    authority: "Georgia Department of Revenue",
    title: "Job tax credit program — 2026 designated census tracts revised",
    summary:
      "Georgia DOR has updated the 2026 list of census tracts eligible for the enhanced Job Tax Credit. Eligibility depends on industry NAICS code and physical employment location — review affected clients individually.",
    type: "rate_change",
    taxType: "income",
    retroactive: true,
    counties: [],
    entityTypes: ["S-Corp", "C-Corp", "LLC"],
    taxTypes: ["Job Tax Credit"],
    oldDeadline: null,
    newDeadline: null,
    effectiveDate: "2026-01-01",
    sourceUrl: "https://demo.duedatehq.space/announcements/ga-job-tax-credit-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-05-02T11:30:00Z"),
  },
  // Supersede pair — IL form revision then a correction. The FE collapses
  // the older one when relatedSourceUrls links them.
  {
    stateCode: "IL",
    authority: "Illinois Department of Revenue",
    title: "IL-1040 instructions revised — Schedule M",
    summary:
      "Illinois DOR has updated the IL-1040 Schedule M instructions to clarify retirement-income subtraction for 2026 filings. Form unchanged.",
    type: "form_change",
    taxType: "income",
    retroactive: false,
    counties: [],
    entityTypes: ["Individual"],
    taxTypes: ["Personal income"],
    oldDeadline: null,
    newDeadline: null,
    effectiveDate: "2026-04-30",
    sourceUrl: "https://demo.duedatehq.space/announcements/il-1040-schedule-m-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-04-30T19:00:00Z"),
  },
  {
    stateCode: "IL",
    authority: "Illinois Department of Revenue",
    title: "IL-1040 Schedule M correction — supersedes Apr 30 update",
    summary:
      "Illinois DOR has issued a correction to the Schedule M update from April 30. Pension subtraction language reverted; the prior bulletin can be disregarded for filings already in progress.",
    type: "form_change",
    taxType: "income",
    retroactive: false,
    counties: [],
    entityTypes: ["Individual"],
    taxTypes: ["Personal income"],
    oldDeadline: null,
    newDeadline: null,
    effectiveDate: "2026-05-02",
    sourceUrl: "https://demo.duedatehq.space/announcements/il-1040-schedule-m-correction-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-05-02T15:30:00Z"),
  },
  {
    stateCode: "PA",
    authority: "Pennsylvania Department of Revenue",
    title: "myPATH portal outage May 6-7 — filings paused",
    summary:
      "PA DOR has scheduled a 36-hour myPATH portal outage from May 6 18:00 ET through May 7 23:59 ET for system upgrades. Returns and payments due May 7 will be honored if filed by May 8 with no penalty.",
    type: "penalty_relief",
    taxType: "income",
    retroactive: false,
    counties: [],
    entityTypes: ["LLC", "S-Corp", "C-Corp", "Partnership", "Individual"],
    taxTypes: ["Corporate income", "Personal income"],
    oldDeadline: "2026-05-07",
    newDeadline: "2026-05-08",
    effectiveDate: "2026-05-06",
    sourceUrl: "https://demo.duedatehq.space/announcements/pa-mypath-outage-may-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-05-04T16:45:00Z"),
  },
  {
    stateCode: "NJ",
    authority: "New Jersey Division of Taxation",
    title: "NJ BAIT (PTE) graduated rate brackets confirmed for 2026",
    summary:
      "NJ has confirmed the 2026 BAIT (Business Alternative Income Tax / PTE election) bracket structure. Rates unchanged at 5.675% / 6.52% / 9.12% / 10.9%. Filers can plan Q3 estimates accordingly.",
    type: "rate_change",
    taxType: "income",
    retroactive: false,
    counties: [],
    entityTypes: ["LLC", "Partnership", "S-Corp"],
    taxTypes: ["BAIT / PTE"],
    oldDeadline: null,
    newDeadline: null,
    effectiveDate: "2026-01-01",
    sourceUrl: "https://demo.duedatehq.space/announcements/nj-bait-confirmed-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-04-29T10:00:00Z"),
  },
  {
    stateCode: "MA",
    authority: "Massachusetts Department of Revenue",
    title: "MA Form 2 (fiduciary) — Schedule B updated for trust DNI",
    summary:
      "Mass DOR has revised Schedule B of Form 2 to capture distributable net income (DNI) more precisely for complex trusts. New required line. No deadline change.",
    type: "form_change",
    taxType: "income",
    retroactive: false,
    counties: [],
    entityTypes: ["Trust"],
    taxTypes: ["Fiduciary"],
    oldDeadline: null,
    newDeadline: null,
    effectiveDate: "2026-01-01",
    sourceUrl: "https://demo.duedatehq.space/announcements/ma-form-2-trust-dni-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-04-28T09:00:00Z"),
  },
  {
    stateCode: "OR",
    authority: "Oregon Department of Revenue",
    title: "OR-PTE election form revised for 2026",
    summary:
      "Oregon DOR has updated the Form OR-19 (pass-through entity tax election) instructions. Election deadline unchanged at April 15. No action required for filings already submitted.",
    type: "form_change",
    taxType: "income",
    retroactive: false,
    counties: [],
    entityTypes: ["S-Corp", "Partnership"],
    taxTypes: ["PTE election"],
    oldDeadline: null,
    newDeadline: null,
    effectiveDate: "2026-05-01",
    sourceUrl: "https://demo.duedatehq.space/announcements/or-pte-form-2026",
    sourceAuthority: "primary",
    parseConfidence: "high",
    publishedAt: new Date("2026-05-01T18:00:00Z"),
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
