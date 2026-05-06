import { useNavigate } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { trpc } from "../lib/api/client";
import { MOCK_TODO_ITEMS } from "../data/mockTodoItems";
import type { MockTodoItem } from "../data/mockTodoItems";
import { env } from "../config";
import { cn } from "../lib/utils";

// MorningTriage — the directive layer above the action queue.
//
// What the CPA actually needs Monday morning is a single answer to "what
// must I touch NOW or TODAY?" The dual KPI tiles (Behind plan / Filing
// today) and the JustHappened chip strip both spoke that language too
// quietly: zero-state numbers eat real estate, and chips read as decoration
// instead of CTA. This block replaces both.
//
// When any actionable count is non-zero, render banner-weight cards in
// blocking-first priority — the eye lands on the one item that demands the
// next gesture, every CTA names the verb, the row is the click target.
// When everything's calm, collapse to a single one-line summary so the
// page yields its space to the queue immediately below.
//
// Priority order (top → bottom):
//   1. past_official     — DANGER — legal miss, file or extend NOW
//   2. filing_today      — WARN   — calendar TODAY, last call before EOD
//   3. anomalies         — WARN   — AI flagged, blocks confirmation, needs judgment
//   4. behind_plan       — WARN   — internal target eaten, drift signal
//   5. replies_waiting   — INFO   — client wrote back, conversational
//   6. inbound_to_confirm — OK    — overnight rubber-stamp work
//
// Lower-priority items still surface; higher-urgency ones are simply at
// the top so the morning glance reads "fire first."

export type MorningTriageSummary = {
  pastInternalTarget: number;
  pastOfficial: number;
  dueToday: number;
};

type Tone = "danger" | "warn" | "info" | "ok";

type TriageAction = {
  key: string;
  tone: Tone;
  icon: LucideIcon;
  headline: string;
  detail: string;
  ctaLabel: string;
  to: string;
};

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

export function MorningTriage({
  summary,
}: {
  summary: MorningTriageSummary;
}) {
  const todoQuery = trpc.todoItems.list.useQuery({ limit: 50 });
  const live = todoQuery.data?.items ?? [];
  const useMockFallback = env.useMockData && live.length === 0;
  const items = useMockFallback ? MOCK_TODO_ITEMS : (live as MockTodoItem[]);
  const counts = countSources(items);

  const actions: TriageAction[] = [];

  if (summary.pastOfficial > 0) {
    actions.push({
      key: "past_official",
      tone: "danger",
      icon: AlertOctagon,
      headline:
        summary.pastOfficial === 1
          ? "1 deadline past the official date"
          : `${summary.pastOfficial} deadlines past the official date`,
      detail: "Legal miss — file or extend NOW",
      ctaLabel: "Review",
      to: "/timeline",
    });
  }

  if (summary.dueToday > 0) {
    actions.push({
      key: "filing_today",
      tone: "warn",
      icon: Calendar,
      headline:
        summary.dueToday === 1
          ? "1 filing due today"
          : `${summary.dueToday} filings due today`,
      detail: "Last call before EOD — confirm filed",
      ctaLabel: "Open",
      to: "/timeline",
    });
  }

  if (counts.issues > 0) {
    actions.push({
      key: "anomalies",
      tone: "warn",
      icon: AlertTriangle,
      headline:
        counts.issues === 1
          ? "1 anomaly needs your judgment"
          : `${counts.issues} anomalies need your judgment`,
      detail:
        "AI flagged numbers that don't match prior year — can't be auto-confirmed",
      ctaLabel: "Resolve",
      to: "/clients",
    });
  }

  if (summary.pastInternalTarget > 0) {
    actions.push({
      key: "behind_plan",
      tone: "warn",
      icon: AlertTriangle,
      headline:
        summary.pastInternalTarget === 1
          ? "1 client is behind plan"
          : `${summary.pastInternalTarget} clients are behind plan`,
      detail: "Past internal target — buffer eaten, bring back on track today",
      ctaLabel: "See plan",
      to: "/timeline",
    });
  }

  if (counts.replies > 0) {
    actions.push({
      key: "replies",
      tone: "info",
      icon: MessageSquare,
      headline:
        counts.replies === 1
          ? "1 client reply waiting"
          : `${counts.replies} client replies waiting`,
      detail: "Pushback or question — needs your decision",
      ctaLabel: "Open",
      to: "/mail",
    });
  }

  if (counts.confirm > 0) {
    actions.push({
      key: "inbound_to_confirm",
      tone: "ok",
      icon: CheckCircle2,
      headline:
        counts.confirm === 1
          ? "Rubber-stamp 1 inbound doc"
          : `Rubber-stamp ${counts.confirm} inbound docs`,
      detail: "AI classified these overnight · ~30s each",
      ctaLabel: "Review",
      to: "/clients",
    });
  }

  // Calm state — single one-liner that yields its space to the queue.
  if (actions.length === 0) {
    return (
      <div
        className="mb-section bg-surface border border-line rounded-md px-region py-2.5 flex items-center gap-3"
        aria-label="Morning triage"
      >
        <CheckCircle2 className="w-4 h-4 text-ok-ink shrink-0" aria-hidden />
        <span className="text-sm text-ink-700">
          <span className="font-medium text-ink-900">All caught up.</span>{" "}
          <span className="text-ink-500 tabular-nums">
            0 behind plan · 0 filing today · nothing inbound to triage
          </span>
        </span>
      </div>
    );
  }

  return (
    <div
      className="mb-section flex flex-col gap-2"
      aria-label="Morning triage"
    >
      {actions.map((a) => (
        <TriageBanner key={a.key} action={a} />
      ))}
    </div>
  );
}

const TONE_CONTAINER: Record<Tone, string> = {
  danger:
    "bg-danger-bg/40 border-danger-border hover:bg-danger-bg/60",
  warn: "bg-warn-bg/40 border-warn-border hover:bg-warn-bg/60",
  info: "bg-info-bg/40 border-info-border hover:bg-info-bg/60",
  ok: "bg-ok-bg/40 border-ok-border hover:bg-ok-bg/60",
};

const TONE_ICON: Record<Tone, string> = {
  danger: "text-danger-ink",
  warn: "text-warn-ink",
  info: "text-info-ink",
  ok: "text-ok-ink",
};

function TriageBanner({ action }: { action: TriageAction }) {
  const navigate = useNavigate();
  const Icon = action.icon;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(action.to)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(action.to);
        }
      }}
      className={cn(
        "flex items-center gap-3 px-region py-3 border rounded-md cursor-pointer transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40",
        TONE_CONTAINER[action.tone],
      )}
    >
      <Icon
        className={cn("w-5 h-5 shrink-0", TONE_ICON[action.tone])}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink-900 leading-snug">
          {action.headline}
        </div>
        <div className="text-xs text-ink-500 mt-0.5 line-clamp-1">
          {action.detail}
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-700 shrink-0">
        {action.ctaLabel}
        <ChevronRight className="w-3.5 h-3.5" aria-hidden />
      </span>
    </div>
  );
}
