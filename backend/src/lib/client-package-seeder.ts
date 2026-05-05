/**
 * Client × package seeding chain — shared between imports.commit and
 * clients.assignBundle. Without sharing this, the two paths drift: the
 * import path generates deadlines + tasks + checklists + milestones,
 * but assignBundle previously only existed in the FE mock adapter, so
 * the per-client "assign package" UI silently no-op'd in production.
 *
 * One round trip:
 *   1. generateDeadlinesForClient → deadlines table
 *   2. select new deadlines without tasks → create tasks (1:1 mapping)
 *   3. seedChecklistsForTasks → checklist_items per task (from
 *      service_template.standardChecklist payload)
 *   4. seedMilestonesForTasks → 5 task_milestones per task with Mode B
 *      proposed dates (substrate fallback if no LLM key)
 *
 * Idempotent at every step — re-running for the same client × package
 * skips existing rows.
 */

import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  clients,
  deadlines,
  tasks,
  type TaskInsert,
} from "../db/schema.js";
import { generateDeadlinesForClient } from "./deadline-generator.js";
import { seedChecklistsForTasks } from "./checklist-seeder.js";
import { seedMilestonesForTasks } from "./milestone-seeder.js";
import { forwardingTokenFor } from "./forwarding-token.js";

export interface SeedClientWithPackageResult {
  deadlinesCreated: number;
  tasksCreated: number;
  checklistItemsCreated: number;
  milestonesCreated: number;
}

export async function seedClientWithPackage(args: {
  firmId: string;
  clientId: string;
  packageId: string;
  year: number;
}): Promise<SeedClientWithPackageResult> {
  const { firmId, clientId, packageId, year } = args;

  // 1. Deadlines.
  const dl = await generateDeadlinesForClient({
    firmId,
    clientId,
    packageId,
    year,
  });

  // 2. Tasks — 1 per deadline. Pull deadlines for THIS client, skip any
  // that already have a task (idempotent).
  const clientDeadlines = await db
    .select({ id: deadlines.id, serviceTemplateId: deadlines.serviceTemplateId })
    .from(deadlines)
    .where(and(eq(deadlines.firmId, firmId), eq(deadlines.clientId, clientId)));
  const existingTaskDeadlines = await db
    .select({ deadlineId: tasks.deadlineId })
    .from(tasks)
    .where(eq(tasks.firmId, firmId));
  const taken = new Set(existingTaskDeadlines.map((t) => t.deadlineId));

  const [clientRow] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientId));
  const clientName = clientRow?.name ?? "client";

  const newTaskRows: TaskInsert[] = clientDeadlines
    .filter((d) => !taken.has(d.id))
    .map((d) => ({
      firmId,
      deadlineId: d.id,
      forwardingEmailLocalPart: forwardingTokenFor(clientName, d.id),
    }));

  let inserted: Array<{ id: string; deadlineId: string }> = [];
  if (newTaskRows.length > 0) {
    inserted = await db
      .insert(tasks)
      .values(newTaskRows)
      .returning({ id: tasks.id, deadlineId: tasks.deadlineId });
  }

  // 3. Checklists — per task, from each task's service_template.standardChecklist.
  const templateByDeadline = new Map(
    clientDeadlines.map((d) => [d.id, d.serviceTemplateId]),
  );
  const ci = await seedChecklistsForTasks(
    inserted.map((t) => ({
      firmId,
      taskId: t.id,
      serviceTemplateId: templateByDeadline.get(t.deadlineId) ?? null,
    })),
  );

  // 4. Milestones — Mode B proposals with substrate fallback.
  const ms = await seedMilestonesForTasks(
    inserted.map((t) => ({ firmId, taskId: t.id })),
  );

  // 5. Calendar push — fire-and-forget. The CPA sees calendar events
  // appear within seconds of finishing onboarding; failures are
  // captured via integrations.lastError without blocking the chain.
  // No-op when the firm hasn't connected Google Calendar.
  if (dl.created > 0) {
    void (async () => {
      try {
        const { syncFirmToGoogleCalendar } = await import("./calendar-sync.js");
        await syncFirmToGoogleCalendar(firmId, { onlyStale: true });
      } catch {
        // already captured inside the sync function
      }
    })();
  }

  return {
    deadlinesCreated: dl.created,
    tasksCreated: inserted.length,
    checklistItemsCreated: ci.created,
    milestonesCreated: ms.created,
  };
}
