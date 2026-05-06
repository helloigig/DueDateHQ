import type { Announcement } from "../types";

/**
 * Pretends to be the server-side state-authority scraper. On every dashboard
 * mount, `detectNewAnnouncements()` compares this feed against what's already
 * in the store and surfaces anything new — mimicking the 24h detection SLA
 * without a real pipeline.
 *
 * Entries with `detectedAt` in the future are "about to drop" when the user
 * visits — useful to demonstrate the thesis: open the app, see new
 * intelligence.
 */
export const STATE_FEED: Announcement[] = [
  {
    id: "ann-feed-ca-storm-2026",
    stateCode: "CA",
    authority: "California Franchise Tax Board",
    title: "Winter storm filing relief for Northern California",
    summary:
      "California has extended filing and payment deadlines for individuals and businesses in 14 Northern California counties affected by January 2026 storms. Federal also granted disaster relief.",
    issuanceDate: "2026-04-22",
    effectiveDate: "2026-04-22",
    detectedAt: new Date().toISOString(),
    type: "disaster_extension",
    taxType: "multiple",
    retroactive: false,
    counties: [
      "Alameda",
      "Contra Costa",
      "Sonoma",
      "Marin",
      "Napa",
      "Santa Clara",
    ],
    entityTypes: ["Individual", "LLC", "S-Corp", "C-Corp", "Partnership"],
    taxTypes: ["income", "franchise"],
    oldDeadline: "2026-04-15",
    newDeadline: "2026-06-17",
    sourceUrl:
      "https://www.ftb.ca.gov/newsroom/2026-winter-storm-relief.html",
    sourceAuthority: "primary",
    relatedAnnouncementIds: ["irs-disaster-2026-ca-storm"],
    parseConfidence: "high",
    matchConfidence: "high",
    affectedClientIds: [],
    read: false,
    dismissed: false,
  },
  {
    id: "ann-feed-tx-nexus-2026",
    stateCode: "TX",
    authority: "Texas Comptroller of Public Accounts",
    title: "Franchise tax threshold raised for small LLCs",
    summary:
      "Texas has raised the franchise tax no-tax-due threshold from $1.23M to $2.47M in total revenue for report years ending Jan 1, 2026 onward. Affected LLCs may no longer need to file.",
    issuanceDate: "2026-04-20",
    effectiveDate: "2026-01-01",
    detectedAt: new Date().toISOString(),
    type: "nexus_change",
    taxType: "franchise",
    retroactive: true,
    counties: [],
    entityTypes: ["LLC"],
    taxTypes: ["franchise"],
    sourceUrl:
      "https://comptroller.texas.gov/taxes/franchise/announcements.php",
    sourceAuthority: "primary",
    relatedAnnouncementIds: [],
    parseConfidence: "high",
    matchConfidence: "medium",
    affectedClientIds: [],
    read: false,
    dismissed: false,
  },
  {
    id: "ann-feed-ny-penalty-relief-2026",
    stateCode: "NY",
    authority: "New York Department of Taxation and Finance",
    title: "Late-payment penalty waiver for Q1 2026 personal income tax",
    summary:
      "New York DTF will waive late-payment penalties for individual filers whose Q1 personal income tax payments were delayed by the March 2026 e-file portal outage. Tag affected clients so the waiver gets applied at filing.",
    issuanceDate: "2026-04-19",
    effectiveDate: "2026-04-30",
    detectedAt: new Date().toISOString(),
    type: "penalty_relief",
    taxType: "income",
    retroactive: false,
    counties: [],
    entityTypes: ["Individual", "LLC"],
    taxTypes: ["income"],
    sourceUrl: "https://www.tax.ny.gov/press/penalty-relief-2026.htm",
    sourceAuthority: "primary",
    relatedAnnouncementIds: [],
    parseConfidence: "high",
    matchConfidence: "high",
    affectedClientIds: [],
    read: false,
    dismissed: false,
  },
  {
    // Reframed 2026-05-06: previously a CA pte_change "Form 3804
    // deadline moved to May 15" that contradicted the seed's ann-ca-
    // 2026-pte-election ("deadline extended to July 31"). A CPA seeing
    // both at once would not be able to tell which is real, which
    // violates "data must make sense". Repointed to a CA marketplace-
    // facilitator nexus update — different topic, no conflict.
    id: "ann-feed-ca-marketplace-nexus-2026",
    stateCode: "CA",
    authority: "California Department of Tax and Fee Administration",
    title: "Marketplace facilitator threshold lowered to $400,000",
    summary:
      "CA CDTFA has lowered the marketplace facilitator economic nexus threshold from $500,000 to $400,000 in California sales for tax year 2026. LLCs and S-Corps selling through marketplaces with CA receipts above the new threshold must register and collect.",
    issuanceDate: "2026-04-21",
    effectiveDate: "2026-07-01",
    detectedAt: new Date().toISOString(),
    type: "nexus_change",
    taxType: "sales_use",
    retroactive: false,
    counties: [],
    entityTypes: ["S-Corp", "LLC"],
    taxTypes: ["sales_use"],
    sourceUrl: "https://www.cdtfa.ca.gov/news/2026/marketplace-threshold.htm",
    sourceAuthority: "primary",
    relatedAnnouncementIds: [],
    parseConfidence: "high",
    matchConfidence: "medium",
    affectedClientIds: [],
    read: false,
    dismissed: false,
  },
  {
    id: "ann-feed-ca-rate-change-2026",
    stateCode: "CA",
    authority: "California Franchise Tax Board",
    title: "2026 personal income tax brackets updated",
    summary:
      "Annual inflation adjustments to CA personal income tax brackets are in effect for tax year 2026. Top bracket threshold moved to $698,272 (was $677,275). Affects Q-estimate calculations for high-income filers.",
    issuanceDate: "2026-04-23",
    effectiveDate: "2026-01-01",
    detectedAt: new Date().toISOString(),
    type: "rate_change",
    taxType: "income",
    retroactive: false,
    counties: [],
    // Broad entity scope — bracket changes affect anyone with CA-source
    // income. Match logic intersects with state, so only CA clients surface.
    entityTypes: ["Individual", "S-Corp", "Partnership", "LLC"],
    taxTypes: ["income"],
    sourceUrl: "https://www.ftb.ca.gov/forms/2026/2026-rate-tables.html",
    sourceAuthority: "primary",
    relatedAnnouncementIds: [],
    parseConfidence: "high",
    matchConfidence: "high",
    affectedClientIds: [],
    read: false,
    dismissed: false,
  },
  {
    id: "ann-feed-ca-form-568-2026",
    stateCode: "CA",
    authority: "California Franchise Tax Board",
    title: "Form 568 (LLC return) instructions revised for 2026",
    summary:
      "California Franchise Tax Board has updated the Form 568 instructions for tax year 2026 — Schedule IW receipts allocation language clarified. No change to filing deadline or amounts. Catalog metadata update queued for admin review.",
    issuanceDate: "2026-04-24",
    effectiveDate: "2026-01-01",
    detectedAt: new Date().toISOString(),
    type: "form_change",
    taxType: "income",
    retroactive: false,
    counties: [],
    entityTypes: ["LLC"],
    taxTypes: ["income"],
    sourceUrl: "https://www.ftb.ca.gov/forms/2026/2026-568-instructions.html",
    sourceAuthority: "primary",
    relatedAnnouncementIds: [],
    parseConfidence: "high",
    matchConfidence: "high",
    affectedClientIds: [],
    read: false,
    dismissed: false,
  },
];
