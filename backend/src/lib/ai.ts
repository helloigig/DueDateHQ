/**
 * AI integration — Anthropic Claude calls + cost/latency tracking.
 *
 * Replaces the deterministic stubs that shipped earlier (FE
 * `src/lib/ai-stub.ts` + BE `parseWithLLM` in scraper). Only the
 * high-leverage modes are LLM-backed:
 *
 *   - Mode A (classifyDocument)  — every inbound email triggers this
 *   - Mode D (draftEmail)        — every "Custom email" click triggers this
 *   - Scraper (parseAnnouncement) — low-confidence regex hits get LLM lift
 *
 * Modes B / C / E remain deterministic in the FE because their
 * existing logic (history-based aggregation, statistical anomaly
 * detection, set-difference for cross-year) is already meaningful
 * and doesn't gain much from an LLM round-trip.
 *
 * Operational characteristics:
 *   - System prompts are cached (cache_control: ephemeral) so repeat
 *     calls don't pay their token cost again
 *   - Every call writes to `ai_inferences` with mode/cost/latency
 *   - When ANTHROPIC_API_KEY is missing, all functions throw a clear
 *     error rather than silently producing garbage
 *   - Drift report (aiInferences.driftReport) reads acceptance rates
 *     from the same table — closes the eval loop
 */

import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db/client.js";
import { aiInferences } from "../db/schema.js";
import { log, captureException } from "./observability.js";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY not configured — set in backend/.env.local",
    );
  }
  _client = new Anthropic({ apiKey: key });
  return _client;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Default model — Haiku for cost-sensitive paths (classify, scrape parse),
// Sonnet for tone-sensitive paths (drafts). Override per call when needed.
const HAIKU_MODEL = "claude-haiku-4-5";
const SONNET_MODEL = "claude-sonnet-4-5";

/**
 * Generic LLM call wrapper. Handles error normalization, latency
 * measurement, and ai_inferences row insertion. Returns the raw
 * model output for caller-specific parsing.
 */
async function callLLM(args: {
  firmId: string;
  mode: "A" | "B" | "C" | "D" | "E";
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  /** Free-form payload stored alongside the row (input snapshot,
   *  context refs, etc.) — useful for offline evals. */
  context?: Record<string, unknown>;
}): Promise<{ text: string; inferenceId: number; costCents: number }> {
  const start = Date.now();
  let output = "";
  let costCents = 0;
  let errorMsg: string | null = null;

  try {
    const result = await client().messages.create({
      model: args.model,
      max_tokens: args.maxTokens ?? 1024,
      system: [
        {
          type: "text",
          text: args.systemPrompt,
          // Prompt caching — repeat calls in the same hour skip the
          // input tokens for the system prompt. ~90% cost reduction
          // on tight loops (every-doc classify, every-row draft).
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: args.userPrompt }],
    });

    // Extract first text block; ignore tool_use etc. for now
    const block = result.content.find((b) => b.type === "text");
    output = block && "text" in block ? block.text : "";

    // Cost — Anthropic pricing per 1M tokens (Haiku 4.5: $1/$5,
    // Sonnet 4.5: $3/$15). Cents = tokens / 1M * cents-per-million.
    const inputCostPerM = args.model.includes("haiku") ? 100 : 300;
    const outputCostPerM = args.model.includes("haiku") ? 500 : 1500;
    const inputTokens = result.usage.input_tokens ?? 0;
    const outputTokens = result.usage.output_tokens ?? 0;
    const cacheReadTokens =
      ((result.usage as unknown) as Record<string, unknown>)
        .cache_read_input_tokens as number | undefined ?? 0;
    // Cached tokens are 90% off
    const billedInputTokens =
      inputTokens - cacheReadTokens + cacheReadTokens * 0.1;
    costCents =
      (billedInputTokens / 1_000_000) * inputCostPerM +
      (outputTokens / 1_000_000) * outputCostPerM;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
    captureException(err, { mode: args.mode, model: args.model });
    throw err;
  } finally {
    const durationMs = Date.now() - start;
    // Record the inference even on error — drift detection needs both
    try {
      const inputHash = createHash("sha256")
        .update(args.systemPrompt)
        .update("\n--\n")
        .update(args.userPrompt)
        .digest("hex");
      const [row] = await db
        .insert(aiInferences)
        .values({
          firmId: args.firmId,
          mode: args.mode,
          model: args.model,
          latencyMs: durationMs,
          costCents: costCents.toString(),
          inputHash,
          output: {
            text: output,
            errorMessage: errorMsg,
            context: args.context ?? null,
          },
        })
        .returning({ id: aiInferences.id });
      if (row) {
        log.info("ai.call", {
          mode: args.mode,
          model: args.model,
          durationMs,
          costCents: Number(costCents.toFixed(4)),
          inferenceId: row.id,
          error: errorMsg,
        });
        // We can't return inside finally — the outer try returns first.
        // Stash on the closure via a side channel.
        (returnHook as { id?: number }).id = row.id;
      }
    } catch (logErr) {
      // Logging failure shouldn't fail the user's request
      captureException(logErr, { ctx: "ai_inferences_log" });
    }
  }

  return {
    text: output,
    inferenceId: returnHook.id ?? 0,
    costCents,
  };
}

const returnHook: { id?: number } = {};

// ───────── Mode A — classify inbound document ─────────

export interface ClassifyDocumentInput {
  firmId: string;
  filename: string;
  itemType?: string;
  /** Plain-text content of the document (optional — speeds up
   *  classification when available, e.g. for PDFs we extracted) */
  textPreview?: string;
  /** Task context — form type, client name — helps the model pick
   *  the right item slot when the same filename could match multiple */
  taskContext?: {
    formType: string;
    clientName: string;
    pendingItems: Array<{ itemType: string; label: string }>;
  };
}

export interface ClassifyDocumentOutput {
  guess: string;
  itemType: string | null;
  confidence: "high" | "medium" | "low";
  flagReason?: string;
  inferenceId: number;
}

const CLASSIFY_SYSTEM_PROMPT = `You classify tax documents for a CPA tool. Given a filename and optionally a text preview, you assign the doc to a checklist item type and rate your confidence.

Output strict JSON:
{
  "itemType": "<one of the pendingItems' itemType, or null if none match>",
  "guess": "<short human-readable label, e.g. 'W-2', 'K-1', '1099-INT'>",
  "confidence": "high" | "medium" | "low",
  "flagReason": "<only if you see something anomalous (wrong tax year, redacted, mismatched name) — otherwise omit>"
}

Rules:
- "high" = filename + text both clearly identify the doc
- "medium" = filename strongly suggests but text is missing/ambiguous
- "low" = filename is generic (e.g. "scan.pdf") and no text
- Never invent an itemType not in pendingItems. Return null if nothing matches.
- Output ONLY valid JSON, no preamble.`;

export async function classifyDocument(
  input: ClassifyDocumentInput,
): Promise<ClassifyDocumentOutput> {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  const userPrompt = JSON.stringify({
    filename: input.filename,
    textPreview: input.textPreview?.slice(0, 4000) ?? null,
    taskContext: input.taskContext ?? null,
  });
  const { text, inferenceId } = await callLLM({
    firmId: input.firmId,
    mode: "A",
    model: HAIKU_MODEL,
    systemPrompt: CLASSIFY_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 512,
    context: {
      filename: input.filename,
      itemType: input.itemType,
      hasPreview: Boolean(input.textPreview),
    },
  });

  let parsed: Partial<ClassifyDocumentOutput> = {};
  try {
    parsed = JSON.parse(text) as Partial<ClassifyDocumentOutput>;
  } catch {
    // Model returned non-JSON — fall back to low confidence
    log.warn("ai.classify.parse_failed", { text: text.slice(0, 200) });
  }

  return {
    guess: parsed.guess ?? input.filename,
    itemType: parsed.itemType ?? input.itemType ?? null,
    confidence: parsed.confidence ?? "low",
    flagReason: parsed.flagReason,
    inferenceId,
  };
}

// ───────── Mode D — draft chase email ─────────

export interface DraftEmailInput {
  firmId: string;
  client: { name: string };
  task: { formType: string };
  itemLabel?: string;
  itemType?: string;
  context?: string;
  tone: "warm" | "neutral" | "urgent";
  cpaSignature: string;
  forwardingEmail: string;
  /** True when the firm has connected Gmail/Outlook so we have voice
   *  samples to mirror. Without it, tone defaults to the requested
   *  tone without per-CPA voice fitting. */
  methodBConnected?: boolean;
  /** Optional voice samples (last 3 emails to this client, redacted)
   *  for tone mirroring when methodBConnected. */
  voiceSamples?: string[];
  /** Specific docs the client still owes us. When supplied, the model
   *  drafts a targeted ask ("I still need W-2 + 1099-INT") rather
   *  than a generic chase. lastYearArrival anchors expectations without
   *  being preachy. Empty array → generic chase. */
  missingDocs?: Array<{
    itemType: string;
    label: string;
    /** ISO date the same item arrived in a prior year — used by the
     *  prompt to reference history naturally ("you usually send the
     *  W-2 in early March"). Omit when no prior. */
    lastYearArrival?: string;
  }>;
}

export interface DraftEmailOutput {
  subject: string;
  body: string;
  aiSources: Array<{ kind: string; note: string }>;
  inferenceId: number;
}

const DRAFT_SYSTEM_PROMPT = `You draft chase emails for CPAs to send to their clients. The CPA reviews and sends; you never auto-send.

Output strict JSON:
{
  "subject": "<short, specific. NOT 'Important — please respond'>",
  "body": "<plain text. Use '\\n\\n' for paragraph breaks. Sign with the CPA's signature.>"
}

Rules:
- Tone: 'warm' = friendly, conversational. 'neutral' = professional, brief. 'urgent' = direct, deadline-aware.
- Subject names the form and the ask (e.g. "W-2 + 1099-INT for your 1040" not "Tax docs needed")
- Body opens with greeting using client's first name. State what you need + why + how to send. Mention the per-task forwarding address. Close with the CPA's signature.
- 3-5 sentences max. CPAs hate verbose drafts.
- No bullet points unless asked. No legal disclaimers.
- If voiceSamples are provided, mirror sentence length + register; do NOT copy specific phrases.
- If missingDocs has multiple items, list them naturally in the body ("I still need your W-2 and 1099-INT") rather than itemizing.
- If missingDocs[i].lastYearArrival is set, reference it gently ("you usually send the W-2 in early March") to anchor expectations without being preachy.
- If missingDocs is empty, fall back to a generic doc-request closer.
- Output ONLY valid JSON.`;

export async function draftEmail(
  input: DraftEmailInput,
): Promise<DraftEmailOutput> {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const userPrompt = JSON.stringify({
    client: input.client,
    task: input.task,
    itemLabel: input.itemLabel,
    itemType: input.itemType,
    context: input.context,
    tone: input.tone,
    cpaSignature: input.cpaSignature,
    forwardingEmail: input.forwardingEmail,
    voiceSamples: input.methodBConnected ? input.voiceSamples : undefined,
    missingDocs: input.missingDocs ?? [],
  });

  const { text, inferenceId } = await callLLM({
    firmId: input.firmId,
    mode: "D",
    // Sonnet is worth the cost on email drafts — Haiku produces stilted
    // tone too often. Cost difference is ~3x but volume is low (one
    // draft per chase, not per-row).
    model: SONNET_MODEL,
    systemPrompt: DRAFT_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 1024,
    context: {
      tone: input.tone,
      itemType: input.itemType,
      methodBConnected: input.methodBConnected,
    },
  });

  let parsed: { subject?: string; body?: string } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    log.warn("ai.draft.parse_failed", { text: text.slice(0, 200) });
  }

  // Build the aiSources panel — what the user sees in EmailDraftModal
  // about WHY the draft looks the way it does. Transparency, not magic.
  const aiSources: DraftEmailOutput["aiSources"] = [];
  if (input.methodBConnected && input.voiceSamples?.length) {
    aiSources.push({
      kind: "tone_match",
      note: `Tone mirrored from your last ${input.voiceSamples.length} emails to ${input.client.name}`,
    });
  } else {
    aiSources.push({
      kind: "substrate",
      note: `Tone defaulted to ${input.tone}; connect Gmail/Outlook to mirror your voice.`,
    });
  }
  if (input.itemType) {
    aiSources.push({
      kind: "prior_year",
      note: `${input.itemType.replace(/_/g, " ")} pulled from item-specific template`,
    });
  }
  aiSources.push({
    kind: "forwarding_email",
    note: `Per-task forwarding: ${input.forwardingEmail}`,
  });

  return {
    subject: parsed.subject ?? `${input.itemLabel ?? "Documents"} for your ${input.task.formType}`,
    body: parsed.body ?? "(draft generation failed — please write manually)",
    aiSources,
    inferenceId,
  };
}

// ───────── Scraper — parse state announcement ─────────

const SCRAPE_SYSTEM_PROMPT = `You extract structured tax announcements from state revenue authority press releases. Given a title and body, you return canonical fields a CPA tool can index.

Output strict JSON:
{
  "title": "<the headline as published>",
  "summary": "<2-3 sentence plain-English summary>",
  "type": "disaster_extension" | "penalty_relief" | "pte_change" | "form_change" | "rate_change" | "nexus_change",
  "confidence": <number 0-1, your confidence the type is right>,
  "oldDeadline": "<YYYY-MM-DD if a deadline shifted, else null>",
  "newDeadline": "<YYYY-MM-DD if a deadline shifted, else null>",
  "retroactive": <bool — does this apply to filings already submitted?>,
  "entityTypes": ["<llc|corp|individual|partnership|trust|nonprofit>"]
}

Rules:
- If the press release isn't a tax-relevant change, return type='form_change' and confidence=0.
- Only fill oldDeadline/newDeadline when the text explicitly states dates.
- entityTypes empty array if it applies to all.
- Output ONLY valid JSON.`;

export interface ParseAnnouncementInput {
  firmId: string;
  /** Title from the source (RSS title or HTML headline) */
  title: string;
  /** Body / description text — the page or RSS description */
  body: string;
  stateCode: string;
  authority: string;
}

export interface ParseAnnouncementOutput {
  title: string;
  summary: string;
  type:
    | "disaster_extension"
    | "penalty_relief"
    | "pte_change"
    | "form_change"
    | "rate_change"
    | "nexus_change";
  confidence: number;
  oldDeadline: string | null;
  newDeadline: string | null;
  retroactive: boolean;
  entityTypes: string[];
  inferenceId: number;
}

export async function parseAnnouncement(
  input: ParseAnnouncementInput,
): Promise<ParseAnnouncementOutput | null> {
  if (!isAiConfigured()) return null;
  const userPrompt = JSON.stringify({
    state: input.stateCode,
    authority: input.authority,
    title: input.title,
    body: input.body.slice(0, 8000),
  });
  try {
    const { text, inferenceId } = await callLLM({
      firmId: input.firmId,
      // Mode "C" is anomaly-flag in the spec; the scraper parser uses
      // it as the closest existing bucket. (Worth carving out a Mode F
      // / Mode G in a follow-up if scraper volume justifies it.)
      mode: "C",
      model: HAIKU_MODEL,
      systemPrompt: SCRAPE_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1024,
      context: {
        stateCode: input.stateCode,
        authority: input.authority,
      },
    });
    const parsed = JSON.parse(text) as Omit<
      ParseAnnouncementOutput,
      "inferenceId"
    >;
    return { ...parsed, inferenceId };
  } catch (err) {
    log.warn("ai.parseAnnouncement.failed", {
      message: err instanceof Error ? err.message : String(err),
      title: input.title,
    });
    return null;
  }
}

// ───────── Mode B — per-client arrival timing prediction ─────────

const ARRIVAL_TIMING_SYSTEM_PROMPT = `You predict when a client is likely to send a tax document, given their prior history. The CPA uses your prediction to time chase emails — too early is annoying, too late risks the deadline.

Output strict JSON:
{
  "windowStart": "<MM-DD>",
  "windowEnd": "<MM-DD>",
  "confidence": "high" | "medium" | "low",
  "reasoning": "<one short sentence — what in the history drove this>",
  "anomalyHint": "<only if the doc is overdue vs prior pattern, otherwise omit>"
}

Rules:
- "high" confidence requires ≥3 prior years of arrival data
- "medium" requires 2 prior years
- "low" for 0-1 prior years (substrate fallback — return cohort timing window)
- windowStart/windowEnd are MM-DD only (year doesn't matter — it's a recurrence pattern)
- The window should be tight enough to be useful (≤30 days) but wide enough to catch normal variation
- If the current date is past windowEnd and the doc hasn't arrived, set anomalyHint to flag it
- Output ONLY valid JSON.`;

export interface ArrivalTimingInput {
  firmId: string;
  clientId: string;
  itemType: string;
  /** Historical arrival dates for this (client × item_type) pair —
   *  ISO date strings, oldest first. */
  priorArrivals: string[];
  /** Today's date in ISO — used by the model to detect overdue cases */
  today: string;
  /** Optional cohort baseline for low-history fallback */
  cohortWindow?: { start: string; end: string };
}

export interface ArrivalTimingOutput {
  windowStart: string | null;
  windowEnd: string | null;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  anomalyHint?: string;
  inferenceId: number;
}

export async function predictArrivalTiming(
  input: ArrivalTimingInput,
): Promise<ArrivalTimingOutput | null> {
  if (!isAiConfigured()) return null;
  const userPrompt = JSON.stringify({
    itemType: input.itemType,
    priorArrivals: input.priorArrivals,
    today: input.today,
    cohortWindow: input.cohortWindow,
  });
  try {
    const { text, inferenceId } = await callLLM({
      firmId: input.firmId,
      mode: "B",
      model: HAIKU_MODEL,
      systemPrompt: ARRIVAL_TIMING_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 512,
      context: {
        clientId: input.clientId,
        itemType: input.itemType,
        priorYearCount: input.priorArrivals.length,
      },
    });
    const parsed = JSON.parse(text) as Omit<
      ArrivalTimingOutput,
      "inferenceId"
    >;
    return { ...parsed, inferenceId };
  } catch (err) {
    log.warn("ai.predictArrivalTiming.failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ───────── Mode C — anomaly detection on financial values ─────────

const ANOMALY_SYSTEM_PROMPT = `You detect anomalies in client tax/financial data. Statistical outliers (e.g. income jumped 80% YoY) are easy; the value of an LLM here is contextual judgment — "income jumped 80% but the client mentioned a one-time stock sale, so this is fine."

Output strict JSON:
{
  "isAnomaly": <bool>,
  "severity": "low" | "medium" | "high",
  "reason": "<short — why is this anomalous?>",
  "likelyExplanation": "<short — what could legitimately cause it?>",
  "needsCpaJudgment": <bool — true if the explanation isn't conclusive>
}

Rules:
- Cap "high" severity for cases that suggest fraud, undisclosed income, or material misstatement
- "medium" for unexpected swings without obvious explanation in the supplied context
- "low" for swings within normal year-over-year variance for that entity type
- needsCpaJudgment=false ONLY when the supplied context conclusively explains the anomaly
- Output ONLY valid JSON.`;

export interface DetectAnomalyInput {
  firmId: string;
  clientId: string;
  fieldLabel: string;
  currentValue: number;
  priorValues: number[];
  /** Free-form context — recent activity events, notes, prior-year facts.
   *  Helps the model distinguish "anomaly" from "expected one-time event." */
  context?: string;
  entityType?: string;
}

export interface DetectAnomalyOutput {
  isAnomaly: boolean;
  severity: "low" | "medium" | "high";
  reason: string;
  likelyExplanation: string;
  needsCpaJudgment: boolean;
  inferenceId: number;
}

export async function detectAnomaly(
  input: DetectAnomalyInput,
): Promise<DetectAnomalyOutput | null> {
  if (!isAiConfigured()) return null;
  // Cheap prefilter — if the swing is < 15% from prior mean and there
  // are ≥3 priors, skip the LLM call. The deterministic threshold
  // already catches these cases without the round-trip cost.
  if (input.priorValues.length >= 3) {
    const mean =
      input.priorValues.reduce((a, b) => a + b, 0) / input.priorValues.length;
    if (mean > 0 && Math.abs(input.currentValue - mean) / mean < 0.15) {
      return null;
    }
  }
  const userPrompt = JSON.stringify({
    fieldLabel: input.fieldLabel,
    currentValue: input.currentValue,
    priorValues: input.priorValues,
    entityType: input.entityType,
    context: input.context?.slice(0, 4000),
  });
  try {
    const { text, inferenceId } = await callLLM({
      firmId: input.firmId,
      mode: "C",
      model: HAIKU_MODEL,
      systemPrompt: ANOMALY_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 512,
      context: {
        clientId: input.clientId,
        fieldLabel: input.fieldLabel,
      },
    });
    const parsed = JSON.parse(text) as Omit<DetectAnomalyOutput, "inferenceId">;
    return { ...parsed, inferenceId };
  } catch (err) {
    log.warn("ai.detectAnomaly.failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ───────── Prior-year return PDF extraction ─────────

const PRIOR_YEAR_SYSTEM_PROMPT = `You extract structured fields from a prior-year tax return PDF. The CPA uses these to seed a new year's checklist + identify cross-year patterns (Mode E).

Output strict JSON:
{
  "clientName": "<from header — owner / business name>",
  "ein": "<XX-XXXXXXX format if present, else null>",
  "entityType": "individual" | "llc" | "s_corp" | "c_corp" | "partnership" | "trust" | "non_profit" | null,
  "taxYear": <integer year, from form header>,
  "priorAGI": <number, AGI from line 11 (1040) or comparable, else null>,
  "formsFiled": [<list of form numbers visible: "1040", "Schedule C", "Schedule E", "8606", etc.>],
  "k1Sources": [<list of partnership/S-corp/trust names from K-1s, if any>],
  "confidence": <number 0-1, your confidence the extraction is right>
}

Rules:
- "high" confidence (≥0.8) requires: clear form header + legible numerical fields + extractable entity name
- "medium" (0.5-0.8): some fields obscured/scanned poorly but core fields readable
- "low" (<0.5): scan quality is bad or document is partial; CPA review required
- Don't invent values. If a field isn't visible, return null.
- Output ONLY valid JSON.`;

export interface ParsePriorYearInput {
  firmId: string;
  /** Storage key — BE downloads the PDF bytes from Supabase Storage */
  storageKey: string;
  /** Optional client id for context — when set, Mode E can chain
   *  this extraction into cross-year-insights generation. */
  clientId?: string;
}

export interface ParsePriorYearOutput {
  clientName: string | null;
  ein: string | null;
  entityType: string | null;
  taxYear: number | null;
  priorAGI: number | null;
  formsFiled: string[];
  k1Sources: string[];
  confidence: number;
  inferenceId: number;
}

export async function parsePriorYearReturnPdf(
  input: ParsePriorYearInput,
): Promise<ParsePriorYearOutput | null> {
  if (!isAiConfigured()) return null;
  // Lazy-import to avoid circular dep at module-load (storage → ai → storage)
  const { getBytes } = await import("./storage.js");
  let pdfBytes: Buffer;
  try {
    pdfBytes = await getBytes(input.storageKey);
  } catch (err) {
    log.warn("ai.parsePriorYearReturnPdf.fetch_failed", {
      storageKey: input.storageKey,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  // Hard cap — Claude has a context limit, and very large PDFs are
  // usually scans we'd have to OCR separately anyway. 32MB is the
  // practical Anthropic limit for document attachments today.
  const MAX_PDF_BYTES = 32 * 1024 * 1024;
  if (pdfBytes.byteLength > MAX_PDF_BYTES) {
    log.warn("ai.parsePriorYearReturnPdf.pdf_too_large", {
      storageKey: input.storageKey,
      bytes: pdfBytes.byteLength,
    });
    return null;
  }

  const start = Date.now();
  try {
    // Claude's document attachment support — pass PDF as base64 in a
    // content block of type "document". Sonnet 4.5 reads multi-page
    // PDFs natively (no OCR needed for digitally-generated forms);
    // scanned forms still benefit but accuracy depends on scan quality.
    const result = await client().messages.create({
      model: SONNET_MODEL,
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: PRIOR_YEAR_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBytes.toString("base64"),
              },
            },
            {
              type: "text",
              text: "Extract the structured fields from this prior-year tax return.",
            },
          ],
        },
      ],
    });
    const block = result.content.find((b) => b.type === "text");
    const text = block && "text" in block ? block.text : "";
    const durationMs = Date.now() - start;

    // Cost: Sonnet $3/M input + $15/M output. PDF tokens scale with
    // page count; ~1500 tokens/page typical. A 5-page return with
    // ~700 output tokens ≈ $0.04 per extraction.
    const inputTokens = result.usage.input_tokens ?? 0;
    const outputTokens = result.usage.output_tokens ?? 0;
    const costCents =
      (inputTokens / 1_000_000) * 300 + (outputTokens / 1_000_000) * 1500;

    // Log to ai_inferences via the same pipeline as other modes
    let inferenceId = 0;
    try {
      const { createHash } = await import("node:crypto");
      const inputHash = createHash("sha256")
        .update(input.storageKey)
        .digest("hex");
      const [row] = await db
        .insert(aiInferences)
        .values({
          firmId: input.firmId,
          mode: "E",
          model: SONNET_MODEL,
          latencyMs: durationMs,
          costCents: costCents.toString(),
          inputHash,
          output: { text, storageKey: input.storageKey },
        })
        .returning({ id: aiInferences.id });
      inferenceId = row?.id ?? 0;
    } catch (err) {
      log.warn("ai.parsePriorYearReturnPdf.log_failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    let parsed: Partial<ParsePriorYearOutput> = {};
    try {
      parsed = JSON.parse(text) as Partial<ParsePriorYearOutput>;
    } catch {
      log.warn("ai.parsePriorYearReturnPdf.parse_failed", {
        textPreview: text.slice(0, 200),
      });
    }

    log.info("ai.parsePriorYearReturnPdf.done", {
      firmId: input.firmId,
      durationMs,
      costCents: Number(costCents.toFixed(4)),
      pages: Math.ceil(pdfBytes.byteLength / 100_000),
      confidence: parsed.confidence,
    });

    return {
      clientName: parsed.clientName ?? null,
      ein: parsed.ein ?? null,
      entityType: parsed.entityType ?? null,
      taxYear: parsed.taxYear ?? null,
      priorAGI: parsed.priorAGI ?? null,
      formsFiled: parsed.formsFiled ?? [],
      k1Sources: parsed.k1Sources ?? [],
      confidence: parsed.confidence ?? 0.4,
      inferenceId,
    };
  } catch (err) {
    captureException(err, { ctx: "parse_prior_year_pdf" });
    return null;
  }
}

// ───────── Mode E — cross-year insights ─────────

const CROSS_YEAR_SYSTEM_PROMPT = `You analyze a client's multi-year tax history to surface advisory opportunities. The CPA uses your output to identify:
  - missing items (last year had X, this year doesn't)
  - structural opportunities (e.g. PTET election eligible this year, qualified small business stock holding period crossing a threshold)
  - regression risk (e.g. AGI dropped — does the client know they may now qualify for credits they didn't last year?)

Output strict JSON:
{
  "insights": [
    {
      "category": "missing_item" | "election_opportunity" | "credit_eligibility" | "structural" | "regression_risk",
      "title": "<short — what to surface>",
      "detail": "<2-3 sentences — why this matters, what action the CPA might take>",
      "confidence": "high" | "medium" | "low",
      "priorYearsEvidence": [<array of years that support this>]
    }
  ]
}

Rules:
- Surface AT MOST 5 insights, ranked by importance
- "high" confidence requires evidence in 2+ prior years
- Include the priorYearsEvidence array — the CPA needs to see what your reasoning is grounded in
- Don't surface insights that just describe the data ("their AGI is $X") — every insight should imply a CPA action
- Output ONLY valid JSON. Empty array is fine if nothing material.`;

export interface CrossYearInsightsInput {
  firmId: string;
  clientId: string;
  clientName: string;
  entityType: string;
  primaryState: string;
  /** Per-year facts: { year: 2023, items: [{itemType, value}, ...] } */
  yearlyFacts: Array<{
    year: number;
    items: Array<{ itemType: string; value?: number; label?: string }>;
  }>;
  /** Current-year checklist (items expected this year) */
  currentChecklist: Array<{ itemType: string; label: string; state: string }>;
}

export interface CrossYearInsight {
  category:
    | "missing_item"
    | "election_opportunity"
    | "credit_eligibility"
    | "structural"
    | "regression_risk";
  title: string;
  detail: string;
  confidence: "high" | "medium" | "low";
  priorYearsEvidence: number[];
}

export interface CrossYearInsightsOutput {
  insights: CrossYearInsight[];
  inferenceId: number;
}

export async function generateCrossYearInsights(
  input: CrossYearInsightsInput,
): Promise<CrossYearInsightsOutput | null> {
  if (!isAiConfigured()) return null;
  // Skip for cold-start clients — Mode E is only meaningful with ≥2
  // prior years of data
  if (input.yearlyFacts.length < 2) return null;

  const userPrompt = JSON.stringify({
    client: {
      name: input.clientName,
      entityType: input.entityType,
      primaryState: input.primaryState,
    },
    yearlyFacts: input.yearlyFacts,
    currentChecklist: input.currentChecklist,
  });
  try {
    const { text, inferenceId } = await callLLM({
      firmId: input.firmId,
      mode: "E",
      // Sonnet for cross-year — multi-year reasoning is worth the cost
      // (~$0.05/client). Volume is one call per client per audit pass,
      // not per row.
      model: SONNET_MODEL,
      systemPrompt: CROSS_YEAR_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 2048,
      context: {
        clientId: input.clientId,
        priorYearCount: input.yearlyFacts.length,
      },
    });
    const parsed = JSON.parse(text) as { insights: CrossYearInsight[] };
    return { insights: parsed.insights ?? [], inferenceId };
  } catch (err) {
    log.warn("ai.generateCrossYearInsights.failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
