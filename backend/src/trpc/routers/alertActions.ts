/**
 * alertActions router — backend procedures for the 5 non-disaster alertType
 * action surfaces:
 *
 *   penalty_relief → tagClientsForRelief, markTagApplied, untag
 *   pte_change     → schedulePlanningCalls, markPlanningCallCompleted
 *   rate_change    → recomputeEstimates, undoRecomputeEstimates
 *   nexus_change   → runNexusCheck, addNexusFilings, markFilingsProtective,
 *                    getNexusQuestionnaire
 *
 * Companion specs: docs/specs/alert-detail-{variant}.md
 *
 * All procedures are firm-scoped via firmProcedure → ctx.firmId. Action
 * mutations write to activity_events for the audit log (TODO: wire up
 * the activity_events router once it ships in this repo).
 *
 * Disaster_extension lives in announcementsRouter (existing) since the
 * batch deadline mutation predates this work.
 */
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import {
  announcements,
  clients,
  clientStateNexus,
  clientTags,
  deadlines,
  nexusQuestionnaireRuns,
  planningCalls,
} from "../../db/schema.js";
import {
  getNexusRules,
  type NexusKind,
  type SuggestedFiling,
} from "../../lib/nexus-rules.js";
import {
  generatePteTalkingPoints,
  pointsToJson,
} from "../../lib/talking-points-generator.js";
import {
  getRateSchedule,
  recomputeEstimate,
} from "../../lib/estimate-calculator.js";

// In-memory undo token store. In production this would be a short-lived
// row in `undo_tokens` table or a Redis key with TTL. Keeping in-memory
// for V1 — undo windows are 5 min so any restart invalidates them, which
// is fine.
const undoTokens = new Map<
  string,
  { firmId: string; restore: Array<{ deadlineId: string; amountCents: number }>; expiresAt: number }
>();
const UNDO_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function makeUndoToken(): string {
  return `undo_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function purgeExpiredUndoTokens(): void {
  const now = Date.now();
  for (const [k, v] of undoTokens) {
    if (v.expiresAt < now) undoTokens.delete(k);
  }
}

export const alertActionsRouter = router({
  // ─── penalty_relief ─────────────────────────────────────────────────────

  /**
   * Tag selected clients for filing-time review of a penalty relief.
   * Idempotent: re-tagging a client for the same alert is a no-op.
   * Returns: count of new tags + count of duplicates skipped.
   */
  tagClientsForRelief: firmProcedure
    .input(
      z.object({
        announcementId: z.string().uuid(),
        clientIds: z.array(z.string().uuid()).min(1).max(500),
        expiresAt: z.string().datetime().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify announcement exists.
      const ann = await db.query.announcements.findFirst({
        where: eq(announcements.id, input.announcementId),
      });
      if (!ann) {
        throw new TRPCError({ code: "NOT_FOUND", message: "alert not found" });
      }
      // Verify all clients belong to this firm.
      const clientRows = await db
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.firmId, ctx.firmId),
            inArray(clients.id, input.clientIds),
          ),
        );
      if (clientRows.length !== input.clientIds.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "one or more clients not found in your firm",
        });
      }
      // Pre-render tag text (mirrors BatchTagModal's preview).
      const noticeRef = ann.authority;
      const expiry = input.expiresAt
        ? `Expires ${new Date(input.expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`
        : "Retroactive (no expiry)";
      // Skip duplicates: any active tag for this (client, alert) already.
      const existingTags = await db
        .select()
        .from(clientTags)
        .where(
          and(
            eq(clientTags.firmId, ctx.firmId),
            eq(clientTags.alertId, input.announcementId),
            inArray(clientTags.clientId, input.clientIds),
            eq(clientTags.status, "active"),
          ),
        );
      const dupClientIds = new Set(existingTags.map((t) => t.clientId));
      const toInsert = clientRows
        .filter((c) => !dupClientIds.has(c.id))
        .map((c) => {
          const filing =
            c.entityType === "Individual" ? "1040 filing" :
            c.entityType === "S-Corp" ? "1120-S filing" :
            c.entityType === "C-Corp" ? "1120 filing" :
            c.entityType === "Partnership" ? "1065 filing" :
            c.entityType === "Trust" ? "1041 filing" :
            "applicable filing";
          return {
            firmId: ctx.firmId,
            clientId: c.id,
            alertId: input.announcementId,
            kind: "penalty_relief" as const,
            tagText: `Penalty relief (${noticeRef}) — apply at next ${filing}. ${expiry}.`,
            tagContext: ann.summary,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            status: "active" as const,
            createdBy: ctx.dbUser.id,
          };
        });
      if (toInsert.length === 0) {
        return {
          taggedCount: 0,
          duplicateCount: dupClientIds.size,
          failedCount: 0,
        };
      }
      await db.insert(clientTags).values(toInsert);
      return {
        taggedCount: toInsert.length,
        duplicateCount: dupClientIds.size,
        failedCount: 0,
      };
    }),

  /**
   * Mark a tag as applied at filing time (called from TaskDetail's
   * "claim relief" button).
   */
  markTagApplied: firmProcedure
    .input(
      z.object({
        tagId: z.string().uuid(),
        taskId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(clientTags)
        .set({
          appliedAt: new Date(),
          appliedInTaskId: input.taskId ?? null,
          status: "applied",
        })
        .where(
          and(
            eq(clientTags.id, input.tagId),
            eq(clientTags.firmId, ctx.firmId),
          ),
        )
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "tag not found" });
      }
      return { ok: true as const, appliedAt: updated.appliedAt?.toISOString() };
    }),

  /** Manual untag with required reason. */
  untag: firmProcedure
    .input(
      z.object({
        tagId: z.string().uuid(),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(clientTags)
        .set({
          status: "removed",
          removedAt: new Date(),
          removedReason: input.reason,
        })
        .where(
          and(
            eq(clientTags.id, input.tagId),
            eq(clientTags.firmId, ctx.firmId),
          ),
        )
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return { ok: true as const };
    }),

  // ─── pte_change ─────────────────────────────────────────────────────────

  /**
   * Schedule planning calls for selected clients. Creates planning_calls
   * rows + queues TodoItems on Today (TODO: wire to todoItems router once
   * the public API surface for "create one-off TodoItem" lands).
   */
  schedulePlanningCalls: firmProcedure
    .input(
      z.object({
        announcementId: z.string().uuid(),
        clientIds: z.array(z.string().uuid()).min(1).max(500),
        suggestedWindow: z.enum(["this_week", "next_2_weeks", "before_deadline"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ann = await db.query.announcements.findFirst({
        where: eq(announcements.id, input.announcementId),
      });
      if (!ann) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const clientRows = await db
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.firmId, ctx.firmId),
            inArray(clients.id, input.clientIds),
          ),
        );
      if (clientRows.length !== input.clientIds.length) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // Compute suggested window.
      const today = new Date();
      const start = new Date(today);
      const end = new Date(today);
      if (input.suggestedWindow === "this_week") {
        end.setDate(today.getDate() + 7);
      } else if (input.suggestedWindow === "next_2_weeks") {
        end.setDate(today.getDate() + 14);
      } else {
        // before_deadline — window ends at announcement.effectiveDate
        if (ann.effectiveDate) {
          end.setTime(new Date(ann.effectiveDate).getTime());
        } else {
          end.setDate(today.getDate() + 30);
        }
      }
      // Generate per-client talking points. LLM-backed when
      // ANTHROPIC_API_KEY is set; template-based fallback otherwise.
      // Concurrent fanout — Haiku handles bursts fine, and a 50-client
      // batch finishes in ~2s instead of 50× sequential ~600ms each.
      const allPoints = await Promise.all(
        clientRows.map((c) =>
          generatePteTalkingPoints({ announcement: ann, client: c }),
        ),
      );
      const toInsert = clientRows.map((c, i) => ({
        firmId: ctx.firmId,
        clientId: c.id,
        alertId: input.announcementId,
        topic: "pte_strategy" as const,
        talkingPointsJson: pointsToJson(allPoints[i] ?? []),
        suggestedWindowStart: start.toISOString().slice(0, 10),
        suggestedWindowEnd: end.toISOString().slice(0, 10),
        status: "proposed" as const,
        createdBy: ctx.dbUser.id,
      }));
      const inserted = await db
        .insert(planningCalls)
        .values(toInsert)
        .returning({ id: planningCalls.id });
      return {
        callsCreated: inserted.length,
        // TODO when todoItems router exposes a "create" mutation, fan out
        // here so each call appears on Today as a "schedule call with X"
        // TodoItem. Currently the call is reachable via /clients/:id but
        // doesn't auto-bubble to Today.
        todoItemsAdded: 0,
      };
    }),

  /** Mark a scheduled planning call as completed with an outcome. */
  markPlanningCallCompleted: firmProcedure
    .input(
      z.object({
        callId: z.string().uuid(),
        outcome: z.enum([
          "renewed",
          "revoked",
          "opted_in",
          "deferred",
          "no_change",
        ]),
        notes: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(planningCalls)
        .set({
          status: "completed",
          completedAt: new Date(),
          outcome: input.outcome,
          outcomeNotes: input.notes ?? null,
        })
        .where(
          and(
            eq(planningCalls.id, input.callId),
            eq(planningCalls.firmId, ctx.firmId),
          ),
        )
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return { ok: true as const };
    }),

  // ─── rate_change ────────────────────────────────────────────────────────

  /**
   * Recompute estimate amounts using the estimate-calculator library.
   * Mutates deadlines.amount_cents in a transaction; populates
   * original_amount_cents so undo can restore. Returns an undo token
   * valid for 5 minutes.
   */
  recomputeEstimates: firmProcedure
    .input(
      z.object({
        announcementId: z.string().uuid(),
        selections: z.array(
          z.object({
            deadlineId: z.string().uuid(),
            // Optional override — when present, skip the calculator and
            // apply this amount directly. Used by FE for "I disagree, set
            // it to $X" flow.
            overrideAmountCents: z.number().int().nonnegative().optional(),
          }),
        ),
        ruleJurisdiction: z.enum([
          "federal",
          "CA",
          "NY",
          "NJ",
          "MA",
          "IL",
          "AZ",
        ]),
        ruleTaxYear: z.number().int().min(2024).max(2030),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ann = await db.query.announcements.findFirst({
        where: eq(announcements.id, input.announcementId),
      });
      if (!ann) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const oldRule = getRateSchedule(input.ruleJurisdiction, input.ruleTaxYear - 1);
      const newRule = getRateSchedule(input.ruleJurisdiction, input.ruleTaxYear);
      if (!oldRule || !newRule) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No rate schedule for ${input.ruleJurisdiction} ${input.ruleTaxYear}`,
        });
      }
      const restore: Array<{ deadlineId: string; amountCents: number }> = [];
      let recomputedCount = 0;
      // Per-deadline transaction work. For V1 we don't open an explicit
      // BEGIN — drizzle's per-statement isolation is enough since each
      // deadline update is independent.
      for (const sel of input.selections) {
        const deadline = await db.query.deadlines.findFirst({
          where: and(
            eq(deadlines.id, sel.deadlineId),
            eq(deadlines.firmId, ctx.firmId),
          ),
        });
        if (!deadline) continue;
        if (sel.overrideAmountCents !== undefined) {
          restore.push({
            deadlineId: deadline.id,
            amountCents: deadline.amountCents ?? 0,
          });
          await db
            .update(deadlines)
            .set({
              amountCents: sel.overrideAmountCents,
              originalAmountCents: deadline.originalAmountCents ??
                deadline.amountCents,
              estimateMethod: "manual",
            })
            .where(eq(deadlines.id, deadline.id));
          recomputedCount += 1;
          continue;
        }
        // Run calculator.
        const client = await db.query.clients.findFirst({
          where: eq(clients.id, deadline.clientId),
        });
        if (!client) continue;
        const result = recomputeEstimate({
          deadlineId: deadline.id,
          currentAmountCents: deadline.amountCents ?? 0,
          period: deadline.period,
          oldRule,
          newRule,
          client: {
            // Estimated AGI — V1 uses a placeholder. V2 reads from
            // imported_facts (prior-year actual) or QBO sync.
            estimatedAgiCents:
              (client.estimatedStateRevenueJsonb as Record<string, number>)?.[ann.stateCode] ??
              30000000, // $300K default
            fiscalYearEndMonth: 12,
            hasLossCarryforward: false,
            isOnPaymentPlan: false,
          },
          alreadyPaid: false,
        });
        restore.push({
          deadlineId: deadline.id,
          amountCents: deadline.amountCents ?? 0,
        });
        await db
          .update(deadlines)
          .set({
            amountCents: result.newAmountCents,
            originalAmountCents:
              deadline.originalAmountCents ?? deadline.amountCents,
            estimateMethod: result.methodology,
          })
          .where(eq(deadlines.id, deadline.id));
        recomputedCount += 1;
      }
      // Issue undo token.
      purgeExpiredUndoTokens();
      const token = makeUndoToken();
      undoTokens.set(token, {
        firmId: ctx.firmId,
        restore,
        expiresAt: Date.now() + UNDO_WINDOW_MS,
      });
      // Count auto-pay clients (for FE flash banner messaging).
      const autopayCount = await db.$count(
        clients,
        and(
          eq(clients.firmId, ctx.firmId),
          inArray(
            clients.id,
            (await db.select({ id: deadlines.clientId })
              .from(deadlines)
              .where(inArray(deadlines.id, restore.map((r) => r.deadlineId)))
            ).map((r) => r.id),
          ),
          eq(clients.estimateAutopay, true),
        ),
      );
      return {
        recomputedCount,
        bankUpdateTodos: autopayCount,
        undoToken: token,
        expiresAt: new Date(Date.now() + UNDO_WINDOW_MS).toISOString(),
      };
    }),

  /** Undo a recompute within the 5-minute window. Idempotent. */
  undoRecomputeEstimates: firmProcedure
    .input(z.object({ undoToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      purgeExpiredUndoTokens();
      const token = undoTokens.get(input.undoToken);
      if (!token || token.firmId !== ctx.firmId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Undo window expired or token invalid",
        });
      }
      let restoredCount = 0;
      for (const r of token.restore) {
        await db
          .update(deadlines)
          .set({ amountCents: r.amountCents })
          .where(
            and(
              eq(deadlines.id, r.deadlineId),
              eq(deadlines.firmId, ctx.firmId),
            ),
          );
        restoredCount += 1;
      }
      undoTokens.delete(input.undoToken);
      return { restoredCount };
    }),

  // ─── nexus_change ───────────────────────────────────────────────────────

  /**
   * Returns the questionnaire + thresholds for a given (state, nexusKind)
   * pair — feeds the NexusCheckModal's UI without duplicating per-state
   * config on the FE.
   */
  getNexusQuestionnaire: firmProcedure
    .input(
      z.object({
        state: z.string().length(2),
        nexusKind: z.enum(["sales", "income", "payroll", "franchise"]),
      }),
    )
    .query(async ({ input }) => {
      const ruleSet = getNexusRules(input.state, input.nexusKind as NexusKind);
      if (!ruleSet) {
        return null;
      }
      return {
        state: ruleSet.state,
        nexusKind: ruleSet.nexusKind,
        thresholdSummary: ruleSet.thresholdSummary,
        ruleEffectiveDate: ruleSet.ruleEffectiveDate,
        questions: ruleSet.questions.map((q) => ({
          id: q.id,
          text: q.text,
        })),
        suggestedFilings: ruleSet.suggestedFilings,
      };
    }),

  /**
   * Process per-client nexus check answers. Persists the run + updates
   * `client_state_nexus.status` based on the per-state heuristic.
   */
  runNexusCheck: firmProcedure
    .input(
      z.object({
        announcementId: z.string().uuid(),
        clientId: z.string().uuid(),
        state: z.string().length(2),
        nexusKind: z.enum(["sales", "income", "payroll", "franchise"]),
        answers: z.record(z.string(), z.boolean()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ruleSet = getNexusRules(input.state, input.nexusKind as NexusKind);
      if (!ruleSet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No nexus rules configured for ${input.state} ${input.nexusKind}`,
        });
      }
      const result = ruleSet.resultStrategy(input.answers);
      const recommendedFilings: SuggestedFiling[] =
        result.status === "established" ? ruleSet.suggestedFilings : [];

      // Write immutable questionnaire run row.
      await db.insert(nexusQuestionnaireRuns).values({
        firmId: ctx.firmId,
        clientId: input.clientId,
        alertId: input.announcementId,
        state: input.state,
        nexusKind: input.nexusKind as NexusKind,
        questionsJsonb: ruleSet.questions,
        answersJsonb: input.answers,
        resultStatus: result.status,
        confidence: result.confidence,
        recommendedFilingsJsonb: recommendedFilings,
        completedBy: ctx.dbUser.id,
      });

      // Upsert client_state_nexus row.
      const existing = await db.query.clientStateNexus.findFirst({
        where: and(
          eq(clientStateNexus.clientId, input.clientId),
          eq(clientStateNexus.state, input.state),
          eq(clientStateNexus.nexusKind, input.nexusKind as NexusKind),
        ),
      });
      if (existing) {
        await db
          .update(clientStateNexus)
          .set({
            status: result.status,
            establishedAt:
              result.status === "established" ? new Date() : existing.establishedAt,
            establishedByAlertId:
              result.status === "established"
                ? input.announcementId
                : existing.establishedByAlertId,
            establishedByUserId:
              result.status === "established" ? ctx.dbUser.id : existing.establishedByUserId,
            updatedAt: new Date(),
          })
          .where(eq(clientStateNexus.id, existing.id));
      } else {
        await db.insert(clientStateNexus).values({
          firmId: ctx.firmId,
          clientId: input.clientId,
          state: input.state,
          nexusKind: input.nexusKind as NexusKind,
          status: result.status,
          establishedAt: result.status === "established" ? new Date() : null,
          establishedByAlertId:
            result.status === "established" ? input.announcementId : null,
          establishedByUserId: result.status === "established" ? ctx.dbUser.id : null,
        });
      }

      return {
        status: result.status,
        confidence: result.confidence,
        reason: result.reason,
        recommendedFilings,
      };
    }),

  /**
   * After nexus check completes (or admin override), batch-create the new
   * deadline rows. Each filing references the alert + state.
   */
  addNexusFilings: firmProcedure
    .input(
      z.object({
        announcementId: z.string().uuid(),
        clientId: z.string().uuid(),
        state: z.string().length(2),
        filings: z.array(
          z.object({
            formCode: z.string().min(1),
            formName: z.string().min(1),
            // Optional — if omitted, BE defaults to a year-end date as
            // placeholder. Sarah edits per-deadline if needed.
            dueDate: z.string().date().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify client.
      const client = await db.query.clients.findFirst({
        where: and(
          eq(clients.id, input.clientId),
          eq(clients.firmId, ctx.firmId),
        ),
      });
      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "client not found" });
      }
      const ann = await db.query.announcements.findFirst({
        where: eq(announcements.id, input.announcementId),
      });
      if (!ann) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const defaultDueDate =
        ann.effectiveDate ??
        `${new Date().getFullYear()}-12-31`; // year-end fallback
      const toInsert = input.filings.map((f) => ({
        firmId: ctx.firmId,
        clientId: input.clientId,
        period: `${input.state} ${new Date().getFullYear()}`,
        formType: f.formCode,
        jurisdiction: input.state,
        officialDueDate: f.dueDate ?? defaultDueDate,
        adjustedDueDate: f.dueDate ?? defaultDueDate,
        notes: `Added from nexus_change alert: ${ann.title}`,
      }));
      const inserted = await db
        .insert(deadlines)
        .values(toInsert)
        .returning({ id: deadlines.id });
      return {
        filingsAdded: inserted.length,
        clientId: input.clientId,
      };
    }),

  /**
   * For nexus contraction — mark existing filings as kept-as-protective.
   * The deadline serves one more filing year then auto-disables.
   */
  markFilingsProtective: firmProcedure
    .input(
      z.object({
        announcementId: z.string().uuid(),
        deadlineIds: z.array(z.string().uuid()).min(1),
        reason: z.string().min(1).max(500),
        protectedThroughYear: z.number().int().min(2024).max(2030),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership of all deadlines.
      const rows = await db
        .select({ id: deadlines.id })
        .from(deadlines)
        .where(
          and(
            eq(deadlines.firmId, ctx.firmId),
            inArray(deadlines.id, input.deadlineIds),
          ),
        );
      if (rows.length !== input.deadlineIds.length) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db
        .update(deadlines)
        .set({
          protectedAfterFilingYear: input.protectedThroughYear,
          notes: sql`COALESCE(${deadlines.notes}, '') || E'\n[protective] ' || ${input.reason}`,
        })
        .where(inArray(deadlines.id, input.deadlineIds));
      return {
        markedCount: rows.length,
        protectedThroughYear: input.protectedThroughYear,
      };
    }),
});
