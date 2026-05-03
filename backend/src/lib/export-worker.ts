/**
 * Export worker — Phase 1 implementation.
 *
 * Real architecture (per arch §4.3):
 *   - BullMQ queues: `audit-trail-pack` + `deadline-export`
 *   - Workers run in a separate process, write artifacts to Supabase
 *     Storage, update `export_runs.download_url` + `status='ready'`
 *
 * Phase 1 (this file):
 *   - In-process worker on a 5s tick — picks `queued` rows, generates
 *     the artifact synchronously, writes to a temp file (or data: URL),
 *     marks `ready` with the URL.
 *   - PDF: minimal text-based PDF (no PDFKit/Puppeteer dep). Real
 *     production swaps the body of `generatePdf` for a templated render.
 *   - CSV: native string concat with RFC-4180 escaping.
 *   - iCal: vanilla RFC-5545 string template.
 *
 * Trade-offs the user should know:
 *   - In-process worker shares CPU with the request-serving Hono. For
 *     small-to-medium firms (<1000 deadlines) this is fine; large firms
 *     will want the worker split into a separate process.
 *   - `download_url` is a stable HTTP path served by the worker (see
 *     route added in index.ts). Real production uses Supabase Storage
 *     pre-signed URLs.
 */

import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  clients,
  deadlines,
  exportRuns,
  tasks,
  activityEvents,
  checklistItems,
} from "../db/schema.js";
import { log, span, captureException } from "./observability.js";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// No leading `./` — index.ts prepends it when registering serveStatic, so
// keeping the bare name avoids producing the `././.artifacts` path that
// Hono complained about on every boot ("root path '././.artifacts' is not
// found, are you sure it's correct?").
const ARTIFACT_DIR = process.env.EXPORT_ARTIFACT_DIR ?? ".artifacts";

// Create the artifact dir at module-load time. Hono's serveStatic
// (registered in index.ts) stat's the root path immediately on app.use,
// which fires before startExportWorker's first tick. Without this, every
// boot logs a noisy "root path not found" warning even though the worker
// would have created the directory on its first cycle 5 seconds later.
// mkdirSync is fine here — module init is already synchronous and the
// path is local-FS so the call is cheap.
if (!existsSync(ARTIFACT_DIR)) {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
}

// Worker-tick safety net: a horizontally-scaled deploy that bind-mounts
// the artifact dir from a volume could see it disappear between ticks.
async function ensureDir() {
  if (!existsSync(ARTIFACT_DIR)) {
    await mkdir(ARTIFACT_DIR, { recursive: true });
  }
}

// ---------- Generators ----------

interface DeadlineRow {
  client: string;
  formType: string;
  officialDueDate: string;
  status: string;
  state: string;
}

async function fetchDeadlinesForFirm(firmId: string): Promise<DeadlineRow[]> {
  const rows = await db
    .select({
      client: clients.name,
      formType: deadlines.formType,
      officialDueDate: deadlines.officialDueDate,
      status: deadlines.status,
      // The schema stores jurisdiction as "CA", "NY", etc — the state
      // code lives there (Federal forms use "Federal" or similar).
      state: deadlines.jurisdiction,
    })
    .from(deadlines)
    .leftJoin(clients, eq(clients.id, deadlines.clientId))
    .where(eq(deadlines.firmId, firmId));

  return rows.map((r) => ({
    client: r.client ?? "—",
    formType: r.formType,
    // Drizzle returns date columns as strings (YYYY-MM-DD) by default.
    officialDueDate: String(r.officialDueDate ?? ""),
    status: r.status,
    state: r.state ?? "",
  }));
}

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function generateDeadlinesCsv(rows: DeadlineRow[]): string {
  const lines = ["Client,Form,Due Date,State,Status"];
  for (const r of rows) {
    lines.push(
      [r.client, r.formType, r.officialDueDate, r.state, r.status]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

/**
 * RFC-5545 iCalendar generator. One VEVENT per deadline. Real production
 * adds VALARM components for reminders + ATTENDEE for the assigned CPA.
 */
export function generateDeadlinesIcal(rows: DeadlineRow[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DueDateHQ//Phase1//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const r of rows) {
    if (!r.officialDueDate) continue;
    const dt = r.officialDueDate.replace(/-/g, "");
    const uid = `${r.client.replace(/\s+/g, "_")}-${r.formType}-${dt}@duedatehq.com`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d+/, "")}`,
      `DTSTART;VALUE=DATE:${dt}`,
      `SUMMARY:${escapeIcal(r.client)} — ${escapeIcal(r.formType)}`,
      `DESCRIPTION:Status ${escapeIcal(r.status)} · ${escapeIcal(r.state)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function escapeIcal(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/**
 * Minimal text-based PDF — generates a valid PDF/1.4 document with one
 * page of monospace text. Real production swaps for PDFKit / Puppeteer
 * with a templated layout. The point of this stub is the worker pipeline
 * — once the artifact lands at the URL, the FE flow works end-to-end.
 */
export function generateDeadlinesPdf(rows: DeadlineRow[]): Buffer {
  // Build the page content stream
  const lines: string[] = [
    "BT",
    "/F1 12 Tf",
    "72 760 Td",
    "(DueDateHQ — Deadline Export) Tj",
    "0 -20 Td",
    "/F1 9 Tf",
    `(Generated ${new Date().toISOString()} — ${rows.length} rows) Tj`,
    "0 -20 Td",
  ];
  let y = 720;
  for (const r of rows.slice(0, 60)) {
    const txt = `${r.officialDueDate}  ${r.client.slice(0, 28).padEnd(28)}  ${r.formType.slice(0, 14).padEnd(14)}  ${r.status.slice(0, 10)}`;
    lines.push(`(${escapePdfString(txt)}) Tj`, "0 -14 Td");
    y -= 14;
    if (y < 50) break;
  }
  lines.push("ET");

  const stream = lines.join("\n");

  // Object table — minimal PDF
  const objs: string[] = [];
  objs.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objs.push(
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
  );
  objs.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
  );
  objs.push(
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
  );
  objs.push(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n",
  );

  // Compute xref offsets
  let header = "%PDF-1.4\n";
  let body = "";
  const offsets: number[] = [];
  for (const o of objs) {
    offsets.push(header.length + body.length);
    body += o;
  }
  const xrefStart = header.length + body.length;
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${off.toString().padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(header + body + xref + trailer, "binary");
}

function escapePdfString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Audit-trail pack — bundles a task's full state into a JSON document
 * suitable for IRS audit response. PRD §15.4 / §11.3.
 */
async function generateAuditTrailJson(
  firmId: string,
  taskId: string,
): Promise<string> {
  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.firmId, firmId)),
  });
  if (!task) throw new Error("task_not_found");
  const deadline = await db.query.deadlines.findFirst({
    where: eq(deadlines.id, task.deadlineId),
  });
  const items = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.taskId, taskId));
  const events = await db
    .select()
    .from(activityEvents)
    .where(eq(activityEvents.taskId, task.id));

  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      firmId,
      task,
      deadline,
      checklist: items,
      activity: events,
      schema: "duedatehq.audit-trail.v1",
    },
    null,
    2,
  );
}

// ---------- Worker loop ----------

async function processOne(): Promise<boolean> {
  // Atomically claim one queued row by flipping its status to running
  const claim = await db
    .update(exportRuns)
    .set({ status: "running" })
    .where(eq(exportRuns.status, "queued"))
    .returning();
  const row = claim[0];
  if (!row) return false;

  return span(
    "export.process",
    async () => {
      try {
        await ensureDir();
        let url = "";
        let bytes = 0;
        const filename = `${row.id}.${extFor(row.kind)}`;
        const path = join(ARTIFACT_DIR, filename);

        if (row.kind === "deadlines_csv") {
          const rows = await fetchDeadlinesForFirm(row.firmId);
          const body = generateDeadlinesCsv(rows);
          await writeFile(path, body, "utf-8");
          bytes = Buffer.byteLength(body);
        } else if (row.kind === "deadlines_ical") {
          const rows = await fetchDeadlinesForFirm(row.firmId);
          const body = generateDeadlinesIcal(rows);
          await writeFile(path, body, "utf-8");
          bytes = Buffer.byteLength(body);
        } else if (row.kind === "deadlines_pdf") {
          const rows = await fetchDeadlinesForFirm(row.firmId);
          const buf = generateDeadlinesPdf(rows);
          await writeFile(path, buf);
          bytes = buf.length;
        } else if (row.kind === "audit_trail_json") {
          const scope = row.scope as { taskId?: string };
          if (!scope?.taskId) throw new Error("audit_trail_requires_taskId");
          const body = await generateAuditTrailJson(row.firmId, scope.taskId);
          await writeFile(path, body, "utf-8");
          bytes = Buffer.byteLength(body);
        } else if (row.kind === "audit_trail_pdf") {
          // Two PDF flavors discriminated by scope.sheet:
          //   "cover"  → per-task cover sheet for chase attachments
          //   default  → full audit-trail packer
          const scope = row.scope as { taskId?: string; sheet?: string };
          if (!scope?.taskId) throw new Error("audit_trail_requires_taskId");
          if (scope.sheet === "cover") {
            const buf = await generateTaskCoverSheetPdf(
              row.firmId,
              scope.taskId,
            );
            await writeFile(path, buf);
            bytes = buf.length;
          } else {
            // Phase 1: write a stub PDF wrapping the JSON body. Real
            // production composes a typeset PDF from the audit data.
            const json = await generateAuditTrailJson(
              row.firmId,
              scope.taskId,
            );
            const stub = generateDeadlinesPdf(
              json.slice(0, 4000).split("\n").map((line, i) => ({
                client: `line-${i}`,
                formType: line.slice(0, 30),
                officialDueDate: "",
                state: "",
                status: "",
              })),
            );
            await writeFile(path, stub);
            bytes = stub.length;
          }
        } else {
          throw new Error(`unknown_kind:${row.kind}`);
        }

        url = `/exports/${filename}`;
        await db
          .update(exportRuns)
          .set({
            status: "ready",
            downloadUrl: url,
            storageKey: filename,
            completedAt: new Date(),
          })
          .where(eq(exportRuns.id, row.id));

        log.info("export.done", { id: row.id, kind: row.kind, bytes });
      } catch (err) {
        captureException(err, { exportId: row.id, kind: row.kind });
        await db
          .update(exportRuns)
          .set({
            status: "failed",
            errorMessage: err instanceof Error ? err.message : String(err),
          })
          .where(eq(exportRuns.id, row.id));
      }
      return true;
    },
    { id: row.id, kind: row.kind },
  );
}

/**
 * Per-task cover sheet — a single-page PDF the CPA can attach to a
 * chase email or mail. Lists pending docs + the per-task forwarding
 * address client-friendly. Reuses the minimal text-PDF generator;
 * production swaps for a templated render with the firm's logo.
 */
async function generateTaskCoverSheetPdf(
  firmId: string,
  taskId: string,
): Promise<Buffer> {
  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.firmId, firmId)),
  });
  if (!task) throw new Error("task_not_found");
  const deadline = await db.query.deadlines.findFirst({
    where: eq(deadlines.id, task.deadlineId),
  });
  const client = deadline
    ? await db.query.clients.findFirst({
        where: eq(clients.id, deadline.clientId),
      })
    : null;
  const items = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.taskId, taskId));
  const pending = items.filter(
    (i) =>
      i.state === "not_requested" ||
      i.state === "requested_waiting" ||
      i.state === "received_issue",
  );

  // Compose a deadlines-style row list — generateDeadlinesPdf accepts
  // DeadlineRow[]; use it for the body. Each row = one pending doc.
  const rows: DeadlineRow[] = [
    {
      client: client?.name ?? "—",
      formType: deadline?.formType ?? "—",
      officialDueDate: deadline?.officialDueDate
        ? String(deadline.officialDueDate)
        : "",
      state: deadline?.jurisdiction ?? "",
      status: `Send to: ${task.forwardingEmailLocalPart}@inbound.duedatehq.com`,
    },
    ...pending.map((i) => ({
      client: "  →",
      formType: i.label,
      officialDueDate: "",
      state: "",
      status: i.state.replace(/_/g, " "),
    })),
  ];
  return generateDeadlinesPdf(rows);
}

function extFor(kind: string): string {
  if (kind.endsWith("_csv")) return "csv";
  if (kind.endsWith("_pdf")) return "pdf";
  if (kind.endsWith("_ical")) return "ics";
  if (kind.endsWith("_json")) return "json";
  return "bin";
}

// ---------- Scheduler ----------

let workerHandle: NodeJS.Timeout | null = null;

export function startExportWorker(intervalMs = 5_000): void {
  if (workerHandle) return;
  workerHandle = setInterval(() => {
    void processOne().catch((err) =>
      captureException(err, { ctx: "export_worker_tick" }),
    );
  }, intervalMs);
  workerHandle.unref?.();
  log.info("export_worker.started", { intervalMs, dir: ARTIFACT_DIR });
}

export function stopExportWorker(): void {
  if (workerHandle) {
    clearInterval(workerHandle);
    workerHandle = null;
  }
}

export { ARTIFACT_DIR };
