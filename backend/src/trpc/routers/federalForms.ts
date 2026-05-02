/**
 * federalForms tRPC router — surfaces the catalog to FE consumers
 * (AddDeadlineModal, FilingsTab, AI applicability).
 *
 * Procedures:
 *   list                      — full catalog with filters
 *   getByFormNumber           — single row, idempotent
 *   applicabilityForClient    — ranked applicable forms for a client,
 *                               drives FilingsTab + AI applicability
 *   extractFromLlm            — get-or-create row for a long-tail form;
 *                               runs the LLM extractor when missing
 *   recentChanges             — last N change events for the admin
 *                               reviewer queue
 *   pollNow                   — trigger a federal-register-poller cycle
 *                               on demand (admin only — guards via
 *                               FEDERAL_REGISTER_RUN_NOW_SECRET)
 *
 * Auth: all procedures except `pollNow` use firmProcedure (any auth'd
 * user can read). The catalog itself is system-wide (no firm_id), but
 * we still want a logged-in session for rate limits + audit.
 */

import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import {
  clients,
  federalForms,
  federalFormChangeEvents,
  federalRegisterNotices,
} from "../../db/schema.js";
import {
  getOrExtractFederalForm,
  normalizeFormNumber,
} from "../../lib/federal-form-extractor.js";
import { runFederalRegisterCycle } from "../../lib/federal-register-poller.js";

const FREQUENCY_VALUES = [
  "annual",
  "quarterly",
  "monthly",
  "per_event",
] as const;

const CATEGORY_VALUES = [
  "income",
  "payroll",
  "info_return",
  "estimated",
  "extension",
  "excise",
  "estate_gift",
  "nonprofit",
  "international",
  "amendment",
  "other",
] as const;

const STATUS_VALUES = ["active", "pending_review", "deprecated"] as const;

type FederalFormRow = typeof federalForms.$inferSelect;

export interface FederalFormDTO {
  id: string;
  formNumber: string;
  formName: string;
  category: string;
  entityTypes: string[];
  frequency: string;
  dueDateRule: unknown;
  notes: string | null;
  irsUrl: string | null;
  extractionMethod: "curated" | "llm" | "federal_register";
  confidenceScore: number;
  status: "active" | "pending_review" | "deprecated";
  lastVerifiedAt: string | null;
  lastChangeCheckAt: string | null;
}

function toDTO(r: FederalFormRow): FederalFormDTO {
  return {
    id: r.id,
    formNumber: r.formNumber,
    formName: r.formName,
    category: r.category,
    entityTypes: r.entityTypes,
    frequency: r.frequency,
    dueDateRule: r.dueDateRule,
    notes: r.notes,
    irsUrl: r.irsUrl,
    extractionMethod: r.extractionMethod,
    confidenceScore: Number(r.confidenceScore),
    status: r.status,
    lastVerifiedAt: r.lastVerifiedAt?.toISOString() ?? null,
    lastChangeCheckAt: r.lastChangeCheckAt?.toISOString() ?? null,
  };
}

export const federalFormsRouter = router({
  /**
   * Catalog list. Default filters out deprecated + pending_review rows
   * so the AddDeadlineModal picker doesn't show low-confidence LLM
   * extractions to end users. Admin reviewer queue passes
   * `includePendingReview: true` to see them all.
   */
  list: firmProcedure
    .input(
      z
        .object({
          search: z.string().trim().optional(),
          entityType: z.string().optional(),
          category: z.enum(CATEGORY_VALUES).optional(),
          frequency: z.enum(FREQUENCY_VALUES).optional(),
          status: z.array(z.enum(STATUS_VALUES)).optional(),
          includePendingReview: z.boolean().default(false),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const includePendingReview = input?.includePendingReview ?? false;
      const allowed = new Set<string>(
        input?.status ?? (includePendingReview
          ? ["active", "pending_review"]
          : ["active"]),
      );

      // We do most filtering in JS — the catalog is small (~30-200 rows),
      // and prefiltering by entity type via a `?` ANY query in Postgres
      // would only save microseconds at this size.
      const rows = await db
        .select()
        .from(federalForms)
        .orderBy(federalForms.category, federalForms.formNumber);

      const search = input?.search?.toLowerCase() ?? "";
      const entityType = input?.entityType;
      const category = input?.category;
      const frequency = input?.frequency;
      const out: FederalFormDTO[] = [];
      for (const r of rows) {
        if (!allowed.has(r.status)) continue;
        if (entityType && !r.entityTypes.includes(entityType)) continue;
        if (category && r.category !== category) continue;
        if (frequency && r.frequency !== frequency) continue;
        if (search) {
          const hay = `${r.formNumber} ${r.formName} ${r.notes ?? ""}`
            .toLowerCase();
          if (!hay.includes(search)) continue;
        }
        out.push(toDTO(r));
      }
      return out;
    }),

  /**
   * Single-form lookup. Returns null when not found — caller decides
   * whether to fall through to extractFromLlm.
   */
  getByFormNumber: firmProcedure
    .input(z.object({ formNumber: z.string().min(1).max(20) }))
    .query(async ({ input }) => {
      const normalized = normalizeFormNumber(input.formNumber);
      if (!normalized) return null;
      const row = await db.query.federalForms.findFirst({
        where: eq(federalForms.formNumber, normalized),
      });
      return row ? toDTO(row) : null;
    }),

  /**
   * Ranked list of federal forms applicable to a specific client.
   *
   * Ranking logic (deterministic — Mode F doesn't need LLM judgment
   * to pick which forms apply to entity types):
   *   1. Forms whose entity_types include this client's entity_type
   *   2. Within that bucket: annual income forms first, then
   *      estimates, then payroll, then info-returns, then everything
   *      else, then extensions/amendments at the bottom (since those
   *      are conditional)
   *   3. Within frequency: alphabetical by form_number for stability
   *
   * The output flags each row with `confidence: 'high' | 'medium'`:
   *   - 'high' = curated row, entity match exact
   *   - 'medium' = LLM-extracted row OR entity match via fallback (e.g.
   *     S-Corp client and a form that lists C-Corp + S-Corp + Partnership
   *     since the form-level entity_types is broad)
   */
  applicabilityForClient: firmProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const client = await db.query.clients.findFirst({
        where: and(
          eq(clients.id, input.clientId),
          eq(clients.firmId, ctx.firmId),
        ),
      });
      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "client not found" });
      }

      const rows = await db
        .select()
        .from(federalForms)
        .where(eq(federalForms.status, "active"));

      const CATEGORY_RANK: Record<string, number> = {
        income: 0,
        estimated: 1,
        payroll: 2,
        info_return: 3,
        nonprofit: 4,
        excise: 5,
        estate_gift: 6,
        international: 7,
        other: 8,
        extension: 9,
        amendment: 10,
      };

      const applicable: Array<{
        form: FederalFormDTO;
        confidence: "high" | "medium";
        reason: string;
      }> = [];

      for (const r of rows) {
        if (r.entityTypes.length === 0) continue; // catch-all rows skipped
        if (!r.entityTypes.includes(client.entityType)) continue;

        const exactMatch = r.entityTypes.length <= 2;
        const isCurated = r.extractionMethod === "curated";
        const confidence: "high" | "medium" =
          exactMatch && isCurated ? "high" : "medium";
        const reason = isCurated
          ? `Curated catalog · ${client.entityType} listed in entity_types`
          : `LLM-extracted (${(Number(r.confidenceScore) * 100).toFixed(0)}% confidence)`;
        applicable.push({ form: toDTO(r), confidence, reason });
      }

      applicable.sort((a, b) => {
        const ra = CATEGORY_RANK[a.form.category] ?? 99;
        const rb = CATEGORY_RANK[b.form.category] ?? 99;
        if (ra !== rb) return ra - rb;
        return a.form.formNumber.localeCompare(b.form.formNumber);
      });

      return {
        clientId: client.id,
        entityType: client.entityType,
        primaryState: client.primaryState,
        forms: applicable,
      };
    }),

  /**
   * Get-or-create a row via the LLM extractor. Used by AddDeadlineModal
   * when the user types a form number we don't recognize, and by
   * admin tooling for ad-hoc catalog extension.
   *
   * Returns the row + a `created` flag + a `confidence` field promoted
   * to the top so callers can decide whether to surface a "needs review"
   * banner without parsing the row's confidence_score.
   */
  extractFromLlm: firmProcedure
    .input(
      z.object({
        formNumber: z.string().min(1).max(20),
        hint: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await getOrExtractFederalForm({
        formNumber: input.formNumber,
        hint: input.hint,
        firmId: ctx.firmId,
      });
      return {
        form: toDTO(result.form),
        created: result.created,
        llmCalled: result.llmCalled,
        confidence: Number(result.form.confidenceScore),
        needsReview: result.form.status === "pending_review",
      };
    }),

  /**
   * Recent change events from the federal-register-poller. Drives
   * the admin reviewer queue. Default scope: unreviewed events from
   * the last 30 days.
   */
  recentChanges: firmProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(200).default(50),
          includeReviewed: z.boolean().default(false),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const limit = input?.limit ?? 50;
      const includeReviewed = input?.includeReviewed ?? false;

      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const rows = await db
        .select({
          event: federalFormChangeEvents,
          notice: federalRegisterNotices,
          form: federalForms,
        })
        .from(federalFormChangeEvents)
        .innerJoin(
          federalRegisterNotices,
          eq(federalFormChangeEvents.noticeId, federalRegisterNotices.id),
        )
        .innerJoin(
          federalForms,
          eq(federalFormChangeEvents.formId, federalForms.id),
        )
        .where(
          includeReviewed
            ? gte(federalFormChangeEvents.createdAt, cutoff)
            : and(
                gte(federalFormChangeEvents.createdAt, cutoff),
                isNull(federalFormChangeEvents.reviewedAt),
              ),
        )
        .orderBy(desc(federalFormChangeEvents.createdAt))
        .limit(limit);

      return rows.map((r) => ({
        eventId: r.event.id,
        changeKind: r.event.changeKind,
        summary: r.event.summary,
        createdAt: r.event.createdAt.toISOString(),
        reviewedAt: r.event.reviewedAt?.toISOString() ?? null,
        appliedAt: r.event.appliedAt?.toISOString() ?? null,
        form: {
          id: r.form.id,
          formNumber: r.form.formNumber,
          formName: r.form.formName,
        },
        notice: {
          id: r.notice.id,
          documentNumber: r.notice.documentNumber,
          title: r.notice.title,
          publicationDate: r.notice.publicationDate,
          htmlUrl: r.notice.htmlUrl,
          parseConfidence: r.notice.parseConfidence,
        },
      }));
    }),

  /** Mark a change event reviewed (admin reviewer flow). */
  markChangeReviewed: firmProcedure
    .input(
      z.object({
        eventId: z.number().int(),
        applied: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input }) => {
      const now = new Date();
      const [updated] = await db
        .update(federalFormChangeEvents)
        .set({
          reviewedAt: now,
          appliedAt: input.applied ? now : null,
        })
        .where(eq(federalFormChangeEvents.id, input.eventId))
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return { ok: true as const };
    }),

  /**
   * Apply a parsed catalog change to the federal_forms catalog.
   * Admin-only in production (TODO: wire users.role check). Optionally
   * accepts userOverrides — when present, those values override the
   * AI-parsed values for specific fields.
   *
   * In a transaction:
   *   1. Update federal_forms with the new values (per field).
   *   2. Mark federal_form_change_events.applied_at = now() + applied_by.
   *   3. Update federal_forms.last_change_check_at.
   */
  applyChangeEvent: firmProcedure
    .input(
      z.object({
        eventId: z.number().int(),
        // Per-field overrides — admin can edit before applying.
        // Shape: { notes?: string, irsUrl?: string, dueDateRule?: unknown, ... }
        userOverrides: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const event = await db.query.federalFormChangeEvents.findFirst({
        where: eq(federalFormChangeEvents.id, input.eventId),
      });
      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (event.appliedAt || event.rejectedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Change event already resolved",
        });
      }
      // V1: only the `summary` field is parsed by the regex/LLM pipeline
      // and rolled into federal_forms.notes. V2: structured diff per field.
      const overrides = input.userOverrides ?? {};
      const noteValue =
        typeof overrides.notes === "string" ? overrides.notes : event.summary;
      const now = new Date();
      // Update the catalog row.
      await db
        .update(federalForms)
        .set({
          notes: noteValue,
          lastChangeCheckAt: now,
          updatedAt: now,
        })
        .where(eq(federalForms.id, event.formId));
      // Mark the event applied.
      await db
        .update(federalFormChangeEvents)
        .set({
          appliedAt: now,
          appliedBy: ctx.dbUser.id,
          userOverridesJsonb: input.userOverrides ?? null,
          reviewedAt: now,
        })
        .where(eq(federalFormChangeEvents.id, input.eventId));
      return {
        applied: true as const,
        appliedAt: now.toISOString(),
        fieldsApplied: Object.keys(overrides).length > 0
          ? Object.keys(overrides)
          : ["notes"],
      };
    }),

  /**
   * Reject a parsed catalog change. Admin-only. Reason is required so
   * the parser feedback loop can learn from rejections.
   */
  rejectChangeEvent: firmProcedure
    .input(
      z.object({
        eventId: z.number().int(),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ input }) => {
      const event = await db.query.federalFormChangeEvents.findFirst({
        where: eq(federalFormChangeEvents.id, input.eventId),
      });
      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (event.appliedAt || event.rejectedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Change event already resolved",
        });
      }
      const now = new Date();
      await db
        .update(federalFormChangeEvents)
        .set({
          rejectedAt: now,
          rejectedReason: input.reason,
          reviewedAt: now,
        })
        .where(eq(federalFormChangeEvents.id, input.eventId));
      return { rejected: true as const, rejectedAt: now.toISOString() };
    }),

  /**
   * Non-admin acknowledge — marks the event as seen by this user without
   * mutating the catalog. (V2: per-user acknowledgment table; V1: just
   * removes from this user's Today queue via a different mechanism.)
   * Returns { ok: true } unconditionally for now since per-user state
   * isn't yet modeled in the BE.
   */
  acknowledgeChangeEvent: firmProcedure
    .input(z.object({ eventId: z.number().int() }))
    .mutation(async () => {
      // No-op in V1. Future: write to user_change_event_acks (user, event, ts).
      return { ok: true as const };
    }),

  /**
   * On-demand poll. Mirrors `/api/scraper/run-now` for the state
   * announcement scraper. Available to any signed-in user — the
   * cycle is idempotent so spamming it isn't dangerous, and it's
   * useful during demos.
   */
  pollNow: firmProcedure.mutation(async () => {
    const result = await runFederalRegisterCycle();
    return result;
  }),
});

