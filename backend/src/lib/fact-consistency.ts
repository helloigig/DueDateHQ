/**
 * Cross-fact consistency analyzer — per PRD §9.6 v0.8 amendment + §4.3 Mode C.
 *
 * Walks ImportedFact rows grouped by (client × tax_year × fact_type). When the
 * same fact has multiple source_references and the values disagree beyond a
 * tolerance, surfaces a Mode C-style flag for CPA review.
 *
 * Why: Mode A v2 re-extraction will land facts with new extraction_version;
 * cross-fact consistency catches the case where v1 and v2 disagree, OR where
 * the same fact landed from two different sources (1040 PDF + IRS transcript)
 * with different values. Either case is a high-signal flag — the canonical
 * value needs CPA judgment.
 *
 * Deterministic — no LLM. The LLM might help interpret "is this discrepancy
 * a known-good reason (e.g., amended return)?" but that's a P1 enhancement.
 */

import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { importedFacts, type ImportedFact } from "../db/schema.js";

export type InconsistencyFlag = {
  clientId: string;
  taxYear: number;
  factType: string;
  severity: "low" | "medium" | "high";
  reason: string;
  values: Array<{
    factId: number;
    value: unknown;
    sourceGmailMessageId: string | null;
    extractionVersion: string;
    confidence: string;
  }>;
};

/** Numeric tolerance for fact values (e.g., prior_agi). 5% spread is a
 *  reasonable bar — within rounding/penny-precision noise; beyond it is a
 *  meaningful mismatch worth surfacing. */
const NUMERIC_TOLERANCE = 0.05;

/**
 * Compare a list of facts that share (client × year × fact_type). Returns
 * a flag iff inconsistency exists.
 */
function analyzeGroup(facts: ImportedFact[]): InconsistencyFlag | null {
  if (facts.length < 2) return null;
  const sample = facts[0];
  if (!sample) return null;
  const factType = sample.factType;
  const clientId = sample.clientId;
  const taxYear = sample.taxYear;
  if (!clientId || taxYear == null) return null;

  // String-typed facts: entity_type, ein, client_name. All values must be
  // identical (case-insensitive for entity_type which has known variants).
  if (factType === "entity_type" || factType === "ein") {
    const norm = (v: unknown) =>
      typeof v === "string" ? v.toLowerCase().replace(/[^a-z0-9]/g, "") : null;
    const vals = facts.map((f) => norm(f.value));
    const uniq = new Set(vals.filter((v) => v !== null));
    if (uniq.size > 1) {
      return {
        clientId,
        taxYear,
        factType,
        severity: "high",
        reason: `${factType} extracted as ${uniq.size} different values across sources`,
        values: facts.map(toFlagValue),
      };
    }
    return null;
  }

  // Numeric facts: prior_agi. Compute spread; flag if max-min / mean > tolerance.
  if (factType === "prior_agi") {
    const nums = facts
      .map((f) => (typeof f.value === "number" ? f.value : null))
      .filter((n): n is number => n !== null);
    if (nums.length < 2) return null;
    const max = Math.max(...nums);
    const min = Math.min(...nums);
    const mean = nums.reduce((s, n) => s + n, 0) / nums.length;
    if (mean === 0) return null;
    const spread = (max - min) / Math.abs(mean);
    if (spread > NUMERIC_TOLERANCE) {
      const severity: InconsistencyFlag["severity"] =
        spread > 0.2 ? "high" : spread > 0.1 ? "medium" : "low";
      return {
        clientId,
        taxYear,
        factType,
        severity,
        reason: `prior_agi spreads ${(spread * 100).toFixed(0)}% across sources ($${formatMoney(min)} → $${formatMoney(max)})`,
        values: facts.map(toFlagValue),
      };
    }
    return null;
  }

  // Array facts: forms_filed, k1_sources. Flag if any source has items the
  // others don't (set-difference > 0).
  if (factType === "forms_filed" || factType === "k1_sources") {
    const sets = facts.map((f) =>
      Array.isArray(f.value) ? new Set(f.value as string[]) : new Set<string>(),
    );
    const union = new Set<string>();
    for (const s of sets) for (const x of s) union.add(x);
    const intersection = new Set<string>();
    for (const x of union) {
      if (sets.every((s) => s.has(x))) intersection.add(x);
    }
    const diff = union.size - intersection.size;
    if (diff > 0) {
      return {
        clientId,
        taxYear,
        factType,
        severity: diff > 2 ? "high" : "medium",
        reason: `${factType}: ${diff} item${diff === 1 ? "" : "s"} present in some sources but not others`,
        values: facts.map(toFlagValue),
      };
    }
    return null;
  }

  // Unknown fact_type — bail. Future fact types should add an explicit
  // analyzer branch above.
  return null;
}

function toFlagValue(f: ImportedFact): InconsistencyFlag["values"][0] {
  return {
    factId: f.id,
    value: f.value,
    sourceGmailMessageId: f.sourceGmailMessageId,
    extractionVersion: f.extractionVersion,
    confidence: f.confidence,
  };
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Find all consistency flags for a firm (optionally scoped to one client).
 * Loads imported_facts, groups, analyzes each group.
 */
export async function findFactInconsistencies(args: {
  firmId: string;
  clientId?: string;
}): Promise<InconsistencyFlag[]> {
  const conds = [eq(importedFacts.firmId, args.firmId)];
  if (args.clientId) conds.push(eq(importedFacts.clientId, args.clientId));
  const rows = await db
    .select()
    .from(importedFacts)
    .where(and(...conds));

  // Group by (clientId, taxYear, factType)
  const groups = new Map<string, ImportedFact[]>();
  for (const r of rows) {
    if (!r.clientId || r.taxYear == null) continue;
    const key = `${r.clientId}::${r.taxYear}::${r.factType}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  const flags: InconsistencyFlag[] = [];
  for (const facts of groups.values()) {
    const flag = analyzeGroup(facts);
    if (flag) flags.push(flag);
  }

  // Sort high-severity first, then by recency
  const severityRank: Record<InconsistencyFlag["severity"], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  flags.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return flags;
}
