import { TRPCError } from "@trpc/server";
import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import { clients, servicePackages } from "../../db/schema.js";
import { ALL_STATES } from "../../lib/states.js";
import { seedClientWithPackage } from "../../lib/client-package-seeder.js";

const ENTITY_TYPES = [
  "LLC",
  "S-Corp",
  "C-Corp",
  "Individual",
  "Partnership",
  "Trust",
] as const;
const CLIENT_STATUS = ["prospect", "active", "inactive", "archived"] as const;
const PAGE_SIZE = 100;

const createInput = z.object({
  name: z.string().min(1).max(200),
  entityType: z.enum(ENTITY_TYPES),
  primaryState: z.enum(ALL_STATES),
  nexusStates: z.array(z.enum(ALL_STATES)).default([]),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().max(40).optional().nullable(),
  county: z.string().max(80).optional().nullable(),
  industry: z.string().max(80).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  tier: z.string().max(40).default("standard"),
});

// FE may send fields the BE doesn't support yet (servicePackages, hasDeadlineThisWeek).
// Accept them silently — Phase 1 will wire them.
const listInput = z
  .object({
    search: z.string().max(200).optional(),
    state: z.array(z.string()).optional(),
    entityType: z.array(z.string()).optional(),
    status: z.array(z.string()).optional(),
    tier: z.array(z.string()).optional(),
    servicePackage: z.array(z.string()).optional(),
    hasDeadlineThisWeek: z.boolean().optional(),
    assigneeId: z.string().optional(),
    cursor: z.string().optional(),
    includeArchived: z.boolean().default(false),
  })
  .partial()
  .optional();

function rowToClient(r: typeof clients.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    entityType: r.entityType as (typeof ENTITY_TYPES)[number],
    primaryState: r.primaryState as (typeof ALL_STATES)[number],
    nexusStates: (r.nexusStates ?? []) as (typeof ALL_STATES)[number][],
    contactEmail: r.contactEmail ?? "",
    contactPhone: r.contactPhone ?? undefined,
    status: r.status,
    tier: ((r.tier ?? "standard") as "standard" | "premium" | "custom"),
    addedAt: r.createdAt.toISOString(),
    servicePackages: [] as string[],
    county: r.county ?? undefined,
  };
}

export const clientsRouter = router({
  list: firmProcedure.input(listInput).query(async ({ ctx, input }) => {
    const filters = [eq(clients.firmId, ctx.firmId)];
    if (!input?.includeArchived) {
      filters.push(isNull(clients.archivedAt));
    }
    if (input?.status?.length) {
      filters.push(
        inArray(
          clients.status,
          input.status as (typeof CLIENT_STATUS)[number][],
        ),
      );
    }
    if (input?.entityType?.length) {
      filters.push(inArray(clients.entityType, input.entityType));
    }
    if (input?.state?.length) {
      filters.push(inArray(clients.primaryState, input.state));
    }
    if (input?.tier?.length) {
      filters.push(inArray(clients.tier, input.tier));
    }
    if (input?.assigneeId) {
      filters.push(eq(clients.assignedUserId, input.assigneeId));
    }
    if (input?.search) {
      const term = `%${input.search}%`;
      filters.push(
        or(ilike(clients.name, term), ilike(clients.contactEmail, term))!,
      );
    }
    // Cursor format: opaque base64 of the last-seen row id; we just use the id.
    const cursorId = input?.cursor;
    if (cursorId) {
      filters.push(sql`${clients.id} > ${cursorId}`);
    }
    const rows = await db
      .select()
      .from(clients)
      .where(and(...filters))
      .orderBy(asc(clients.name), asc(clients.id))
      .limit(PAGE_SIZE + 1);
    const hasMore = rows.length > PAGE_SIZE;
    const items = (hasMore ? rows.slice(0, PAGE_SIZE) : rows).map(rowToClient);
    const nextCursor = hasMore ? rows[PAGE_SIZE - 1]!.id : undefined;
    return { items, nextCursor };
  }),

  get: firmProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      // Accept any string id but only attempt the DB lookup when it's a
      // valid UUID. Stale FE URLs (e.g. localStorage seed clients with
      // ids like "c-ca-01") return null instead of a Zod parse error.
      const isUuid =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
          input.id,
        );
      if (!isUuid) return null;
      const row = await db.query.clients.findFirst({
        where: and(eq(clients.id, input.id), eq(clients.firmId, ctx.firmId)),
      });
      return row ? rowToClient(row) : null;
    }),

  create: firmProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [row] = await db
        .insert(clients)
        .values({
          firmId: ctx.firmId,
          name: input.name,
          entityType: input.entityType,
          primaryState: input.primaryState,
          nexusStates: input.nexusStates,
          contactEmail: input.contactEmail ?? null,
          contactPhone: input.contactPhone ?? null,
          county: input.county ?? null,
          industry: input.industry ?? null,
          notes: input.notes ?? null,
          tier: input.tier,
        })
        .returning();
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { id: row.id };
    }),

  update: firmProcedure
    .input(z.object({ id: z.string().uuid(), patch: createInput.partial() }))
    .mutation(async ({ ctx, input }) => {
      const result = await db
        .update(clients)
        .set({
          ...(input.patch.name !== undefined && { name: input.patch.name }),
          ...(input.patch.entityType !== undefined && {
            entityType: input.patch.entityType,
          }),
          ...(input.patch.primaryState !== undefined && {
            primaryState: input.patch.primaryState,
          }),
          ...(input.patch.nexusStates !== undefined && {
            nexusStates: input.patch.nexusStates,
          }),
          ...(input.patch.contactEmail !== undefined && {
            contactEmail: input.patch.contactEmail,
          }),
          ...(input.patch.contactPhone !== undefined && {
            contactPhone: input.patch.contactPhone,
          }),
          ...(input.patch.county !== undefined && {
            county: input.patch.county,
          }),
          ...(input.patch.industry !== undefined && {
            industry: input.patch.industry,
          }),
          ...(input.patch.notes !== undefined && { notes: input.patch.notes }),
          ...(input.patch.tier !== undefined && { tier: input.patch.tier }),
          updatedAt: sql`now()`,
        })
        .where(and(eq(clients.id, input.id), eq(clients.firmId, ctx.firmId)));
      if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true as const };
    }),

  archive: firmProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await db
        .update(clients)
        .set({ status: "archived", archivedAt: sql`now()` })
        .where(and(eq(clients.id, input.id), eq(clients.firmId, ctx.firmId)));
      if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true as const };
    }),

  /**
   * Assign a service package to a client and run the full chain:
   * deadlines → tasks → checklists → milestones. Same code path the CSV
   * import uses, so per-client UI and bulk import stay in sync.
   *
   * The FE has called this for months via `useAssignBundle` but only the
   * mock adapter handled it; in real mode it 404'd silently. Wiring it
   * here closes the gap so a freshly-added client (without a CSV with a
   * service-package column) can pick up tasks via the Engagement tab.
   */
  assignBundle: firmProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        bundleId: z.string().uuid(),
        year: z.number().int().min(2020).max(2100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the client belongs to this firm before doing anything.
      const [client] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(eq(clients.id, input.clientId), eq(clients.firmId, ctx.firmId)),
        );
      if (!client) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify the package is visible to this firm (system OR firm-owned).
      const pkg = await db.query.servicePackages.findFirst({
        where: and(
          eq(servicePackages.id, input.bundleId),
          or(
            isNull(servicePackages.firmId),
            eq(servicePackages.firmId, ctx.firmId),
          )!,
        ),
      });
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND" });

      const result = await seedClientWithPackage({
        firmId: ctx.firmId,
        clientId: input.clientId,
        packageId: pkg.id,
        year: input.year ?? new Date().getFullYear(),
      });
      return { ok: true as const, ...result };
    }),

  /**
   * Mirror of assignBundle for the FE's `useUnassignBundle` hook. We
   * can't safely delete deadlines/tasks/checklists once they exist (the
   * audit trail breaks, and the CPA may have already chased a client on
   * a doc). For now this is a no-op that returns ok — Phase 2 wires
   * archive-style soft deletion. Stub here so the FE call doesn't 404.
   */
  unassignBundle: firmProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        bundleId: z.string().uuid(),
      }),
    )
    .mutation(async () => {
      return { ok: true as const, removed: 0 };
    }),
});
