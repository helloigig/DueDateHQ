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
} from "lucide-react";
import type { Client, Task } from "../types";
import { useStore } from "../data/store";
import { bundleById } from "../data/bundles";
import { exportAuditTrailJson, exportAuditTrailPdf } from "../lib/audit-trail";
import { useCoverSheet } from "../hooks/useFilesFromClients";
import {
  useFileExtensionForTask,
  useUpdateTaskStatus,
} from "../hooks/useTasks";
import { env } from "../config";
import { simulateInboundDocument } from "../lib/simulate-inbound";
import { periodSuffix } from "../lib/formPeriod";
import { DeadlineChip, defaultActionsForState } from "./ui/DeadlineChip";
import { classifyDeadlineState } from "../data/dateHelpers";
import { TaskActions } from "./TaskActions";
import { ClientChip } from "./ClientChip";

interface Props {
  task: Task;
  client: Client;
  /** Open the AI email-draft modal in chase mode. The DeadlineChip
   *  surfaces this when `recommendedAction === "chase"`. Wired by the
   *  parent (TaskPanel) so the modal state stays at panel scope. */
  onChase?: () => void;
  /** Hide the "Clients > {client} > {form}" breadcrumb. TaskPanel
   *  sets this when rendering inside a client drawer — the parent
   *  client page already establishes the breadcrumb; repeating it
   *  inside the drawer is redundant. */
  hideBreadcrumb?: boolean;
}

export function TaskHeader({
  task,
  client,
  onChase,
  hideBreadcrumb,
}: Props) {
  const [copied, setCopied] = useState(false);
  const { deadlines } = useStore();
  const updateStatus = useUpdateTaskStatus();
  const fileExtension = useFileExtensionForTask();
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
      {!hideBreadcrumb && (
        <nav
          aria-label="Breadcrumb"
          className="text-xs text-ink-500 flex items-center gap-1 mb-2"
        >
          <Link to="/clients" className="hover:text-ink-900">
            Clients
          </Link>
          <ChevronRight className="w-3 h-3" aria-hidden />
          {/* Breadcrumb leaf for the client — sm chip keeps it inline at
              the breadcrumb font size; tier dot is suppressed because the
              full identity sits in the H1 below. */}
          <ClientChip
            client={client}
            size="sm"
            as="link"
            showTier={false}
            showState={false}
          />
          <ChevronRight className="w-3 h-3" aria-hidden />
          <span className="text-ink-900">
            {task.formType}
            {(() => {
              const period = periodSuffix(task.formType, task.officialDueDate);
              return period ? ` · ${period}` : null;
            })()}
          </span>
        </nav>
      )}

      {/* Header layout: title block sits side-by-side with the action
          group at sm+; stacks on mobile so the right-aligned action
          pills don't crowd the title. ProgressRing dropped 2026-05-06
          per Yuqi audit ("what does 0% mean?") — the actual progress
          signal lives in the checklist sections below ("Still
          waiting · 1 of 1 items"). */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div>
          {/* Title typography matches PageHeader (text-display, 22/600).
              Inline h1 (not <PageHeader>) because the deadline chip + meta
              cling to the title row inside a flex layout. */}
          <h1 className="text-display font-semibold text-ink-900 leading-7 tracking-[-0.01em]">
            {task.formType}
            {/* Quarterly disambiguator (941/720) so three same-form tasks
                on one client read distinctly. Same logic FilingsTab uses
                in the row title. Yuqi audit 2026-05-06 (Task surface). */}
            {(() => {
              const period = periodSuffix(task.formType, task.officialDueDate);
              if (!period) return null;
              return (
                <span
                  className="ml-2 align-middle text-sm font-semibold px-1.5 py-0.5 rounded bg-sunken text-ink-700 border border-line tabular-nums"
                  title={`${period} of fiscal year (due ${task.officialDueDate})`}
                >
                  {period}
                </span>
              );
            })()}
          </h1>
          {/* Deadline state chip — replaces the parallel "Due / Internal target /
              Client prep" labels. The mini-timeline below already shows every
              milestone date as a waypoint, so re-rendering them as inline
              comma-separated text was duplicate information at equal weight.
              The chip carries the operational state (active milestone, slip,
              IRS runway when relevant) and exposes state-appropriate actions
              on click.

              Reconciliation with the canonical Task action set (PR #94 /
              <TaskActions/>): the chip popover and the action dropdown now
              route through the same hooks (useUpdateTaskStatus +
              useFileExtensionForTask) and use matching window.confirm prompts
              so the audit trail is identical regardless of which entry the
              CPA used. The chip's value-add is *state-aware recommendation*
              (it surfaces the 1-2 verbs that match the current state with
              precise sub-labels like "Stops the overdue clock"); the
              dropdown's value-add is *the full lifecycle menu*. They are
              complements, not alternates. */}
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
                  // Chase opens the AI-drafted modal — handler lives on
                  // TaskDetail so modal state stays page-scoped. Resolved
                  // in favour of main's prop-callback wiring (was: chip
                  // passed undefined to suppress chase entirely while we
                  // waited for the modal lift). Page-scoped is the right
                  // home for transient modal state.
                  onChase: onChase,
                  // Mark complete — direct mutation. The canonical
                  // <TaskActions/> "Mark complete" button keeps its own
                  // window.confirm prompt; the chip is a recommendation
                  // surface, not a confirmation surface, so a second
                  // dialog here would be duplicate gatekeeping.
                  onSubmit: () => updateStatus(task.id, "completed"),
                  // File extension routes through the dedicated mutation
                  // (cascades to deadline) instead of a free-form status
                  // write. Same hook as <TaskActions/>' overflow menu.
                  onFileExtension: () => fileExtension(task.id),
                  // onAdjustTarget intentionally omitted — the mini-timeline
                  // below already exposes drag-the-waypoint as the canonical
                  // editor; an extra button here was duplicate UX.
                  // onViewExtension intentionally omitted — the ExtensionBanner
                  // on TaskDetail already shows submitted/approved + new IRS
                  // deadline above the header. No need to re-route here.
                },
              )}
            />
            {/* "View in Timeline" link removed 2026-05-06 — Path to
                filing IS the per-task timeline view. Linking to a
                cross-client Timeline duplicated the same axis. If
                cross-week workload context is wanted, the Timeline
                destination is one click away in the sidebar. */}
          </div>
          <div className="text-xs text-ink-500 mt-2 flex items-baseline flex-wrap gap-x-section gap-y-1">
            <span>
              <span className="text-ink-400">Preparer:</span>{" "}
              <span className="text-ink-900">
                {task.assignedUser || "Unassigned"}
              </span>
            </span>
            <span>
              <span className="text-ink-400">Reviewer:</span>{" "}
              <span className={task.reviewerUser ? "text-ink-900" : "text-ink-500"}>
                {task.reviewerUser ?? "Unassigned"}
              </span>
            </span>
          </div>
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

      {/* Forwarding strip — Method A per PRD §7.4. Yuqi audit
          2026-05-06: "is forwarding that email important? what does
          cover sheet/audit trail mean?"
            • Forwarding IS load-bearing — it's the substrate. Added
              an inline explainer line so the user knows what the
              address is for at a glance, not via tooltip.
            • Cover sheet + Audit trail are niche (mail-in clients,
              annual audits) — moved behind a ⋯ overflow so they
              don't compete with the substrate address for first
              read. Mock-mode-only Simulate inbound stays as a
              debug helper but only when env.useMockData. */}
      <div className="mt-4 pt-3 border-t border-line text-xs">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
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
          <ForwardingOverflow
            task={task}
            clientName={client.name}
          />
        </div>
        <p className="text-2xs text-ink-500 mt-1.5 leading-relaxed">
          Email this address to forward client docs. AI extracts data,
          threads inbound files to this task, flags issues for your
          review. Replies to chase emails land here automatically.
        </p>
      </div>
    </header>
  );
}

/**
 * Niche actions tucked behind a ⋯ overflow on the forwarding strip:
 *   • Cover sheet — printable PDF for clients mailing in physical docs
 *   • Audit trail — IRS-compliance export
 *   • Simulate inbound — mock-mode dev helper only
 *
 * These were three competing buttons on the strip that crowded the
 * forwarding address itself. Tucking them away keeps the substrate
 * (the address) primary and these niche affordances discoverable
 * without being loud.
 */
function ForwardingOverflow({
  task,
  clientName,
}: {
  task: Task;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ml-auto relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="text-xs px-2 py-1 rounded text-ink-500 hover:text-ink-900 hover:bg-sunken inline-flex items-center gap-1"
        title="More actions on this task"
      >
        <span aria-hidden>⋯</span>
        <span className="sr-only">More actions</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute z-30 right-0 top-full mt-1 min-w-[200px] bg-surface border border-line rounded-md shadow-pop p-1"
          onMouseLeave={() => setOpen(false)}
        >
          <CoverSheetMenuItem taskId={task.id} onPicked={() => setOpen(false)} />
          <button
            type="button"
            onClick={() => {
              exportAuditTrailJson(task);
              exportAuditTrailPdf(task);
              setOpen(false);
            }}
            className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-sunken flex items-center gap-2"
          >
            <FileDown className="w-3 h-3 text-ink-500" aria-hidden />
            <span>Audit trail</span>
            <span className="ml-auto text-2xs text-ink-400">JSON + PDF</span>
          </button>
          {env.useMockData && (
            <button
              type="button"
              onClick={() => {
                simulateInboundDocument(task.id, clientName);
                setOpen(false);
              }}
              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-sunken flex items-center gap-2"
              title="Mock-mode helper: simulates a client reply with attached document"
            >
              <Inbox className="w-3 h-3 text-ink-500" aria-hidden />
              <span>Simulate inbound</span>
              <span className="ml-auto text-2xs text-ink-400">debug</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Inline cover-sheet item for the overflow menu. Wraps the existing
 * CoverSheetButton's logic but renders as a menu row instead of a
 * standalone button.
 */
function CoverSheetMenuItem({
  taskId,
  onPicked,
}: {
  taskId: string;
  onPicked: () => void;
}) {
  const sheet = useCoverSheet();
  const isMock = env.useMockData;
  if (sheet.status.state === "ready" && sheet.status.url) {
    const url = sheet.status.url;
    setTimeout(() => {
      window.open(url, "_blank", "noopener");
      sheet.reset();
    }, 0);
  }
  const onClick = () => {
    if (isMock) return;
    void sheet.generate(taskId);
    onPicked();
  };
  const label =
    sheet.status.state === "queued"
      ? "Generating cover sheet…"
      : sheet.status.state === "failed"
        ? "Retry cover sheet"
        : "Cover sheet";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isMock || sheet.status.state === "queued"}
      className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-sunken flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      title={
        isMock
          ? "Cover sheet generation runs on the BE export worker — not available in mock mode"
          : "Generate a per-task cover sheet PDF — attach to chase emails or mail it"
      }
    >
      <FileDown className="w-3 h-3 text-ink-500" aria-hidden />
      <span>{label}</span>
      <span className="ml-auto text-2xs text-ink-400">PDF</span>
    </button>
  );
}

// CoverSheetButton inlined into ForwardingOverflow above — Yuqi audit
// 2026-05-06 moved cover sheet behind ⋯ overflow on the forwarding strip.

// ProgressRing removed 2026-05-06 — see Props.completionPct comment.
