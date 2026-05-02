/**
 * Mode E talking-points generator for pte_change planning calls.
 *
 * Spec: docs/specs/alert-detail-pte-change.md
 *
 * V1: pure template-based generator (no LLM call). Personalizes 3–5 bullet
 * points per (alert, client) tuple using the alert metadata + client's PTE
 * status + entity type.
 *
 * V2 (P1): swap the template path for a Claude Haiku call when
 * ANTHROPIC_API_KEY is present. Same return shape; provider is the
 * implementation detail. Until then, the template path produces "good
 * enough for a first version" copy that already beats no copy.
 *
 * Use:
 *   const points = generatePteTalkingPoints({
 *     announcement, client, election: client.pteEligibilityStatus
 *   });
 */
import type { Announcement, Client } from "../db/schema.js";

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
 * Generate the talking points list for a (alert, client) tuple.
 *
 * Always includes 1 "intent" + 1 "impact" point. Conditionally includes
 * deadline / estimate timing / owner credit / election pitch points based
 * on client status + alert metadata.
 *
 * Returns 3–5 points typically (capped at 5).
 */
export function generatePteTalkingPoints(
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
