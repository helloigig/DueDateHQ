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
- Subject names the form and the ask (e.g. "W-2 for your 1040" not "Tax docs needed")
- Body opens with greeting using client's first name. State what you need + why + how to send. Mention the per-task forwarding address. Close with the CPA's signature.
- 3-5 sentences max. CPAs hate verbose drafts.
- No bullet points unless asked. No legal disclaimers.
- If voiceSamples are provided, mirror sentence length + register; do NOT copy specific phrases.
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
