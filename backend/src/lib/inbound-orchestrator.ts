/**
 * Inbound Orchestrator — per PRD §3.5 + §4.3 Mode A + §5.8.
 *
 * Runs the 7-class top-level inbound classifier on every email arriving via
 * Method A SES forward or Method B OAuth pull. When class = client_reply_intent,
 * runs the 5-sub-intent classifier (per §5.8). Routes to:
 *   - client_document      → ChecklistItem.sourceReferences[] add (Mode A
 *                            applied to inbound). If Mode A confidence < 0.7,
 *                            falls back to Task.unmatched_inbound (modeled as
 *                            an InboundReply with taskId=null pending CPA review).
 *   - client_reply_intent  → InboundReply with replyIntent set; routed to To
 *                            Do per intent.
 *   - agency_correspondence → high-priority TodoItem (IRS notice, e-file
 *                              rejection, etc.).
 *   - third_party_data     → ChecklistItem.sourceReferences[] add (W-2 from
 *                            ADP, 1099 from issuer, K-1 from fund manager).
 *   - payment_confirm      → activity event on related task; no money movement.
 *   - vendor_notification  → low-priority log.
 *   - spam                 → quiet archive.
 *
 * v0.8 phase: heuristic classifier ships today. LLM-backed classifier hooks
 * the same interface (`classifyInbound`) — swap implementation when the LLM
 * key is provisioned. Per PRD §4.7 the eval target is ≥ 92% precision on
 * the 7-class top-level + ≥ 90% on the 5 sub-intents (≤ 3% false-positive
 * on `timeline_pushback` specifically — extension proposals are high-cost
 * trust failures).
 */

import type {
  InboundReplyInsert,
} from "../db/schema.js";
import { callLLM, HAIKU_MODEL, isAiConfigured } from "./ai.js";
import { log } from "./observability.js";

export type InboundEmail = {
  gmailMessageId: string;
  fromAddress: string;
  toAddress: string;
  subject?: string;
  bodyText?: string;
  attachmentMetadata: Array<{
    filename: string;
    mimeType?: string;
    size?: number;
    attachmentIndex: number;
  }>;
};

export type ClassificationResult = {
  topLevelClass:
    | "client_document"
    | "client_reply_intent"
    | "agency_correspondence"
    | "third_party_data"
    | "payment_confirm"
    | "vendor_notification"
    | "spam";
  replyIntent?:
    | "document_provided"
    | "timeline_pushback"
    | "question_asked"
    | "off_topic"
    | "mismatched_attachment"
    | "acknowledgment";
  confidence: number; // 0..1
  suggestedAction?: Record<string, unknown>;
};

// ════════════════════════════════════════════════════════════════════════
// Heuristic classifier — v0.8 ship-today fallback.
//
// Uses domain regex + simple keyword matches. NOT a substitute for the
// LLM-backed classifier (PRD §4.7 eval target ≥ 92% precision); it gives
// a sane default until `classifyInboundLLM` is wired with API keys.
// ════════════════════════════════════════════════════════════════════════

const AGENCY_DOMAIN_PATTERNS = [
  /\birs\.gov$/i,
  // (^|\.) anchor so both `tax.ny.gov` (where `tax` is the first segment)
  // and `subdomain.tax.something.gov` match. Earlier `\.tax\.` required a
  // preceding dot, missing all NY/CA/etc. state authority direct sends.
  // Surfaced by inbound-classifier-v1.jsonl example 012 (NY DTF notice).
  /(?:^|\.)tax\.[a-z.]+$/i,
  /(?:^|\.)dor\.[a-z.]+$/i,
  /\bftb\.ca\.gov$/i,
  /(?:^|\.)treasury\.[a-z.]+$/i,
  /(?:^|\.)taxation\.[a-z.]+$/i,
  /(?:^|\.)revenue\.[a-z.]+$/i,
];
const PAYMENT_DOMAIN_PATTERNS = [
  /^stripe\.com$/i,
  /^cpacharge\.com$/i,
  /^paypal\.com$/i,
  /^square\.com$/i,
  /^venmo\.com$/i,
];
const THIRD_PARTY_ISSUER_PATTERNS = [
  /^adp\.com$/i,
  /^paychex\.com$/i,
  /^gusto\.com$/i,
  /^fidelity\.com$/i,
  /^vanguard\.com$/i,
  /^schwab\.com$/i,
];
const VENDOR_DOMAIN_PATTERNS = [
  /^quickbooks\.intuit\.com$/i,
  /^xero\.com$/i,
  /^sharepoint\.com$/i,
];
const SPAM_KEYWORDS = [
  /unsubscribe.*click here/i,
  /viagra/i,
  /lottery winner/i,
];
const PUSHBACK_PATTERNS = [
  /\bnot ready\b/i,
  /\bcan you extend\b/i,
  /\bextension\b/i,
  /\bdelay\b/i,
  /\b(later|next week|next month|by july)\b/i,
];
const QUESTION_PATTERNS = [/\?\s*$/m, /^(can|could|how|what|when|where|why|is|are)\b/im];
const ACK_PATTERNS = [
  /^(thanks|got it|received|confirmed|will do)/i,
  /^(thank you|appreciated)/i,
];
const VACATION_PATTERNS = [
  /out of office/i,
  /auto-reply/i,
  /currently on vacation/i,
];

function domain(addr: string): string {
  const at = addr.lastIndexOf("@");
  return at >= 0 ? addr.slice(at + 1).toLowerCase() : addr.toLowerCase();
}

export function classifyInboundHeuristic(
  email: InboundEmail,
): ClassificationResult {
  const fromDomain = domain(email.fromAddress);
  const body = email.bodyText ?? "";
  const subject = email.subject ?? "";
  const hasAttachment = email.attachmentMetadata.length > 0;

  // Spam first — cheapest prune.
  if (SPAM_KEYWORDS.some((p) => p.test(body) || p.test(subject))) {
    return { topLevelClass: "spam", confidence: 0.95 };
  }

  // Vendor notifications (our integrations + SaaS we depend on).
  if (VENDOR_DOMAIN_PATTERNS.some((p) => p.test(fromDomain))) {
    return { topLevelClass: "vendor_notification", confidence: 0.9 };
  }

  // Payment confirmations.
  if (PAYMENT_DOMAIN_PATTERNS.some((p) => p.test(fromDomain))) {
    return {
      topLevelClass: "payment_confirm",
      confidence: 0.92,
      suggestedAction: {
        action: "log_payment_activity",
        sourceProvider: fromDomain,
      },
    };
  }

  // Agency correspondence (IRS / state DOR / etc.).
  if (AGENCY_DOMAIN_PATTERNS.some((p) => p.test(fromDomain))) {
    return {
      topLevelClass: "agency_correspondence",
      confidence: 0.93,
      suggestedAction: {
        urgency: "high",
        review_required: true,
      },
    };
  }

  // Third-party data (W-2 from issuer, K-1 from fund, 1099 from broker).
  // Signal: sender is an issuer domain AND there's an attachment.
  if (
    hasAttachment &&
    THIRD_PARTY_ISSUER_PATTERNS.some((p) => p.test(fromDomain))
  ) {
    return {
      topLevelClass: "third_party_data",
      confidence: 0.88,
      suggestedAction: {
        action: "match_to_checklist",
      },
    };
  }

  // Client correspondence — default branch. Sub-classify intent.
  if (hasAttachment && !PUSHBACK_PATTERNS.some((p) => p.test(body))) {
    return {
      topLevelClass: "client_document",
      confidence: 0.8,
      suggestedAction: {
        action: "match_to_checklist",
      },
    };
  }

  // Reply intent sub-classifier (5 + ack)
  if (VACATION_PATTERNS.some((p) => p.test(body))) {
    return {
      topLevelClass: "client_reply_intent",
      replyIntent: "off_topic",
      confidence: 0.95,
    };
  }
  if (PUSHBACK_PATTERNS.some((p) => p.test(body))) {
    return {
      topLevelClass: "client_reply_intent",
      replyIntent: "timeline_pushback",
      confidence: 0.78,
      suggestedAction: {
        action: "propose_extension",
      },
    };
  }
  if (QUESTION_PATTERNS.some((p) => p.test(body))) {
    return {
      topLevelClass: "client_reply_intent",
      replyIntent: "question_asked",
      confidence: 0.82,
      suggestedAction: {
        action: "draft_reply",
      },
    };
  }
  if (
    !hasAttachment &&
    ACK_PATTERNS.some((p) => p.test(body.trim().slice(0, 80)))
  ) {
    return {
      topLevelClass: "client_reply_intent",
      replyIntent: "acknowledgment",
      confidence: 0.85,
    };
  }
  if (hasAttachment) {
    // Fell through: had attachment but pushback markers fired. Treat as
    // mismatched per §5.8 — needs CPA review.
    return {
      topLevelClass: "client_reply_intent",
      replyIntent: "mismatched_attachment",
      confidence: 0.6,
    };
  }

  // Last resort: off-topic.
  return {
    topLevelClass: "client_reply_intent",
    replyIntent: "off_topic",
    confidence: 0.5,
  };
}

// ════════════════════════════════════════════════════════════════════════
// LLM classifier — Mode A 7-class top-level + 5-intent sub-classifier.
//
// Per PRD §4.7 this is the production target — eval target ≥ 92% precision
// on the 7-class top-level + ≥ 90% on the 5 sub-intents (≤ 3% false-positive
// on `timeline_pushback` specifically — extension proposals are high-cost
// CPA-trust failures).
//
// The heuristic above remains as the fallback path: when ANTHROPIC_API_KEY
// is missing, the LLM call fails to parse, or the LLM throws. Dev runs
// without a key continue to work (heuristic 7-class returns sensible defaults).
// ════════════════════════════════════════════════════════════════════════

const INBOUND_SYSTEM_PROMPT = `You classify inbound emails for a CPA workflow tool. Every email arriving at a per-task forwarding address (Method A) or via the CPA's own Gmail/Outlook (Method B) flows through you.

Step 1 — assign ONE top-level class from the 7-class taxonomy:

| Class | Definition |
|---|---|
| client_document | Client sent us a tax document (W-2, 1099, K-1, prior return, receipt PDF). Must have an attachment AND text affirming the doc ("here's my W-2", "attached the K-1"). |
| client_reply_intent | Client is communicating but did NOT send a clean document — pushback, question, vacation reply, off-topic. May have an attachment that's wrong/mismatched. |
| agency_correspondence | IRS, state DOR, Treasury notice — high priority, official tax authority. Sender domain = irs.gov / *.tax.* / *.dor.* / ftb.ca.gov / treasury.* etc. |
| third_party_data | Document from issuer (W-2 from ADP, 1099 from broker, K-1 from fund manager). Sender = adp/paychex/gusto/fidelity/vanguard/schwab. Has attachment. |
| payment_confirm | Payment confirmation receipt (Stripe/CPACharge/PayPal/Square/Venmo). NOT money movement — just notifications. |
| vendor_notification | SaaS vendor email (QuickBooks/Xero/SharePoint admin). Low priority. |
| spam | Marketing, phishing, scam. Quiet-archive. |

Step 2 — IF AND ONLY IF topLevelClass = "client_reply_intent", assign one of 5 sub-intents:

| Intent | Signal |
|---|---|
| document_provided | Attachment + text affirms ("here's my W-2"). |
| timeline_pushback | Client wants to delay ("not ready until July", "can you extend?"). HIGH BAR — only fire if explicit. False-positive cost is severe (auto-extension proposal). |
| question_asked | Contains a question + no attachment. |
| off_topic | Vacation reply, autoresponder, generic chat. |
| mismatched_attachment | Has attachment but wrong year/type/client. |
| acknowledgment | "thanks", "got it", "confirmed". No attachment, no question. |

Confidence calibration:
- 0.90+ = unambiguous (clear domain + clear text + clear attachment status)
- 0.70-0.89 = strong signal but some ambiguity
- 0.50-0.69 = uncertain — surface for CPA review
- below 0.50 = guess; CPA should treat as unmatched

Output STRICT JSON only, no preamble:
{
  "topLevelClass": "<one of the 7>",
  "replyIntent": "<one of the 5 OR null if topLevelClass != client_reply_intent>",
  "confidence": <0.0-1.0>,
  "suggestedAction": <object or null — populate per below>
}

suggestedAction by class:
- agency_correspondence → { "urgency": "high", "review_required": true }
- payment_confirm → { "action": "log_payment_activity", "sourceProvider": "<domain>" }
- third_party_data → { "action": "match_to_checklist" }
- client_document → { "action": "match_to_checklist" }
- client_reply_intent + timeline_pushback → { "action": "propose_extension" }
- client_reply_intent + question_asked → { "action": "draft_reply" }
- otherwise null`;

const TOP_LEVEL_CLASSES = new Set<ClassificationResult["topLevelClass"]>([
  "client_document",
  "client_reply_intent",
  "agency_correspondence",
  "third_party_data",
  "payment_confirm",
  "vendor_notification",
  "spam",
]);

const REPLY_INTENTS = new Set<NonNullable<ClassificationResult["replyIntent"]>>([
  "document_provided",
  "timeline_pushback",
  "question_asked",
  "off_topic",
  "mismatched_attachment",
  "acknowledgment",
]);

/**
 * Real LLM-backed classifier. Calls Haiku 4.5 with a structured-output
 * prompt. Falls back to the heuristic on:
 *   - no API key configured (dev environments without ANTHROPIC_API_KEY)
 *   - LLM call throws (transport error / rate limit / model outage)
 *   - LLM returns text that doesn't parse as the expected JSON shape
 *   - LLM returns class/intent values outside the taxonomy
 *
 * Caller passes firmId so per-call cost + latency lands in ai_inferences
 * for offline eval (PRD §4.7 acceptance-rate measurement).
 */
export async function classifyInboundLLM(
  email: InboundEmail,
  opts: { firmId: string },
): Promise<ClassificationResult> {
  if (!isAiConfigured()) {
    return classifyInboundHeuristic(email);
  }

  // User prompt — compact JSON of the email metadata + a body excerpt.
  // Body capped at ~3KB to stay well under Haiku context + cost. Strip
  // base64/quoted-printable noise to keep the model focused on signal.
  const bodyExcerpt = (email.bodyText ?? "")
    .replace(/=\r?\n/g, "") // soft-wraps from quoted-printable
    .slice(0, 3000);
  const userPrompt = JSON.stringify({
    from: email.fromAddress,
    to: email.toAddress,
    subject: email.subject ?? "",
    bodyExcerpt,
    attachmentCount: email.attachmentMetadata.length,
    attachmentSummary: email.attachmentMetadata.slice(0, 5).map((a) => ({
      filename: a.filename,
      mimeType: a.mimeType ?? "unknown",
      sizeKb: a.size ? Math.round(a.size / 1024) : null,
    })),
  });

  try {
    const { text } = await callLLM({
      firmId: opts.firmId,
      mode: "A", // Per PRD §4.3, the inbound classifier IS Mode A's primary application
      model: HAIKU_MODEL,
      systemPrompt: INBOUND_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 512,
      context: {
        gmailMessageId: email.gmailMessageId,
        fromDomain: domain(email.fromAddress),
        hasAttachment: email.attachmentMetadata.length > 0,
      },
    });

    const parsed = parseLLMResponse(text);
    if (!parsed) {
      log.warn("inbound_classifier.llm_parse_failed_fallback_to_heuristic", {
        gmailMessageId: email.gmailMessageId,
        textPreview: text.slice(0, 200),
      });
      return classifyInboundHeuristic(email);
    }
    return parsed;
  } catch (err) {
    log.warn("inbound_classifier.llm_throw_fallback_to_heuristic", {
      gmailMessageId: email.gmailMessageId,
      message: err instanceof Error ? err.message : String(err),
    });
    return classifyInboundHeuristic(email);
  }
}

function parseLLMResponse(text: string): ClassificationResult | null {
  // Try direct JSON parse first; some models wrap in ```json fences which
  // we strip when present. The system prompt says "no preamble" but we
  // defend against drift.
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  const topLevelClass = obj.topLevelClass as ClassificationResult["topLevelClass"];
  if (!TOP_LEVEL_CLASSES.has(topLevelClass)) return null;

  const replyIntentRaw = obj.replyIntent;
  let replyIntent: ClassificationResult["replyIntent"];
  if (
    topLevelClass === "client_reply_intent" &&
    typeof replyIntentRaw === "string" &&
    REPLY_INTENTS.has(replyIntentRaw as NonNullable<ClassificationResult["replyIntent"]>)
  ) {
    replyIntent = replyIntentRaw as ClassificationResult["replyIntent"];
  } else {
    replyIntent = undefined;
  }

  // Confidence: clamp to [0, 1], reject NaN. Guard against the model
  // returning "high"/"medium"/"low" by accident — convert to numeric.
  let confidence: number;
  if (typeof obj.confidence === "number" && Number.isFinite(obj.confidence)) {
    confidence = Math.max(0, Math.min(1, obj.confidence));
  } else if (typeof obj.confidence === "string") {
    const map: Record<string, number> = { high: 0.9, medium: 0.7, low: 0.5 };
    confidence = map[obj.confidence.toLowerCase()] ?? 0.5;
  } else {
    return null;
  }

  const suggestedAction =
    obj.suggestedAction && typeof obj.suggestedAction === "object"
      ? (obj.suggestedAction as Record<string, unknown>)
      : undefined;

  return {
    topLevelClass,
    replyIntent,
    confidence,
    suggestedAction,
  };
}

/**
 * Persist an inbound email into the InboundReplies table after classification.
 * The bytes never live with us — just the gmail_message_id pointer + extracted
 * text + classification result.
 */
export function buildInboundReplyInsert(
  firmId: string,
  email: InboundEmail,
  classification: ClassificationResult,
): InboundReplyInsert {
  return {
    firmId,
    taskId: null, // null until matched to a task by Mode A inbound classifier
    gmailMessageId: email.gmailMessageId,
    fromAddress: email.fromAddress,
    toAddress: email.toAddress,
    subject: email.subject ?? null,
    bodyText: email.bodyText ?? null,
    attachmentMetadata: email.attachmentMetadata,
    topLevelClass: classification.topLevelClass,
    replyIntent: classification.replyIntent ?? null,
    intentConfidence: classification.confidence.toFixed(2),
    suggestedAction: classification.suggestedAction ?? null,
    classifiedAt: new Date(),
  };
}
