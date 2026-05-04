import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  clients,
  deadlines,
  serviceTemplates,
  type DeadlineInsert,
} from "../db/schema.js";
import { computeDueDate, type DueDateRule } from "./due-date-rules.js";

/**
 * Default firm-internal buffer days by rule type — keeps the BE in sync
 * with FE `<DueDate>` derivation (annual: -7d, quarterly: -3d). Until the
 * firm-settings sheet ships an override, every firm gets these defaults
 * written at deadline-generation time. The FE then no longer has to
 * derive from formClass when `internalTargetDate` is null.
 */
const DEFAULT_BUFFER_BY_RULE: Record<DueDateRule["type"], number> = {
  annual_fixed: 7,
  quarterly_fixed: 3,
};

function shiftIsoBackwards(iso: string, days: number): string {
  if (days <= 0) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

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

  // Look up the client's service_start_date — deadlines that fall before
  // this date weren't the firm's responsibility, so we skip generating them.
  // NULL service_start_date means "no boundary" (treated as far past).
  const [clientRow] = await db
    .select({ serviceStartDate: clients.serviceStartDate })
    .from(clients)
    .where(eq(clients.id, args.clientId));
  const serviceStart = clientRow?.serviceStartDate ?? null;

  const inserts: DeadlineInsert[] = [];
  let skippedPreServiceStart = 0;
  for (const tmpl of templates) {
    const rule = tmpl.dueDateRule as DueDateRule;
    const periodInput =
      rule.type === "quarterly_fixed" ? `${args.year}` : `${args.year}`;
    const computed = computeDueDate(rule, periodInput);
    for (const c of computed) {
      // Skip deadlines from before the client's service window.
      if (serviceStart && c.officialDueDate < serviceStart) {
        skippedPreServiceStart++;
        continue;
      }
      const bufferDays = DEFAULT_BUFFER_BY_RULE[rule.type] ?? 0;
      inserts.push({
        firmId: args.firmId,
        clientId: args.clientId,
        serviceTemplateId: tmpl.id,
        period: c.period,
        formType: tmpl.formType,
        jurisdiction: tmpl.jurisdiction,
        officialDueDate: c.officialDueDate,
        adjustedDueDate: c.adjustedDueDate,
        internalTargetDate: shiftIsoBackwards(c.adjustedDueDate, bufferDays),
        status: "not_started",
      });
    }
  }
  if (skippedPreServiceStart > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[deadline-generator] skipped ${skippedPreServiceStart} deadlines before service_start=${serviceStart} for client ${args.clientId}`,
    );
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
