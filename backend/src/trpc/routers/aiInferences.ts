import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import { aiInferences } from "../../db/schema.js";

/**
 * AI eval surface (P0.18, PRD §4.7).
 *
 * Online eval lives on the `ai_inferences.was_acted_on` flag — flipped
 * when a CPA accepts (true) or rejects (false) an AI proposal. Offline
 * eval is a separate harness (`backend/scripts/eval-offline.ts`, Phase 1)
 * that runs against curated ground-truth fixtures.
 *
 * For Phase 0 we expose the recording endpoint + a per-mode summary view
 * so the FE can show "Mode A acceptance: 87% over 30d" in Settings.
 */
const MODES = ["A", "B", "C", "D", "E", "F"] as const;
type Mode = (typeof MODES)[number];

/** p50 / p95 percentile from a list of latency-ms values. Returns null when
 *  the sample is empty. */
function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length),
  );
  return sorted[idx] ?? null;
}

export const aiInferencesRouter = router({
  /** Called by the FE the moment a CPA acts on an AI proposal. */
  recordAcceptance: firmProcedure
    .input(
      z.object({
        inferenceId: z.coerce.number().int().positive(),
        accepted: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await db
        .update(aiInferences)
        .set({
          wasActedOn: input.accepted,
          cpaActionAt: new Date(),
        })
        .where(
          and(
            eq(aiInferences.id, input.inferenceId),
            eq(aiInferences.firmId, ctx.firmId),
          ),
        );
      if (result.count === 0) {
        return { ok: false as const, reason: "not_found" };
      }
      return { ok: true as const };
    }),

  /**
   * Per-mode acceptance rate + cost + latency over the firm's lifetime.
   * Returns counts, acceptance rate, total cost, p50/p95 latency. Phase 1
   * adds drift detection per arch §6.9 (see driftReport below).
   */
  summary: firmProcedure
    .input(z.object({ mode: z.enum(MODES) }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(aiInferences)
        .where(
          input?.mode
            ? and(
                eq(aiInferences.firmId, ctx.firmId),
                eq(aiInferences.mode, input.mode),
              )
            : eq(aiInferences.firmId, ctx.firmId),
        );
      const total = rows.length;
      const acted = rows.filter((r) => r.wasActedOn !== null).length;
      const accepted = rows.filter((r) => r.wasActedOn === true).length;
      const cost = rows.reduce(
        (sum, r) => sum + Number(r.costCents ?? 0),
        0,
      );
      const latencies = rows
        .map((r) => r.latencyMs)
        .filter((n): n is number => typeof n === "number" && n > 0);
      return {
        total,
        actedOn: acted,
        accepted,
        acceptanceRate: acted > 0 ? accepted / acted : null,
        totalCostCents: cost,
        p50LatencyMs: percentile(latencies, 50),
        p95LatencyMs: percentile(latencies, 95),
      };
    }),

  /**
   * Multi-mode overview — returns one summary row per Mode A-F in a single
   * query. Drives the Settings → AI eval all-modes dashboard. Cheaper than
   * 6 round-trips when the FE just needs the headline numbers per mode.
   */
  summaryAll: firmProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select()
      .from(aiInferences)
      .where(eq(aiInferences.firmId, ctx.firmId));
    const byMode = new Map<Mode, typeof rows>();
    for (const r of rows) {
      const arr = byMode.get(r.mode as Mode) ?? [];
      arr.push(r);
      byMode.set(r.mode as Mode, arr);
    }
    return MODES.map((m) => {
      const modeRows = byMode.get(m) ?? [];
      const total = modeRows.length;
      const acted = modeRows.filter((r) => r.wasActedOn !== null).length;
      const accepted = modeRows.filter((r) => r.wasActedOn === true).length;
      const cost = modeRows.reduce(
        (sum, r) => sum + Number(r.costCents ?? 0),
        0,
      );
      const latencies = modeRows
        .map((r) => r.latencyMs)
        .filter((n): n is number => typeof n === "number" && n > 0);
      return {
        mode: m,
        total,
        actedOn: acted,
        accepted,
        acceptanceRate: acted > 0 ? accepted / acted : null,
        totalCostCents: cost,
        p50LatencyMs: percentile(latencies, 50),
        p95LatencyMs: percentile(latencies, 95),
      };
    });
  }),

  /**
   * Drift report — per-mode acceptance rate bucketed by week. Lets ops
   * spot deteriorating model performance before users complain. Returns
   * up to 12 weeks of buckets, oldest-first; charts go to /settings/ai.
   *
   * Drift signal = current week's acceptance rate vs trailing 4-week
   * mean. >5pp drop is the alert threshold (configurable per arch §6.9).
   */
  driftReport: firmProcedure
    .input(z.object({ mode: z.enum(MODES) }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(aiInferences)
        .where(
          input?.mode
            ? and(
                eq(aiInferences.firmId, ctx.firmId),
                eq(aiInferences.mode, input.mode),
              )
            : eq(aiInferences.firmId, ctx.firmId),
        );

      // Bucket by ISO week of cpaActionAt (or createdAt for un-acted)
      const weeks = new Map<
        string,
        { total: number; acted: number; accepted: number }
      >();
      for (const r of rows) {
        const ts = r.cpaActionAt ?? r.createdAt;
        if (!ts) continue;
        const d = new Date(ts);
        // ISO week key — YYYY-Www
        const yr = d.getUTCFullYear();
        const week = isoWeek(d);
        const key = `${yr}-W${String(week).padStart(2, "0")}`;
        const b = weeks.get(key) ?? { total: 0, acted: 0, accepted: 0 };
        b.total++;
        if (r.wasActedOn !== null) b.acted++;
        if (r.wasActedOn === true) b.accepted++;
        weeks.set(key, b);
      }

      const sorted = [...weeks.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([week, v]) => ({
          week,
          total: v.total,
          acceptanceRate: v.acted > 0 ? v.accepted / v.acted : null,
        }));

      // Drift = latest week's rate vs trailing 4-week mean
      const latest = sorted[sorted.length - 1];
      const prior = sorted.slice(-5, -1).filter((s) => s.acceptanceRate !== null);
      const priorMean =
        prior.length > 0
          ? prior.reduce((sum, s) => sum + (s.acceptanceRate ?? 0), 0) /
            prior.length
          : null;
      const drift =
        latest?.acceptanceRate !== null &&
        latest?.acceptanceRate !== undefined &&
        priorMean !== null
          ? latest.acceptanceRate - priorMean
          : null;

      return {
        weeks: sorted,
        drift,
        // Alert threshold: a 5-percentage-point drop week-over-window
        alert: drift !== null && drift < -0.05,
      };
    }),
});

/**
 * ISO 8601 week number — week containing Thursday is week 1 of its year.
 * Vanilla math, no deps; matches `date-fns/getISOWeek` output.
 */
function isoWeek(d: Date): number {
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getTime();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
}
