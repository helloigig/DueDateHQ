/**
 * Mode E talking-points generator for pte_change planning calls.
 *
 * Spec: docs/specs/alert-detail-pte-change.md
 *
 * Two paths:
 *
 *   1. LLM-backed (`generatePteTalkingPointsLLM`) — calls Claude Haiku
 *      with a structured-output prompt; produces 3–5 bullets per (alert,
 *      client) tuple personalized on the client's PTE status, entity
 *      type, and prior-year context. Used when ANTHROPIC_API_KEY is set.
 *
 *   2. Template-based (`generatePteTalkingPointsTemplate`) — pure
 *      template generator with the same return shape. Used as fallback
 *      when no API key, when the LLM call errors, or when the caller
 *      explicitly opts out (e.g., a deterministic test).
 *
 * Public API: `generatePteTalkingPoints()` picks #1 when API key present,
 * #2 otherwise. Always returns synchronously-resolvable data so callers
 * don't need to special-case provider availability.
 *
 * Cost note: Haiku call is ~$0.0005 per (alert, client) tuple at typical
 * sizes. For an alert with 50 clients that's ~$0.025 — single-cent range.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Announcement, Client } from "../db/schema.js";
import { captureException } from "./observability.js";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export interface TalkingPointsInput {
  announcement: Pick<
    Announcement,
    "id" | "title" | "summary" | "stateCode" | "effectiveDate" | "type"
  >;
  client: Pick<
    Client,
    "id" | "name" | "entityType" | "primaryState" | "pteElectionYear" | "pteEligibilityStatus"
  >;
}

export interface TalkingPoint {
  category:
    | "intent"
    | "impact"
    | "deadline"
    | "estimate_timing"
    | "owner_credit"
    | "election_pitch"
    | "renewal";
  text: string;
  /** Whether this point is high-confidence (always relevant) or
   *  speculative (depends on assumptions). UI can render speculative
   *  points with a softer style. */
  speculative: boolean;
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  "S-Corp": "S-Corp",
  Partnership: "Partnership",
  LLC: "LLC",
  "C-Corp": "C-Corp",
  Trust: "Trust",
  Individual: "Individual",
};

/**
 * Public entry point — picks LLM if ANTHROPIC_API_KEY is set, falls
 * back to template generator otherwise. Always async (LLM path needs
 * it; template path resolves immediately).
 *
 * Errors in the LLM path fall through to the template generator so a
 * Claude outage never blocks pte_change scheduling.
 */
export async function generatePteTalkingPoints(
  input: TalkingPointsInput,
): Promise<TalkingPoint[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generatePteTalkingPointsTemplate(input);
  }
  try {
    const llmPoints = await generatePteTalkingPointsLLM(input);
    if (llmPoints.length > 0) return llmPoints;
    // Empty result = LLM produced unparseable output. Fall through.
    return generatePteTalkingPointsTemplate(input);
  } catch (err) {
    captureException(err, {
      ctx: "talking_points_generator",
      clientId: input.client.id,
      alertId: input.announcement.id,
    });
    return generatePteTalkingPointsTemplate(input);
  }
}

const LLM_SYSTEM_PROMPT = `You are a senior tax accountant helping a CPA prepare for a planning call with a client about a state Pass-Through Entity (PTE) tax change.

Output 3 to 5 talking-point bullets the CPA can read off during the call. Each bullet must be ONE category from this fixed list:
  intent           — confirm the client's intent for the upcoming election year
  impact           — walk the client through what changed in the alert
  deadline         — flag the new election deadline and timing implications
  estimate_timing  — discuss Q-estimate timing impact (PTE payment vs personal estimate)
  owner_credit     — reconcile owner-level state credit allocations on K-1s
  election_pitch   — pitch electing PTE for the first time (eligible-but-not-elected clients)
  renewal          — re-evaluate a lapsed prior-year election

Mark each bullet "speculative: true" when the bullet depends on assumptions about the client's situation that need confirmation; "speculative: false" when it's a direct restatement of the alert or a standard talking point that always applies.

Output JSON only, no prose. Shape:
{
  "points": [
    { "category": "<one-of-above>", "text": "<bullet text>", "speculative": <bool> }
  ]
}

Tone: terse, professional, no jargon Sarah doesn't already know. Each bullet under 20 words.`;

interface LlmResponse {
  points: Array<{ category: string; text: string; speculative: boolean }>;
}

const VALID_CATEGORIES: ReadonlySet<TalkingPoint["category"]> = new Set([
  "intent",
  "impact",
  "deadline",
  "estimate_timing",
  "owner_credit",
  "election_pitch",
  "renewal",
]);

/**
 * Calls Claude Haiku for personalized talking points. Throws on network
 * error or structurally invalid response — caller (`generatePteTalkingPoints`)
 * catches and falls back to the template path.
 */
export async function generatePteTalkingPointsLLM(
  input: TalkingPointsInput,
): Promise<TalkingPoint[]> {
  const { announcement: ann, client } = input;
  const status = client.pteEligibilityStatus ?? "eligible_not_elected";
  const userPrompt = JSON.stringify({
    alert: {
      state: ann.stateCode,
      title: ann.title,
      summary: ann.summary,
      effectiveDate: ann.effectiveDate,
    },
    client: {
      name: client.name,
      entityType: client.entityType,
      primaryState: client.primaryState,
      pteEligibilityStatus: status,
      pteElectionYear: client.pteElectionYear,
    },
  });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const result = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: LLM_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" }, // amortize the system prompt across all clients in a batch
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });
  const block = result.content.find((b) => b.type === "text");
  const modelText = block && "text" in block ? block.text : "";

  // Best-effort JSON extraction: strip markdown fences if the model
  // wraps the JSON in ```json ... ```. Throws on parse failure.
  const trimmed = modelText
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/```\s*$/, "");
  let parsed: LlmResponse;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed.points)) return [];

  return parsed.points
    .filter(
      (p): p is { category: TalkingPoint["category"]; text: string; speculative: boolean } =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as { text?: unknown }).text === "string" &&
        ((p as { text: string }).text.trim().length > 0) &&
        VALID_CATEGORIES.has((p as { category: TalkingPoint["category"] }).category),
    )
    .slice(0, 5)
    .map((p) => ({
      category: p.category,
      text: p.text.trim(),
      speculative: typeof p.speculative === "boolean" ? p.speculative : false,
    }));
}

/**
 * Template-based generator (no LLM). Always available, fast, deterministic.
 * Always includes 1 "intent" + 1 "impact" point. Conditionally includes
 * deadline / estimate timing / owner credit / election pitch points based
 * on client status + alert metadata.
 *
 * Returns 3–5 points typically (capped at 5).
 */
export function generatePteTalkingPointsTemplate(
  input: TalkingPointsInput,
): TalkingPoint[] {
  const { announcement: ann, client } = input;
  const points: TalkingPoint[] = [];

  const status = client.pteEligibilityStatus ?? "eligible_not_elected";
  const entityLabel =
    ENTITY_TYPE_LABELS[client.entityType] ?? client.entityType;

  // ── 1. Always include an "intent" bullet ──────────────────────────────
  if (status === "elected") {
    points.push({
      category: "intent",
      text: `Confirm intent to renew ${ann.stateCode} PTE election for ${
        ann.effectiveDate?.slice(0, 4) ?? "current year"
      }`,
      speculative: false,
    });
  } else if (status === "eligible_not_elected") {
    points.push({
      category: "election_pitch",
      text: `Pitch ${ann.stateCode} PTE election — federal SALT-cap workaround for ${entityLabel} owners`,
      speculative: false,
    });
  } else if (status === "lapsed") {
    points.push({
      category: "renewal",
      text: `Re-evaluate ${ann.stateCode} PTE election (lapsed in prior year)`,
      speculative: false,
    });
  } else {
    points.push({
      category: "intent",
      text: `Verify PTE eligibility for ${entityLabel} entity in ${ann.stateCode}`,
      speculative: true,
    });
  }

  // ── 2. Always include an "impact" bullet ──────────────────────────────
  // Strip the title's redundant prefixes for cleaner bullets.
  const impactSummary = ann.summary
    .split(".")[0]
    ?.trim()
    .replace(/^[^a-zA-Z]*/, "");
  points.push({
    category: "impact",
    text: `Walk through impact: ${impactSummary || ann.title}`,
    speculative: false,
  });

  // ── 3. Conditionally include deadline timing point ────────────────────
  if (ann.effectiveDate) {
    const eff = new Date(ann.effectiveDate);
    const formattedDate = eff.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    points.push({
      category: "deadline",
      text: `New election deadline ${formattedDate} — book the call before that`,
      speculative: false,
    });
  }

  // ── 4. Q-estimate timing implication ─────────────────────────────────
  if (status === "elected" || status === "lapsed") {
    points.push({
      category: "estimate_timing",
      text: "Q-estimate timing implications (PTE payment vs personal estimate)",
      speculative: false,
    });
  }

  // ── 5. Owner-credit reconciliation (election cases only) ─────────────
  if (status === "elected") {
    points.push({
      category: "owner_credit",
      text: "Reconcile owner-level state credit allocations on K-1s",
      speculative: true,
    });
  }

  return points.slice(0, 5);
}

/**
 * Render talking points for a planning_calls.talking_points_json column.
 * Strips the metadata, returns plain string[] for storage.
 */
export function pointsToJson(points: TalkingPoint[]): string[] {
  return points.map((p) => p.text);
}
