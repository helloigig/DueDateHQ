import type { EntityType, StateCode } from "../types";
import { STATE_NAMES } from "../types";
import type { DetectedRow, FieldMapping } from "./mockImportData";

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/** Minimal RFC-4180 parser — handles quoted fields, doubled-quotes, CRLF. */
export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += ch;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim().length > 0));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const [headers, ...dataRows] = nonEmpty;
  return {
    headers: headers.map((h) => h.trim()),
    rows: dataRows,
  };
}

const ENTITY_ALIASES: Record<string, EntityType> = {
  individual: "Individual",
  ind: "Individual",
  "sole prop": "Individual",
  llc: "LLC",
  "llc-disregarded": "LLC",
  scorp: "S-Corp",
  "s-corp": "S-Corp",
  "s corp": "S-Corp",
  ccorp: "C-Corp",
  "c-corp": "C-Corp",
  "c corp": "C-Corp",
  partnership: "Partnership",
  ptr: "Partnership",
  trust: "Trust",
};

// Build STATE_ALIASES from the canonical STATE_NAMES map. Each state has at
// least two aliases: the lowercased 2-letter code and the lowercased full name.
const STATE_ALIASES: Record<string, StateCode> = (() => {
  const map: Record<string, StateCode> = {};
  for (const code of Object.keys(STATE_NAMES) as StateCode[]) {
    map[code.toLowerCase()] = code;
    map[STATE_NAMES[code].toLowerCase()] = code;
  }
  return map;
})();

function pickEntity(raw: string): EntityType | null {
  const k = raw.trim().toLowerCase();
  return ENTITY_ALIASES[k] ?? null;
}

function pickState(raw: string): StateCode | null {
  const k = raw.trim().toLowerCase();
  return STATE_ALIASES[k] ?? null;
}

interface FieldGuess {
  index: number;
  targetField: FieldMapping["targetField"] | null;
  confidence: FieldMapping["confidence"];
}

const TARGETS: Array<{
  target: FieldMapping["targetField"];
  patterns: RegExp[];
}> = [
  { target: "client_name", patterns: [/^name$/i, /client/i, /company/i] },
  { target: "entity_type", patterns: [/entity/i, /type/i] },
  { target: "primary_state", patterns: [/^state$/i, /primary.?state/i, /jurisdiction/i] },
  { target: "contact_email", patterns: [/email/i] },
  { target: "contact_phone", patterns: [/phone/i, /tel/i] },
  { target: "bundle", patterns: [/bundle/i, /package/i, /service/i] },
];

export function detectMapping(headers: string[]): FieldMapping[] {
  const used = new Set<FieldMapping["targetField"]>();
  const mapping: FieldMapping[] = headers.map((header) => {
    const guess = guessField(header, used);
    if (guess?.targetField) used.add(guess.targetField);
    return {
      sourceColumn: header,
      targetField: guess?.targetField ?? "__ignored__",
      confidence: guess?.confidence ?? "ignore",
    };
  });
  return mapping;
}

function guessField(
  header: string,
  used: Set<FieldMapping["targetField"]>
): FieldGuess | null {
  for (const { target, patterns } of TARGETS) {
    if (used.has(target)) continue;
    for (const re of patterns) {
      if (re.test(header)) {
        return {
          index: 0,
          targetField: target,
          confidence: re.source.includes("^") ? "high" : "high",
        };
      }
    }
  }
  return null;
}

export function rowsFromCsv(
  _headers: string[],
  rows: string[][],
  mapping: FieldMapping[]
): DetectedRow[] {
  const indexOf = (t: FieldMapping["targetField"]): number => {
    const i = mapping.findIndex((m) => m.targetField === t);
    return i;
  };

  const nameIdx = indexOf("client_name");
  const entityIdx = indexOf("entity_type");
  const stateIdx = indexOf("primary_state");
  const emailIdx = indexOf("contact_email");
  const phoneIdx = indexOf("contact_phone");
  const bundleIdx = indexOf("bundle");

  return rows
    .filter((r) => r.length > 0 && r.some((c) => c.trim().length > 0))
    .map((r, i) => {
      const name = nameIdx >= 0 ? (r[nameIdx] ?? "").trim() : "";
      const entityRaw = entityIdx >= 0 ? r[entityIdx] ?? "" : "";
      const stateRaw = stateIdx >= 0 ? r[stateIdx] ?? "" : "";
      const email = emailIdx >= 0 ? (r[emailIdx] ?? "").trim() : "";
      const phone =
        phoneIdx >= 0 ? (r[phoneIdx] ?? "").trim() || undefined : undefined;
      const bundle =
        bundleIdx >= 0 ? (r[bundleIdx] ?? "").trim() || null : null;

      const entityType = pickEntity(entityRaw);
      const primaryState = pickState(stateRaw);
      const issues: string[] = [];
      if (!name) issues.push("name_missing");
      if (!entityType) issues.push("entity_missing");
      if (!primaryState) issues.push("state_unknown");
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        issues.push("email_missing");

      return {
        sourceName: name,
        sourceEntity: entityRaw,
        sourceState: stateRaw,
        sourceEmail: email,
        sourcePhone: phone,
        sourceService: bundleIdx >= 0 ? r[bundleIdx] ?? "" : "",
        name: name || `(Unnamed row ${i + 1})`,
        entityType,
        primaryState,
        email,
        phone,
        bundle,
        issues,
      };
    });
}

/** Detect source format from header signature. */
export function detectSource(headers: string[]): string {
  const set = new Set(headers.map((h) => h.toLowerCase()));
  if (set.has("fit_client_id") || set.has("fit client id"))
    return "File In Time";
  if (set.has("taxdome_id") || set.has("taxdome id")) return "TaxDome";
  if (set.has("drake id") || set.has("prepid")) return "Drake";
  if (set.has("proconnect id")) return "ProConnect";
  return "CSV";
}
