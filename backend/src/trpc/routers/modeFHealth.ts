/**
 * Mode F Health router — per IA v0.7 amendment §3.9d + PRD §4.3 Mode F SLO.
 *
 * State-monitoring's own monitoring. Without this surface, "no alerts" is
 * ambiguous (real silence vs. monitoring is broken).
 *
 * Phase 1 connection: derives overall health from existing announcements
 * pipeline (most-recent detectedAt timestamp + total active alerts). Per-state
 * freshness breakdown stays illustrative until backend exposes
 * StateAnnouncementSource.lastScrapedAt — Phase 3 backend follow-up.
 *
 * SLO (PRD §4.3 Mode F):
 *   - per-state freshness ≤ 6h target
 *   - ≤ 24h hard ceiling
 *   - 95% of alerts detected within 24h of publication
 */

import { desc } from "drizzle-orm";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import { announcements, stateAnnouncementSources } from "../../db/schema.js";

const ILLUSTRATIVE_STATES = [
  { code: "NY", label: "New York", staleHours: 4, status: "stale_short" },
  { code: "TX", label: "Texas", staleHours: 12, status: "stale_short" },
  { code: "CA", label: "California", staleHours: 28, status: "rescrape_running" },
];

export const modeFHealthRouter = router({
  /**
   * Returns Mode F overall health + per-state breakdown. Reads
   * StateAnnouncementSource (NEW in v0.8 amendment) for real per-state
   * freshness when populated; falls back to illustrative when scraper hasn't
   * written rows yet (fresh dev environment).
   */
  status: firmProcedure.query(async () => {
    const total = 50;

    // Pipeline overall signal: most-recent announcement detection.
    const recentAnn = await db
      .select({ detectedAt: announcements.detectedAt })
      .from(announcements)
      .orderBy(desc(announcements.detectedAt))
      .limit(1);

    const lastDetectedAt = recentAnn[0]?.detectedAt ?? null;
    const lastSyncMinAgo = lastDetectedAt
      ? Math.floor(
          (Date.now() - new Date(lastDetectedAt).getTime()) / (60 * 1000),
        )
      : null;

    // Per-state real freshness from state_announcement_sources, when populated.
    const sources = await db.select().from(stateAnnouncementSources);
    const havePerStateData = sources.length > 0;

    let perState: Array<{
      code: string;
      label: string;
      staleHours: number;
      status: string;
    }>;
    let perStateIllustrative: boolean;

    if (havePerStateData) {
      // Compute per-state stale hours, and only list those above the 6h SLO.
      const now = Date.now();
      const stale = sources
        .map((s) => {
          const staleHours = s.lastSuccessAt
            ? Math.floor(
                (now - new Date(s.lastSuccessAt).getTime()) / (60 * 60 * 1000),
              )
            : 9999;
          return {
            code: s.stateCode,
            label: s.stateCode, // resolve to full state name in frontend
            staleHours,
            status: s.status,
          };
        })
        .filter((s) => s.staleHours > 6) // SLO: ≤ 6h target
        .sort((a, b) => b.staleHours - a.staleHours);
      perState = stale;
      perStateIllustrative = false;
    } else {
      perState = ILLUSTRATIVE_STATES;
      perStateIllustrative = true;
    }

    // Determine overall health.
    const longStale = perState.filter((s) => s.staleHours > 24).length;
    let overall: "green" | "amber" | "red";
    if (lastSyncMinAgo == null || lastSyncMinAgo > 24 * 60) {
      overall = "red";
    } else if (longStale > 0) {
      overall = "red";
    } else if (lastSyncMinAgo > 6 * 60 || perState.length > 0) {
      overall = "amber";
    } else {
      overall = "green";
    }

    return {
      overall,
      total,
      stale: perState.length,
      lastSyncMinAgo,
      nextSyncInMin: 16, // heuristic — actual scheduling lives in `scraper.ts`
      perState,
      perStateIllustrative,
    };
  }),
});
