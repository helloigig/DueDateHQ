import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Copy,
  Check,
  ChevronRight,
  Inbox,
  FileDown,
  Package,
} from "lucide-react";
import type { Client, Task, TaskStatus } from "../types";
import { actions, useStore } from "../data/store";
import { bundleById } from "../data/bundles";
import { exportAuditTrailJson, exportAuditTrailPdfStub } from "../lib/audit-trail";
import { useCoverSheet } from "../hooks/useFilesFromClients";
import { env } from "../config";
import { simulateInboundDocument } from "../lib/simulate-inbound";

const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  deferred: "Deferred",
  filed_extension: "Extension filed",
  overdue: "Overdue",
};

interface Props {
  task: Task;
  client: Client;
  /** Completion percentage 0-100 from the checklist; renders the progress ring. */
  completionPct?: number;
}

export function TaskHeader({ task, client, completionPct = 0 }: Props) {
  const [copied, setCopied] = useState(false);
  const { deadlines } = useStore();
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

  const onStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    actions.updateTaskStatus(task.id, e.target.value as TaskStatus);
  };

  const onMarkComplete = () => {
    if (
      task.status === "completed" ||
      window.confirm(`Mark ${task.formType} complete? This closes the task.`)
    ) {
      actions.updateTaskStatus(task.id, "completed");
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
          <div className="text-sm text-ink-500 mt-1 flex items-center flex-wrap gap-x-3 gap-y-1">
            <span>
              <span className="text-ink-400">Due:</span>{" "}
              <span className="text-ink-900 font-medium">
                {task.officialDueDate}
              </span>
            </span>
            <span className="text-ink-300">·</span>
            <span>
              <span className="text-ink-400">Internal target:</span>{" "}
              {task.internalTargetDate}
            </span>
            {task.clientPrepDate && (
              <>
                <span className="text-ink-300">·</span>
                <span>
                  <span className="text-ink-400">Client prep:</span>{" "}
                  {task.clientPrepDate}
                </span>
              </>
            )}
            <span className="text-ink-300">·</span>
            <span>
              <span className="text-ink-400">Preparer:</span>{" "}
              <span className="text-ink-900">{task.assignedUser}</span>
            </span>
            <span className="text-ink-300">·</span>
            <span>
              <span className="text-ink-400">Reviewer:</span>{" "}
              <span className="text-ink-700">
                {/* Phase 2 stub — wireframe shows the field; real assignment
                    UI ships with the role-aware permissions update. */}
                Unassigned
              </span>
              <button
                type="button"
                className="ml-1 text-2xs text-ink-500 underline hover:text-ink-900"
                onClick={() => alert("Reviewer assignment ships in Phase 2 alongside Admin/Viewer roles")}
              >
                assign
              </button>
            </span>
          </div>
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

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={task.status}
            onChange={onStatusChange}
            className="text-sm border border-line rounded px-2 py-1.5 bg-surface text-ink-900"
          >
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            onClick={onMarkComplete}
            disabled={task.status === "completed"}
            className="text-sm px-3 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {task.status === "completed" ? "Completed" : "Mark complete"}
          </button>
        </div>
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
          <button
            onClick={() => simulateInboundDocument(task.id, client.name)}
            className="text-xs px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken inline-flex items-center gap-1.5"
            title="Simulate a client reply with attached document — fires the document.received event"
          >
            <Inbox className="w-3 h-3" aria-hidden /> Simulate inbound
          </button>
          <button
            onClick={() => {
              exportAuditTrailJson(task);
              exportAuditTrailPdfStub(task);
            }}
            className="text-xs px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken inline-flex items-center gap-1.5"
            title="IRS audit-trail compliant export"
          >
            <FileDown className="w-3 h-3" aria-hidden /> Audit trail
          </button>
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
  const isMock = env.useMockApi;

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
