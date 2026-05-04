import { TRPCError } from "@trpc/server";
import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import {
  checklistItems,
  clientNotes,
  clients,
  clientServicePackages,
  deadlines,
  servicePackages,
  tasks,
} from "../../db/schema.js";
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

// CSV-escape one cell — wraps in quotes when the cell contains comma,
// quote, or newline; doubles inner quotes per RFC 4180.
function csvCell(s: string): string {
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const CSV_HEADER = [
  "Name",
  "Entity",
  "Primary state",
  "Nexus states",
  "Tier",
  "Status",
  "Email",
  "Phone",
  "Service packages",
  "Service start date",
  "Active tasks",
  "Waiting docs",
  "Oldest reminder (days)",
  "Next deadline",
  "Last updated",
].join(",");

function csvFilename(scope: "client" | "clients"): string {
  const date = new Date().toISOString().slice(0, 10);
  return `duedatehq-${scope}-${date}.csv`;
}
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
   * Bulk + per-client CSV export. Synchronous build — returns the CSV text
   * as a string; FE creates a blob and triggers download. No worker, no
   * polling. Sized for firm-scale (<10k clients); >10k goes through the
   * async export_runs flow (deferred).
   *
   * Why CSV (not PDF/JSON/iCal): CPAs are Excel-native data people. The
   * primary use case is "dump the book + pivot in Excel" — capacity
   * planning, slice-and-dice, "show me all CA LLCs with deadlines in
   * March." CSV is the escape hatch when the product can't anticipate
   * the cut they need. PDF lives on the per-task audit pack only.
   *
   * Scope: respects the same filter args as clients.list, plus optional
   * single `clientId` for the per-client variant. Default = active +
   * non-archived (matches the Clients page default).
   *
   * Columns are opinionated — what a CPA actually pivots on. UUIDs and
   * internal flags omitted; sensitive notes omitted (safer default).
   */
  exportCsv: firmProcedure
    .input(
      z
        .object({
          clientId: z.string().uuid().optional(),
          search: z.string().max(200).optional(),
          state: z.array(z.string()).optional(),
          entityType: z.array(z.string()).optional(),
          status: z.array(z.string()).optional(),
          tier: z.array(z.string()).optional(),
          includeArchived: z.boolean().default(false),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      // Build the same WHERE clauses as clients.list — keeps the export
      // and the on-screen list in sync. The user's mental model is
      // "export what I'm looking at."
      const filters = [eq(clients.firmId, ctx.firmId)];
      if (input?.clientId) {
        filters.push(eq(clients.id, input.clientId));
      }
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
      if (input?.search) {
        const term = `%${input.search}%`;
        filters.push(
          or(ilike(clients.name, term), ilike(clients.contactEmail, term))!,
        );
      }
      const clientRows = await db
        .select()
        .from(clients)
        .where(and(...filters))
        .orderBy(asc(clients.name));

      if (clientRows.length === 0) {
        return {
          filename: csvFilename(input?.clientId ? "client" : "clients"),
          content: CSV_HEADER + "\n",
          rowCount: 0,
        };
      }

      const clientIds = clientRows.map((c) => c.id);

      // Per-client computed columns — single SQL pass each instead of a
      // join-explosion that would multiply rows.
      // 1) active task counts + earliest open deadline.
      const taskAgg = await db
        .select({
          clientId: deadlines.clientId,
          activeTasks: sql<number>`count(distinct ${tasks.id})::int`,
          nextDeadline: sql<string | null>`min(${deadlines.officialDueDate}) filter (where ${tasks.status} != 'completed')`,
        })
        .from(tasks)
        .innerJoin(deadlines, eq(deadlines.id, tasks.deadlineId))
        .where(
          and(
            eq(tasks.firmId, ctx.firmId),
            inArray(deadlines.clientId, clientIds),
          ),
        )
        .groupBy(deadlines.clientId);
      const taskMap = new Map(taskAgg.map((r) => [r.clientId, r]));

      // 2) waiting-doc counts + oldest reminder per client.
      const waitingAgg = await db
        .select({
          clientId: deadlines.clientId,
          waitingDocs: sql<number>`count(${checklistItems.id})::int`,
          oldestReminder: sql<Date | null>`min(${checklistItems.lastReminderAt})`,
        })
        .from(checklistItems)
        .innerJoin(tasks, eq(tasks.id, checklistItems.taskId))
        .innerJoin(deadlines, eq(deadlines.id, tasks.deadlineId))
        .where(
          and(
            eq(checklistItems.firmId, ctx.firmId),
            inArray(deadlines.clientId, clientIds),
            inArray(checklistItems.state, [
              "requested_waiting",
              "not_requested",
            ]),
          ),
        )
        .groupBy(deadlines.clientId);
      const waitingMap = new Map(waitingAgg.map((r) => [r.clientId, r]));

      // 3) service packages per client.
      const pkgRows = await db
        .select({
          clientId: clientServicePackages.clientId,
          packageName: servicePackages.name,
        })
        .from(clientServicePackages)
        .innerJoin(
          servicePackages,
          eq(servicePackages.id, clientServicePackages.packageId),
        )
        .where(inArray(clientServicePackages.clientId, clientIds));
      const pkgMap = new Map<string, string[]>();
      for (const r of pkgRows) {
        const arr = pkgMap.get(r.clientId) ?? [];
        arr.push(r.packageName);
        pkgMap.set(r.clientId, arr);
      }

      const today = new Date();
      const dayMs = 24 * 60 * 60 * 1000;
      const lines: string[] = [CSV_HEADER];
      for (const c of clientRows) {
        const t = taskMap.get(c.id);
        const w = waitingMap.get(c.id);
        const pkgs = pkgMap.get(c.id) ?? [];
        const oldest =
          w?.oldestReminder
            ? Math.floor((today.getTime() - new Date(w.oldestReminder).getTime()) / dayMs)
            : null;
        lines.push(
          [
            csvCell(c.name),
            csvCell(c.entityType),
            csvCell(c.primaryState),
            csvCell((c.nexusStates ?? []).join("; ")),
            csvCell(c.tier ?? ""),
            csvCell(c.status),
            csvCell(c.contactEmail ?? ""),
            csvCell(c.contactPhone ?? ""),
            csvCell(pkgs.join("; ")),
            csvCell(c.serviceStartDate ?? ""),
            csvCell(t?.activeTasks?.toString() ?? "0"),
            csvCell(w?.waitingDocs?.toString() ?? "0"),
            csvCell(oldest != null ? oldest.toString() : ""),
            csvCell(t?.nextDeadline ?? ""),
            csvCell(c.updatedAt.toISOString().slice(0, 10)),
          ].join(","),
        );
      }

      return {
        filename: csvFilename(input?.clientId ? "client" : "clients"),
        content: lines.join("\n") + "\n",
        rowCount: clientRows.length,
      };
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

  /**
   * Append a note to a client's note feed (Client Detail, PRD §4.6).
   * Distinct from `clients.notes` (legacy single text field on the
   * client row) — feed entries are append-only, pinnable, and may
   * link to a specific deadline.
   */
  addNote: firmProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        body: z.string().min(1).max(4000),
        relatedDeadlineId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the client belongs to this firm — never let a stray
      // clientId from a stale tab insert a note into a different firm.
      const [owned] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(eq(clients.id, input.clientId), eq(clients.firmId, ctx.firmId)),
        );
      if (!owned) throw new TRPCError({ code: "NOT_FOUND" });
      const [row] = await db
        .insert(clientNotes)
        .values({
          firmId: ctx.firmId,
          clientId: input.clientId,
          authorUserId: ctx.dbUser.id,
          body: input.body,
          relatedDeadlineId: input.relatedDeadlineId ?? null,
        })
        .returning();
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { id: row.id };
    }),

  toggleNotePin: firmProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        noteId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const note = await db.query.clientNotes.findFirst({
        where: and(
          eq(clientNotes.id, input.noteId),
          eq(clientNotes.clientId, input.clientId),
          eq(clientNotes.firmId, ctx.firmId),
        ),
      });
      if (!note) throw new TRPCError({ code: "NOT_FOUND" });
      await db
        .update(clientNotes)
        .set({ pinned: !note.pinned })
        .where(eq(clientNotes.id, note.id));
      return { ok: true as const };
    }),

  deleteNote: firmProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        noteId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await db
        .delete(clientNotes)
        .where(
          and(
            eq(clientNotes.id, input.noteId),
            eq(clientNotes.clientId, input.clientId),
            eq(clientNotes.firmId, ctx.firmId),
          ),
        );
      if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true as const };
    }),
});
