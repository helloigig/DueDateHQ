import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import { exportRuns } from "../../db/schema.js";

const KIND = [
  "deadlines_csv",
  "deadlines_pdf",
  "deadlines_ical",
  "audit_trail_pdf",
  "audit_trail_json",
] as const;

export const exportsRouter = router({
  /**
   * Queue an export. Phase 0 marks rows as `queued`; the worker that
   * generates the artifact runs in Phase 1 (BullMQ `audit-trail-pack`
   * + `deadline-export` queues per arch §4.3). The FE polls `status`.
   */
  request: firmProcedure
    .input(
      z.object({
        kind: z.enum(KIND),
        scope: z.unknown().default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await db
        .insert(exportRuns)
        .values({
          firmId: ctx.firmId,
          requestedByUserId: ctx.dbUser.id,
          kind: input.kind,
          scope: (input.scope ?? {}) as object,
          status: "queued",
        })
        .returning();
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { exportId: row.id };
    }),

  status: firmProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await db.query.exportRuns.findFirst({
        where: and(
          eq(exportRuns.id, input.id),
          eq(exportRuns.firmId, ctx.firmId),
        ),
      });
      if (!row) return null;
      return {
        status: row.status,
        url: row.downloadUrl,
        errorMessage: row.errorMessage,
      };
    }),

  list: firmProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(exportRuns)
      .where(eq(exportRuns.firmId, ctx.firmId))
      .orderBy(desc(exportRuns.createdAt))
      .limit(50);
  }),
});
