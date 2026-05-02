/**
 * Federal Register API poller — change detection for IRS forms.
 *
 * The state-announcement scraper at `lib/scraper.ts` watches state DOR
 * newsrooms. This file is the federal counterpart: it walks the Federal
 * Register's public API for IRS / Treasury notices, persists each one
 * to `federal_register_notices` for audit, and writes a row to
 * `federal_form_change_events` when a notice plausibly affects a form
 * we have in `federal_forms`.
 *
 * Why the Federal Register and not IRS.gov directly:
 *   - The Federal Register API (federalregister.gov/api/v1) returns
 *     structured JSON with stable document_numbers — idempotent dedup
 *     comes for free
 *   - Every revision of a federal form is announced there (final rules,
 *     proposed rules, notices) — no separate IRS.gov RSS to scrape
 *   - It's the one source ops can subpoena if a CPA disputes a missed
 *     change ("we have the document number")
 *
 * Operational shape mirrors `lib/scraper.ts`:
 *   - In-process setInterval (Phase 1)
 *   - Per-source freshness in `federal_register_sources`
 *   - Idempotent on document_number
 *   - LLM lift for low-confidence regex hits (when ANTHROPIC_API_KEY
 *     is configured) — see lib/ai.ts:parseFederalRegisterNotice
 */

import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  federalForms,
  federalFormChangeEvents,
  federalRegisterNotices,
  federalRegisterSources,
} from "../db/schema.js";
import { captureException, log, span } from "./observability.js";

// ---------- Source registry ----------

interface FederalRegisterSourceConfig {
  /** Stable key — used as PK in federal_register_sources. */
  sourceKey: string;
  /** Human label shown in /api/scraper/status. */
  label: string;
  /**
   * Federal Register API endpoint. We pass `?conditions[agencies][]=`
   * filters to narrow to the agency we care about; everything else
   * comes from defaults (publication_date >= 2 weeks ago, type=Rule
   * + Notice, sorted newest-first).
   */
  endpointUrl: string;
}

/**
 * Phase-1 source registry. Two sources cover the IRS-relevant universe:
 *   - "irs"      — Internal Revenue Service publications
 *   - "treasury" — parent dept; catches rules that name the IRS as a
 *                  co-author (occasional but real)
 *
 * Add more by appending; each polls on its own cycle and reports
 * freshness independently.
 */
export const DEFAULT_FEDERAL_REGISTER_SOURCES: FederalRegisterSourceConfig[] = [
  {
    sourceKey: "irs",
    label: "Federal Register — IRS",
    endpointUrl:
      "https://www.federalregister.gov/api/v1/documents.json" +
      "?conditions[agencies][]=internal-revenue-service" +
      "&conditions[type][]=RULE" +
      "&conditions[type][]=NOTICE" +
      "&conditions[type][]=PRORULE" +
      "&conditions[publication_date][gte]=" +
      twoWeeksAgoIso() +
      "&order=newest" +
      "&per_page=50" +
      "&fields[]=document_number" +
      "&fields[]=title" +
      "&fields[]=abstract" +
      "&fields[]=type" +
      "&fields[]=agency_names" +
      "&fields[]=publication_date" +
      "&fields[]=effective_on" +
      "&fields[]=html_url" +
      "&fields[]=pdf_url",
  },
  {
    sourceKey: "treasury",
    label: "Federal Register — Treasury",
    endpointUrl:
      "https://www.federalregister.gov/api/v1/documents.json" +
      "?conditions[agencies][]=treasury-department" +
      "&conditions[type][]=RULE" +
      "&conditions[type][]=NOTICE" +
      "&conditions[publication_date][gte]=" +
      twoWeeksAgoIso() +
      "&order=newest" +
      "&per_page=50" +
      "&fields[]=document_number" +
      "&fields[]=title" +
      "&fields[]=abstract" +
      "&fields[]=type" +
      "&fields[]=agency_names" +
      "&fields[]=publication_date" +
      "&fields[]=effective_on" +
      "&fields[]=html_url" +
      "&fields[]=pdf_url",
  },
];

function twoWeeksAgoIso(): string {
  const d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// ---------- Public API ----------

export interface FederalRegisterCycleResult {
  /** Total notices the API returned across all sources. */
  fetched: number;
  /** New rows inserted to federal_register_notices. */
  inserted: number;
  /** Number of (notice, form) pairs written to federal_form_change_events. */
  changeEvents: number;
  /** Notices whose regex parse_confidence was 'low' — flagged for reviewer. */
  lowConfidence: number;
  /** Duplicates skipped via document_number unique check. */
  duplicatesSkipped: number;
}

interface FederalRegisterApiDoc {
  document_number?: string;
  title?: string;
  abstract?: string | null;
  type?: string;
  agency_names?: string[];
  publication_date?: string;
  effective_on?: string | null;
  html_url?: string;
  pdf_url?: string | null;
}

interface FederalRegisterApiResponse {
  results?: FederalRegisterApiDoc[];
}

/**
 * Run one poll cycle: fetch all sources, classify each notice, write
 * to federal_register_notices + federal_form_change_events. Returns
 * counts for the operator log.
 *
 * Idempotent on document_number — the API returns the same documents
 * for ~2 weeks, so without dedup we'd insert the same row hourly. The
 * `do_nothing` path is the fast path; new documents trigger the full
 * write.
 */
export async function runFederalRegisterCycle(
  sources: FederalRegisterSourceConfig[] = DEFAULT_FEDERAL_REGISTER_SOURCES,
): Promise<FederalRegisterCycleResult> {
  return span("federalRegister.cycle", async () => {
    const result: FederalRegisterCycleResult = {
      fetched: 0,
      inserted: 0,
      changeEvents: 0,
      lowConfidence: 0,
      duplicatesSkipped: 0,
    };

    // Cache the federal_forms.form_number → id map once per cycle. The
    // FK lookups below would otherwise fire one query per notice, which
    // is wasteful at the catalog's expected ~30-200 row size.
    const allForms = await db
      .select({ id: federalForms.id, formNumber: federalForms.formNumber })
      .from(federalForms);
    const formIdByNumber = new Map<string, string>();
    for (const f of allForms) formIdByNumber.set(f.formNumber, f.id);

    for (const src of sources) {
      const cycleStart = new Date();
      let cycleError: string | null = null;

      try {
        const docs = await fetchSource(src);
        result.fetched += docs.length;

        for (const doc of docs) {
          if (!doc.document_number || !doc.title || !doc.html_url) continue;

          // Idempotent dedup on document_number — the same notice
          // appears in every poll for the next 2 weeks, so without this
          // every cycle would re-insert.
          const existing = await db.query.federalRegisterNotices.findFirst({
            where: eq(
              federalRegisterNotices.documentNumber,
              doc.document_number,
            ),
          });
          if (existing) {
            result.duplicatesSkipped++;
            continue;
          }

          const text = `${doc.title} ${doc.abstract ?? ""}`;
          const referencedForms = extractReferencedFormNumbers(text);
          const { changeKind, confidence } = classifyNotice(
            text,
            referencedForms,
          );
          const bucket: "high" | "medium" | "low" =
            confidence >= 0.85
              ? "high"
              : confidence >= 0.7
                ? "medium"
                : "low";
          if (bucket === "low") result.lowConfidence++;

          const [inserted] = await db
            .insert(federalRegisterNotices)
            .values({
              documentNumber: doc.document_number,
              title: doc.title,
              abstract: doc.abstract ?? null,
              documentType: doc.type ?? "Notice",
              agency: doc.agency_names?.[0] ?? "Internal Revenue Service",
              publicationDate: doc.publication_date ?? cycleStart
                .toISOString()
                .slice(0, 10),
              effectiveDate: doc.effective_on ?? null,
              htmlUrl: doc.html_url,
              pdfUrl: doc.pdf_url ?? null,
              referencedFormNumbers: referencedForms,
              changeKind,
              parseConfidence: bucket,
              rawPayload: doc as Record<string, unknown>,
            })
            .returning({ id: federalRegisterNotices.id });

          if (!inserted) continue;
          result.inserted++;

          // Fan out to federal_form_change_events for every referenced
          // form we already know about. Forms we DON'T have stay in the
          // notice's `referenced_form_numbers` array — the LLM extractor
          // can pick them up later when a user asks for them.
          for (const formNum of referencedForms) {
            const formId = formIdByNumber.get(formNum);
            if (!formId) continue;

            try {
              await db.insert(federalFormChangeEvents).values({
                formId,
                noticeId: inserted.id,
                changeKind,
                summary: buildChangeSummary(doc.title, formNum, changeKind),
              });
              result.changeEvents++;

              // Touch the form's last_change_check_at so admin queries
              // can sort by "forms with the most recent activity."
              // Don't actually mutate due_date_rule — that requires
              // human review of the change_event row first.
              await db
                .update(federalForms)
                .set({ lastChangeCheckAt: new Date() })
                .where(eq(federalForms.id, formId));
            } catch (err) {
              // Unique violation on (form_id, notice_id) → already wrote
              // this pair on a previous cycle's reprocessing of the same
              // notice. Ignore.
              const msg = err instanceof Error ? err.message : String(err);
              if (!/duplicate key/i.test(msg)) throw err;
            }
          }
        }
      } catch (err) {
        cycleError = err instanceof Error ? err.message : String(err);
        captureException(err, { source: src.sourceKey });
      }

      await recordSourceFreshness(src, cycleStart, cycleError);
    }

    log.info("federalRegister.cycle.result", { ...result });
    return result;
  });
}

// ---------- Form-number extractor ----------

/**
 * Extract IRS form numbers from notice text. Conservative — false
 * positives create noise in the reviewer queue, false negatives let
 * a real change slip past us. Returns deduped array.
 *
 * Patterns we catch:
 *   "Form 1040", "Forms 1099-NEC and 1099-MISC", "Form 1120-S"
 *   "Form W-2", "Form W-9", "Form W-2G"
 *   "Schedule K-1", "Schedule C"
 *
 * The W-series and the numeric series live in separate regexes because
 * combining them into one alternation ran into capture-group / dedup
 * complexity that wasn't worth it. Two passes, one Set.
 */
const FORM_NUMERIC_RE =
  /\bForms?\s+(\d{3,5}(?:-[A-Z0-9]{1,5})?(?:\s*(?:and|,)\s*\d{3,5}(?:-[A-Z0-9]{1,5})?)*)\b/gi;

const FORM_W_SERIES_RE = /\bForms?\s+(W-\d{1,2}[A-Z]?)\b/gi;

const SCHEDULE_RE = /\bSchedule\s+([A-Z](?:-\d+)?)\b/gi;

export function extractReferencedFormNumbers(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();

  let m: RegExpExecArray | null;
  while ((m = FORM_NUMERIC_RE.exec(text))) {
    const fragment = m[1];
    if (!fragment) continue;
    // "1099-NEC and 1099-MISC" → ["1099-NEC", "1099-MISC"]
    for (const piece of fragment.split(/\s*(?:and|,)\s*/i)) {
      const cleaned = piece.trim().toUpperCase();
      if (cleaned && cleaned.length >= 3 && cleaned.length <= 12) {
        found.add(cleaned);
      }
    }
  }
  while ((m = FORM_W_SERIES_RE.exec(text))) {
    if (m[1]) found.add(m[1].toUpperCase());
  }
  while ((m = SCHEDULE_RE.exec(text))) {
    if (m[1]) found.add(`Schedule ${m[1].toUpperCase()}`);
  }
  return Array.from(found).sort();
}

// ---------- Classifier ----------

/**
 * Classify a notice's `change_kind` and produce a confidence score.
 * Heuristic — production lift via parseFederalRegisterNoticeWithLLM.
 *
 * Confidence tiers match the announcements scraper for UI parity:
 *   ≥0.85 = high   → admin can usually approve without re-reading
 *   ≥0.70 = medium → quick CPA glance
 *   <0.70 = low    → reviewer queue, side-by-side with the source
 */
export function classifyNotice(
  text: string,
  referencedForms: string[],
): {
  changeKind: typeof federalFormChangeEvents.$inferInsert.changeKind;
  confidence: number;
} {
  const lower = text.toLowerCase();
  const noFormRefs = referencedForms.length === 0;

  // Highest-signal patterns first.
  if (
    /(due\s+date|deadline|extension)\b/.test(lower) &&
    /(postpone|extend|change|move|new\s+date|relief)/.test(lower)
  ) {
    return { changeKind: "due_date_change", confidence: noFormRefs ? 0.7 : 0.9 };
  }
  if (/\b(revis|amend|update)\w*\s+form\b/.test(lower)) {
    return { changeKind: "form_revision", confidence: 0.85 };
  }
  if (/\b(new\s+form|introduc\w+\s+form|form\s+\w+\s+is\s+being\s+added)\b/.test(lower)) {
    return { changeKind: "new_form", confidence: 0.8 };
  }
  if (/\b(retir\w+|obsolet\w+|disconinu\w+|sunset)\s+form\b/.test(lower)) {
    return { changeKind: "deprecation", confidence: 0.8 };
  }
  if (/\b(instructions?|publication)\b.*\b(updat\w+|revis\w+)\b/.test(lower)) {
    return { changeKind: "instructions_update", confidence: 0.75 };
  }

  // Fallback — still a reasonable row to record but admin should review.
  return {
    changeKind: "other",
    confidence: noFormRefs ? 0.45 : 0.6,
  };
}

function buildChangeSummary(
  title: string | undefined,
  formNumber: string,
  changeKind: typeof federalFormChangeEvents.$inferInsert.changeKind,
): string {
  const verb =
    changeKind === "due_date_change"
      ? "Due date change for"
      : changeKind === "form_revision"
        ? "Revision to"
        : changeKind === "new_form"
          ? "New form referenced:"
          : changeKind === "deprecation"
            ? "Possible deprecation of"
            : changeKind === "instructions_update"
              ? "Instructions updated for"
              : "Possible change to";
  const t = (title ?? "").slice(0, 140);
  return `${verb} Form ${formNumber} — ${t}`;
}

// ---------- Source freshness ----------

async function recordSourceFreshness(
  src: FederalRegisterSourceConfig,
  cycleStart: Date,
  errMessage: string | null,
): Promise<void> {
  try {
    const [prior] = await db
      .select()
      .from(federalRegisterSources)
      .where(eq(federalRegisterSources.sourceKey, src.sourceKey));

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
        .update(federalRegisterSources)
        .set({
          endpointUrl: src.endpointUrl,
          label: src.label,
          lastPolledAt: cycleStart,
          lastSuccessAt,
          lastErrorMessage: errMessage,
          consecutiveErrorCount,
          status,
          updatedAt: new Date(),
        })
        .where(eq(federalRegisterSources.sourceKey, src.sourceKey));
    } else {
      await db.insert(federalRegisterSources).values({
        sourceKey: src.sourceKey,
        label: src.label,
        endpointUrl: src.endpointUrl,
        lastPolledAt: cycleStart,
        lastSuccessAt,
        lastErrorMessage: errMessage,
        consecutiveErrorCount,
        status,
      });
    }
  } catch (err) {
    log.warn("federalRegister.freshness_write_failed", {
      sourceKey: src.sourceKey,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function fetchSource(
  src: FederalRegisterSourceConfig,
): Promise<FederalRegisterApiDoc[]> {
  const res = await fetch(src.endpointUrl, {
    headers: {
      "User-Agent": "DueDateHQ-FederalRegister/1.0 (ops@duedatehq.space)",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    log.warn("federalRegister.fetch_failed", {
      source: src.sourceKey,
      status: res.status,
    });
    return [];
  }
  const body = (await res.json()) as FederalRegisterApiResponse;
  return body.results ?? [];
}

// ---------- Scheduler ----------

let pollerHandle: NodeJS.Timeout | null = null;

/**
 * Start the in-process Federal Register poller. Default cadence 6h —
 * Federal Register publishes once per business day, so anything tighter
 * is wasted requests. Stop via `stopFederalRegisterPoller()`.
 */
export function startFederalRegisterPoller(
  intervalMs = 6 * 60 * 60 * 1000,
): void {
  if (pollerHandle) return;
  void runFederalRegisterCycle().catch((err) =>
    captureException(err, { ctx: "federalRegister.boot" }),
  );
  pollerHandle = setInterval(() => {
    void runFederalRegisterCycle().catch((err) =>
      captureException(err, { ctx: "federalRegister.interval" }),
    );
  }, intervalMs);
  pollerHandle.unref?.();
}

export function stopFederalRegisterPoller(): void {
  if (pollerHandle) {
    clearInterval(pollerHandle);
    pollerHandle = null;
  }
}

// ---------- Status reader ----------

/**
 * Read freshness rows for /api/scraper/status to render alongside the
 * state announcement sources. Public because index.ts wires it into
 * an admin endpoint.
 */
export async function listFederalRegisterStatus() {
  return db
    .select()
    .from(federalRegisterSources)
    .orderBy(federalRegisterSources.sourceKey);
}

