/**
 * One-shot admin script — find every active client in every firm that
 * has zero deadlines, suggest a system service package based on their
 * (entityType, primaryState), and run the standard package seeder so
 * deadlines / tasks / checklists / milestones spawn.
 *
 * Idempotent: a second run is a no-op once each client has at least one
 * deadline. Safe to re-run after future imports too.
 *
 * Run on prod via:
 *   flyctl ssh console -a duedatehq -C 'node dist/db/backfill-unpackaged-clients.js'
 *
 * Required pre-condition: system service packages have been seeded via
 *   flyctl ssh console -a duedatehq -C 'node dist/db/seed.js'
 * Otherwise pickSuggestedPackage returns null for every client and the
 * script reports `skipped_no_match` for each row — same failure mode
 * that left them unpackaged in the first place.
 */
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "./client.js";
import { clients, deadlines, servicePackages } from "./schema.js";
import { seedClientWithPackage } from "../lib/client-package-seeder.js";

function pickSuggestedPackage(
  all: Array<typeof servicePackages.$inferSelect>,
  entityType: string,
  primaryState: string,
): (typeof servicePackages.$inferSelect) | null {
  const matches = all.filter(
    (p) =>
      p.applicableEntityTypes.includes(entityType) &&
      (p.applicableStates === null ||
        p.applicableStates.includes(primaryState)),
  );
  matches.sort((a, b) => {
    const aSpecific = a.applicableStates !== null ? 0 : 1;
    const bSpecific = b.applicableStates !== null ? 0 : 1;
    if (aSpecific !== bSpecific) return aSpecific - bSpecific;
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return matches[0] ?? null;
}

async function backfill() {
  const year = new Date().getFullYear();

  const allRows = await db
    .select({
      id: clients.id,
      firmId: clients.firmId,
      name: clients.name,
      entityType: clients.entityType,
      primaryState: clients.primaryState,
      status: clients.status,
    })
    .from(clients);

  const targets: typeof allRows = [];
  for (const c of allRows) {
    if (c.status !== "active") continue;
    const existing = await db
      .select({ id: deadlines.id })
      .from(deadlines)
      .where(eq(deadlines.clientId, c.id))
      .limit(1);
    if (existing.length === 0) targets.push(c);
  }

  if (targets.length === 0) {
    // eslint-disable-next-line no-console
    console.log("[backfill] no unpackaged clients found — nothing to do.");
    return;
  }

  // Fetch all system + firm packages in one shot (the suggester is
  // entity+state matching, identical across firms in the firm-scoped
  // case since system packages have firm_id = null).
  const allPackages = await db
    .select()
    .from(servicePackages)
    .where(or(isNull(servicePackages.firmId), eq(servicePackages.isSystem, true))!);

  if (allPackages.length === 0) {
    // eslint-disable-next-line no-console
    console.error(
      "[backfill] no system packages found in DB — run `node dist/db/seed.js` first, then re-run this script.",
    );
    process.exit(1);
  }

  const counts = {
    processed: 0,
    seeded: 0,
    deadlinesCreated: 0,
    tasksCreated: 0,
    checklistItemsCreated: 0,
    skippedNoMatch: 0,
    failed: 0,
  };

  for (const c of targets) {
    counts.processed += 1;
    const pkg = pickSuggestedPackage(allPackages, c.entityType, c.primaryState);
    if (!pkg) {
      counts.skippedNoMatch += 1;
      // eslint-disable-next-line no-console
      console.log(
        `[backfill] no package match: ${c.name} (${c.entityType}/${c.primaryState})`,
      );
      continue;
    }
    try {
      const seed = await seedClientWithPackage({
        firmId: c.firmId,
        clientId: c.id,
        packageId: pkg.id,
        year,
      });
      counts.seeded += 1;
      counts.deadlinesCreated += seed.deadlinesCreated;
      counts.tasksCreated += seed.tasksCreated;
      counts.checklistItemsCreated += seed.checklistItemsCreated;
      // eslint-disable-next-line no-console
      console.log(
        `[backfill] seeded: ${c.name} → ${pkg.name} (+${seed.deadlinesCreated}d +${seed.tasksCreated}t +${seed.checklistItemsCreated}ci)`,
      );
    } catch (err) {
      counts.failed += 1;
      // eslint-disable-next-line no-console
      console.error(
        `[backfill] failed: ${c.name} (${c.id}) —`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[backfill] done — processed: ${counts.processed}, seeded: ${counts.seeded}, deadlines: +${counts.deadlinesCreated}, tasks: +${counts.tasksCreated}, checklists: +${counts.checklistItemsCreated}, skipped (no match): ${counts.skippedNoMatch}, failed: ${counts.failed}`,
  );
}

await backfill();
process.exit(0);
