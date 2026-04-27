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
    publishedDate: "2026-04-22",
    // Detected just now — will appear as fresh on next dashboard mount
    detectedAt: new Date().toISOString(),
    type: "disaster_extension",
    confidence: "high",
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
    publishedDate: "2026-04-20",
    detectedAt: new Date().toISOString(),
    type: "nexus_change",
    confidence: "high",
    counties: [],
    entityTypes: ["LLC"],
    taxTypes: ["franchise"],
    sourceUrl:
      "https://comptroller.texas.gov/taxes/franchise/announcements.php",
    affectedClientIds: [],
    read: false,
    dismissed: false,
  },
];
