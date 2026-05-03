import { Link } from "react-router-dom";
import { trpc } from "../lib/api/client";
import { MOCK_TODO_ITEMS } from "../data/mockTodoItems";
import type { MockTodoItem } from "../data/mockTodoItems";
import { env } from "../config";

// JustHappenedStrip — overnight diff, rendered as a single inline text
// line. NOT a stack of colored pills (that visually competed with State
// alerts and confused the page hierarchy — "is this another alert
// surface?"). This strip answers "what changed in your inbox overnight?",
// State alerts answers "what did the government just announce?". Two
// different things, two different visual weights:
//   • Just happened  = thin status line, ambient
//   • State alerts   = full cards, demands attention
//
// Three counts the CPA wants to drain in seconds before they start
// chasing — Mode A inbound, Mode C anomaly flags, client replies.
// Hidden entirely when all counts are zero.

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

  const segments: Array<{ to: string; text: string; tone?: string }> = [];
  if (counts.confirm > 0) {
    segments.push({
      to: "/clients",
      text: `${counts.confirm} to confirm`,
      tone: "text-ok-ink hover:text-ok-ink/80",
    });
  }
  if (counts.issues > 0) {
    segments.push({
      to: "/clients",
      text: `${counts.issues} to review`,
      tone: "text-warn-ink hover:text-warn-ink/80",
    });
  }
  if (counts.replies > 0) {
    segments.push({
      to: "/mail",
      text: `${counts.replies} ${counts.replies === 1 ? "reply" : "replies"}`,
      tone: "text-info-ink hover:text-info-ink/80",
    });
  }

  return (
    <p
      aria-label="Overnight from clients"
      className="text-sm text-ink-500 flex items-center flex-wrap gap-x-2"
    >
      <span className="text-ink-700">Overnight from clients:</span>
      {segments.map((s, i) => (
        <span key={s.to + s.text} className="inline-flex items-center gap-2">
          <Link
            to={s.to}
            className={`font-medium underline-offset-2 hover:underline ${s.tone ?? ""}`}
          >
            {s.text}
          </Link>
          {i < segments.length - 1 && (
            <span className="text-ink-300" aria-hidden>
              ·
            </span>
          )}
        </span>
      ))}
    </p>
  );
}
