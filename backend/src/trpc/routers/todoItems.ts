/**
 * TodoItems router — computed virtual view per PRD §4.8 + IA v0.7 §3.1.
 *
 * TodoItem is NOT a stored row. This router aggregates from 9 underlying
 * sources (Modes A-F outputs + InboundReply intents + DeliveryEvent bounces +
 * manual TaskNote) into a single urgency-ranked feed for Today's action queue.
 *
 * Phase 1 connection (today): real wiring for the 5 sources currently in the
 * schema (checklistItems / emailDrafts / aiInferences / announcements via
 * announcement matches / activity manual notes). InboundReply + DeliveryEvent
 * sources stay as-mock until those tables ship in the v0.8 architecture
 * follow-up (PRD §17.2 row 27).
 *
 * urgency_score formula (PRD §4.8 v0.8 amendment):
 *   urgency = base_source_score
 *           × waiting_multiplier        ← gap-over-fill
 *           × deadline_proximity_factor
 *           × tier_weight
 *           + stuck_duration_bonus
 */

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import {
  aiInferences,
  announcementMatches,
  announcements,
  checklistItems,
  clients,
  deadlines,
  deliveryEvents,
  emailDrafts,
  firmAnnouncements,
  inboundReplies,
  tasks,
} from "../../db/schema.js";

type Verb = "Send" | "Confirm" | "Apply" | "Discuss";

// CPA-visible verbs collapse the 9 sources to 4 categories per IA §3.1.
// All known sources have a verb; unknown sources fall back to "Discuss" so
// the row still renders sanely instead of exploding.
const VERB_BY_SOURCE: Record<string, Verb> = {
  mode_a_inbound: "Confirm",
  mode_b_reminder_due: "Send",
  mode_c_anomaly: "Confirm",
  mode_d_draft_ready: "Send",
  mode_e_opportunity: "Discuss",
  mode_f_alert: "Apply",
  reply_pushback: "Discuss",
  reply_question: "Discuss",
  delivery_bounce: "Send",
  manual: "Discuss",
};
function verb(source: string): Verb {
  return VERB_BY_SOURCE[source] ?? "Discuss";
}

// Base urgency score per source (PRD §4.8). Unknown source → 30 (manual-tier).
const BASE_SCORE: Record<string, number> = {
  delivery_bounce: 95,
  reply_pushback: 90,
  mode_c_anomaly: 80,
  reply_question: 70,
  mode_d_draft_ready: 60,
  mode_b_reminder_due: 50,
  mode_a_inbound: 50,
  mode_f_alert: 100,
  mode_e_opportunity: 40,
  manual: 30,
};
function baseScore(source: string): number {
  return BASE_SCORE[source] ?? 30;
}

// Tier weight (Premium / Standard / Basic).
const TIER_WEIGHT: Record<string, number> = {
  premium: 1.5,
  standard: 1.0,
  basic: 0.7,
};

type TodoItem = {
  id: string;
  source: string;
  verb: "Send" | "Confirm" | "Apply" | "Discuss";
  client: string;
  clientId: string;
  task?: string;
  taskId?: string;
  dueDate?: string;
  action: string;
  context: string;
  stageLabel?: string;
  daysBehind?: number;
  urgency: "high" | "medium" | "normal";
  urgencyScore: number;
  surface:
    | "email_draft_modal"
    | "task_detail"
    | "alert_detail"
    | "opportunity_detail"
    | "bounce_modal";
};

function urgencyBucket(score: number): "high" | "medium" | "normal" {
  if (score >= 200) return "high";
  if (score >= 100) return "medium";
  return "normal";
}

function deadlineProximityFactor(dueDate: string | null | undefined): number {
  if (!dueDate) return 1;
  const ms = new Date(dueDate).getTime() - Date.now();
  const days = ms / (24 * 60 * 60 * 1000);
  if (days < 0) return 3; // overdue
  if (days < 7) return 2;
  if (days < 30) return 1.5;
  return 1;
}

function waitingMultiplierForChecklist(state: string, lastReminderAt: string | null): number {
  if (state === "requested_waiting") {
    if (!lastReminderAt) return 2.0;
    const days =
      (Date.now() - new Date(lastReminderAt).getTime()) / (24 * 60 * 60 * 1000);
    if (days > 7) return 2.5;
    if (days > 3) return 1.5;
    return 1.0;
  }
  if (state === "not_requested") {
    return 2.0; // T-21 hit (heuristic; real Mode B logic refines this)
  }
  return 1.0;
}

function stuckBonusForChecklist(lastReminderAt: string | null): number {
  if (!lastReminderAt) return 0;
  const days =
    (Date.now() - new Date(lastReminderAt).getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(0, days * 5);
}

export const todoItemsRouter = router({
  /**
   * Compute the unified TodoItem feed for the firm's action queue. Returns
   * already-ranked by urgency_score desc; frontend renders top N with
   * "show more" expansion.
   */
  list: firmProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const items: TodoItem[] = [];

      // ------- Source 1: Mode A inbound — checklistItems received_unreviewed
      // ------- Source 3: Mode C anomaly — checklistItems received_issue
      // ------- Source 2: Mode B reminder due — checklistItems requested_waiting / not_requested
      const checklistRows = await db
        .select({
          ci: checklistItems,
          task: tasks,
          deadline: deadlines,
          client: clients,
        })
        .from(checklistItems)
        .innerJoin(tasks, eq(checklistItems.taskId, tasks.id))
        .innerJoin(deadlines, eq(tasks.deadlineId, deadlines.id))
        .innerJoin(clients, eq(deadlines.clientId, clients.id))
        .where(
          and(
            eq(tasks.firmId, ctx.firmId),
            inArray(checklistItems.state, [
              "received_unreviewed",
              "received_issue",
              "requested_waiting",
              "not_requested",
            ]),
          ),
        );

      for (const row of checklistRows) {
        const tierWeight = TIER_WEIGHT[row.client.tier ?? "standard"] ?? 1;
        const dueDate = row.deadline.officialDueDate;
        const taskName = row.deadline.formType;
        const lastReminderIso = row.ci.lastReminderAt
          ? row.ci.lastReminderAt.toISOString()
          : null;

        if (row.ci.state === "received_issue") {
          const score =
            baseScore("mode_c_anomaly") *
              1.0 *
              deadlineProximityFactor(dueDate) *
              tierWeight;
          items.push({
            id: `mode_c-${row.ci.id}`,
            source: "mode_c_anomaly",
            verb: verb("mode_c_anomaly"),
            client: row.client.name,
            clientId: row.client.id,
            task: taskName,
            taskId: row.task.id,
            dueDate,
            action: `Resolve flag · ${row.ci.label}`,
            context: row.ci.aiFlagReason ?? "Mode C flagged anomaly — review before confirming",
            stageLabel: "Review",
            urgency: urgencyBucket(score),
            urgencyScore: Math.round(score),
            surface: "task_detail",
          });
        } else if (row.ci.state === "received_unreviewed") {
          const score =
            baseScore("mode_a_inbound") *
              1.0 *
              deadlineProximityFactor(dueDate) *
              tierWeight;
          items.push({
            id: `mode_a-${row.ci.id}`,
            source: "mode_a_inbound",
            verb: verb("mode_a_inbound"),
            client: row.client.name,
            clientId: row.client.id,
            task: taskName,
            taskId: row.task.id,
            dueDate,
            action: `Confirm ${row.ci.label}`,
            context: `AI confidence ${row.ci.aiConfidence ?? "—"} · received and waiting for your decision`,
            stageLabel: "Review",
            urgency: urgencyBucket(score),
            urgencyScore: Math.round(score),
            surface: "task_detail",
          });
        } else if (
          row.ci.state === "requested_waiting" ||
          row.ci.state === "not_requested"
        ) {
          const wm = waitingMultiplierForChecklist(row.ci.state, lastReminderIso);
          const stuck = stuckBonusForChecklist(lastReminderIso);
          const score =
            baseScore("mode_b_reminder_due") *
              wm *
              deadlineProximityFactor(dueDate) *
              tierWeight +
            stuck;
          const daysSinceReminder = lastReminderIso
            ? Math.floor(
                (Date.now() - new Date(lastReminderIso).getTime()) /
                  (24 * 60 * 60 * 1000),
              )
            : null;
          const reminderText = daysSinceReminder != null
            ? `last sent ${daysSinceReminder}d ago`
            : "not yet requested";
          items.push({
            id: `mode_b-${row.ci.id}`,
            source: "mode_b_reminder_due",
            verb: verb("mode_b_reminder_due"),
            client: row.client.name,
            clientId: row.client.id,
            task: taskName,
            taskId: row.task.id,
            dueDate,
            action: `Send reminder · ${row.ci.label}`,
            context: `${reminderText}${lastReminderIso ? " · draft ready" : ""}`,
            stageLabel: "Collect",
            daysBehind:
              daysSinceReminder != null && daysSinceReminder > 7
                ? daysSinceReminder
                : undefined,
            urgency: urgencyBucket(score),
            urgencyScore: Math.round(score),
            surface: "email_draft_modal",
          });
        }
      }

      // ------- Source 4: Mode D draft ready — emailDrafts in 'draft' state
      const draftRows = await db
        .select({
          draft: emailDrafts,
          task: tasks,
          deadline: deadlines,
          client: clients,
        })
        .from(emailDrafts)
        .innerJoin(tasks, eq(emailDrafts.taskId, tasks.id))
        .innerJoin(deadlines, eq(tasks.deadlineId, deadlines.id))
        .innerJoin(clients, eq(deadlines.clientId, clients.id))
        .where(
          and(
            eq(emailDrafts.firmId, ctx.firmId),
            eq(emailDrafts.status, "draft"),
          ),
        )
        .limit(20);

      for (const row of draftRows) {
        const tierWeight = TIER_WEIGHT[row.client.tier ?? "standard"] ?? 1;
        const dueDate = row.deadline.officialDueDate;
        const score =
          baseScore("mode_d_draft_ready") *
          1.0 *
          deadlineProximityFactor(dueDate) *
          tierWeight;
        items.push({
          id: `mode_d-${row.draft.id}`,
          source: "mode_d_draft_ready",
          verb: verb("mode_d_draft_ready"),
          client: row.client.name,
          clientId: row.client.id,
          task: row.deadline.formType,
          taskId: row.task.id,
          dueDate,
          action: `Review draft · ${row.draft.subject ?? "(untitled)"}`,
          context: `Mode D drafted ${row.draft.tone ?? "neutral"} tone · ready to send`,
          urgency: urgencyBucket(score),
          urgencyScore: Math.round(score),
          surface: "email_draft_modal",
        });
      }

      // ------- Source 6: Mode F alert — firm announcements not yet actioned.
      // "Actioned" means acknowledged or batch-adjusted (the two end-states
      // that close the loop). Dismissed-without-action also closes via
      // dismissedAt timestamp.
      const fAnnRows = await db
        .select({
          announcementId: firmAnnouncements.announcementId,
          firmId: firmAnnouncements.firmId,
          ann: announcements,
          matchCount: sql<number>`(SELECT count(*)::int FROM ${announcementMatches} am WHERE am.announcement_id = ${announcements.id} AND am.firm_id = ${firmAnnouncements.firmId})`,
        })
        .from(firmAnnouncements)
        .innerJoin(
          announcements,
          eq(firmAnnouncements.announcementId, announcements.id),
        )
        .where(
          and(
            eq(firmAnnouncements.firmId, ctx.firmId),
            isNull(firmAnnouncements.dismissedAt),
            isNull(firmAnnouncements.acknowledgedAt),
            isNull(firmAnnouncements.batchAdjustedAt),
          ),
        )
        .limit(20);

      for (const row of fAnnRows) {
        const matchCount = Number(row.matchCount ?? 0);
        if (matchCount === 0) continue; // zero-match alerts are silent (per PRD §1.7)
        const score =
          baseScore("mode_f_alert") * 1.0 * (matchCount > 5 ? 1.5 : 1.0);
        const issuedIso = row.ann.publishedAt
          ? row.ann.publishedAt.toISOString()
          : row.ann.detectedAt
            ? row.ann.detectedAt.toISOString()
            : null;
        items.push({
          id: `mode_f-${row.announcementId}`,
          source: "mode_f_alert",
          verb: verb("mode_f_alert"),
          client: matchCount === 1 ? "1 client" : `${matchCount} clients`,
          clientId: "", // batch action — no single client
          action: `Apply ${row.ann.title}`,
          context: `${row.ann.stateCode}: published ${formatRelative(issuedIso)} · matched on ${matchCount} client${matchCount === 1 ? "" : "s"}`,
          urgency: urgencyBucket(score),
          urgencyScore: Math.round(score),
          surface: "alert_detail",
        });
      }

      // ------- Source 5: Mode E opportunity — aiInferences mode='E' on
      // related_object_type='client', not yet actioned. (aiInferences uses
      // generic relatedObjectType + relatedObjectId rather than a client_id
      // column — schema decision per backend Phase 0.)
      const eRows = await db
        .select({
          inf: aiInferences,
          client: clients,
        })
        .from(aiInferences)
        .leftJoin(
          clients,
          and(
            eq(aiInferences.relatedObjectType, "client"),
            eq(aiInferences.relatedObjectId, clients.id),
          ),
        )
        .where(
          and(
            eq(aiInferences.firmId, ctx.firmId),
            eq(aiInferences.mode, "E"),
            isNull(aiInferences.wasActedOn),
          ),
        )
        .limit(15);

      for (const row of eRows) {
        if (!row.client) continue;
        const tierWeight = TIER_WEIGHT[row.client.tier ?? "standard"] ?? 1;
        const score = baseScore("mode_e_opportunity") * 1.0 * tierWeight;
        const out = (row.inf.output ?? {}) as { summary?: string };
        items.push({
          id: `mode_e-${row.inf.id}`,
          source: "mode_e_opportunity",
          verb: verb("mode_e_opportunity"),
          client: row.client.name,
          clientId: row.client.id,
          action: out.summary ?? "Cross-year insight detected",
          context: `Mode E confidence ${row.inf.confidence ?? "—"}`,
          urgency: urgencyBucket(score),
          urgencyScore: Math.round(score),
          surface: "opportunity_detail",
        });
      }

      // ------- Source 7-8: InboundReply intents (pushback / question) —
      // NEW in v0.8 amendment second wave. Requires CPA reply / decision.
      const intentRows = await db
        .select({
          ir: inboundReplies,
          task: tasks,
          deadline: deadlines,
          client: clients,
        })
        .from(inboundReplies)
        .leftJoin(tasks, eq(inboundReplies.taskId, tasks.id))
        .leftJoin(deadlines, eq(tasks.deadlineId, deadlines.id))
        .leftJoin(clients, eq(deadlines.clientId, clients.id))
        .where(
          and(
            eq(inboundReplies.firmId, ctx.firmId),
            isNull(inboundReplies.cpaActionedAt),
            inArray(inboundReplies.replyIntent, [
              "timeline_pushback",
              "question_asked",
            ]),
          ),
        )
        .limit(20);

      for (const row of intentRows) {
        if (!row.client) continue;
        const tierWeight = TIER_WEIGHT[row.client.tier ?? "standard"] ?? 1;
        const dueDate = row.deadline?.officialDueDate;
        const isPushback = row.ir.replyIntent === "timeline_pushback";
        const baseSource = isPushback ? "reply_pushback" : "reply_question";
        const score =
          baseScore(baseSource) *
          1.0 *
          deadlineProximityFactor(dueDate) *
          tierWeight;
        items.push({
          id: `intent-${row.ir.id}`,
          source: baseSource,
          verb: verb(baseSource),
          client: row.client.name,
          clientId: row.client.id,
          task: row.deadline?.formType,
          taskId: row.task?.id,
          dueDate,
          action: isPushback
            ? `Client says materials delayed · propose extension?`
            : `Client asked: ${(row.ir.bodyText ?? "").slice(0, 80)}…`,
          context: isPushback
            ? "InboundReply intent classifier flagged a timeline_pushback (§5.8) — needs CPA decision"
            : "Open Mode D draft to reply, or mark for follow-up",
          urgency: urgencyBucket(score),
          urgencyScore: Math.round(score),
          surface: isPushback ? "task_detail" : "email_draft_modal",
        });
      }

      // ------- Source 9: DeliveryEvent bounces — outbound failures the CPA
      // hasn't addressed yet (suppressedAt null). Bounces always surface
      // even if the email was sent days ago.
      const bounceRows = await db
        .select({
          ev: deliveryEvents,
          draft: emailDrafts,
          task: tasks,
          deadline: deadlines,
          client: clients,
        })
        .from(deliveryEvents)
        .innerJoin(
          emailDrafts,
          eq(deliveryEvents.emailDraftId, emailDrafts.id),
        )
        .innerJoin(tasks, eq(emailDrafts.taskId, tasks.id))
        .innerJoin(deadlines, eq(tasks.deadlineId, deadlines.id))
        .innerJoin(clients, eq(deadlines.clientId, clients.id))
        .where(
          and(
            eq(deliveryEvents.firmId, ctx.firmId),
            inArray(deliveryEvents.eventType, ["bounced", "complained"]),
            isNull(deliveryEvents.suppressedAt),
          ),
        )
        .limit(20);

      for (const row of bounceRows) {
        const tierWeight = TIER_WEIGHT[row.client.tier ?? "standard"] ?? 1;
        const dueDate = row.deadline.officialDueDate;
        const score =
          baseScore("delivery_bounce") *
          1.0 *
          deadlineProximityFactor(dueDate) *
          tierWeight;
        items.push({
          id: `bounce-${row.ev.id}`,
          source: "delivery_bounce",
          verb: verb("delivery_bounce"),
          client: row.client.name,
          clientId: row.client.id,
          task: row.deadline.formType,
          taskId: row.task.id,
          dueDate,
          action: `Reminder bounced — fix address`,
          context: `${row.draft.toAddress} · reason: ${row.ev.bounceReason ?? "unknown"} · ${formatRelative(row.ev.eventAt?.toISOString() ?? null)}`,
          urgency: urgencyBucket(score),
          urgencyScore: Math.round(score),
          surface: "bounce_modal",
        });
      }

      // Sort by urgency desc and trim
      items.sort((a, b) => b.urgencyScore - a.urgencyScore);
      const trimmed = items.slice(0, limit);

      return {
        items: trimmed,
        total: items.length,
        // v0.8 amendment Phase 2 backend: all 9 sources now wired against
        // real tables. The original "sourcesPending" was for Phase 1 only.
        sourcesPending: [],
      };
    }),
});

function formatRelative(iso: string | null): string {
  if (!iso) return "recently";
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
