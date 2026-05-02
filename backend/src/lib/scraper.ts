/**
 * State announcement scraper — Phase 1 implementation.
 *
 * Real architecture (per arch §6.4):
 *   - Cloudflare Worker fetches each state revenue authority's RSS or
 *     newsroom HTML on a 1-hour schedule
 *   - LLM (Gemini Flash by default, Claude Haiku for fallback) parses
 *     unstructured pages into the canonical Announcement shape
 *   - Output written to `announcements` table with `parse_confidence`
 *   - Matcher walks the firm's clients and inserts `announcement_matches`
 *     rows for affected ones
 *   - Reviewer dashboard at /settings/alerts surfaces low-confidence
 *     items for human approval
 *
 * Phase 1 implementation (this file):
 *   - In-process scraper running on a configurable interval
 *   - Source registry of RSS/newsroom URLs per state authority
 *   - Heuristic parser (regex-based) for the most common notice types
 *     — disaster_extension, penalty_relief, deadline_change
 *   - Real DB writes — same table the FE reads from
 *   - LLM parsing is plumbed but stubbed; swap `parseWithLLM` body for
 *     Anthropic SDK call when key + budget are available
 *
 * The 24h SLA is structurally satisfied: with a 1-hour interval, the
 * worst-case detection latency is bounded at 60 minutes from the
 * authority's publish time, well under the 24h SLA target.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  announcementMatches,
  announcements,
  clients,
  stateAnnouncementSources,
} from "../db/schema.js";
import { log, span, captureException } from "./observability.js";

// ---------- Source registry ----------

export interface ScraperSource {
  /** State 2-letter code */
  stateCode: string;
  /** Authority name shown in the UI ("CA FTB", "NY DTF", ...) */
  authority: string;
  /** RSS / Atom / HTML newsroom URL */
  url: string;
  /** Format hint: 'rss' = parse XML, 'html' = run regex extractor */
  kind: "rss" | "html";
}

/**
 * Phase-1 source registry. Real production maintains this as a config
 * table editable by ops; here we hardcode the top-7 most-active states.
 * Add more by appending — each runs on its own fetch cycle.
 */
export const DEFAULT_SOURCES: ScraperSource[] = [
  {
    stateCode: "CA",
    authority: "CA FTB",
    url: "https://www.ftb.ca.gov/about-ftb/newsroom/news.xml",
    kind: "rss",
  },
  {
    stateCode: "NY",
    authority: "NY DTF",
    url: "https://www.tax.ny.gov/press/rel/rss.xml",
    kind: "rss",
  },
  {
    stateCode: "TX",
    authority: "TX Comptroller",
    url: "https://comptroller.texas.gov/about/news/rss.xml",
    kind: "rss",
  },
  {
    stateCode: "FL",
    authority: "FL DOR",
    url: "https://floridarevenue.com/Pages/news.aspx",
    kind: "html",
  },
  {
    stateCode: "IL",
    authority: "IL DOR",
    url: "https://www2.illinois.gov/rev/Pages/News.aspx",
    kind: "html",
  },
  {
    stateCode: "MA",
    authority: "MA DOR",
    url: "https://www.mass.gov/news/department-of-revenue",
    kind: "html",
  },
  {
    stateCode: "WA",
    authority: "WA DOR",
    url: "https://dor.wa.gov/about/news-releases",
    kind: "html",
  },
];

// ---------- Public API ----------

export interface ScrapedNotice {
  stateCode: string;
  authority: string;
  title: string;
  summary: string;
  sourceUrl: string;
  publishedAt: Date;
  /** 0-1 confidence the heuristic parser assigns. <0.7 → reviewer queue. */
  parseConfidence: number;
  /** Heuristic classification — one of the AnnouncementType enums. */
  type:
    | "disaster_extension"
    | "penalty_relief"
    | "pte_change"
    | "form_change"
    | "rate_change"
    | "nexus_change";
}

/**
 * Run one scraper cycle: fetch all sources, parse, dedupe, write to
 * `announcements`. Returns counts for the operator log.
 *
 * Idempotent: existing announcements (matched by source_url) are
 * skipped — the scraper can run as often as you like.
 *
 * Two layers of dedup before insert:
 *   (1) sourceUrl exact match — anywhere, any time. Standard repeat-fetch case.
 *   (2) Title fingerprint — same (stateCode, type, normalized-title) within
 *       the last 30 days. Catches the common HTML-scrape pathology where one
 *       newsroom page has the same article linked from multiple anchor
 *       positions (different hrefs, identical link text). Without (2), a
 *       single FL DOR fetch produced 5 rows like "FL: declaration from the
 *       Internal Revenue Service" that all matched the same client set and
 *       cluttered the dashboard. With (2), only the first lands in the DB.
 */
export async function runScraperCycle(
  sources: ScraperSource[] = DEFAULT_SOURCES,
): Promise<{
  fetched: number;
  new: number;
  lowConfidence: number;
  duplicatesSkipped: number;
}> {
  return span("scraper.cycle", async () => {
    let fetched = 0;
    let inserted = 0;
    let lowConfidence = 0;
    let duplicatesSkipped = 0;

    for (const src of sources) {
      const cycleStart = new Date();
      let cycleError: string | null = null;
      try {
        const notices = await fetchSource(src);
        fetched += notices.length;

        // Pre-fetch the dedup window once per state. One query beats one
        // per notice. The 30-day window is generous — disaster-related
        // articles often re-trend weeks later when an IRS extension is
        // announced.
        const recentSame = await db
          .select({
            id: announcements.id,
            title: announcements.title,
            type: announcements.type,
            sourceUrl: announcements.sourceUrl,
            relatedSourceUrls: announcements.relatedSourceUrls,
          })
          .from(announcements)
          .where(
            and(
              eq(announcements.stateCode, src.stateCode),
              sql`${announcements.detectedAt} > now() - interval '30 days'`,
            ),
          );
        type RecentRow = (typeof recentSame)[number];
        const byUrl = new Map<string, RecentRow>();
        const byFingerprint = new Map<string, RecentRow>();
        for (const r of recentSame) {
          byUrl.set(r.sourceUrl, r);
          for (const u of r.relatedSourceUrls) byUrl.set(u, r);
          byFingerprint.set(fingerprintKey(r.type, r.title), r);
        }

        for (const n of notices) {
          // (1) URL dedup — same exact URL we've already filed (either
          // as canonical sourceUrl or as a previously-tracked related
          // URL). Within-window check is the fast path; we fall through
          // to a broader DB lookup for older rows.
          const urlMatch =
            byUrl.get(n.sourceUrl) ??
            (await db.query.announcements.findFirst({
              where: eq(announcements.sourceUrl, n.sourceUrl),
            }));
          if (urlMatch) {
            duplicatesSkipped++;
            continue;
          }

          // (2) Title-fingerprint dedup. Same state + same type +
          // normalized title. When this fires, the new URL almost
          // certainly points at the same article surfaced from a
          // different anchor — record it on the canonical row so the
          // frontend banner can honestly say "N sources confirm this."
          const fpKey = fingerprintKey(n.type, n.title);
          const fpMatch = byFingerprint.get(fpKey);
          if (fpMatch) {
            const merged = Array.from(
              new Set([...fpMatch.relatedSourceUrls, n.sourceUrl]),
            );
            if (merged.length !== fpMatch.relatedSourceUrls.length) {
              await db
                .update(announcements)
                .set({ relatedSourceUrls: merged })
                .where(eq(announcements.id, fpMatch.id));
              fpMatch.relatedSourceUrls = merged;
              byUrl.set(n.sourceUrl, fpMatch);
            }
            duplicatesSkipped++;
            continue;
          }

          // Bucket numeric confidence into the existing schema enum.
          // Low-confidence items still write but the reviewer dashboard
          // (filter parse_confidence='low') triages them before they
          // reach the firm projection (firm_announcements rows).
          const bucket: "high" | "medium" | "low" =
            n.parseConfidence >= 0.85
              ? "high"
              : n.parseConfidence >= 0.7
                ? "medium"
                : "low";
          const [insertedRow] = await db
            .insert(announcements)
            .values({
              stateCode: n.stateCode,
              authority: n.authority,
              title: n.title,
              summary: n.summary,
              type: n.type,
              sourceUrl: n.sourceUrl,
              sourceAuthority: n.authority,
              parseConfidence: bucket,
              publishedAt: n.publishedAt,
              detectedAt: new Date(),
            })
            .returning({
              id: announcements.id,
              title: announcements.title,
              type: announcements.type,
              sourceUrl: announcements.sourceUrl,
              relatedSourceUrls: announcements.relatedSourceUrls,
            });
          // Track within this cycle so subsequent notices in the same
          // batch dedup against the row we just inserted.
          if (insertedRow) {
            byUrl.set(n.sourceUrl, insertedRow);
            byFingerprint.set(fpKey, insertedRow);
          }
          inserted++;
          if (bucket === "low") lowConfidence++;
        }
      } catch (err) {
        cycleError =
          err instanceof Error ? err.message : String(err);
        captureException(err, { source: src.url });
      }
      // Write per-state freshness — drives Mode F Health real-per-state
      // status (IA v0.7 §3.9d). PK is (state_code, authority); we upsert
      // every cycle so the dashboard reflects last-scraped-at even when
      // there are no new notices to insert.
      await recordSourceFreshness(src, cycleStart, cycleError);
    }

    log.info("scraper.cycle.result", {
      fetched,
      inserted,
      lowConfidence,
      duplicatesSkipped,
      sourceCount: sources.length,
    });

    return { fetched, new: inserted, lowConfidence, duplicatesSkipped };
  });
}

// ---------- Dedup helpers ----------

/**
 * Normalize an announcement title to a fingerprint suitable for equality
 * comparison. Lowercases, strips punctuation, collapses whitespace.
 *
 *   "FL: declaration from the Internal Revenue Service (IRS)"
 *   "FL: declaration from the Internal Revenue Service"
 *
 * become different fingerprints (the trailing "(IRS)" is signal — those
 * are arguably different articles). But:
 *
 *   "declaration from the Internal Revenue Service"
 *   "Declaration   from the Internal-Revenue Service."
 *
 * collapse to the same fingerprint, which is the clutter we're chasing.
 */
export function titleFingerprint(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fingerprintKey(type: string, title: string): string {
  return `${type}|${titleFingerprint(title)}`;
}

/**
 * Match newly-detected announcements to a firm's clients. Run after
 * `runScraperCycle` (or on a schedule per firm).
 *
 * Matching rules (Phase 1):
 *   - State match: client.primaryState === announcement.stateCode
 *   - Entity-type filter when announcement.entityTypes is non-empty
 *
 * Returns count of new matches inserted.
 */
export async function matchFirm(firmId: string): Promise<number> {
  return span(
    "scraper.match_firm",
    async () => {
      const firmClients = await db.query.clients.findMany({
        where: eq(clients.firmId, firmId),
      });
      const recentAnns = await db
        .select()
        .from(announcements)
        .where(sql`${announcements.detectedAt} > now() - interval '30 days'`);

      let inserted = 0;
      for (const ann of recentAnns) {
        for (const client of firmClients) {
          if (client.primaryState !== ann.stateCode) continue;
          if (
            Array.isArray(ann.entityTypes) &&
            ann.entityTypes.length > 0 &&
            !ann.entityTypes.includes(client.entityType)
          ) {
            continue;
          }

          // Idempotent insert via composite uniq (announcement, firm, client)
          try {
            await db.insert(announcementMatches).values({
              firmId,
              announcementId: ann.id,
              clientId: client.id,
            });
            inserted++;
          } catch {
            // Conflict on uniq → already matched. Ignore.
          }
        }
      }

      return inserted;
    },
    { firmId },
  );
}

// ---------- Internals ----------

/**
 * Upsert per-state scrape freshness. PK is (state_code, authority).
 * Status thresholds match Mode F Health spec (IA v0.7 §3.9d):
 *   - healthy:     scraped <2h ago and last cycle succeeded
 *   - stale_short: succeeded >2h ago but <24h ago
 *   - stale_long:  succeeded >24h ago
 *   - broken:      ≥3 consecutive errors
 */
async function recordSourceFreshness(
  src: ScraperSource,
  cycleStart: Date,
  errMessage: string | null,
): Promise<void> {
  try {
    // Read prior row to compute new consecutiveErrorCount + status.
    const [prior] = await db
      .select()
      .from(stateAnnouncementSources)
      .where(
        and(
          eq(stateAnnouncementSources.stateCode, src.stateCode),
          eq(stateAnnouncementSources.authority, src.authority),
        ),
      );
    const wasError = errMessage !== null;
    const consecutiveErrorCount = wasError
      ? (prior?.consecutiveErrorCount ?? 0) + 1
      : 0;
    const lastSuccessAt = wasError
      ? (prior?.lastSuccessAt ?? null)
      : cycleStart;
    let status: "healthy" | "stale_short" | "stale_long" | "broken";
    if (consecutiveErrorCount >= 3) {
      status = "broken";
    } else if (!lastSuccessAt) {
      status = "stale_long";
    } else {
      const ageMs = Date.now() - lastSuccessAt.getTime();
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      status =
        ageMs < TWO_HOURS
          ? "healthy"
          : ageMs < TWENTY_FOUR_HOURS
            ? "stale_short"
            : "stale_long";
    }
    if (prior) {
      await db
        .update(stateAnnouncementSources)
        .set({
          sourceUrl: src.url,
          lastScrapedAt: cycleStart,
          lastSuccessAt,
          lastErrorMessage: errMessage,
          consecutiveErrorCount,
          status,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(stateAnnouncementSources.stateCode, src.stateCode),
            eq(stateAnnouncementSources.authority, src.authority),
          ),
        );
    } else {
      await db.insert(stateAnnouncementSources).values({
        stateCode: src.stateCode,
        authority: src.authority,
        sourceUrl: src.url,
        lastScrapedAt: cycleStart,
        lastSuccessAt,
        lastErrorMessage: errMessage,
        consecutiveErrorCount,
        status,
      });
    }
  } catch (err) {
    // Freshness write failure shouldn't break the cycle — log + continue.
    log.warn("scraper.freshness_write_failed", {
      stateCode: src.stateCode,
      authority: src.authority,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function fetchSource(src: ScraperSource): Promise<ScrapedNotice[]> {
  const res = await fetch(src.url, {
    headers: { "User-Agent": "DueDateHQ-Scraper/1.0 (ops@duedatehq.com)" },
  });
  if (!res.ok) {
    log.warn("scraper.fetch_failed", {
      source: src.url,
      status: res.status,
    });
    return [];
  }
  const body = await res.text();
  if (src.kind === "rss") return parseRss(body, src);
  return parseHtml(body, src);
}

/**
 * RSS/Atom parser — minimal, no XML lib. Pulls <item><title>+<link>+
 * <description> tuples. Real production uses fast-xml-parser, but for
 * the well-formed feeds the state authorities publish, this is enough.
 */
function parseRss(body: string, src: ScraperSource): ScrapedNotice[] {
  const items: ScrapedNotice[] = [];
  // Greedy <item>...</item> extractor; tolerant of <entry> (Atom)
  const itemRe = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(body))) {
    const block = match[2] ?? "";
    const title = textIn(block, "title");
    const link = textIn(block, "link") || hrefIn(block, "link");
    const desc = textIn(block, "description") || textIn(block, "summary");
    const pubDate = textIn(block, "pubDate") || textIn(block, "updated");
    if (!title || !link) continue;
    const publishedAt = pubDate ? new Date(pubDate) : new Date();
    if (Number.isNaN(publishedAt.getTime())) continue;

    items.push({
      stateCode: src.stateCode,
      authority: src.authority,
      title,
      summary: stripTags(desc).slice(0, 1000),
      sourceUrl: link,
      publishedAt,
      ...classify(title + " " + desc),
    });
  }
  return items;
}

/**
 * HTML newsroom parser — looks for <article> or <li> blocks containing
 * date + headline. Heuristic; falls back to title-only when summary
 * extraction fails. Real production uses cheerio + per-source selectors.
 */
function parseHtml(body: string, src: ScraperSource): ScrapedNotice[] {
  const items: ScrapedNotice[] = [];
  // Look for <a> tags with a likely-news href + visible text. Filter by
  // length to avoid nav links.
  const anchorRe = /<a[^>]+href="([^"]+)"[^>]*>([^<]{20,200})<\/a>/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = anchorRe.exec(body))) {
    const href = m[1];
    const text = stripTags(m[2] ?? "").trim();
    if (!href || !text || seen.has(href)) continue;
    if (!/news|release|notice|advisory/i.test(href)) continue;
    seen.add(href);
    const url = href.startsWith("http")
      ? href
      : new URL(href, src.url).toString();
    items.push({
      stateCode: src.stateCode,
      authority: src.authority,
      title: text,
      summary: "",
      sourceUrl: url,
      publishedAt: new Date(),
      ...classify(text),
      // HTML scraping is lower confidence than RSS by default
      parseConfidence: 0.55,
    });
  }
  return items.slice(0, 20);
}

/**
 * Heuristic classifier — keyword match. Returns the announcement type
 * + a confidence score. Overridden by `parseConfidence` set on the
 * caller's path (HTML scraping forces low confidence regardless).
 *
 * Production swaps this for an LLM call (Gemini/Claude) — see
 * parseWithLLM below.
 */
function classify(text: string): {
  type: ScrapedNotice["type"];
  parseConfidence: number;
} {
  const t = text.toLowerCase();
  if (/disaster|emergency|hurricane|wildfire|flood|earthquake/.test(t))
    return { type: "disaster_extension", parseConfidence: 0.85 };
  if (/penalty|abat|relief/.test(t))
    return { type: "penalty_relief", parseConfidence: 0.78 };
  if (/pte|pass.?through|elective/.test(t))
    return { type: "pte_change", parseConfidence: 0.75 };
  if (/form|schedule|new line|new field/.test(t))
    return { type: "form_change", parseConfidence: 0.72 };
  if (/rate|percentage|tax change/.test(t))
    return { type: "rate_change", parseConfidence: 0.7 };
  if (/nexus|economic threshold|wayfair/.test(t))
    return { type: "nexus_change", parseConfidence: 0.7 };
  // Default: form_change with low confidence — reviewer triages.
  return { type: "form_change", parseConfidence: 0.45 };
}

/**
 * LLM-based announcement parser. Calls Anthropic with a structured-
 * output prompt that returns canonical Announcement fields. Used to
 * lift confidence on regex hits the heuristic classifier rates < 0.7.
 *
 * Returns null when AI isn't configured or the call fails — callers
 * keep the regex result rather than dropping the row.
 */
export async function parseWithLLM(args: {
  firmId: string;
  title: string;
  body: string;
  stateCode: string;
  authority: string;
}): Promise<ScrapedNotice | null> {
  const { parseAnnouncement } = await import("./ai.js");
  const result = await parseAnnouncement(args);
  if (!result) return null;
  return {
    stateCode: args.stateCode,
    authority: args.authority,
    title: result.title,
    summary: result.summary,
    sourceUrl: "", // caller fills in
    publishedAt: new Date(),
    parseConfidence: result.confidence,
    type: result.type,
  };
}

// ---------- Tiny XML helpers ----------

function textIn(block: string, tag: string): string {
  const m = new RegExp(
    `<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,
    "i",
  ).exec(block);
  if (!m || !m[1]) return "";
  return decode(stripTags(m[1])).trim();
}

function hrefIn(block: string, tag: string): string {
  const m = new RegExp(`<${tag}\\b[^>]*href="([^"]+)"`, "i").exec(block);
  return m?.[1] ?? "";
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

// ---------- Scheduler ----------

let scraperHandle: NodeJS.Timeout | null = null;

/**
 * Start the in-process scraper on a fixed interval. Called from
 * backend/src/index.ts. Default cadence is 1 hour — well under the
 * 24h SLA. Call `stopScraperScheduler()` for graceful shutdown.
 */
export function startScraperScheduler(intervalMs = 60 * 60 * 1000): void {
  if (scraperHandle) return;
  // Run once on boot, then on interval
  void runScraperCycle().catch((err) => captureException(err, { ctx: "boot" }));
  scraperHandle = setInterval(() => {
    void runScraperCycle().catch((err) =>
      captureException(err, { ctx: "interval" }),
    );
  }, intervalMs);
  // Don't keep the process alive solely for the scheduler
  scraperHandle.unref?.();
}

export function stopScraperScheduler(): void {
  if (scraperHandle) {
    clearInterval(scraperHandle);
    scraperHandle = null;
  }
}
