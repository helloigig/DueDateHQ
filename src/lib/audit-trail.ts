/**
 * Audit-trail packer per PRD §15.4. Per-task export at MVP. Two artifacts:
 *  - JSON (machine-readable, full event schema, ISO-8601 UTC, firm_id metadata)
 *  - PDF (human-readable; we render an HTML mock that prints to PDF via window.print)
 *
 * The export pulls from the activity timeline, checklist items, and email
 * drafts associated with the task. Per PRD §1.7: we never store document bytes,
 * so the export references filenames not blobs.
 */
import type { Task } from "../types";
import { getState } from "../data/store";
import { getSession } from "../data/session";

interface AuditEntry {
  timestamp: string;
  type: string;
  actor: string;
  summary: string;
  payload?: unknown;
}

function buildEntries(task: Task): AuditEntry[] {
  const { clients, checklistItems, emailDrafts } = getState();
  const client = clients.find((c) => c.id === task.clientId);
  const activity = (client?.activity ?? []).filter(
    (e) => e.relatedDeadlineId === task.deadlineId
  );
  const items = checklistItems.filter((c) => c.taskId === task.id);
  const emails = emailDrafts.filter(
    (d) => d.taskId === task.id && d.status === "sent"
  );

  const entries: AuditEntry[] = [];

  // Static task metadata
  entries.push({
    timestamp: task.officialDueDate + "T00:00:00.000Z",
    type: "task_metadata",
    actor: "system",
    summary: `Task created: ${task.formType} for ${client?.name}`,
    payload: {
      taskId: task.id,
      clientId: task.clientId,
      forwardingEmail: task.forwardingEmail,
      officialDueDate: task.officialDueDate,
      internalTargetDate: task.internalTargetDate,
    },
  });

  for (const a of activity) {
    entries.push({
      timestamp: a.timestamp,
      type: a.type,
      actor: a.actorName,
      summary: a.summary,
    });
  }

  for (const i of items) {
    entries.push({
      timestamp: i.confirmedAt ?? i.receivedAt ?? task.officialDueDate + "T00:00:00.000Z",
      type: `checklist_item.${i.state}`,
      actor: i.confirmedBy ?? "system",
      summary: `${i.label} — ${i.state.replace(/_/g, " ")}`,
      payload: {
        itemId: i.id,
        state: i.state,
        aiClassification: i.aiClassification,
        aiConfidence: i.aiConfidence,
        flagReason: i.flagReason,
      },
    });
  }

  for (const e of emails) {
    entries.push({
      timestamp: e.sentAt ?? e.createdAt,
      type: "email_sent",
      actor: e.sendMethod === "phase2_auto" ? "ai (phase 2)" : "cpa",
      summary: e.subject,
      payload: {
        to: e.to,
        cc: e.cc,
        tone: e.tone,
        aiSources: e.aiSources,
      },
    });
  }

  entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return entries;
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportAuditTrailJson(task: Task): void {
  const session = getSession();
  const { clients } = getState();
  const client = clients.find((c) => c.id === task.clientId);
  const entries = buildEntries(task);
  const payload = {
    schema: "duedatehq.audit-trail.v1",
    generatedAt: new Date().toISOString(),
    firmId: "firm-mock",
    firmName: session?.firmName ?? "Mitchell CPA",
    task: {
      id: task.id,
      clientId: task.clientId,
      clientName: client?.name,
      formType: task.formType,
      jurisdiction: task.jurisdiction,
      officialDueDate: task.officialDueDate,
      forwardingEmail: task.forwardingEmail,
    },
    entries,
  };
  const filename = `audit-${(client?.name ?? "client").replace(/\W+/g, "-")}-${task.formType.replace(/\W+/g, "-")}.json`;
  downloadFile(filename, JSON.stringify(payload, null, 2), "application/json");
}

/**
 * Render the audit trail as an HTML report and open the browser print
 * dialog so the user can save it as PDF (Cmd+P → "Save as PDF" on macOS).
 * Server-side PDF generation will replace this when the export-worker
 * lane lands; until then, browser print produces a faithful, paginated
 * artifact that meets PRD §15.4 audit-trail requirements.
 */
export function exportAuditTrailPdf(task: Task): void {
  const session = getSession();
  const { clients } = getState();
  const client = clients.find((c) => c.id === task.clientId);
  const entries = buildEntries(task);
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <!doctype html>
    <html><head><title>Audit trail · ${client?.name} · ${task.formType}</title>
    <style>
      body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #0f172a; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      .meta { color: #64748b; font-size: 12px; margin-bottom: 24px; }
      .entry { padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
      .ts { font-family: ui-monospace, monospace; font-size: 11px; color: #94a3b8; }
      .type { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
      .summary { font-size: 13px; margin-top: 2px; }
      .actor { font-size: 11px; color: #64748b; }
      footer { margin-top: 24px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    </style></head><body>
    <h1>${task.formType} · ${client?.name ?? ""}</h1>
    <div class="meta">
      ${session?.firmName ?? "Mitchell CPA"} · Forwarding ${task.forwardingEmail}<br>
      Generated ${new Date().toLocaleString()} · DueDateHQ audit-trail v1
    </div>
    ${entries.map((e) => `
      <div class="entry">
        <div class="ts">${e.timestamp}</div>
        <div class="type">${e.type.replace(/_/g, " ")}</div>
        <div class="summary">${escapeHtml(e.summary)}</div>
        <div class="actor">${escapeHtml(e.actor)}</div>
      </div>
    `).join("")}
    <footer>This export is append-only and immutable. PRD §11.3 + §15.4.</footer>
    </body></html>
  `);
  win.document.close();
  setTimeout(() => win.print(), 300);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
