/**
 * Baseline checklist seeder.
 *
 * Without this, tasks land empty after import and there's nothing for
 * inbound documents to match against — the entire "files from clients"
 * loop breaks at the foundation. The standardChecklist on each
 * serviceTemplate is the spec of what docs the form needs; this
 * function materializes those into checklistItems rows the moment a
 * task is created.
 *
 * Idempotent on (taskId, itemType) — re-running for the same task
 * skips items that already exist.
 *
 * Each item starts in `not_requested` state. The first chase email
 * (manual or scheduled) flips it to `requested_waiting`; an inbound
 * document via Mode A flips it to `received_unreviewed`; the CPA's
 * confirm click flips it to `received_confirmed` (§5.3 invariant).
 */

import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  checklistItems,
  serviceTemplates,
  type ChecklistItemInsert,
} from "../db/schema.js";
import { log } from "./observability.js";

interface StandardChecklistRow {
  label: string;
  itemType: string;
}

/**
 * Seed the checklist for a single task. Reads the parent deadline's
 * service_template to find the standardChecklist payload and inserts
 * one row per item.
 */
export async function seedChecklistForTask(args: {
  firmId: string;
  taskId: string;
  serviceTemplateId: string | null;
}): Promise<{ created: number }> {
  if (!args.serviceTemplateId) return { created: 0 };

  const tmpl = await db.query.serviceTemplates.findFirst({
    where: eq(serviceTemplates.id, args.serviceTemplateId),
  });
  if (!tmpl) return { created: 0 };

  const checklist = tmpl.standardChecklist as StandardChecklistRow[] | null;
  if (!Array.isArray(checklist) || checklist.length === 0) {
    return { created: 0 };
  }

  // Skip items that already exist for this task (idempotent re-run)
  const existing = await db
    .select({ itemType: checklistItems.itemType })
    .from(checklistItems)
    .where(eq(checklistItems.taskId, args.taskId));
  const seen = new Set(existing.map((e) => e.itemType));

  const inserts: ChecklistItemInsert[] = [];
  for (let i = 0; i < checklist.length; i++) {
    const row = checklist[i];
    if (!row || seen.has(row.itemType)) continue;
    inserts.push({
      firmId: args.firmId,
      taskId: args.taskId,
      label: row.label,
      itemType: row.itemType,
      sortOrder: i,
      state: "not_requested",
      stateChangedByKind: "system",
    });
  }

  if (inserts.length === 0) return { created: 0 };
  await db.insert(checklistItems).values(inserts);
  log.info("checklist.seeded", {
    taskId: args.taskId,
    count: inserts.length,
  });
  return { created: inserts.length };
}

/**
 * Bulk variant — seed checklists for many tasks at once. Used after
 * imports.commit creates a batch of tasks. Walks each task's deadline
 * to find the service template; runs in parallel for throughput.
 */
export async function seedChecklistsForTasks(
  taskRecords: Array<{
    firmId: string;
    taskId: string;
    serviceTemplateId: string | null;
  }>,
): Promise<{ created: number }> {
  let total = 0;
  await Promise.all(
    taskRecords.map(async (t) => {
      const r = await seedChecklistForTask(t);
      total += r.created;
    }),
  );
  return { created: total };
}
