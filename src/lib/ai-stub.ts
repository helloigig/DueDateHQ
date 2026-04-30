/**
 * AI use-mode dispatcher.
 *
 * Two paths per function:
 *   - Mock mode (env.useMockData=true): deterministic stub. Stable
 *     outputs across re-renders, short simulated latency. Used in
 *     dev / preview / demo workspace.
 *   - Real mode (env.useMockData=false): dispatches to the BE
 *     trpc.ai.* procedures, which call Anthropic Claude with prompt
 *     caching and log every call to ai_inferences.
 *
 * Five modes (PRD §4.3):
 *   - Mode A: classifyDocument        (real LLM in real mode)
 *   - Mode B: arrivalTiming           (always deterministic — history math)
 *   - Mode C: flagAnomaly             (always deterministic — statistical)
 *   - Mode D: draftEmail              (real LLM in real mode)
 *   - Mode E: crossYearInsights       (always deterministic — set diff)
 *
 * Modes B/C/E stay deterministic because their existing logic is
 * meaningful and cheap. Modes A/D need real LLM for product feel.
 */

import type {
  AiSource,
  AiConfidence,
  Client,
  ChecklistItem,
  EmailTone,
  ImportedFact,
  Task,
} from "../types";
import { env } from "../config";
import { trpcClientUntyped } from "./api/client";

const cache = new Map<string, unknown>();

function hash(input: unknown): string {
  return JSON.stringify(input);
}

function cached<T>(key: unknown, compute: () => T): T {
  const k = hash(key);
  if (cache.has(k)) return cache.get(k) as T;
  const v = compute();
  cache.set(k, v);
  return v;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// -------- Mode A — classify inbound document --------

export async function classifyDocument(input: {
  filename: string;
  itemType: string;
  /** Optional task context — when provided in real mode, AI gets the
   *  pending checklist items + form type for sharper classification. */
  taskContext?: {
    formType: string;
    clientName: string;
    pendingItems: Array<{ itemType: string; label: string }>;
  };
}): Promise<{ guess: string; confidence: AiConfidence }> {
  // Real mode — call BE through tRPC
  if (!env.useMockData) {
    try {
      const result = await trpcClientUntyped.ai.classifyDocument.mutate({
        filename: input.filename,
        itemType: input.itemType,
        taskContext: input.taskContext,
      });
      return {
        guess: result.guess,
        confidence: result.confidence,
      };
    } catch (err) {
      // BE not configured / rate-limited / other — fall through to
      // the deterministic stub so the UI keeps working
      console.warn("[ai] classifyDocument fell back to stub:", err);
    }
  }

  // Mock / fallback path — deterministic stub
  await delay(300);
  return cached(input, () => {
    const code = input.filename.charCodeAt(0) + input.filename.length;
    const conf: AiConfidence =
      code % 5 === 0 ? "low" : code % 3 === 0 ? "medium" : "high";
    return {
      guess: input.itemType.replace(/_/g, " ").toUpperCase(),
      confidence: conf,
    };
  });
}

// -------- Mode B — per-client arrival timing --------

export interface ArrivalPrediction {
  windowStart?: string; // MM-DD
  windowEnd?: string; // MM-DD
  confidence: AiConfidence;
  source: "history" | "cohort" | "substrate";
  detail: string;
}

export function arrivalTiming(
  clientId: string,
  itemType: string,
  facts: ImportedFact[]
): ArrivalPrediction {
  const matches = facts.filter(
    (f) => f.clientId === clientId && f.itemType === itemType && f.observedDate
  );
  if (matches.length === 0) {
    return {
      confidence: "low",
      source: "substrate",
      detail: `No prior history for ${itemType}. Mode B will sharpen once 1+ year is imported.`,
    };
  }
  const monthDays = matches.map((f) => f.observedDate!.slice(5));
  monthDays.sort();
  const start = monthDays[0];
  const end = monthDays[monthDays.length - 1];
  return {
    windowStart: start,
    windowEnd: end,
    confidence: matches.length >= 3 ? "high" : "medium",
    source: "history",
    detail: `Across ${matches.length} prior year${
      matches.length === 1 ? "" : "s"
    }, ${itemType.replace(/_/g, " ")} arrived between ${start} and ${end}.`,
  };
}

// -------- Mode C — anomaly flag --------

export interface AnomalyFlag {
  flag: boolean;
  reason?: string;
  severity?: "low" | "medium" | "high";
}

export function flagAnomaly(
  currentValue: number,
  priorValues: number[]
): AnomalyFlag {
  if (priorValues.length === 0) return { flag: false };
  const avg =
    priorValues.reduce((a, b) => a + b, 0) / priorValues.length;
  if (avg === 0) return { flag: false };
  const delta = Math.abs((currentValue - avg) / avg);
  if (delta < 0.15) return { flag: false };
  const sev: "low" | "medium" | "high" =
    delta > 0.5 ? "high" : delta > 0.25 ? "medium" : "low";
  const direction = currentValue < avg ? "lower" : "higher";
  return {
    flag: true,
    severity: sev,
    reason: `Value ${currentValue} is ${Math.round(delta * 100)}% ${direction} than the prior-year average of ${Math.round(avg)}.`,
  };
}

// -------- Mode D — draft outbound email --------

interface DraftEmailInput {
  task: Task;
  client: Pick<Client, "name" | "contactEmail" | "id">;
  itemLabel?: string;
  itemType?: string;
  tone: EmailTone;
  cpaName: string;
  cpaSignature: string;
  firmName: string;
  forwardingEmail: string;
  /** Free-form context for the email — used for "Ask client" on a flag. */
  context?: string;
  /** Has the CPA connected Method B (Gmail/Outlook OAuth)? */
  methodBConnected?: boolean;
  /** Smart chase — every still-pending doc on this task. When supplied,
   *  the draft asks specifically (W-2 + 1099-INT) instead of generically.
   *  lastYearArrival anchors expectations naturally without being preachy. */
  missingDocs?: Array<{
    itemType: string;
    label: string;
    lastYearArrival?: string;
  }>;
}

const TONE_INTROS: Record<EmailTone, string> = {
  formal: "Dear {{client_name}},\n\nI hope this finds you well. ",
  casual: "Hi {{client_name}},\n\n",
  urgent: "Hi {{client_name}},\n\n**Time-sensitive:** ",
  apologetic:
    "Hi {{client_name}},\n\nApologies for the back-and-forth on this. ",
};

const TONE_OUTROS: Record<EmailTone, string> = {
  formal: "\n\nKind regards,\n{{cpa_signature}}",
  casual: "\n\nThanks,\n{{cpa_signature}}",
  urgent: "\n\nThanks for jumping on this,\n{{cpa_signature}}",
  apologetic: "\n\nThanks for your patience,\n{{cpa_signature}}",
};

function tonalLine(tone: EmailTone, item: string): string {
  switch (tone) {
    case "formal":
      return `I am writing to request your ${item} so that we may complete your return on schedule.`;
    case "urgent":
      return `I still need your ${item} to file by your deadline. Please send it as soon as possible — even today, if you can.`;
    case "apologetic":
      return `I realize I've asked about your ${item} before. If it's already on its way, please disregard.`;
    case "casual":
    default:
      return `Could you forward your ${item} when you have a moment?`;
  }
}

export interface DraftEmailOutput {
  subject: string;
  body: string;
  aiSources: AiSource[];
}

/**
 * Map FE tone (formal/casual/urgent/apologetic) → BE tone
 * (warm/neutral/urgent). Apologetic uses warm + a context hint
 * so the model knows to acknowledge prior back-and-forth.
 */
function mapTone(t: EmailTone): {
  beTone: "warm" | "neutral" | "urgent";
  contextHint?: string;
} {
  switch (t) {
    case "formal":
      return { beTone: "neutral" };
    case "urgent":
      return { beTone: "urgent" };
    case "apologetic":
      return {
        beTone: "warm",
        contextHint:
          "I've asked about this before — please acknowledge that gently.",
      };
    case "casual":
    default:
      return { beTone: "warm" };
  }
}

export async function draftEmail(
  input: DraftEmailInput
): Promise<DraftEmailOutput> {
  // Real mode — call BE through tRPC. Falls back to stub on any error.
  if (!env.useMockData) {
    try {
      const { beTone, contextHint } = mapTone(input.tone);
      const mergedContext = [input.context, contextHint]
        .filter(Boolean)
        .join("\n\n");
      const result = await trpcClientUntyped.ai.draftEmail.mutate({
        client: { name: input.client.name },
        task: { formType: input.task.formType },
        itemLabel: input.itemLabel,
        itemType: input.itemType,
        context: mergedContext || undefined,
        tone: beTone,
        cpaSignature: input.cpaSignature,
        forwardingEmail: input.forwardingEmail,
        methodBConnected: input.methodBConnected,
        missingDocs: input.missingDocs,
      });
      return {
        subject: result.subject,
        body: result.body,
        aiSources: result.aiSources as AiSource[],
      };
    } catch (err) {
      console.warn("[ai] draftEmail fell back to stub:", err);
    }
  }

  // Mock / fallback path — deterministic stub.
  // Simulate the 5-second latency target from PRD §11.1, but capped low for
  // a wireframe build so demos don't drag.
  await delay(700 + Math.random() * 600);

  return cached(input, () => {
    const item = input.itemLabel ?? "outstanding documents";
    const intro = TONE_INTROS[input.tone].replace(
      "{{client_name}}",
      input.client.name
    );
    const middle = input.context ? `${input.context}\n\n` : "";
    const ask = tonalLine(input.tone, item);
    const forwardingNote = `\n\nYou can reply to this email or send to ${input.forwardingEmail}.`;
    const outro = TONE_OUTROS[input.tone].replace(
      "{{cpa_signature}}",
      input.cpaSignature
    );

    const subject =
      input.tone === "urgent"
        ? `Urgent: ${item} for your ${input.task.formType}`
        : `${item} for your ${input.task.formType}`;
    const body = `${intro}${middle}${ask}${forwardingNote}${outro}`;

    const aiSources: AiSource[] = [];
    if (input.methodBConnected) {
      aiSources.push({
        kind: "tone_match",
        note: `Tone matched against your last 3 emails to ${input.client.name}`,
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

    return { subject, body, aiSources };
  });
}

// -------- Mode E — cross-year insights --------

/**
 * Detects items that disappeared from the current year's checklist but
 * appeared in 2+ prior years. Mode E flagship use-case (PRD §4.3 Mode E).
 */
export function crossYearInsights(
  clientId: string,
  currentItems: ChecklistItem[],
  facts: ImportedFact[]
): Array<{ itemType: string; priorYears: number[]; detail: string }> {
  const currentTypes = new Set(currentItems.map((c) => c.itemType));
  const priorByType = new Map<string, Set<number>>();
  for (const f of facts) {
    if (f.clientId !== clientId) continue;
    if (!priorByType.has(f.itemType)) priorByType.set(f.itemType, new Set());
    priorByType.get(f.itemType)!.add(f.year);
  }
  const out: Array<{ itemType: string; priorYears: number[]; detail: string }> = [];
  for (const [type, yearSet] of priorByType) {
    if (currentTypes.has(type)) continue;
    if (yearSet.size < 2) continue;
    const years = Array.from(yearSet).sort();
    out.push({
      itemType: type,
      priorYears: years,
      detail: `${type.replace(/_/g, " ")} appeared in ${years.length} prior years (${years.join(", ")}) but not in this year's checklist.`,
    });
  }
  return out;
}
