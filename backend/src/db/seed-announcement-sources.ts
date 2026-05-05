/**
 * Seed `state_announcement_sources` from the scraper's `DEFAULT_SOURCES`
 * registry. Drives the Mode F Health module's per-state freshness panel
 * (IA v0.7 §3.9d) so the UI shows "scheduled" rows from boot — without
 * this, the table is empty until the first scraper cycle completes
 * (~1 hour) and the dashboard reads as broken on a fresh deploy.
 *
 * Idempotent on (state_code, authority): re-running is a no-op when a
 * row already exists. Status starts at `healthy` with a null
 * lastScrapedAt — the first cycle's `recordSourceFreshness` overwrites
 * with real values.
 *
 * When you add a state to scraper.ts DEFAULT_SOURCES, this seeder picks
 * it up automatically on the next run.
 */
import { and, eq } from "drizzle-orm";
import { db } from "./client.js";
import { stateAnnouncementSources } from "./schema.js";
import { DEFAULT_SOURCES } from "../lib/scraper.js";

export async function seedAnnouncementSources(): Promise<{
  inserted: number;
  skipped: number;
}> {
  let inserted = 0;
  let skipped = 0;

  for (const src of DEFAULT_SOURCES) {
    const existing = await db
      .select({ stateCode: stateAnnouncementSources.stateCode })
      .from(stateAnnouncementSources)
      .where(
        and(
          eq(stateAnnouncementSources.stateCode, src.stateCode),
          eq(stateAnnouncementSources.authority, src.authority),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      skipped++;
      continue;
    }
    await db.insert(stateAnnouncementSources).values({
      stateCode: src.stateCode,
      authority: src.authority,
      sourceUrl: src.url,
      lastScrapedAt: null,
      lastSuccessAt: null,
      lastErrorMessage: null,
      consecutiveErrorCount: 0,
      // The first cycle hasn't run, so technically the data is "stale_long"
      // (no successful scrape ever). But that's not actionable — it's the
      // expected state on a fresh deploy. Use `healthy` for the seeded
      // baseline; recordSourceFreshness updates within the first hour.
      status: "healthy",
    });
    inserted++;
  }

  return { inserted, skipped };
}
