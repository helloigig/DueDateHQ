import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, MessageSquare } from "lucide-react";
import { trpc } from "../lib/api/client";
import { MOCK_TODO_ITEMS } from "../data/mockTodoItems";
import type { MockTodoItem } from "../data/mockTodoItems";
import { env } from "../config";

// JustHappenedStrip — overnight-diff triage row.
//
// Three counts the CPA wants to drain in seconds before they start chasing:
//   • to confirm  — Mode A inbound, AI-classified, you rubber-stamp
//   • issues      — Mode C anomaly flags, needs your eye
//   • replies     — client wrote back (pushback / question intents)
//
// Same trpc.todoItems feed as ActionQueue (React Query dedupes, no extra
// fetch). Hidden entirely when all counts are zero — the page shouldn't
// reserve space for a row that says "nothing happened."

type Counts = { confirm: number; issues: number; replies: number };

function countSources(items: MockTodoItem[]): Counts {
  let confirm = 0;
  let issues = 0;
  let replies = 0;
  for (const it of items) {
    if (it.source === "mode_a_inbound") confirm += 1;
    else if (it.source === "mode_c_anomaly") issues += 1;
    else if (it.source === "reply_pushback" || it.source === "reply_question")
      replies += 1;
  }
  return { confirm, issues, replies };
}

export function JustHappenedStrip() {
  const todoQuery = trpc.todoItems.list.useQuery({ limit: 50 });
  const live = todoQuery.data?.items ?? [];
  const isMock = env.useMockData;
  const useMockFallback = isMock && live.length === 0;
  const items = (
    useMockFallback ? MOCK_TODO_ITEMS : (live as MockTodoItem[])
  );
  const counts = countSources(items);

  if (counts.confirm === 0 && counts.issues === 0 && counts.replies === 0) {
    return null;
  }

  return (
    <section
      aria-label="Just happened"
      className="flex items-center gap-2 flex-wrap"
    >
      <span className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mr-1">
        Just happened
      </span>
      {counts.confirm > 0 && (
        <Pill
          to="/clients"
          icon={<CheckCircle2 className="w-3.5 h-3.5" aria-hidden />}
          tone="success"
          label={`${counts.confirm} to confirm`}
          tooltip="Mode A — AI classified inbound documents; rubber-stamp to mark received"
        />
      )}
      {counts.issues > 0 && (
        <Pill
          to="/clients"
          icon={<AlertTriangle className="w-3.5 h-3.5" aria-hidden />}
          tone="warn"
          label={`${counts.issues} ${counts.issues === 1 ? "issue" : "issues"} flagged`}
          tooltip="Mode C — AI flagged an anomaly that needs your judgment"
        />
      )}
      {counts.replies > 0 && (
        <Pill
          to="/mail"
          icon={<MessageSquare className="w-3.5 h-3.5" aria-hidden />}
          tone="info"
          label={`${counts.replies} client ${counts.replies === 1 ? "reply" : "replies"}`}
          tooltip="Inbound replies waiting on you (pushback or question intent)"
        />
      )}
    </section>
  );
}

type Tone = "success" | "warn" | "info";

const TONE_CLASSES: Record<Tone, string> = {
  success:
    "bg-success-bg/40 border-success-border text-success-ink hover:bg-success-bg/60",
  warn: "bg-warn-bg/40 border-warn-border text-warn-ink hover:bg-warn-bg/60",
  info: "bg-info-bg/40 border-info-border text-info-ink hover:bg-info-bg/60",
};

function Pill({
  to,
  icon,
  tone,
  label,
  tooltip,
}: {
  to: string;
  icon: React.ReactNode;
  tone: Tone;
  label: string;
  tooltip: string;
}) {
  return (
    <Link
      to={to}
      title={tooltip}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${TONE_CLASSES[tone]}`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
