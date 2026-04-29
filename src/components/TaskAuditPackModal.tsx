import { useState } from "react";
import { FileText, Braces, Download } from "lucide-react";
import type {
  ActivityEntry,
  ChecklistItem,
  Client,
  Task,
} from "../types";
import { formatLongDate } from "../data/dateHelpers";
import {
  downloadJson,
  escapeHtml,
  printHtmlAsPdf,
} from "../lib/printToPdf";
import { Modal, useModalLabelId } from "./Modal";

type Format = "pdf" | "json";

/**
 * Per-task audit-trail packer. PRD §11.3, §15.4. Bundles task + checklist +
 * activity timeline into either a print-ready PDF (browser print dialog) or a
 * structured JSON (stable schema for IRS audit response and integrations).
 *
 * The PDF output is the IRS-grade artifact: vector text, font rendering by
 * the user's browser, accessibility tagging, and the firm's printer if a hard
 * copy is needed. The JSON is for downstream tooling.
 */
export function TaskAuditPackModal({
  open,
  task,
  client,
  checklist,
  activity,
  firmName = "Mitchell CPA",
  onClose,
}: {
  open: boolean;
  task: Task | null;
  client: Client | null;
  checklist: ChecklistItem[];
  activity: ActivityEntry[];
  firmName?: string;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<Format>("pdf");
  const [flash, setFlash] = useState<string | null>(null);
  const labelId = useModalLabelId();

  if (!task || !client) return null;

  const scopedActivity = activity.filter(
    (a) => !a.relatedDeadlineId || a.relatedDeadlineId === task.deadlineId
  );

  const onRun = () => {
    if (format === "pdf") {
      const html = buildPdfHtml(
        task,
        client,
        checklist,
        scopedActivity,
        firmName
      );
      const docTitle = `Audit pack — ${client.name} — ${task.formType}`;
      printHtmlAsPdf(html, docTitle);
      setFlash(
        `Opened the print dialog — choose "Save as PDF" to download. Includes ${
          checklist.length
        } checklist item${checklist.length === 1 ? "" : "s"} and ${
          scopedActivity.length
        } activity entr${scopedActivity.length === 1 ? "y" : "ies"}.`
      );
    } else {
      downloadJson(
        `audit-pack-${client.id}-${task.id}.json`,
        buildJsonPayload(task, client, checklist, scopedActivity, firmName)
      );
      setFlash(
        `Downloaded JSON. Stable schema: duedatehq.audit_pack.v1.`
      );
    }
  };

  return (
    <Modal open={open} onClose={onClose} ariaLabelledBy={labelId} size="lg">
      <Modal.Header
        id={labelId}
        title="Audit pack"
        description={`${client.name} · ${task.formType} · due ${formatLongDate(
          task.officialDueDate
        )}. Bundles the task, checklist states, and activity timeline into a single artifact for IRS audit response.`}
      />

      <Modal.Body className="space-y-4 text-sm">
        <div>
          <div className="text-xs font-medium text-ink-700 mb-2">Format</div>
          <div className="grid grid-cols-2 gap-2">
            <FormatCard
              active={format === "pdf"}
              onClick={() => setFormat("pdf")}
              icon={<FileText className="w-4 h-4" aria-hidden />}
              label="PDF"
              hint="Print-ready · IRS-grade"
            />
            <FormatCard
              active={format === "json"}
              onClick={() => setFormat("json")}
              icon={<Braces className="w-4 h-4" aria-hidden />}
              label="JSON"
              hint="Stable schema · for tooling"
            />
          </div>
        </div>

        <div className="text-xs text-ink-500 bg-sunken border border-line rounded px-3 py-2 space-y-1">
          <div>
            <strong>{checklist.length}</strong> checklist item
            {checklist.length === 1 ? "" : "s"} ·{" "}
            <strong>
              {checklist.filter((c) => c.state === "received_confirmed").length}
            </strong>{" "}
            confirmed
          </div>
          <div>
            <strong>{scopedActivity.length}</strong> activity entr
            {scopedActivity.length === 1 ? "y" : "ies"} scoped to this task
          </div>
        </div>

        {flash && (
          <div className="rounded border border-ok-border bg-ok-bg text-ok-ink text-sm px-3 py-2">
            ✓ {flash}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer tone="sunken">
        <button
          onClick={onClose}
          className="text-sm px-3 py-1.5 rounded border border-line bg-surface hover:bg-sunken text-ink-700"
        >
          Close
        </button>
        <button
          onClick={onRun}
          className="text-sm px-3 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" aria-hidden />
          {format === "pdf" ? "Open print dialog" : "Download JSON"}
        </button>
      </Modal.Footer>
    </Modal>
  );
}

function FormatCard({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-2 text-left px-3 py-2 rounded border transition-colors ${
        active
          ? "border-accent bg-accent text-canvas"
          : "border-line bg-surface text-ink-700 hover:bg-sunken"
      }`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span
          className={`block text-xs ${
            active ? "text-canvas/70" : "text-ink-500"
          }`}
        >
          {hint}
        </span>
      </span>
    </button>
  );
}

// ----- payload builders -----

function buildJsonPayload(
  task: Task,
  client: Client,
  checklist: ChecklistItem[],
  activity: ActivityEntry[],
  firmName: string
) {
  return {
    schema: "duedatehq.audit_pack.v1",
    generatedAt: new Date().toISOString(),
    firm: firmName,
    task: {
      id: task.id,
      formType: task.formType,
      jurisdiction: task.jurisdiction,
      officialDueDate: task.officialDueDate,
      internalTargetDate: task.internalTargetDate,
      status: task.status,
      assignedUser: task.assignedUser,
      completedAt: task.completedAt ?? null,
      completedBy: task.completedBy ?? null,
    },
    client: {
      id: client.id,
      name: client.name,
      entityType: client.entityType,
      primaryState: client.primaryState,
      contactEmail: client.contactEmail,
    },
    checklist: checklist.map((c) => ({
      id: c.id,
      label: c.label,
      itemType: c.itemType,
      state: c.state,
      receivedAt: c.receivedAt ?? null,
      confirmedAt: c.confirmedAt ?? null,
      confirmedBy: c.confirmedBy ?? null,
      aiConfidence: c.aiConfidence ?? null,
      aiClassification: c.aiClassification ?? null,
      receivedFilename: c.receivedFilename ?? null,
      flagReason: c.flagReason ?? null,
      flagSeverity: c.flagSeverity ?? null,
    })),
    activity: activity.map((a) => ({
      id: a.id,
      timestamp: a.timestamp,
      type: a.type,
      actorName: a.actorName,
      summary: a.summary,
    })),
  };
}

function buildPdfHtml(
  task: Task,
  client: Client,
  checklist: ChecklistItem[],
  activity: ActivityEntry[],
  firmName: string
): string {
  const generated = new Date().toLocaleString("en-US");
  const checklistRows = checklist
    .map(
      (c) => `<tr>
        <td>${escapeHtml(c.label)}</td>
        <td>${escapeHtml(c.state.replace(/_/g, " "))}</td>
        <td>${c.confirmedAt ? formatLongDate(c.confirmedAt) : "—"}</td>
        <td>${escapeHtml(c.confirmedBy ?? "—")}</td>
        <td>${escapeHtml(c.aiClassification ?? "—")}</td>
      </tr>`
    )
    .join("");

  const activityList = activity
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .map(
      (a) => `<li>
        <div class="ts">${escapeHtml(
          new Date(a.timestamp).toLocaleString("en-US")
        )} · ${escapeHtml(a.actorName)}</div>
        <div>${escapeHtml(a.summary)}</div>
      </li>`
    )
    .join("");

  return `
    <h1>Audit pack — ${escapeHtml(client.name)}</h1>
    <div class="meta">
      <strong>${escapeHtml(firmName)}</strong> ·
      Generated ${escapeHtml(generated)} ·
      Schema duedatehq.audit_pack.v1
    </div>

    <h2>Task</h2>
    <table>
      <tbody>
        <tr><td><strong>Form</strong></td><td>${escapeHtml(task.formType)}</td></tr>
        <tr><td><strong>Jurisdiction</strong></td><td>${escapeHtml(task.jurisdiction)}</td></tr>
        <tr><td><strong>Official due date</strong></td><td>${formatLongDate(task.officialDueDate)}</td></tr>
        <tr><td><strong>Internal target</strong></td><td>${formatLongDate(task.internalTargetDate)}</td></tr>
        <tr><td><strong>Status</strong></td><td>${escapeHtml(task.status)}</td></tr>
        <tr><td><strong>Assigned</strong></td><td>${escapeHtml(task.assignedUser)}</td></tr>
        ${task.completedAt
          ? `<tr><td><strong>Completed</strong></td><td>${formatLongDate(task.completedAt)} · ${escapeHtml(task.completedBy ?? "")}</td></tr>`
          : ""}
      </tbody>
    </table>

    <h2>Client</h2>
    <table>
      <tbody>
        <tr><td><strong>Name</strong></td><td>${escapeHtml(client.name)}</td></tr>
        <tr><td><strong>Entity</strong></td><td>${escapeHtml(client.entityType)}</td></tr>
        <tr><td><strong>Primary state</strong></td><td>${escapeHtml(client.primaryState)}</td></tr>
        <tr><td><strong>Contact</strong></td><td>${escapeHtml(client.contactEmail)}</td></tr>
      </tbody>
    </table>

    <h2>Checklist (${checklist.length} items · ${checklist.filter((c) => c.state === "received_confirmed").length} confirmed)</h2>
    <table>
      <thead><tr>
        <th>Item</th><th>State</th><th>Confirmed</th><th>By</th><th>AI classification</th>
      </tr></thead>
      <tbody>${checklistRows || `<tr><td colspan="5" class="subtle">No checklist items.</td></tr>`}</tbody>
    </table>

    <h2>Activity timeline (${activity.length} entries)</h2>
    <ul class="timeline">
      ${activityList || `<li class="subtle">No activity recorded.</li>`}
    </ul>

    <div class="footer">
      Source: DueDateHQ. This audit pack reflects the firm's record of this
      task at the timestamp above. Underlying documents are linked from the
      firm's existing system (e.g. SharePoint/Drive); this artifact captures
      state and timing, not document bytes.
    </div>
  `;
}
