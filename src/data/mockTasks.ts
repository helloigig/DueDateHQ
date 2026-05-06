import type { Task, TaskStatus } from "../types";
import type { Deadline } from "../types";
import { deadlines as seedDeadlines } from "./mockDeadlines";
import { clients as seedClients } from "./mockClients";

/**
 * Per PRD §7.4 Method A: forwarding addresses follow the format
 * `firstname-formname-{4charToken}@duedatehq.space`. Token is unguessable,
 * revocable on task completion, and unique per task. We seed deterministic
 * tokens so a refresh leaves the URLs stable.
 *
 * TLD note: production MX is duedatehq.space (Postmark). Never .com — that
 * domain is not ours, and any address rendered with .com would bounce.
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
  return `${first || "client"}-${form || "task"}-${token}@duedatehq.space`;
}

function targetDate(officialDueDate: string, days: number): string {
  const d = new Date(officialDueDate + "T00:00:00");
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Default internal-deadline buffer in days, matching the FirmSession
 * field collected during onboarding (Settings → Firm). Mock seed bakes
 * this value into every task's internalTargetDate so demo state aligns
 * with the field's default. When the firm changes their buffer, live
 * mode recomputes per-task targets server-side; mock mode currently
 * keeps the seed (the field is stored but recompute on change is a BE
 * mutation that doesn't exist in mock yet).
 */
const DEFAULT_BUFFER_DAYS = 14;

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
      // Internal target = official − DEFAULT_BUFFER_DAYS. The buffer is
      // a per-firm setting (FirmSession.internalDeadlineBufferDays,
      // collected in onboarding, default 14d). Mock seed uses the
      // matching default so demo state lines up with what the user
      // configured. Live mode: backend recomputes per-task internal
      // targets when the firm's buffer changes.
      internalTargetDate: targetDate(d.officialDueDate, DEFAULT_BUFFER_DAYS),
      // clientPrepDate = official − (buffer + 7d). Adds an additional
      // week before the internal target to chase clients for documents.
      clientPrepDate: targetDate(d.officialDueDate, DEFAULT_BUFFER_DAYS + 7),
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
