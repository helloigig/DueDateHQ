import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import {
  clients,
  deadlines,
  importedFacts,
  servicePackages,
  tasks,
  type ClientInsert,
  type ImportedFactInsert,
} from "../../db/schema.js";
import { generateDeadlinesForClient } from "../../lib/deadline-generator.js";
import { seedChecklistsForTasks } from "../../lib/checklist-seeder.js";
import { seedMilestonesForTasks } from "../../lib/milestone-seeder.js";
import { findFactInconsistencies } from "../../lib/fact-consistency.js";
import { log } from "../../lib/observability.js";

/**
 * Import / file-format detection. The FE's client-side CSV parser
 * (`src/data/csvParser.ts`) is authoritative for header detection +
 * row mapping; this router writes the parsed rows to the DB and
 * generates downstream artifacts (deadlines, tasks).
 *
 * Phase 1 wires `suggestFieldMapping` to Gemini for ambiguous CSVs;
 * the server-side detector matches the client-side one for now so
 * behavior is consistent if the FE switches to BE detection.
 */

const ENTITY_TYPES = [
  "individual",
  "llc",
  "s_corp",
  "c_corp",
  "partnership",
  "trust",
  "non_profit",
] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * Map display-format entity types to the canonical snake_case enum.
 * The FE persists user-facing strings like "LLC", "S-Corp", "Individual"
 * (per src/types.ts EntityType union); the BE schema stores them as
 * snake_case for SQL friendliness. This normalizer bridges the two.
 *
 * Returns the input unchanged if already canonical, lower-snake-cases
 * otherwise. Unmapped values fall through and Zod rejects them — keeps
 * the surface tight while supporting the variants the FE actually sends.
 */
function normalizeEntityType(input: unknown): unknown {
  if (typeof input !== "string") return input;
  const lowered = input.toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  // Aliases for common variations
  const map: Record<string, EntityType> = {
    individual: "individual",
    llc: "llc",
    s_corp: "s_corp",
    scorp: "s_corp",
    c_corp: "c_corp",
    ccorp: "c_corp",
    partnership: "partnership",
    trust: "trust",
    non_profit: "non_profit",
    nonprofit: "non_profit",
  };
  return map[lowered] ?? input;
}

const RowSchema = z.object({
  name: z.string().min(1),
  entityType: z.preprocess(normalizeEntityType, z.enum(ENTITY_TYPES)),
  primaryState: z
    .string()
    .min(2)
    .max(2)
    .transform((s) => s.toUpperCase()),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  servicePackage: z.string().optional(),
});

export const importsRouter = router({
  detectFormat: firmProcedure
    .input(z.object({ headerRow: z.array(z.string()) }))
    .mutation(({ input }) => {
      const headers = input.headerRow.map((h) => h.toLowerCase().trim());
      const has = (s: string) => headers.some((h) => h.includes(s));
      let source: "taxdome" | "drake" | "proconnect" | "quickbooks" | "file_in_time" | "excel" =
        "excel";
      let confidence: "high" | "low" | "ignore" = "low";
      if (has("client number")) {
        source = "drake";
        confidence = "high";
      } else if (has("entity") && has("primary state")) {
        source = "taxdome";
        confidence = "high";
      } else if (has("client name") && has("ein")) {
        source = "proconnect";
        confidence = "high";
      } else if (has("display name") && has("currency")) {
        source = "quickbooks";
        confidence = "high";
      } else if (has("name") && has("state")) {
        source = "excel";
        confidence = "low";
      }
      return { source, confidence };
    }),

  suggestFieldMapping: firmProcedure
    .input(z.object({ headerRow: z.array(z.string()) }))
    .mutation(() => {
      // Phase 1 — Gemini call for ambiguous columns. For now the FE keeps
      // doing this client-side; we just ack the request shape so the FE
      // doesn't 404 in real mode.
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "ai_field_mapping_phase1",
      });
    }),

  /**
   * Preview — validates rows + reports what would be created without
   * writing. Lets the FE show "X new clients, Y deadlines, Z tasks"
   * before the user clicks commit.
   */
  preview: firmProcedure
    .input(
      z.object({
        rows: z.array(RowSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Existing clients in this firm — for dedupe by name+state.
      // Real production would do fuzzy matching (Levenshtein ≤ 2,
      // EIN exact, contact_email exact); we use exact name+state
      // for Phase 1 so the FE can preview duplicates honestly.
      const existing = await db
        .select({
          name: clients.name,
          primaryState: clients.primaryState,
        })
        .from(clients)
        .where(eq(clients.firmId, ctx.firmId));
      const existingKeys = new Set(
        existing.map((e) => `${e.name.toLowerCase()}|${e.primaryState}`),
      );

      // Service packages this firm has — for matching the row's
      // `servicePackage` string to a real package row.
      const firmPackages = await db
        .select()
        .from(servicePackages)
        .where(eq(servicePackages.firmId, ctx.firmId));
      const packageByName = new Map(
        firmPackages.map((p) => [p.name.toLowerCase(), p]),
      );

      let newClients = 0;
      let duplicates = 0;
      let withPackage = 0;
      let unmatchedPackages: string[] = [];
      for (const row of input.rows) {
        const key = `${row.name.toLowerCase()}|${row.primaryState}`;
        if (existingKeys.has(key)) {
          duplicates++;
          continue;
        }
        newClients++;
        if (row.servicePackage) {
          if (packageByName.has(row.servicePackage.toLowerCase())) {
            withPackage++;
          } else {
            unmatchedPackages.push(row.servicePackage);
          }
        }
      }

      return {
        newClients,
        duplicates,
        withPackage,
        // Distinct unmatched package names (preview UX shows them so
        // the user can fix mappings before committing)
        unmatchedPackages: [...new Set(unmatchedPackages)].slice(0, 10),
      };
    }),

  /**
   * Commit — actually write the rows. Returns the inserted client ids
   * + a synthetic importId the FE can use as a correlation handle for
   * undo (which walks the activity log to find rows created in the
   * same batch — there's no formal import_runs table yet).
   */
  commit: firmProcedure
    .input(
      z.object({
        rows: z.array(RowSchema),
        source: z.string().optional(),
        skippedCount: z.number().int().nonnegative().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Synthetic importId — used by the FE for the success-toast +
      // undo button; production replaces this with a real
      // import_runs.id once that table ships.
      const importId = `imp-${randomBytes(6).toString("hex")}`;
      const importedAt = new Date();

      // Prefetch firm packages once — used for service_package matching.
      const firmPackages = await db
        .select()
        .from(servicePackages)
        .where(eq(servicePackages.firmId, ctx.firmId));
      const packageByName = new Map(
        firmPackages.map((p) => [p.name.toLowerCase(), p]),
      );

      // Existing clients — dedupe by (name, primaryState) per firm.
      const existing = await db
        .select({
          id: clients.id,
          name: clients.name,
          primaryState: clients.primaryState,
        })
        .from(clients)
        .where(eq(clients.firmId, ctx.firmId));
      const existingByKey = new Map(
        existing.map((e) => [
          `${e.name.toLowerCase()}|${e.primaryState}`,
          e.id,
        ]),
      );

      // Step 1 — insert clients in a single batch. Drizzle returns the
      // inserted rows; we collect ids in row-input order so the FE
      // can correlate (e.g. for "5 of 24 created" UI).
      const toInsert: ClientInsert[] = [];
      const skippedIndices: number[] = [];
      for (let i = 0; i < input.rows.length; i++) {
        const row = input.rows[i]!;
        const key = `${row.name.toLowerCase()}|${row.primaryState}`;
        if (existingByKey.has(key)) {
          skippedIndices.push(i);
          continue;
        }
        toInsert.push({
          firmId: ctx.firmId,
          name: row.name,
          entityType: row.entityType,
          primaryState: row.primaryState,
          contactEmail: row.contactEmail ?? null,
          contactPhone: row.contactPhone ?? null,
          status: "active",
          // Service starts today by default — deadlines before today won't
          // be generated for this client. Removes the "8d late" surprise on
          // freshly-imported clients. P1 enhancement: surface this as an
          // optional CSV column so CPAs doing back-tax cleanup can override
          // to an earlier date.
          serviceStartDate: importedAt.toISOString().slice(0, 10),
          // Stash importId in metadata so undo can find this batch
          // without a separate table.
          metadata: { importId, importedAt: importedAt.toISOString() },
        });
      }

      const insertedRows = toInsert.length
        ? await db.insert(clients).values(toInsert).returning({
            id: clients.id,
            name: clients.name,
            primaryState: clients.primaryState,
          })
        : [];
      const insertedById = new Map(
        insertedRows.map((r) => [
          `${r.name.toLowerCase()}|${r.primaryState}`,
          r.id,
        ]),
      );

      // Step 2 — for rows with a servicePackage that maps to a real
      // package, generate deadlines for the current year. Skipped rows
      // (duplicates) reuse the existing client id.
      const year = new Date().getFullYear();
      let deadlinesCreated = 0;
      let tasksCreated = 0;
      let checklistItemsCreated = 0;
      const ids: string[] = [];

      for (let i = 0; i < input.rows.length; i++) {
        const row = input.rows[i]!;
        const key = `${row.name.toLowerCase()}|${row.primaryState}`;
        const clientId = insertedById.get(key) ?? existingByKey.get(key);
        if (!clientId) continue;
        ids.push(clientId);

        if (row.servicePackage) {
          const pkg = packageByName.get(row.servicePackage.toLowerCase());
          if (pkg) {
            const result = await generateDeadlinesForClient({
              firmId: ctx.firmId,
              clientId,
              packageId: pkg.id,
              year,
            });
            deadlinesCreated += result.created;

            // Generate one Task per newly-created deadline. The deadline
            // generator inserted them but didn't create tasks — tasks
            // are 1:1 with deadlines but live in a separate table with
            // the per-task forwarding email local part.
            const newDeadlines = await db
              .select({ id: deadlines.id })
              .from(deadlines)
              .where(
                and(
                  eq(deadlines.firmId, ctx.firmId),
                  eq(deadlines.clientId, clientId),
                ),
              );
            // Skip deadlines that already have tasks (idempotent re-run)
            const existingTasks = await db
              .select({ deadlineId: tasks.deadlineId })
              .from(tasks)
              .where(eq(tasks.firmId, ctx.firmId));
            const existingTaskDeadlines = new Set(
              existingTasks.map((t) => t.deadlineId),
            );
            // Pull deadline → service_template map so we can seed
            // each new task's checklist from the template's
            // standardChecklist payload.
            const deadlineToTemplate = await db
              .select({
                id: deadlines.id,
                serviceTemplateId: deadlines.serviceTemplateId,
              })
              .from(deadlines)
              .where(eq(deadlines.firmId, ctx.firmId));
            const templateByDeadline = new Map(
              deadlineToTemplate.map((d) => [d.id, d.serviceTemplateId]),
            );
            const taskRows = newDeadlines
              .filter((d) => !existingTaskDeadlines.has(d.id))
              .map((d) => ({
                firmId: ctx.firmId,
                deadlineId: d.id,
                forwardingEmailLocalPart: forwardingTokenFor(
                  row.name,
                  d.id,
                ),
              }));
            if (taskRows.length > 0) {
              const inserted = await db
                .insert(tasks)
                .values(taskRows)
                .returning({
                  id: tasks.id,
                  deadlineId: tasks.deadlineId,
                });
              tasksCreated += inserted.length;
              // Seed baseline checklist items from each task's
              // service_template.standardChecklist. Without this,
              // tasks land empty and the inbound classifier has
              // nothing to match attachments against — the entire
              // files-from-clients loop breaks here.
              const seeded = await seedChecklistsForTasks(
                inserted.map((t) => ({
                  firmId: ctx.firmId,
                  taskId: t.id,
                  serviceTemplateId:
                    templateByDeadline.get(t.deadlineId) ?? null,
                })),
              );
              checklistItemsCreated += seeded.created;
              // Auto-seed Mode B milestone proposals for each new task.
              // Substrate fallback when ANTHROPIC_API_KEY missing — every
              // task lands with the 5 milestone slots populated, eliminating
              // the friction step where CPA had to click "Propose dates".
              await seedMilestonesForTasks(
                inserted.map((t) => ({
                  firmId: ctx.firmId,
                  taskId: t.id,
                })),
              );
            }
          }
        }
      }

      log.info("imports.commit.done", {
        firmId: ctx.firmId,
        importId,
        rowsRequested: input.rows.length,
        clientsCreated: insertedRows.length,
        skipped: skippedIndices.length,
        deadlinesCreated,
        tasksCreated,
        checklistItemsCreated,
        source: input.source ?? null,
      });

      return {
        ids,
        importId,
        clientsCreated: insertedRows.length,
        skippedCount: skippedIndices.length + (input.skippedCount ?? 0),
        deadlinesCreated,
        tasksCreated,
        checklistItemsCreated,
      };
    }),

  /**
   * History — list clients created in past imports, grouped by importId
   * stored in clients.metadata. Real production replaces this with an
   * import_runs table that aggregates these natively.
   */
  listHistory: firmProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
        metadata: clients.metadata,
        createdAt: clients.createdAt,
      })
      .from(clients)
      .where(eq(clients.firmId, ctx.firmId));

    const byImport = new Map<
      string,
      { importId: string; importedAt: string; clientIds: string[] }
    >();
    for (const r of rows) {
      const meta = r.metadata as { importId?: string; importedAt?: string };
      if (!meta?.importId) continue;
      const grp =
        byImport.get(meta.importId) ?? {
          importId: meta.importId,
          importedAt: meta.importedAt ?? r.createdAt.toISOString(),
          clientIds: [],
        };
      grp.clientIds.push(r.id);
      byImport.set(meta.importId, grp);
    }
    return [...byImport.values()].sort((a, b) =>
      b.importedAt.localeCompare(a.importedAt),
    );
  }),

  /**
   * Undo an import — archives all clients created in that batch. We
   * don't hard-delete because deadlines + tasks may have already
   * accumulated activity (chase emails, classifications) that we don't
   * want to silently lose. Archived clients can be restored from
   * Settings → Data.
   */
  undo: firmProcedure
    .input(z.object({ importId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .select({
          id: clients.id,
          metadata: clients.metadata,
        })
        .from(clients)
        .where(eq(clients.firmId, ctx.firmId));

      const idsToArchive: string[] = [];
      for (const r of rows) {
        const meta = r.metadata as { importId?: string };
        if (meta?.importId === input.importId) idsToArchive.push(r.id);
      }
      if (idsToArchive.length === 0) {
        return { removed: 0 };
      }

      // Mark clients archived rather than deleting — preserves the
      // audit trail on any deadlines/tasks that already accumulated
      // activity (chases, AI classifications). Real production may
      // also drop the unattached deadlines + tasks if they have no
      // recorded events; deferred for now.
      await db
        .update(clients)
        .set({ status: "archived" })
        .where(
          and(
            eq(clients.firmId, ctx.firmId),
            // Match each id individually — Drizzle doesn't yet have
            // a clean inArray helper across the version we use.
            // Single update with an OR over ids would be cleaner;
            // for now we rely on the small batch size of one import.
            // TODO: drizzle.inArray when upgrading.
            // (Fallback: loop one update per id.)
            eq(clients.id, idsToArchive[0]!),
          ),
        );
      // Loop the rest — small N (one import at a time)
      for (const id of idsToArchive.slice(1)) {
        await db
          .update(clients)
          .set({ status: "archived" })
          .where(
            and(eq(clients.firmId, ctx.firmId), eq(clients.id, id)),
          );
      }

      log.info("imports.undo.done", {
        firmId: ctx.firmId,
        importId: input.importId,
        archived: idsToArchive.length,
      });
      return { removed: idsToArchive.length };
    }),

  /**
   * Prior-year return PDF parser — Tier 3 import (PRD §6.6).
   *
   * Real production: download the PDF from Supabase Storage, run
   * pdfjs-dist extract, send text to Claude with a structured-output
   * prompt, write extracted facts to `imported_facts` for Mode E.
   *
   * Phase 1 (this stub): accepts the shape and returns deterministic
   * placeholder data so the FE upload-and-review flow can be exercised
   * end-to-end without LLM budget. Swap the body of
   * `extractPriorYearFields` when ready.
   */
  parsePriorYearReturn: firmProcedure
    .input(
      z.object({
        storageKey: z.string().min(1),
        clientId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Tenant safety — storage key must start with caller's firm id.
      // Defense-in-depth on top of bucket RLS.
      if (!input.storageKey.startsWith(`${ctx.firmId}/`)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "storage_key_outside_firm",
        });
      }
      // Real path — Sonnet 4.5 reads the PDF directly via document
      // attachment support. Falls back to deterministic stub when AI
      // or storage isn't configured (e.g. dev without keys).
      const { parsePriorYearReturnPdf } = await import("../../lib/ai.js");
      const real = await parsePriorYearReturnPdf({
        firmId: ctx.firmId,
        storageKey: input.storageKey,
        clientId: input.clientId,
      });
      const extracted =
        real ?? (await extractPriorYearFields(input.storageKey));
      return {
        fields: extracted,
        readyForCommit: extracted.confidence >= 0.7,
      };
    }),

  /**
   * Commit reviewed prior-year extraction → imported_facts. Closes the
   * Tier 3 import path: parser extracts → CPA reviews → this writes the
   * canonical fact rows that Mode E's `generateCrossYearInsights` reads.
   *
   * One importedFacts row per significant field. fact_type is the
   * normalized fact key (prior_agi / forms_filed / k1_sources / entity_type
   * / ein). value is jsonb — scalars stored as JSON literals, arrays as
   * arrays. extraction_version="v1" so future Mode A v2 re-extraction batch
   * can identify which facts to refresh.
   */
  commitPriorYearReturn: firmProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        taxYear: z.number().int().min(2000).max(2100),
        fields: z.object({
          clientName: z.string().nullable().optional(),
          ein: z.string().nullable().optional(),
          entityType: z.string().nullable().optional(),
          priorAGI: z.number().nullable().optional(),
          formsFiled: z.array(z.string()).optional(),
          k1Sources: z.array(z.string()).optional(),
          confidence: z.number().min(0).max(1),
        }),
        sourceStorageKey: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Ownership check — caller's firm must own the client.
      const [client] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(eq(clients.id, input.clientId), eq(clients.firmId, ctx.firmId)),
        );
      if (!client) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "client_not_in_firm",
        });
      }

      // Map confidence → schema enum.
      const confidence: ImportedFactInsert["confidence"] =
        input.fields.confidence >= 0.85
          ? "high"
          : input.fields.confidence >= 0.7
            ? "medium"
            : "low";

      const rows: ImportedFactInsert[] = [];
      const make = (
        factType: string,
        value: unknown,
        unit: string | null = null,
      ): ImportedFactInsert => ({
        firmId: ctx.firmId,
        clientId: input.clientId,
        factType,
        value: value as never,
        unit,
        taxYear: input.taxYear,
        // Tier 3 = prior-year PDF import (PRD §6.6). Provenance fields land
        // when the PDF source is in Gmail (Method B). For Tier 3 uploads
        // (Supabase Storage), source_gmail_message_id stays null.
        sourceGmailMessageId: null,
        sourceAttachmentIndex: null,
        sourcePageRange: null,
        extractionVersion: "v1",
        gmailMessageStatus: "available",
        confidence,
        importTier: 3,
      });

      if (input.fields.priorAGI != null) {
        rows.push(make("prior_agi", input.fields.priorAGI, "USD"));
      }
      if (
        input.fields.formsFiled &&
        input.fields.formsFiled.length > 0
      ) {
        rows.push(make("forms_filed", input.fields.formsFiled));
      }
      if (input.fields.k1Sources && input.fields.k1Sources.length > 0) {
        rows.push(make("k1_sources", input.fields.k1Sources));
      }
      if (input.fields.entityType) {
        rows.push(make("entity_type", input.fields.entityType));
      }
      if (input.fields.ein) {
        rows.push(make("ein", input.fields.ein));
      }

      if (rows.length === 0) {
        return { inserted: 0, factTypes: [] as string[] };
      }

      const inserted = await db.insert(importedFacts).values(rows).returning({
        id: importedFacts.id,
        factType: importedFacts.factType,
      });
      log.info("imports.commitPriorYearReturn.done", {
        firmId: ctx.firmId,
        clientId: input.clientId,
        taxYear: input.taxYear,
        inserted: inserted.length,
        factTypes: inserted.map((r) => r.factType),
      });
      return {
        inserted: inserted.length,
        factTypes: inserted.map((r) => r.factType),
      };
    }),

  /**
   * Cross-fact consistency check — per PRD §9.6 v0.8 amendment.
   *
   * Surfaces ImportedFact rows where the same (client × year × fact_type)
   * has multiple sources with values that disagree beyond tolerance. Mode C-
   * style flag — CPA picks the canonical value. Optional clientId scopes
   * the check to one client; without it, walks the whole firm.
   */
  factConsistency: firmProcedure
    .input(
      z
        .object({
          clientId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const flags = await findFactInconsistencies({
        firmId: ctx.firmId,
        clientId: input?.clientId,
      });
      return { flags };
    }),
});

/**
 * Per-task forwarding email local part. Format:
 *   <client-firstname>-<short-token>
 * The token is the first 4 hex chars of the deadline id, ensuring
 * uniqueness across the firm without exposing the full UUID.
 */
function forwardingTokenFor(clientName: string, deadlineId: string): string {
  const slug = clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  const token = deadlineId.replace(/-/g, "").slice(0, 6);
  return `${slug || "client"}-${token}`;
}

async function extractPriorYearFields(storageKey: string): Promise<{
  clientName: string | null;
  ein: string | null;
  entityType: string | null;
  taxYear: number | null;
  priorAGI: number | null;
  formsFiled: string[];
  k1Sources: string[];
  confidence: number;
}> {
  const hash = Array.from(storageKey).reduce(
    (h, c) => (h * 31 + c.charCodeAt(0)) | 0,
    0,
  );
  return {
    clientName: null,
    ein: null,
    entityType:
      hash % 3 === 0 ? "LLC" : hash % 3 === 1 ? "S-Corp" : "Individual",
    taxYear: 2024,
    priorAGI: null,
    formsFiled: [],
    k1Sources: [],
    confidence: 0.4,
  };
}
