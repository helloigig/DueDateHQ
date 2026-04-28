import type { Task, TaskStatus } from "../types";
import type { Deadline } from "../types";
import { deadlines as seedDeadlines } from "./mockDeadlines";
import { clients as seedClients } from "./mockClients";

/**
 * Per PRD §7.4 Method A: forwarding addresses follow the format
 * `firstname-formname-{4charToken}@duedatehq.com`. Token is unguessable,
 * revocable on task completion, and unique per task. We seed deterministic
 * tokens so a refresh leaves the URLs stable.
 */
function makeForwardingEmail(clientName: string, formType: string, taskId: string): string {
  const first = clientName
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const form = formType
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 8);
  // 4-char token from the task id hash
  const token = taskId
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0)
    .toString(36)
    .slice(-4)
    .padStart(4, "x");
  return `${first || "client"}-${form || "task"}-${token}@duedatehq.com`;
}

function targetDate(officialDueDate: string, days: number): string {
  const d = new Date(officialDueDate + "T00:00:00");
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function deadlineStatusToTaskStatus(s: Deadline["status"]): TaskStatus {
  return s as TaskStatus;
}

/**
 * One Task per Deadline at MVP (1:1 per PRD §3.2). Built lazily from the
 * existing deadline seeds so every dashboard row has a Task to navigate to.
 */
export function buildTasksFromDeadlines(deadlines: Deadline[]): Task[] {
  const clientById = new Map(seedClients.map((c) => [c.id, c]));
  return deadlines.map((d): Task => {
    const client = clientById.get(d.clientId);
    const taskId = `t-${d.id}`;
    return {
      id: taskId,
      clientId: d.clientId,
      deadlineId: d.id,
      formType: d.form,
      jurisdiction: d.jurisdiction,
      officialDueDate: d.officialDueDate,
      internalTargetDate: targetDate(d.officialDueDate, 7),
      clientPrepDate: targetDate(d.officialDueDate, 14),
      status: deadlineStatusToTaskStatus(d.status),
      forwardingEmail: makeForwardingEmail(
        client?.name ?? "Client",
        d.form,
        taskId
      ),
      assignedUser: d.assignedUser ?? "Sarah Mitchell",
      completedAt: d.completedAt,
      completedBy: d.completedAt ? "Sarah Mitchell" : undefined,
    };
  });
}

export const tasks: Task[] = buildTasksFromDeadlines(seedDeadlines);
