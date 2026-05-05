import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Copy,
  Check,
  ChevronRight,
  Inbox,
  FileDown,
  Package,
  Slash,
  CalendarRange,
} from "lucide-react";
import type { Client, Task } from "../types";
import { useStore } from "../data/store";
import { bundleById } from "../data/bundles";
import { useCoverSheet } from "../hooks/useFilesFromClients";
import {
  useFileExtensionForTask,
  useUpdateTaskStatus,
} from "../hooks/useTasks";
import { env } from "../config";
import { simulateInboundDocument } from "../lib/simulate-inbound";
import { DeadlineChip, defaultActionsForState } from "./ui/DeadlineChip";
import { classifyDeadlineState } from "../data/dateHelpers";
import { TaskActions } from "./TaskActions";
import { useSession } from "../data/session";

interface Props {
  task: Task;
  client: Client;
  /** Completion percentage 0-100 from the checklist; renders the progress ring. */
  completionPct?: number;
}

export function TaskHeader({ task, client, completionPct = 0 }: Props) {
  const [copied, setCopied] = useState(false);
  const { deadlines } = useStore();
  const updateStatus = useUpdateTaskStatus();
  const fileExtension = useFileExtensionForTask();
  // Solo-firm chrome elision (Yuqi audit 2026-05-05). For 1-user firms
  // (session.tier === "solo") the preparer/reviewer split is decorative
  // — same human is both. Hide the meta line + the Assign control on
  // the TaskActions menu so the page stops asking a question that has
  // no answer worth giving.
  const session = useSession();
  const isSolo = session?.tier === "solo";
  // Simulate inbound is a dev-mode helper (fakes a document.received
  // event into the substrate). Visible to end users it produces noise
  // in real CPA inboxes — gate behind the same mock flag the cover
  // sheet uses, so it surfaces in our seeded demo and disappears in
  // production.
  const showSimulateInbound = env.useMockData;
  // Trace which service package generated this task — closes the loop
  // between Settings → Service Packages and the daily flow. Educates the CPA
  // on what's driving their workload without lecturing.
  const deadline = deadlines.find((d) => d.id === task.deadlineId);
  const sourceBundle = deadline?.bundleId ? bundleById(deadline.bundleId) : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(task.forwardingEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard denied — silent in wireframe */
    }
  };

  return (
    <header className="bg-surface border border-line rounded-md px-5 py-4">
      <nav
        aria-label="Breadcrumb"
        className="text-xs text-ink-500 flex items-center gap-1 mb-2"
      >
        <Link to="/clients" className="hover:text-ink-900">
          Clients
        </Link>
        <ChevronRight className="w-3 h-3" aria-hidden />
        <Link to={`/clients/${client.id}`} className="hover:text-ink-900">
          {client.name}
        </Link>
        <ChevronRight className="w-3 h-3" aria-hidden />
        <span className="text-ink-900">{task.formType}</span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex items-start gap-3">
          <ProgressRing pct={completionPct} />
          <div>
          <h1 className="text-xl font-semibold text-ink-900">
            {task.formType}
          </h1>
          {/* Deadline state chip — replaces the parallel "Due / Internal target /
              Client prep" labels. The mini-timeline below already shows every
              milestone date as a waypoint, so re-rendering them as inline
              comma-separated text was duplicate information at equal weight.
              The chip carries the operational state (active milestone, slip,
              IRS runway when relevant) and exposes state-appropriate actions
              on click. Internal vs official semantics: chip's primary text is
              milestone-driven; official date enters the visible band only
              once the back-plan has slipped past internal target.

              Adjacent "View in Timeline" link: opens /timeline focused on
              this task's due date so the CPA can see what else lands the
              same week (cross-client workload context). Yuqi audit
              2026-05-05: this is the bridge between "this client" and
              "everything else" that the page used to lack. */}
          <div className="mt-2 flex items-center flex-wrap gap-2">
            <DeadlineChip
              officialDueDate={task.officialDueDate}
              internalTargetDate={task.internalTargetDate}
              currentMilestoneTargetDate={
                task.clientPrepDate ?? task.internalTargetDate
              }
              currentMilestoneLabel={
                task.clientPrepDate ? "Collect" : "File"
              }
              status={task.status}
              actions={defaultActionsForState(
                classifyDeadlineState({
                  officialDueDate: task.officialDueDate,
                  internalTargetDate: task.internalTargetDate,
                  currentMilestoneTargetDate:
                    task.clientPrepDate ?? task.internalTargetDate,
                  currentMilestoneLabel: task.clientPrepDate
                    ? "Collect"
                    : "File",
                  status: task.status,
                }).recommendedAction,
                {
                  onChase: () =>
                    alert(
                      "Chase flow opens Mode D draft — wired to existing QuickActionModal in P1",
                    ),
                  onSubmit: () => updateStatus(task.id, "completed"),
                  // Phase-1: file-extension routes through the dedicated mutation
                  // (cascades to deadline) instead of a free-form status write.
                  onFileExtension: () => fileExtension(task.id),
                  onAdjustTarget: () =>
                    alert(
                      "Adjust target opens TaskMilestone editor — drag the waypoint in the mini-timeline below",
                    ),
                  onViewExtension: () =>
                    alert(
                      `Extension filed — new IRS deadline ${task.officialDueDate}`,
                    ),
                },
              )}
            />
            <Link
              to={`/timeline?focus=${task.officialDueDate}&clientId=${client.id}`}
              className="text-2xs text-ink-500 hover:text-ink-900 hover:underline inline-flex items-center gap-1"
              title="See what else lands this week across the firm"
            >
              <CalendarRange className="w-3 h-3" aria-hidden />
              View in Timeline
            </Link>
          </div>
          {!isSolo && (
            <div className="text-xs text-ink-500 mt-2 flex items-center flex-wrap gap-x-3 gap-y-1">
              <span>
                <span className="text-ink-400">Preparer:</span>{" "}
                <span className="text-ink-900">
                  {task.assignedUser || "Unassigned"}
                </span>
              </span>
              <span className="text-ink-300">·</span>
              <span>
                <span className="text-ink-400">Reviewer:</span>{" "}
                <span className={task.reviewerUser ? "text-ink-900" : "text-ink-500"}>
                  {task.reviewerUser ?? "Unassigned"}
                </span>
              </span>
            </div>
          )}
          {task.status === "not_applicable" && task.notApplicableReason && (
            <div className="mt-2 inline-flex items-start gap-1.5 text-xs text-danger-ink bg-danger-bg/40 border border-danger-border rounded px-2 py-1">
              <Slash className="w-3 h-3 shrink-0 mt-0.5 text-danger-solid" aria-hidden />
              <span>
                <span className="font-semibold">Not applicable:</span>{" "}
                {task.notApplicableReason}
              </span>
            </div>
          )}
          {sourceBundle && (
            <div className="text-xs text-ink-500 mt-2 flex items-center gap-1.5">
              <Package className="w-3 h-3 text-ink-400" aria-hidden />
              <span className="text-ink-400">Generated by</span>
              <Link
                to="/settings/packages"
                className="text-ink-700 hover:text-ink-900 hover:underline font-medium"
                title={`${sourceBundle.name} — ${sourceBundle.description}`}
              >
                {sourceBundle.name}
              </Link>
              <span className="text-ink-400">service package</span>
            </div>
          )}
          </div>
        </div>

        <TaskActions task={task} />
      </div>

      {/* Forwarding email — Method A per PRD §7.4 */}
      <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
        <span className="text-ink-500 uppercase tracking-wider font-semibold">
          Forwarding
        </span>
        <code className="font-mono text-ink-900 bg-sunken px-2 py-1 rounded">
          {task.forwardingEmail}
        </code>
        <button
          onClick={copy}
          className="text-ink-500 hover:text-ink-900 flex items-center gap-1 transition-colors"
          title="Copy forwarding address"
        >
          {copied ? (
            <span className="text-ok-ink flex items-center gap-1 animate-in fade-in">
              <Check className="w-3 h-3" /> Copied
            </span>
          ) : (
            <>
              <Copy className="w-3 h-3" /> Copy
            </>
          )}
        </button>
        <span className="text-ink-400 ml-1">
          Replies route here. Documents are sorted automatically and flagged
          for your review.
        </span>
        <span className="ml-auto flex items-center gap-2">
          <CoverSheetButton taskId={task.id} />
          {showSimulateInbound && (
            <button
              onClick={() => simulateInboundDocument(task.id, client.name)}
              className="text-xs px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken inline-flex items-center gap-1.5"
              title="Simulate a client reply with attached document — fires the document.received event (mock mode only)"
            >
              <Inbox className="w-3 h-3" aria-hidden /> Simulate inbound
            </button>
          )}
          {/* Audit trail removed from header — consolidated with the
              Audit pack button at the bottom of the documents column.
              Two audit entry points was the duplication Yuqi flagged. */}
        </span>
      </div>
    </header>
  );
}

/**
 * Cover sheet button — generates a per-task PDF the CPA can attach to
 * a chase email or print to mail. Async: requests an export, polls
 * until ready, opens the URL in a new tab.
 *
 * In mock mode the export-worker isn't running so the button is
 * disabled with a tooltip explaining why. Real mode: 1-3 second
 * generation depending on the export-worker queue depth.
 */
function CoverSheetButton({ taskId }: { taskId: string }) {
  const sheet = useCoverSheet();
  const isMock = env.useMockData;

  // Open the URL once it transitions to ready
  if (sheet.status.state === "ready" && sheet.status.url) {
    const url = sheet.status.url;
    // window.open synchronously here triggers Safari popup blocker;
    // use a useEffect-style guard via setTimeout to defer to next tick
    setTimeout(() => {
      window.open(url, "_blank", "noopener");
      sheet.reset();
    }, 0);
  }

  const onClick = () => {
    if (isMock) return;
    void sheet.generate(taskId);
  };

  const label =
    sheet.status.state === "queued"
      ? "Generating…"
      : sheet.status.state === "failed"
        ? "Retry cover sheet"
        : "Cover sheet";

  return (
    <button
      onClick={onClick}
      disabled={isMock || sheet.status.state === "queued"}
      className="text-xs px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
      title={
        isMock
          ? "Cover sheet generation runs on the BE export worker — not available in mock mode"
          : "Generate a per-task cover sheet PDF — attach to chase emails or mail it"
      }
    >
      <FileDown className="w-3 h-3" aria-hidden /> {label}
    </button>
  );
}

/**
 * Progress ring showing checklist completion percentage. Built with SVG
 * so it scales cleanly. Color shifts subtly as the value crosses 50% / 90%.
 * The needle-thin stroke keeps the ring elegant — never a "loud" donut.
 */
function ProgressRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const stroke =
    clamped >= 100
      ? "stroke-ok-solid"
      : clamped >= 50
      ? "stroke-info-solid"
      : "stroke-ink-400";
  return (
    <div className="relative w-12 h-12 shrink-0" aria-label={`${clamped}% complete`} role="img">
      <svg viewBox="0 0 44 44" className="w-12 h-12 -rotate-90">
        <circle cx="22" cy="22" r={radius} fill="none" className="stroke-line" strokeWidth="2.5" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${stroke} transition-[stroke-dashoffset] duration-500 ease-out`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xs font-medium text-ink-700 tabular-nums">
        {clamped}%
      </span>
    </div>
  );
}
