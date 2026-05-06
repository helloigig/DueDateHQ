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
  // Yuqi audit 2026-05-06: top 3 entries rewritten to match the demo
  // composition Yuqi specified by screenshot — IL Q1 underpayment
  // waiver, TX No-Tax-Due threshold raise, CA-FTB LA wildfire Q1
  // extension. They land on Today's "State alerts" section as the 3
  // most-recent active alerts (sorted by detectedAt desc).
  {
    id: "ann-feed-il-q1-underpayment-2026",
    stateCode: "IL",
    authority: "Illinois Department of Revenue",
    title: "IL waives Q1 2026 estimated-payment underpayment penalties",
    summary:
      "Penalty relief granted for the April 15 estimated payment for individuals affected by ongoing IDOR system migration delays. Interest still accrues on unpaid balances.",
    issuanceDate: "2026-05-06",
    effectiveDate: "2026-04-15",
    detectedAt: new Date().toISOString(),
    type: "penalty_relief",
    taxType: "income",
    retroactive: true,
    counties: [],
    entityTypes: ["Individual"],
    taxTypes: ["income"],
    sourceUrl: "https://tax.illinois.gov/news/2026-q1-underpayment-relief.html",
    sourceAuthority: "primary",
    relatedAnnouncementIds: [],
    parseConfidence: "medium",
    matchConfidence: "high",
    affectedClientIds: [],
    read: false,
    dismissed: false,
  },
  {
    id: "ann-feed-tx-no-tax-due-threshold-2026",
    stateCode: "TX",
    authority: "Texas Comptroller of Public Accounts",
    title: "TX franchise tax No-Tax-Due threshold raised to $2.47M",
    summary:
      "The No-Tax-Due Report threshold rises from $1.23M to $2.47M of total revenue for franchise reports due on or after January 1, 2026. Eligible entities can file the No-Tax-Due Report instead of the long-form return.",
    issuanceDate: "2026-05-05",
    effectiveDate: "2026-01-01",
    detectedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    type: "rate_change",
    taxType: "franchise",
    retroactive: false,
    counties: [],
    entityTypes: ["LLC", "S-Corp", "C-Corp", "Partnership"],
    taxTypes: ["franchise"],
    sourceUrl:
      "https://comptroller.texas.gov/taxes/franchise/2026-threshold.php",
    sourceAuthority: "primary",
    relatedAnnouncementIds: [],
    parseConfidence: "high",
    matchConfidence: "high",
    affectedClientIds: [],
    read: false,
    dismissed: false,
  },
  {
    id: "ann-feed-ca-q1-la-wildfire-2026",
    stateCode: "CA",
    authority: "California Franchise Tax Board",
    title:
      "FTB extends 2026 Q1 estimated payment deadline for LA wildfire counties",
    summary:
      "FTB postpones the April 15 Q1 estimated payment to October 15, 2026 for taxpayers in Los Angeles, Ventura, and San Bernardino counties affected by the January 2026 wildfires. IRS issued matching federal relief.",
    issuanceDate: "2026-05-05",
    effectiveDate: "2026-04-15",
    detectedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    type: "disaster_extension",
    taxType: "income",
    retroactive: true,
    counties: ["Los Angeles", "Ventura", "San Bernardino"],
    entityTypes: ["Individual", "LLC", "S-Corp", "C-Corp", "Partnership"],
    taxTypes: ["income"],
    oldDeadline: "2026-04-15",
    newDeadline: "2026-10-15",
    sourceUrl:
      "https://www.ftb.ca.gov/newsroom/2026-la-wildfire-q1-extension.html",
    relatedSourceUrls: [
      "https://www.irs.gov/newsroom/2026-ca-wildfire-relief",
    ],
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
    detectedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
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
    detectedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
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
    detectedAt: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(),
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
