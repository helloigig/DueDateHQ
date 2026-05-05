/**
 * LLM extraction path for long-tail federal forms.
 *
 * Curated seed covers ~30 forms. Anything past that — 5471, 8865,
 * 8606, 8938, 720, 990-T, 1042, etc. — would bloat the curated JSON
 * and ages the moment IRS changes a due date. Instead, when an FE
 * consumer asks for a form_number we don't have, we ask Claude to
 * extract the metadata from a short user-provided spec (or from the
 * form name + form number alone), persist it to `federal_forms` with
 * `extraction_method='llm'` + a confidence score, and surface that
 * confidence in the UI so the CPA knows it's machine-generated.
 *
 * Operational shape:
 *   - One Anthropic call per missing form (Haiku, ~$0.001 per call)
 *   - Result cached as a federal_forms row — same form requested
 *     again is free
 *   - Confidence < 0.7 → status='pending_review'; admin must approve
 *     before AddDeadlineModal lists it
 *   - Failures fall back to a minimal row (`status='pending_review'`,
 *     dueDateRule=null) so the user can still create a deadline
 *     manually with the form name they typed
 *
 * This file does NOT call IRS.gov or scrape pages. The model uses its
 * trained knowledge of IRS forms; that's good enough for the 95% case
 * and avoids brittle HTML scraping. When a stronger source is needed
 * (e.g. an unfamiliar form), Mode F's federal-register-poller will
 * surface change events that nudge admins to update the row.
 */

import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db/client.js";
import { aiInferences, federalForms, type FederalForm } from "../db/schema.js";
import type { DueDateRule } from "./due-date-rules.js";
import { HAIKU_MODEL, isAiConfigured } from "./ai.js";
import { captureException, log } from "./observability.js";

export interface ExtractFederalFormInput {
  /** Canonical form number, e.g. "5471", "8606", "990-T". */
  formNumber: string;
  /** Optional user-supplied hint (form name, what client mentioned). */
  hint?: string;
  /** Firm context — only used for ai_inferences logging. */
  firmId?: string;
}

export interface ExtractFederalFormResult {
  form: FederalForm;
  /** True if we created a new row; false if returning an existing one
   *  (curated, prior LLM extraction, or another caller raced and won). */
  created: boolean;
  /** True only when AI was actually invoked. False for cache hits. */
  llmCalled: boolean;
}

const EXTRACT_SYSTEM_PROMPT = `You produce structured metadata for an IRS tax form, given its form number and an optional hint. Output strict JSON with the exact keys below — no extra fields, no preamble.

{
  "formName": "<plain-English name>",
  "category": "income" | "payroll" | "info_return" | "estimated" | "extension" | "excise" | "estate_gift" | "nonprofit" | "international" | "amendment" | "other",
  "entityTypes": ["Individual" | "C-Corp" | "S-Corp" | "Partnership" | "LLC" | "Trust" | "Nonprofit"],
  "frequency": "annual" | "quarterly" | "monthly" | "per_event",
  "dueDateRule": {
    "type": "annual_fixed",
    "month": <1-12>,
    "day": <1-31>
  } | {
    "type": "quarterly_fixed",
    "periods": [{ "month": <1-12>, "day": <1-31> }, ... 4 entries]
  } | null,
  "notes": "<1-2 sentences. Surface anything a CPA must remember — extension form, alternate due date, deposit-coupling, threshold rules. Never include time-of-day.>",
  "irsUrl": "https://www.irs.gov/forms-pubs/about-form-<slug>",
  "confidence": <number 0..1>
}

Rules:
- entityTypes contains every entity type that commonly files THIS form. Empty array is invalid.
- frequency must reflect how often a single filer files. "Q1 estimates" → quarterly, "annual return" → annual.
- dueDateRule may be null when the due date depends on filer-specific facts (e.g. fiscal year end, date of death, transaction date). The notes field MUST explain it when null.
- "confidence":
  - 0.85+ : you are confident this is a well-known IRS form with stable facts
  - 0.7-0.85 : you recognize the form but some metadata is best-guess
  - <0.7 : low confidence; admin must review before this becomes user-visible
- irsUrl: use the standard about-form-<slug> path; if the form doesn't have a stable about-form page, return "" (empty string).
- Output ONLY valid JSON. No markdown fences, no commentary.`;

const MAX_FORM_NUMBER_LEN = 12;

/**
 * Get-or-create a federal_forms row for the given form_number. Returns
 * the existing row immediately if present (no LLM call), otherwise
 * runs the extraction. Idempotent under concurrent callers — we trust
 * the table's UNIQUE(form_number) constraint to resolve races and
 * re-read on conflict.
 */
export async function getOrExtractFederalForm(
  input: ExtractFederalFormInput,
): Promise<ExtractFederalFormResult> {
  const normalizedFormNumber = normalizeFormNumber(input.formNumber);
  if (!normalizedFormNumber) {
    throw new Error(
      `Invalid form_number: ${JSON.stringify(input.formNumber)}`,
    );
  }

  // Cache hit — curated rows or prior LLM extractions.
  const existing = await db.query.federalForms.findFirst({
    where: eq(federalForms.formNumber, normalizedFormNumber),
  });
  if (existing) {
    return { form: existing, created: false, llmCalled: false };
  }

  if (!isAiConfigured()) {
    // No API key — write a minimal pending_review row so the user can
    // proceed and an admin can finish the metadata later. Better than
    // throwing and breaking AddDeadlineModal in dev.
    const [row] = await db
      .insert(federalForms)
      .values({
        formNumber: normalizedFormNumber,
        formName: input.hint?.slice(0, 200) ?? `Form ${normalizedFormNumber}`,
        category: "other",
        entityTypes: [],
        frequency: "annual",
        dueDateRule: null,
        notes:
          "Auto-created without AI. Verify category, entity types, and due date before relying on this row.",
        irsUrl: null,
        extractionMethod: "llm",
        confidenceScore: "0.30",
        status: "pending_review",
        lastVerifiedAt: null,
      })
      .onConflictDoNothing()
      .returning();
    if (row) return { form: row, created: true, llmCalled: false };
    // Race lost — read the winner.
    const winner = await db.query.federalForms.findFirst({
      where: eq(federalForms.formNumber, normalizedFormNumber),
    });
    if (!winner) {
      throw new Error("federal-form-extractor: race lost, row not found");
    }
    return { form: winner, created: false, llmCalled: false };
  }

  // Real extraction. We don't go through the shared `callLLM` helper
  // because this isn't tied to a firm context and ai_inferences.firm_id
  // is NOT NULL. Instead we record the call ourselves with firmId
  // when supplied (skipping the row when it's not — admin-triggered
  // extractions don't need per-firm telemetry).
  const start = Date.now();
  const userPrompt = JSON.stringify({
    formNumber: normalizedFormNumber,
    hint: input.hint ?? null,
  });
  let modelText = "";
  let costCents = 0;
  let errorMsg: string | null = null;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const result = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 768,
      system: [
        {
          type: "text",
          text: EXTRACT_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = result.content.find((b) => b.type === "text");
    modelText = block && "text" in block ? block.text : "";

    const inputTokens = result.usage.input_tokens ?? 0;
    const outputTokens = result.usage.output_tokens ?? 0;
    const cacheReadTokens =
      ((result.usage as unknown) as Record<string, unknown>)
        .cache_read_input_tokens as number | undefined ?? 0;
    const billedInput =
      inputTokens - cacheReadTokens + cacheReadTokens * 0.1;
    costCents = (billedInput / 1_000_000) * 100 + (outputTokens / 1_000_000) * 500;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
    captureException(err, { ctx: "federal_form_extractor", formNumber: normalizedFormNumber });
    // Do NOT throw — fall through and write a low-confidence row so the
    // caller sees something. The status='pending_review' means admin
    // owns the next step.
  }

  const parsed = parseModelJson(modelText);
  const confidence =
    typeof parsed?.confidence === "number"
      ? Math.max(0, Math.min(1, parsed.confidence))
      : errorMsg
        ? 0.2
        : 0.5;

  const status: "active" | "pending_review" =
    confidence >= 0.7 && !errorMsg ? "active" : "pending_review";

  const [row] = await db
    .insert(federalForms)
    .values({
      formNumber: normalizedFormNumber,
      formName:
        parsed?.formName ?? input.hint ?? `Form ${normalizedFormNumber}`,
      category: parsed?.category ?? "other",
      entityTypes: Array.isArray(parsed?.entityTypes)
        ? parsed.entityTypes
        : [],
      frequency: parsed?.frequency ?? "annual",
      dueDateRule: (parsed?.dueDateRule ?? null) as DueDateRule | null,
      notes: parsed?.notes ?? null,
      irsUrl: parsed?.irsUrl?.trim() ? parsed.irsUrl : null,
      extractionMethod: "llm",
      confidenceScore: confidence.toFixed(2),
      status,
      lastVerifiedAt: errorMsg ? null : new Date(),
    })
    .onConflictDoNothing()
    .returning();

  // Telemetry — only when firmId is given AND the LLM call ran.
  if (input.firmId && !errorMsg) {
    try {
      await db.insert(aiInferences).values({
        firmId: input.firmId,
        // Mode F = state/federal monitoring; mirrors how parseAnnouncement
        // is logged. Long-tail extraction is a Mode F sub-flow.
        mode: "F",
        model: HAIKU_MODEL,
        latencyMs: Date.now() - start,
        costCents: costCents.toFixed(4),
        inputHash: normalizedFormNumber,
        output: {
          formNumber: normalizedFormNumber,
          confidence,
          status,
        },
      });
    } catch (telemetryErr) {
      log.warn("federal_form_extractor.telemetry_write_failed", {
        message:
          telemetryErr instanceof Error
            ? telemetryErr.message
            : String(telemetryErr),
      });
    }
  }

  if (row) return { form: row, created: true, llmCalled: !errorMsg };

  // Race lost — read the winner. Either a concurrent caller got there
  // first, or our extraction conflicted with a curated row inserted in
  // the same transaction window.
  const winner = await db.query.federalForms.findFirst({
    where: eq(federalForms.formNumber, normalizedFormNumber),
  });
  if (!winner) {
    throw new Error("federal-form-extractor: race lost, row not found");
  }
  return { form: winner, created: false, llmCalled: !errorMsg };
}

// ---------- helpers ----------

export function normalizeFormNumber(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  if (trimmed.length === 0 || trimmed.length > MAX_FORM_NUMBER_LEN) {
    return null;
  }
  // Allow alphanumeric + dashes + spaces (for "Schedule K-1"). Reject
  // anything with control chars or quotes.
  if (!/^[A-Z0-9 \-]+$/.test(trimmed)) return null;
  return trimmed.replace(/\s+/g, " ");
}

interface ParsedExtraction {
  formName?: string;
  category?: string;
  entityTypes?: string[];
  frequency?: string;
  dueDateRule?: DueDateRule | null;
  notes?: string;
  irsUrl?: string;
  confidence?: number;
}

function parseModelJson(text: string): ParsedExtraction | null {
  if (!text) return null;
  // Strip markdown fences if the model added them despite the rules.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  try {
    return JSON.parse(cleaned) as ParsedExtraction;
  } catch {
    log.warn("federal_form_extractor.parse_failed", {
      preview: cleaned.slice(0, 200),
    });
    return null;
  }
}
