import type { ChecklistItem, DocumentState, AiConfidence } from "../types";
import { tasks as seedTasks } from "./mockTasks";
import { resolveFederalForm } from "./canonicalForm";

/**
 * Per-form checklist templates. Each Task gets 4-8 items spread across the
 * six DocumentStates so every state's UI is visible somewhere in the seed
 * data. State distribution is intentionally weighted: most tasks have a mix
 * of `requested_waiting` and `received_unreviewed` items (Pattern 2 — the
 * chase loop is the highest-volume use mode).
 */

interface TemplateItem {
  label: string;
  itemType: string;
  /** Optional IRS PDF link surfaced as a per-item deep-link in ChecklistRow. */
  source?: string;
}

const TEMPLATES: Record<string, TemplateItem[]> = {
  "1040": [
    { label: "W-2 from primary employer", itemType: "wage_w2" },
    { label: "1099-INT (interest income)", itemType: "1099_int" },
    { label: "1099-DIV (dividends)", itemType: "1099_div" },
    { label: "1098 (mortgage interest)", itemType: "1098" },
    { label: "K-1 from investment partnerships", itemType: "k1" },
    { label: "Schedule E supporting docs", itemType: "schedule_e_support" },
    { label: "State residency proof", itemType: "state_residency" },
  ],
  "1065": [
    { label: "Partnership books (closed)", itemType: "partnership_books" },
    { label: "Partner capital schedules", itemType: "partner_capital" },
    { label: "K-1 distribution prep", itemType: "partnership_k1" },
    { label: "Federal 1065 supporting docs", itemType: "1065_support" },
    { label: "State partnership filings", itemType: "state_partnership" },
  ],
  "1120-S": [
    { label: "S-Corp books (closed)", itemType: "scorp_books" },
    { label: "Shareholder distributions", itemType: "scorp_distribution" },
    { label: "Officer compensation report", itemType: "officer_comp" },
    { label: "K-1 to shareholders", itemType: "scorp_k1" },
    { label: "State S-Corp election proof", itemType: "scorp_state_election" },
  ],
  "1120": [
    { label: "C-Corp books (closed)", itemType: "ccorp_books" },
    { label: "Schedule M-3 reconciliation", itemType: "schedule_m3" },
    { label: "Federal 1120 supporting docs", itemType: "1120_support" },
    { label: "State income tax filings", itemType: "state_income_corp" },
  ],
  estimate: [
    { label: "Q estimate calculation", itemType: "est_payment" },
    { label: "Prior-quarter income reconciliation", itemType: "income_recon" },
  ],
  default: [
    { label: "Engagement letter (signed)", itemType: "engagement_letter" },
    { label: "Year-end planning request", itemType: "yep_documents" },
    { label: "Books closing confirmation", itemType: "books_closing" },
  ],
};

function templateFor(form: string): TemplateItem[] {
  // Prefer the federalForms.ts catalog when the deadline string maps to
  // a known form code. Catalog has sourced + per-form-tailored checklists
  // (1041 trust gets trust-specific items, 990 nonprofit gets nonprofit
  // items, etc.) — much richer than the 5 hardcoded templates below.
  // Falls back to the legacy templates for unmatched forms (state-only
  // filings, generic items) so existing test fixtures keep working.
  const canonical = resolveFederalForm(form);
  if (canonical && canonical.requiredItems.length > 0) {
    return canonical.requiredItems.map((item) => ({
      label: item.label,
      itemType: item.itemType,
      source: item.source,
    }));
  }

  if (form.includes("1040")) return TEMPLATES["1040"];
  if (form.includes("1065")) return TEMPLATES["1065"];
  if (form.includes("1120-S")) return TEMPLATES["1120-S"];
  if (form.includes("1120")) return TEMPLATES["1120"];
  if (form.toLowerCase().includes("estimate")) return TEMPLATES["estimate"];
  return TEMPLATES.default;
}

/**
 * State-distribution shape for one task. Picks N items from the template,
 * assigns each a state. Walks the six states in a stable order so the UI
 * always shows variety.
 */
const STATE_ROTATION: DocumentState[] = [
  "received_confirmed",
  "received_unreviewed",
  "requested_waiting",
  "received_issue",
  "not_requested",
  "requested_waiting",
  "not_applicable",
];

const AI_CONFIDENCES: AiConfidence[] = ["high", "medium", "low"];

const FLAG_REASONS: Record<string, { reason: string; severity: "low" | "medium" | "high" }> = {
  wage_w2: {
    reason: "Wages dropped 33% vs. prior year ($120K → $80K). Could be a job change, or wrong year sent.",
    severity: "medium",
  },
  "1099_div": {
    reason: "1099-DIV from prior 3 years not yet received. Account closed, or reporting late?",
    severity: "low",
  },
  "1099_int": {
    reason: "Interest income $1,240 — last year was $1,860 (33% lower). Account balance change?",
    severity: "low",
  },
  k1: {
    reason: "K-1 historically arrives Aug 6; today is Aug 14. Source partnership delay?",
    severity: "medium",
  },
  partner_capital: {
    reason: "Capital schedule signed by 2 of 4 partners. Missing two partners' confirmation.",
    severity: "high",
  },
  est_payment: {
    reason: "Estimated payment 40% lower than prior Q. Income drop or computation error?",
    severity: "medium",
  },
};

function makeChecklistForTask(taskId: string, formType: string): ChecklistItem[] {
  const template = templateFor(formType);
  const out: ChecklistItem[] = [];
  for (let i = 0; i < template.length; i++) {
    const state = STATE_ROTATION[i % STATE_ROTATION.length];
    const item = template[i];
    const id = `ci-${taskId}-${i}`;
    const base: ChecklistItem = {
      id,
      taskId,
      label: item.label,
      itemType: item.itemType,
      state,
      order: i,
      custom: false,
      sourceUrl: item.source,
    };
    switch (state) {
      case "received_confirmed":
        base.receivedAt = "2026-04-08";
        base.confirmedAt = "2026-04-09";
        base.confirmedBy = "Sarah Mitchell";
        base.aiClassification = item.label;
        base.aiConfidence = "high";
        base.receivedFilename = `${item.itemType}-${taskId}.pdf`;
        break;
      case "received_unreviewed":
        base.receivedAt = "2026-04-19";
        base.aiClassification = item.label;
        base.aiConfidence = AI_CONFIDENCES[i % 3];
        base.receivedFilename = `${item.itemType}-${taskId}.pdf`;
        break;
      case "requested_waiting":
        base.lastReminderAt = "2026-04-10";
        base.nextReminderAt = "2026-04-24";
        break;
      case "received_issue": {
        base.receivedAt = "2026-04-18";
        base.aiClassification = item.label;
        base.aiConfidence = "medium";
        base.receivedFilename = `${item.itemType}-${taskId}.pdf`;
        const f = FLAG_REASONS[item.itemType];
        if (f) {
          base.flagReason = f.reason;
          base.flagSeverity = f.severity;
        } else {
          base.flagReason = "AI flagged a discrepancy versus prior year. Review before confirming.";
          base.flagSeverity = "low";
        }
        break;
      }
      case "not_applicable":
        // strikethrough; nothing else needed
        break;
      case "not_requested":
      default:
        break;
    }
    out.push(base);
  }
  return out;
}

export function buildChecklistsFromTasks(tasksList = seedTasks): ChecklistItem[] {
  const all: ChecklistItem[] = [];
  for (const t of tasksList) {
    for (const ci of makeChecklistForTask(t.id, t.formType)) {
      all.push(ci);
    }
  }
  return all;
}

export const checklistItems: ChecklistItem[] = buildChecklistsFromTasks();
