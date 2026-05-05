/**
 * Milestone seeder — auto-create the 5 default TaskMilestone rows when a
 * Task is created. Replaces the friction step where every new task required
 * a CPA click on "Propose dates" in TaskMiniTimeline.
 *
 * Calls Mode B `predictMilestoneTargetDates` to populate target_date per
 * milestone. Substrate fallback (PRD §4.2 cold-start) when no API key. Always
 * creates the 5 rows — even substrate dates are better than no rows, because
 * Timeline / TaskMiniTimeline render milestones-only when present.
 *
 * Idempotent: skips if any milestones already exist for the task.
 *
 * Per PRD §9.4.1: AI authority is yellow zone — proposed_by="ai". CPA can
 * accept/edit/dismiss via existing taskMilestones.update mutation.
 */

import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  clients,
  deadlines,
  taskMilestones,
  tasks,
} from "../db/schema.js";
import { predictMilestoneTargetDates } from "./ai.js";
import { log, captureException } from "./observability.js";

export async function seedMilestonesForTask(args: {
  firmId: string;
  taskId: string;
}): Promise<{ created: number; skipped: boolean }> {
  // Skip if milestones already exist (idempotency).
  const existing = await db
    .select({ id: taskMilestones.id })
    .from(taskMilestones)
    .where(
      and(
        eq(taskMilestones.firmId, args.firmId),
        eq(taskMilestones.taskId, args.taskId),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    return { created: 0, skipped: true };
  }

  // Resolve task → deadline → client for Mode B context.
  const [taskRow] = await db
    .select({
      taskId: tasks.id,
      formType: deadlines.formType,
      officialDueDate: deadlines.officialDueDate,
      clientName: clients.name,
      clientTier: clients.tier,
    })
    .from(tasks)
    .innerJoin(deadlines, eq(deadlines.id, tasks.deadlineId))
    .innerJoin(clients, eq(clients.id, deadlines.clientId))
    .where(
      and(eq(tasks.id, args.taskId), eq(tasks.firmId, args.firmId)),
    );
  if (!taskRow) {
    log.warn("milestone_seeder.task_not_found", {
      taskId: args.taskId,
      firmId: args.firmId,
    });
    return { created: 0, skipped: true };
  }

  const result = await predictMilestoneTargetDates({
    firmId: args.firmId,
    taskId: args.taskId,
    formType: taskRow.formType,
    officialDueDate: taskRow.officialDueDate,
    clientName: taskRow.clientName,
    clientTier:
      taskRow.clientTier === "premium" || taskRow.clientTier === "basic"
        ? taskRow.clientTier
        : "standard",
  });
  if (!result) {
    // predictMilestoneTargetDates only returns null on a hard error path —
    // substrate fallback handles the no-key + LLM-fail cases. Defensive log.
    log.warn("milestone_seeder.no_proposals", {
      taskId: args.taskId,
    });
    return { created: 0, skipped: false };
  }

  await db.insert(taskMilestones).values(
    result.proposals.map((p, idx) => ({
      firmId: args.firmId,
      taskId: args.taskId,
      milestoneType: p.milestoneType,
      targetDate: p.targetDate,
      displayOrder: idx,
      proposedBy: "ai" as const,
      status: "not_started" as const,
    })),
  );

  log.info("milestone_seeder.seeded", {
    taskId: args.taskId,
    count: result.proposals.length,
    overallConfidence: result.overallConfidence,
  });

  return { created: result.proposals.length, skipped: false };
}

/**
 * Bulk variant — used after imports.commit creates many tasks at once.
 * Runs in parallel; logs but doesn't throw on individual failures (one
 * task's seeder error shouldn't block the rest).
 */
export async function seedMilestonesForTasks(
  taskRefs: Array<{ firmId: string; taskId: string }>,
): Promise<{ created: number }> {
  const results = await Promise.allSettled(
    taskRefs.map((t) => seedMilestonesForTask(t)),
  );
  let total = 0;
  for (const r of results) {
    if (r.status === "fulfilled") {
      total += r.value.created;
    } else {
      captureException(r.reason, { ctx: "milestone_seeder.bulk" });
    }
  }
  return { created: total };
}

/**
 * Best-effort seed — called from task-creation paths that shouldn't fail
 * the user's request if the milestone seed errors out. Logs + continues.
 */
export async function trySeedMilestonesForTask(args: {
  firmId: string;
  taskId: string;
}): Promise<void> {
  try {
    await seedMilestonesForTask(args);
  } catch (err) {
    captureException(err, { ctx: "milestone_seeder.try", ...args });
  }
}
