import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import {
  checklistItems,
  clients,
  clientServicePackages,
  deadlines,
  servicePackages,
  serviceTemplates,
  tasks,
} from "../../db/schema.js";
import { computeDueDate, type DueDateRule } from "../../lib/due-date-rules.js";
import { ALL_STATES } from "../../lib/states.js";
import { trySeedMilestonesForTask } from "../../lib/milestone-seeder.js";

const FEDERAL_STATE = "federal";
const CURRENT_YEAR = new Date().getFullYear();

// ─── Helpers ────────────────────────────────────────────────────────────

function isUuid(s: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    s,
  );
}

/**
 * Resolve the set of system service_templates that apply when a client
 * files in (federal + the picked states). We pick all "federal"-jurisdiction
 * templates from the most popular federal package as the baseline, plus
 * every template whose jurisdiction matches one of the picked state codes
 * (lowercased).
 *
 * Templates can repeat across packages (e.g. fed-1040 lives in many
 * Individual packages). We dedupe by (form_type, jurisdiction).
 */
async function resolveTemplates(args: {
  firmId: string;
  stateCodes: string[];
  includeFederal: boolean;
}) {
  const lowerStates = args.stateCodes.map((s) => s.toLowerCase());
  const jurisdictions = args.includeFederal
    ? [FEDERAL_STATE, ...lowerStates]
    : lowerStates;

  // Pull templates whose jurisdiction is in the requested set. Join via
  // package to ensure visibility (system or this firm's). We allow system
  // and own-firm packages.
  const rows = await db
    .select({
      template: serviceTemplates,
      pkg: servicePackages,
    })
    .from(serviceTemplates)
    .innerJoin(
      servicePackages,
      eq(servicePackages.id, serviceTemplates.packageId),
    )
    .where(
      and(
        inArray(serviceTemplates.jurisdiction, jurisdictions),
        or(
          isNull(servicePackages.firmId),
          eq(servicePackages.firmId, args.firmId),
        )!,
      ),
    );

  // Dedupe by (form_type, jurisdiction). Prefer system templates over firm
  // duplicates, and the first-seen otherwise.
  const dedup = new Map<string, typeof rows[number]>();
  for (const r of rows) {
    const key = `${r.template.formType}|${r.template.jurisdiction}`;
    const existing = dedup.get(key);
    if (!existing) {
      dedup.set(key, r);
      continue;
    }
    // Prefer system over firm-custom
    if (existing.pkg.firmId !== null && r.pkg.firmId === null) {
      dedup.set(key, r);
    }
  }
  return [...dedup.values()].map((r) => r.template);
}

// ─── Router ─────────────────────────────────────────────────────────────

const previewInput = z.object({
  stateCodes: z.array(z.enum(ALL_STATES)).min(1).max(50),
  includeFederal: z.boolean().default(true),
  year: z.number().int().min(2020).max(2099).default(CURRENT_YEAR),
});

const commitInput = previewInput.extend({
  clientId: z.string().min(1),
  excludedTemplateIds: z.array(z.string().uuid()).default([]),
  saveAsPackage: z.boolean().default(false),
  customPackageName: z.string().min(1).max(120).optional(),
});

export const multistateRouter = router({
  /**
   * Preview the deadlines that will be spawned for a (clientName,
   * stateCodes, year) combination — without persisting anything. Powers the
   * "review before commit" screen.
   *
   * Returns deadlines grouped by jurisdiction so the FE can render them
   * with state headers + per-state exclude toggles.
   */
  preview: firmProcedure
    .input(previewInput)
    .query(async ({ ctx, input }) => {
      const templates = await resolveTemplates({
        firmId: ctx.firmId,
        stateCodes: input.stateCodes,
        includeFederal: input.includeFederal,
      });

      // For each template, compute the dates for the requested year.
      const deadlinesPreview = templates.flatMap((t) => {
        const rule = t.dueDateRule as DueDateRule;
        const computed = computeDueDate(rule, `${input.year}`);
        return computed.map((c) => ({
          templateId: t.id,
          formType: t.formType,
          jurisdiction: t.jurisdiction,
          period: c.period,
          officialDueDate: c.officialDueDate,
          adjustedDueDate: c.adjustedDueDate,
        }));
      });

      // Group by jurisdiction for FE rendering.
      const byJurisdiction = new Map<string, typeof deadlinesPreview>();
      for (const d of deadlinesPreview) {
        const arr = byJurisdiction.get(d.jurisdiction) ?? [];
        arr.push(d);
        byJurisdiction.set(d.jurisdiction, arr);
      }

      const groups = [...byJurisdiction.entries()].map(([jur, items]) => ({
        jurisdiction: jur,
        templateCount: new Set(items.map((i) => i.templateId)).size,
        deadlineCount: items.length,
        deadlines: items.sort((a, b) =>
          a.adjustedDueDate.localeCompare(b.adjustedDueDate),
        ),
      }));

      // Sort federal first, then alphabetical state codes.
      groups.sort((a, b) => {
        if (a.jurisdiction === FEDERAL_STATE) return -1;
        if (b.jurisdiction === FEDERAL_STATE) return 1;
        return a.jurisdiction.localeCompare(b.jurisdiction);
      });

      return {
        groups,
        totalDeadlines: deadlinesPreview.length,
        totalTemplates: templates.length,
        statesWithoutTemplates: input.stateCodes
          .map((s) => s.toLowerCase())
          .filter((s) => !byJurisdiction.has(s)),
      };
    }),

  /**
   * Commit: spawn deadlines + tasks + Mode-A checklists for the resolved
   * templates. Optionally create a custom firm-level package for reuse.
   *
   * Idempotent on (client, template, period): re-running for the same year
   * skips already-existing deadlines.
   */
  commit: firmProcedure
    .input(commitInput)
    .mutation(async ({ ctx, input }) => {
      if (!isUuid(input.clientId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "invalid_client_id" });
      }
      const client = await db.query.clients.findFirst({
        where: and(
          eq(clients.id, input.clientId),
          eq(clients.firmId, ctx.firmId),
        ),
      });
      if (!client) throw new TRPCError({ code: "NOT_FOUND" });

      const templates = await resolveTemplates({
        firmId: ctx.firmId,
        stateCodes: input.stateCodes,
        includeFederal: input.includeFederal,
      });
      const excludedSet = new Set(input.excludedTemplateIds);
      const usable = templates.filter((t) => !excludedSet.has(t.id));

      let createdPackageId: string | null = null;
      if (input.saveAsPackage) {
        const stateLabel = input.stateCodes.sort().join("+");
        const fallbackName = `${client.name} — Multi-State (${stateLabel})`;
        const [pkg] = await db
          .insert(servicePackages)
          .values({
            firmId: ctx.firmId,
            name: input.customPackageName ?? fallbackName,
            description: `Auto-saved from multi-state wizard: ${input.stateCodes.join(", ")}`,
            applicableEntityTypes: [client.entityType],
            applicableStates: input.stateCodes,
            isSystem: false,
          })
          .returning();
        if (!pkg) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        createdPackageId = pkg.id;

        // Link client to the new package
        await db
          .insert(clientServicePackages)
          .values({ clientId: client.id, packageId: pkg.id })
          .onConflictDoNothing();
      }

      // Spawn deadlines that don't already exist for this (client, template, period).
      const existing = await db
        .select({
          serviceTemplateId: deadlines.serviceTemplateId,
          period: deadlines.period,
        })
        .from(deadlines)
        .where(
          and(
            eq(deadlines.firmId, ctx.firmId),
            eq(deadlines.clientId, client.id),
          ),
        );
      const seen = new Set(
        existing.map((r) => `${r.serviceTemplateId}|${r.period}`),
      );

      let createdDeadlines = 0;
      let createdTasks = 0;
      let createdChecklistItems = 0;

      for (const t of usable) {
        const rule = t.dueDateRule as DueDateRule;
        const computed = computeDueDate(rule, `${input.year}`);
        for (const c of computed) {
          const key = `${t.id}|${c.period}`;
          if (seen.has(key)) continue;

          const [deadline] = await db
            .insert(deadlines)
            .values({
              firmId: ctx.firmId,
              clientId: client.id,
              serviceTemplateId: t.id,
              period: c.period,
              formType: t.formType,
              jurisdiction: t.jurisdiction,
              officialDueDate: c.officialDueDate,
              adjustedDueDate: c.adjustedDueDate,
              status: "not_started",
            })
            .returning();
          if (!deadline) continue;
          createdDeadlines++;

          // Spawn task for this deadline
          const slug = client.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "")
            .slice(0, 16) || "task";
          const formSlug = t.formType
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "")
            .slice(0, 16);
          const token = Math.random().toString(36).slice(2, 6);
          const local = `${slug}-${formSlug}-${token}`;

          const [task] = await db
            .insert(tasks)
            .values({
              firmId: ctx.firmId,
              deadlineId: deadline.id,
              forwardingEmailLocalPart: local,
              status: "not_started",
            })
            .returning();
          if (!task) continue;
          createdTasks++;

          // Spawn baseline checklist
          const baseline =
            (t.standardChecklist as Array<{
              label: string;
              itemType: string;
            }> | null) ?? [];
          if (baseline.length > 0) {
            await db.insert(checklistItems).values(
              baseline.map((b, idx) => ({
                firmId: ctx.firmId,
                taskId: task.id,
                label: b.label,
                itemType: b.itemType,
                sortOrder: idx,
                state: "not_requested" as const,
                stateChangedByKind: "system" as const,
              })),
            );
            createdChecklistItems += baseline.length;
          }
          // Auto-seed Mode B milestone proposals — fire and forget per task
          // so a slow LLM call doesn't block the multi-state wizard.
          void trySeedMilestonesForTask({
            firmId: ctx.firmId,
            taskId: task.id,
          });
        }
      }

      // Update client's nexus_states to reflect the picked states
      const stateUpper = input.stateCodes.map((s) => s.toUpperCase());
      await db
        .update(clients)
        .set({
          nexusStates: stateUpper,
          updatedAt: sql`now()`,
        })
        .where(eq(clients.id, client.id));

      return {
        ok: true as const,
        createdDeadlines,
        createdTasks,
        createdChecklistItems,
        createdPackageId,
      };
    }),
});
