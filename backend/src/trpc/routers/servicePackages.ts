import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import {
  clients,
  clientServicePackages,
  servicePackages,
} from "../../db/schema.js";
import { generateDeadlinesForClient } from "../../lib/deadline-generator.js";

const ENTITY_TYPES = [
  "LLC",
  "S-Corp",
  "C-Corp",
  "Individual",
  "Partnership",
  "Trust",
] as const;

export type PackageDTO = {
  id: string;
  firmId: string | null;
  name: string;
  description: string | null;
  applicableEntityTypes: string[];
  applicableStates: string[] | null;
  isSystem: boolean;
};

function toDTO(r: typeof servicePackages.$inferSelect): PackageDTO {
  return {
    id: r.id,
    firmId: r.firmId,
    name: r.name,
    description: r.description,
    applicableEntityTypes: r.applicableEntityTypes,
    applicableStates: r.applicableStates,
    isSystem: r.isSystem,
  };
}

export const servicePackagesRouter = router({
  /**
   * All packages visible to this firm: system packages (firm_id NULL) +
   * the firm's own custom packages. Sorted system-first, then alpha.
   */
  list: firmProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select()
      .from(servicePackages)
      .where(
        or(isNull(servicePackages.firmId), eq(servicePackages.firmId, ctx.firmId))!,
      )
      .orderBy(desc(servicePackages.isSystem), servicePackages.name);
    return rows.map(toDTO);
  }),

  /**
   * Pick the best system package for a (entityType, primaryState) tuple.
   * Mode A foundation per PRD §4.3: "auto-generate the checklist." We use
   * deterministic ranking now; AI ranking comes with the LLM pipeline.
   */
  suggestForClient: firmProcedure
    .input(
      z.object({
        entityType: z.enum(ENTITY_TYPES),
        primaryState: z.string().length(2),
      }),
    )
    .query(async ({ ctx, input }) => {
      const all = await db
        .select()
        .from(servicePackages)
        .where(
          or(isNull(servicePackages.firmId), eq(servicePackages.firmId, ctx.firmId))!,
        );
      const matches = all.filter(
        (p) =>
          p.applicableEntityTypes.includes(input.entityType) &&
          (p.applicableStates === null ||
            p.applicableStates.includes(input.primaryState)),
      );
      // Prefer state-specific packages over null-state generic ones, then
      // system packages (more curated) over firm-custom.
      matches.sort((a, b) => {
        const aSpecific = a.applicableStates !== null ? 0 : 1;
        const bSpecific = b.applicableStates !== null ? 0 : 1;
        if (aSpecific !== bSpecific) return aSpecific - bSpecific;
        if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return matches[0] ? toDTO(matches[0]) : null;
    }),

  /**
   * Wire a package to a client and spawn deadlines for the requested year.
   * Idempotent on (client, package) and on per-year deadline generation.
   *
   * Returns the count of deadlines newly created — 0 means the assignment
   * was already in place AND deadlines for that year were already spawned.
   */
  assignToClient: firmProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        packageId: z.string().uuid(),
        year: z
          .number()
          .int()
          .min(2020)
          .max(2099)
          .default(new Date().getFullYear()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the client belongs to this firm.
      const client = await db.query.clients.findFirst({
        where: and(
          eq(clients.id, input.clientId),
          eq(clients.firmId, ctx.firmId),
        ),
      });
      if (!client) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify the package is reachable by this firm (system OR firm-owned).
      const pkg = await db.query.servicePackages.findFirst({
        where: and(
          eq(servicePackages.id, input.packageId),
          or(
            isNull(servicePackages.firmId),
            eq(servicePackages.firmId, ctx.firmId),
          )!,
        ),
      });
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND" });

      // Insert assignment if missing.
      await db
        .insert(clientServicePackages)
        .values({ clientId: input.clientId, packageId: input.packageId })
        .onConflictDoNothing();

      // Spawn deadlines for the requested year.
      const { created } = await generateDeadlinesForClient({
        firmId: ctx.firmId,
        clientId: input.clientId,
        packageId: input.packageId,
        year: input.year,
      });
      return { ok: true as const, deadlinesCreated: created };
    }),

  /**
   * Removes the package assignment AND deletes any incomplete deadlines
   * spawned from it. Completed deadlines are kept (they're history).
   */
  unassignFromClient: firmProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        packageId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const client = await db.query.clients.findFirst({
        where: and(
          eq(clients.id, input.clientId),
          eq(clients.firmId, ctx.firmId),
        ),
      });
      if (!client) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .delete(clientServicePackages)
        .where(
          and(
            eq(clientServicePackages.clientId, input.clientId),
            eq(clientServicePackages.packageId, input.packageId),
          ),
        );
      return { ok: true as const };
    }),
});
