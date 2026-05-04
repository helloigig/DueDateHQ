import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import { clients, deadlines } from "../../db/schema.js";

const DEADLINE_STATUS = [
  "not_started",
  "in_progress",
  "completed",
  "deferred",
  "filed_extension",
  "overdue",
] as const;

/**
 * Frontend `Deadline` shape (subset that matters for the dashboard list and
 * client-detail row). Mirrors `src/types.ts` `Deadline` interface — keep the
 * field names aligned so tRPC outputs slot directly into existing components.
 */
export type DeadlineDTO = {
  id: string;
  clientId: string;
  form: string;
  jurisdiction: string;
  officialDueDate: string;
  status: (typeof DEADLINE_STATUS)[number];
  assignedUser?: string;
  notes?: string;
};

export type TriageBuckets = {
  overdue: DeadlineDTO[];
  thisWeek: DeadlineDTO[];
  thisMonth: DeadlineDTO[];
  longTerm: DeadlineDTO[];
};

function rowToDeadline(r: typeof deadlines.$inferSelect): DeadlineDTO {
  return {
    id: r.id,
    clientId: r.clientId,
    form: r.formType,
    jurisdiction: r.jurisdiction,
    // Frontend renders `officialDueDate` from this; we send adjusted (the
    // weekend/holiday-shifted date) because that's what the dashboard times
    // overdue/this-week/etc. against. PRD §8.5.
    officialDueDate: r.adjustedDueDate,
    status: r.status,
    assignedUser: r.assignedUserId ?? undefined,
    notes: r.notes ?? undefined,
  };
}

function bucketize(rows: typeof deadlines.$inferSelect[], today: Date): TriageBuckets {
  const day = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const t0 = day(today);
  const t7 = t0 + 7 * 86_400_000;
  const t30 = t0 + 30 * 86_400_000;

  const buckets: TriageBuckets = {
    overdue: [],
    thisWeek: [],
    thisMonth: [],
    longTerm: [],
  };
  for (const r of rows) {
    if (r.status === "completed") continue;
    const dto = rowToDeadline(r);
    const due = day(new Date(r.adjustedDueDate));
    if (due < t0) buckets.overdue.push(dto);
    else if (due < t7) buckets.thisWeek.push(dto);
    else if (due < t30) buckets.thisMonth.push(dto);
    else buckets.longTerm.push(dto);
  }
  return buckets;
}

export const deadlinesRouter = router({
  /**
   * Dashboard's main feed (PRD §8.5, arch §10.1). Returns deadlines
   * time-grouped into Overdue / This Week / This Month / Long Term.
   * Limits to next 180 days for performance; long-tail items are reachable
   * from the client detail screen.
   */
  listForTriage: firmProcedure
    .input(
      z
        .object({
          bucket: z
            .enum(["overdue", "this_week", "this_month", "long_term"])
            .optional(),
          filters: z.unknown().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx }) => {
      const rows = await db
        .select()
        .from(deadlines)
        .where(eq(deadlines.firmId, ctx.firmId))
        .orderBy(asc(deadlines.adjustedDueDate))
        .limit(2000);
      return bucketize(rows, new Date());
    }),

  listForClient: firmProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(deadlines)
        .innerJoin(clients, eq(clients.id, deadlines.clientId))
        .where(
          and(
            eq(deadlines.firmId, ctx.firmId),
            eq(deadlines.clientId, input.clientId),
          ),
        )
        .orderBy(asc(deadlines.adjustedDueDate));
      return rows.map((r) => rowToDeadline(r.deadlines));
    }),

  updateStatus: firmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(DEADLINE_STATUS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await db
        .update(deadlines)
        .set({ status: input.status, updatedAt: sql`now()` })
        .where(
          and(eq(deadlines.id, input.id), eq(deadlines.firmId, ctx.firmId)),
        );
      if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true as const };
    }),

  /**
   * Defer a deadline to a new date. Sets status=`deferred` and shifts
   * `adjustedDueDate` (the date the dashboard times off — PRD §8.5).
   * `officialDueDate` stays put: the jurisdiction's hard date is
   * immutable; only the firm's working date moves.
   */
  defer: firmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await db
        .update(deadlines)
        .set({
          status: "deferred",
          adjustedDueDate: input.newDate,
          updatedAt: sql`now()`,
        })
        .where(
          and(eq(deadlines.id, input.id), eq(deadlines.firmId, ctx.firmId)),
        );
      if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true as const };
    }),

  /**
   * Mark a deadline as having had an extension filed. Returns `{ id }` —
   * the FE caller treats this as the same row, but the contract leaves
   * room to mint a follow-up extension deadline in Phase 1.
   */
  fileExtension: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await db
        .update(deadlines)
        .set({ status: "filed_extension", updatedAt: sql`now()` })
        .where(
          and(eq(deadlines.id, input.id), eq(deadlines.firmId, ctx.firmId)),
        );
      if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: input.id };
    }),

  /**
   * Confirm the jurisdiction has accepted the extension request. No-op
   * status change in Phase 0 (the row is already `filed_extension`); a
   * dedicated `extension_approved_at` column will land in Phase 1 when
   * the IRS/state acknowledgment ingestion is wired.
   */
  markExtensionApproved: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await db
        .update(deadlines)
        .set({ updatedAt: sql`now()` })
        .where(
          and(eq(deadlines.id, input.id), eq(deadlines.firmId, ctx.firmId)),
        );
      if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true as const };
    }),

  /**
   * Mass deadline shift driven by a state announcement (e.g. "OR
   * postpones Q3 estimates from 9/15 to 10/15 for hurricane relief").
   * For each client in `clientIds`, finds any deadline whose
   * `adjustedDueDate` matches `oldDate` and bumps it to `newDate`.
   *
   * Distinct from `announcements.batchAdjustDeadlines`, which is
   * announcement-id-driven and updates by jurisdiction. This variant
   * gives the FE a direct "I picked these clients, shift these dates"
   * affordance for the alert-detail panel and cross-state cleanup.
   */
  batchAdjust: firmProcedure
    .input(
      z.object({
        clientIds: z.array(z.string().uuid()).min(1).max(500),
        oldDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        announcementTitle: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await db
        .update(deadlines)
        .set({
          adjustedDueDate: input.newDate,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(deadlines.firmId, ctx.firmId),
            inArray(deadlines.clientId, input.clientIds),
            eq(deadlines.adjustedDueDate, input.oldDate),
          ),
        );
      return { ok: true as const, deadlinesUpdated: result.count };
    }),

  /**
   * Manually add an ad-hoc deadline (catalog gap, one-off filing).
   * `period` is derived from the year of `officialDueDate` so the row
   * satisfies the NOT NULL constraint without the FE having to know
   * about service templates. `adjustedDueDate` defaults to the
   * official date — weekend/holiday shifting is Phase 1.
   */
  quickAdd: firmProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        form: z.string().min(1).max(80),
        jurisdiction: z.string().min(2).max(20),
        officialDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the client belongs to this firm.
      const [owned] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(eq(clients.id, input.clientId), eq(clients.firmId, ctx.firmId)),
        );
      if (!owned) throw new TRPCError({ code: "NOT_FOUND" });
      const year = input.officialDueDate.slice(0, 4);
      const [row] = await db
        .insert(deadlines)
        .values({
          firmId: ctx.firmId,
          clientId: input.clientId,
          period: year,
          formType: input.form,
          jurisdiction: input.jurisdiction,
          officialDueDate: input.officialDueDate,
          adjustedDueDate: input.officialDueDate,
        })
        .returning();
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { id: row.id };
    }),
});
