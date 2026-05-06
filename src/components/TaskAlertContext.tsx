import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useStore } from "../data/store";
import type { Client, Task } from "../types";
import { StateBadge } from "./ui/StateBadge";

/**
 * Soft-blocks accidental ignorance: shown at the top of Task detail when an
 * unread alert affects this client AND plausibly touches this specific task
 * (matched by jurisdiction). Without the task-level scope this banner used
 * to repeat every alert touching the client — Sarah just saw the same
 * 7-alert summary on the Client page, then again as a banner on every
 * task. The match below narrows to alerts whose jurisdiction matches the
 * task's (federal-form tasks see federal alerts; state-form tasks see
 * alerts for their state). Routine alerts that only touch other forms on
 * this client stay on /alerts where they belong.
 *
 * The principle: state alerts are never globally must-read (too disruptive),
 * but they're contextually surfaced when relevant. PRD §7.2 accuracy SLA +
 * §4.5 yellow zone — AI surfaces, CPA decides.
 */
interface Props {
  task: Task;
  client: Client;
}

export function TaskAlertContext({ task, client }: Props) {
  const { announcements } = useStore();
  const affecting = announcements.filter((a) => {
    if (a.dismissed) return false;
    if (!a.affectedClientIds.includes(client.id)) return false;
    // Jurisdiction match: federal-task ↔ federal alerts (rare since
    // alerts are state-issued); state-task ↔ alerts for that state.
    // This drops the cross-jurisdiction noise that made the banner
    // duplicate the client-level "ACTIVE STATE ALERTS" list.
    if (task.jurisdiction === "federal") return a.stateCode === ("federal" as unknown as typeof a.stateCode);
    return a.stateCode === task.jurisdiction;
  });

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
        <p className="text-xs text-warn-ink/80 mt-0.5 flex items-center gap-1.5 flex-wrap">
          <StateBadge code={lead.stateCode} size="sm" />
          <span className="font-medium">{lead.title}</span>
          {lead.newDeadline && <span>— new deadline {lead.newDeadline}.</span>}
          {!lead.read && <span>You haven't reviewed it yet.</span>}
        </p>
        <Link
          to={`/alerts/${lead.id}`}
          className="text-xs text-warn-ink hover:underline mt-1 inline-block font-medium"
        >
          Review alert →
        </Link>
      </div>
    </div>
  );
}
