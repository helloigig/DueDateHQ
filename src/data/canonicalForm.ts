/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Canonical form resolver — bridges legacy free-text deadline strings
 *  ("1040 (federal)", "1120-S (federal)") to the federalForms.ts catalog.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  PURPOSE
 *  Existing data (BUNDLES.templates, mock deadlines, user-entered free-text
 *  deadlines) stores form names as decorated strings. The federalForms.ts
 *  catalog uses bare codes ("1040", "1120-S"). This module is the single
 *  place that translates between them so consumers don't each invent their
 *  own regex.
 *
 *  Returns null when no catalog match — caller decides fallback behavior
 *  (typically: keep showing the legacy string + the user's hand-curated
 *  checklist, just don't render the IRS source link).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { FederalForm } from "./federalForms";
import { federalFormByCode, FEDERAL_FORMS } from "./federalForms";

/**
 * Strip trailing decorations like "(federal)", "(individual)", "(extension)".
 * Then try direct catalog lookup; if that fails, walk a small set of
 * normalization rules for common patterns.
 */
export function resolveFederalForm(formString: string): FederalForm | null {
  if (!formString) return null;

  // Strip trailing parentheticals ("1040 (federal)" → "1040")
  const cleaned = formString.replace(/\s*\([^)]+\)\s*$/, "").trim();

  // Direct hit
  const direct = federalFormByCode(cleaned);
  if (direct) return direct;

  // Fuzzy patterns — these handle common decorated forms in legacy data.
  // Order matters: more specific first.
  const lower = cleaned.toLowerCase();

  // Estimated payments — collapse "Q1 estimate", "Q2 estimate" etc to 1040-ES
  // (or 1120-W for corp; we default to individual since most callers are
  // individual contexts; corp-side callers should pass the explicit code).
  if (/^q[1-4]\s+estimate$/i.test(cleaned)) return federalFormByCode("1040-ES");
  if (/estimate.*federal/i.test(cleaned)) return federalFormByCode("1040-ES");

  // Schedules — Schedule A, B, C, D, E, SE
  const scheduleMatch = cleaned.match(/^Schedule\s+([A-Z]+)$/i);
  if (scheduleMatch) {
    const code = `Schedule-${scheduleMatch[1].toUpperCase()}`;
    return federalFormByCode(code);
  }

  // K-1 variants
  if (/k-?1.*1065/i.test(cleaned)) return federalFormByCode("K-1-1065");
  if (/k-?1.*1120-?s/i.test(cleaned)) return federalFormByCode("K-1-1120-S");
  if (/k-?1.*1041/i.test(cleaned)) return federalFormByCode("K-1-1041");

  // Common 4-digit form codes that may appear with other decorations
  // (e.g. "Form 5471", "1040X")
  const codeMatch = cleaned.match(/(\d{3,4}-?[a-z]?)/i);
  if (codeMatch) {
    const candidate = codeMatch[1].toUpperCase();
    const guess = federalFormByCode(candidate);
    if (guess) return guess;
  }

  return null;
}

/**
 * Predicate: does this deadline string map to a known federal form?
 * Useful for FE conditionals ("if (isFederalForm(d)) show source link").
 */
export function isFederalForm(formString: string): boolean {
  return resolveFederalForm(formString) !== null;
}

/**
 * Match suggestions for a partial / typed-text query. Used by autocomplete
 * UIs (AddDeadlineModal). Searches form code and name (case-insensitive).
 * Returns up to `limit` matches sorted by relevance (code-prefix match
 * beats name-substring match).
 */
export function searchFederalForms(query: string, limit = 10): FederalForm[] {
  const q = query.trim().toLowerCase();
  if (!q) return FEDERAL_FORMS.slice(0, limit);

  const codeStarts: FederalForm[] = [];
  const codeContains: FederalForm[] = [];
  const nameContains: FederalForm[] = [];

  for (const f of FEDERAL_FORMS) {
    const codeLower = f.code.toLowerCase();
    const nameLower = f.name.toLowerCase();
    if (codeLower.startsWith(q)) codeStarts.push(f);
    else if (codeLower.includes(q)) codeContains.push(f);
    else if (nameLower.includes(q)) nameContains.push(f);
  }

  return [...codeStarts, ...codeContains, ...nameContains].slice(0, limit);
}
