import { TRPCError } from "@trpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
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
});
