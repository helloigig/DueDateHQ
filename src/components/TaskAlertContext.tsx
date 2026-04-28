import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useStore } from "../data/store";
import type { Client, Task } from "../types";

/**
 * Soft-blocks accidental ignorance: shown at the top of Task detail when the
 * task's client is in an unread alert's affected list. Doesn't actually
 * prevent action — just surfaces the context at the moment it matters.
 *
 * The principle: state alerts are never globally must-read (too disruptive),
 * but they're contextually surfaced when relevant. PRD §7.2 accuracy SLA +
 * §4.5 yellow zone — AI surfaces, CPA decides.
 */
interface Props {
  task: Task;
  client: Client;
}

export function TaskAlertContext({ client }: Props) {
  const { announcements } = useStore();
  const affecting = announcements.filter(
    (a) =>
      !a.dismissed &&
      a.affectedClientIds.includes(client.id)
  );

  if (affecting.length === 0) return null;
  const lead = affecting[0];

  return (
    <div className="bg-warn-bg border border-warn-border rounded-md p-3 flex items-start gap-2.5">
      <AlertTriangle
        className="w-4 h-4 text-warn-ink shrink-0 mt-0.5"
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-warn-ink">
          <span className="font-semibold">
            {affecting.length === 1
              ? "This task may be affected by an active state alert."
              : `This task may be affected by ${affecting.length} active state alerts.`}
          </span>
        </p>
        <p className="text-xs text-warn-ink/80 mt-0.5">
          <span className="font-medium">
            {lead.stateCode}: {lead.title}
          </span>
          {lead.newDeadline && <> — new deadline {lead.newDeadline}</>}.
          {!lead.read && " You haven't reviewed it yet."}
        </p>
        <Link
          to={`/announcements/${lead.id}`}
          className="text-xs text-warn-ink hover:underline mt-1 inline-block font-medium"
        >
          Review alert →
        </Link>
      </div>
    </div>
  );
}
