import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Plus,
  Pencil,
  Hourglass,
  Star,
  Archive,
  ArrowLeftRight,
  StickyNote,
  Tag,
  Send,
  Inbox,
  FileText,
  AlertTriangle,
  Bot,
  Circle,
  type LucideIcon,
} from "lucide-react";
import type { ActivityEntry, ActivityType } from "../types";

const ICON: Record<ActivityType, LucideIcon> = {
  status_change: Check,
  deadline_added: Plus,
  deadline_updated: Pencil,
  extension_filed: Hourglass,
  client_created: Star,
  client_edited: Pencil,
  client_archived: Archive,
  batch_adjust: ArrowLeftRight,
  note_added: StickyNote,
  bundle_assigned: Tag,
  email_sent: Send,
  email_received: Inbox,
  document_received: FileText,
  document_confirmed: CheckCircle2,
  document_flagged: AlertTriangle,
  ai_inferred: Bot,
  checklist_state_change: Circle,
};

const FILTER_GROUPS: Array<{
  label: string;
  types: ActivityType[];
}> = [
  { label: "All", types: [] },
  {
    label: "Email",
    types: ["email_sent", "email_received"],
  },
  {
    label: "Documents",
    types: ["document_received", "document_confirmed", "document_flagged"],
  },
  { label: "Status", types: ["status_change", "extension_filed"] },
  { label: "AI", types: ["ai_inferred"] },
  { label: "Notes", types: ["note_added"] },
];

interface Props {
  entries: ActivityEntry[];
  /** When set, only entries with `relatedDeadlineId === scopeDeadlineId`
   * are shown. Used by Task detail to scope to one task. */
  scopeDeadlineId?: string;
  title?: string;
}

export function ActivityTimeline({
  entries,
  scopeDeadlineId,
  title = "Activity",
}: Props) {
  const [filter, setFilter] = useState<ActivityType[]>([]);
  const scoped = scopeDeadlineId
    ? entries.filter((e) => e.relatedDeadlineId === scopeDeadlineId)
    : entries;
  const visible =
    filter.length === 0
      ? scoped
      : scoped.filter((e) => filter.includes(e.type));

  return (
    <section className="bg-surface border border-line rounded-md">
      <header className="flex items-center px-4 py-3 border-b border-line gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-700">
          {title}
          <span className="ml-2 text-ink-400 font-normal normal-case tracking-normal">
            ({scoped.length})
          </span>
        </h2>
        <div className="ml-auto flex items-center gap-1 flex-wrap">
          {FILTER_GROUPS.map((g) => {
            const active =
              g.types.length === 0
                ? filter.length === 0
                : g.types.every((t) => filter.includes(t)) &&
                  filter.length === g.types.length;
            return (
              <button
                key={g.label}
                onClick={() => setFilter(g.types)}
                className={[
                  "text-2xs uppercase tracking-wide px-2 py-0.5 rounded border",
                  active
                    ? "bg-ink-900 text-canvas border-ink-900"
                    : "border-line text-ink-500 hover:bg-sunken",
                ].join(" ")}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </header>
      {visible.length === 0 ? (
        <div className="px-4 py-6 text-sm text-ink-500">
          No activity yet for this filter.
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((e) => (
            <li
              key={e.id}
              className="px-4 py-2.5 flex items-start gap-3 text-sm"
            >
              <span aria-hidden className="leading-5 select-none w-5 flex items-center justify-center text-ink-500">
                {(() => {
                  const Icon = ICON[e.type] ?? Circle;
                  return <Icon className="w-3.5 h-3.5" />;
                })()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-ink-900">{e.summary}</p>
                <p className="text-xs text-ink-500">
                  {fmtTimestamp(e.timestamp)} · {e.actorName}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <footer className="px-4 py-2 text-2xs text-ink-400 border-t border-line">
        Append-only · IRS audit-trail compliant. Entries cannot be deleted.
      </footer>
    </section>
  );
}

function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const md = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${md} · ${time}`;
}
