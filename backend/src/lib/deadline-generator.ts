import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  deadlines,
  serviceTemplates,
  type DeadlineInsert,
} from "../db/schema.js";
import { computeDueDate, type DueDateRule } from "./due-date-rules.js";

/**
 * Materializes deadline rows for a (client × package × year) tuple. Pulls
 * the package's templates, computes due dates from each template's
 * `dueDateRule`, and inserts. Idempotent on (client_id, service_template_id,
 * period) — re-running for the same year skips existing rows.
 *
 * Returns the count of deadlines newly created.
 */
export async function generateDeadlinesForClient(args: {
  firmId: string;
  clientId: string;
  packageId: string;
  year: number;
}): Promise<{ created: number }> {
  const templates = await db
    .select()
    .from(serviceTemplates)
    .where(eq(serviceTemplates.packageId, args.packageId));

  if (templates.length === 0) return { created: 0 };

  const inserts: DeadlineInsert[] = [];
  for (const tmpl of templates) {
    const rule = tmpl.dueDateRule as DueDateRule;
    const periodInput =
      rule.type === "quarterly_fixed" ? `${args.year}` : `${args.year}`;
    const computed = computeDueDate(rule, periodInput);
    for (const c of computed) {
      inserts.push({
        firmId: args.firmId,
        clientId: args.clientId,
        serviceTemplateId: tmpl.id,
        period: c.period,
        formType: tmpl.formType,
        jurisdiction: tmpl.jurisdiction,
        officialDueDate: c.officialDueDate,
        adjustedDueDate: c.adjustedDueDate,
        status: "not_started",
      });
    }
  }

  if (inserts.length === 0) return { created: 0 };

  // Skip rows already present for this (client, template, period). The
  // schema doesn't have a unique constraint on this triple yet (Phase 1
  // when we add the rollover engine), so we filter in app code.
  const existing = await db
    .select({
      clientId: deadlines.clientId,
      serviceTemplateId: deadlines.serviceTemplateId,
      period: deadlines.period,
    })
    .from(deadlines)
    .where(
      and(
        eq(deadlines.firmId, args.firmId),
        eq(deadlines.clientId, args.clientId),
      ),
    );
  const seen = new Set(
    existing.map((r) => `${r.serviceTemplateId}|${r.period}`),
  );
  const fresh = inserts.filter(
    (r) => !seen.has(`${r.serviceTemplateId}|${r.period}`),
  );

  if (fresh.length === 0) return { created: 0 };
  await db.insert(deadlines).values(fresh);
  return { created: fresh.length };
}
