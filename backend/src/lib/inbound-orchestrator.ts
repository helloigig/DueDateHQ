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
  /\.tax\.[a-z.]+$/i,
  /\bdor\.[a-z.]+$/i,
  /\bftb\.ca\.gov$/i,
  /\btreasury\.[a-z.]+$/i,
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
// LLM classifier hook — wire to Anthropic Claude / OpenAI when keys land.
//
// Per PRD §4.7 the LLM classifier is the production target; the heuristic
// above is the ship-today fallback for the eval set + dev experience.
// ════════════════════════════════════════════════════════════════════════

export async function classifyInboundLLM(
  email: InboundEmail,
  apiKey: string | undefined,
): Promise<ClassificationResult> {
  if (!apiKey) {
    // Graceful degradation: if no LLM key configured, fall back to heuristic.
    // Production: this branch should be unreachable. Dev/test: it's the
    // expected path until ANTHROPIC_API_KEY is set in env.
    return classifyInboundHeuristic(email);
  }
  // TODO(P0 follow-up): wire @anthropic-ai/sdk call here. Prompt template:
  //   - System: 7-class top-level taxonomy + 5 sub-intent taxonomy
  //   - User: from + subject + body excerpt + attachment metadata
  //   - JSON schema response: { topLevelClass, replyIntent?, confidence }
  // Eval set lives at backend/eval/inbound-classifier-v1.jsonl (NOT YET
  // CREATED — backend Phase 2 follow-up per `feedback_no_manual_file_shuffle`).
  return classifyInboundHeuristic(email);
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
