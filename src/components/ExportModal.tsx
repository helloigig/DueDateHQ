import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import type { Client, Deadline } from "../types";
import { formatLongDate } from "../data/dateHelpers";
import { Modal, useModalLabelId } from "./Modal";
import {
  downloadJson,
  escapeHtml,
  printHtmlAsPdf,
} from "../lib/printToPdf";

type Scope = "current" | "all" | "range";
type Format = "csv" | "pdf" | "json" | "ical";
type Recipient = "download" | "email_self" | "email_coworker";

function buildCsv(deadlines: Deadline[], clients: Map<string, Client>): string {
  const header = [
    "Client",
    "Entity",
    "Primary State",
    "Form",
    "Jurisdiction",
    "Official due date",
    "Status",
    "Email",
  ].join(",");
  const rows = deadlines.map((d) => {
    const c = clients.get(d.clientId);
    if (!c) return "";
    return [
      csvCell(c.name),
      c.entityType,
      c.primaryState,
      csvCell(d.form),
      d.jurisdiction,
      d.officialDueDate,
      d.status,
      c.contactEmail,
    ].join(",");
  });
  return [header, ...rows].filter(Boolean).join("\n");
}

function csvCell(s: string): string {
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildIcal(deadlines: Deadline[], clients: Map<string, Client>): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DueDateHQ//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const d of deadlines) {
    const c = clients.get(d.clientId);
    if (!c) continue;
    const day = d.officialDueDate.replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${d.id}@duedatehq.com`,
      `DTSTART;VALUE=DATE:${day}`,
      `DTEND;VALUE=DATE:${day}`,
      `SUMMARY:${c.name} — ${d.form}`,
      `DESCRIPTION:Jurisdiction: ${d.jurisdiction} · Status: ${d.status}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function downloadBlob(filename: string, content: string, mime: string) {
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

function buildPdfHtml(
  deadlines: Deadline[],
  clients: Map<string, Client>,
  firmName: string,
  exportTitle: string
): string {
  const generated = new Date().toLocaleString("en-US");
  const range = deadlines.length
    ? `${deadlines.reduce(
        (m, d) => (d.officialDueDate < m ? d.officialDueDate : m),
        deadlines[0].officialDueDate
      )} → ${deadlines.reduce(
        (m, d) => (d.officialDueDate > m ? d.officialDueDate : m),
        deadlines[0].officialDueDate
      )}`
    : "—";
  const rows = deadlines
    .slice()
    .sort((a, b) => a.officialDueDate.localeCompare(b.officialDueDate))
    .map((d) => {
      const c = clients.get(d.clientId);
      return `<tr>
        <td>${formatLongDate(d.officialDueDate)}</td>
        <td>${escapeHtml(c?.name ?? "—")}</td>
        <td>${escapeHtml(c?.entityType ?? "")}</td>
        <td>${escapeHtml(d.form)}</td>
        <td>${escapeHtml(d.jurisdiction)}</td>
        <td>${escapeHtml(d.status)}</td>
      </tr>`;
    })
    .join("");
  return `
    <h1>${escapeHtml(exportTitle)}</h1>
    <div class="meta">
      <strong>${escapeHtml(firmName)}</strong> ·
      Generated ${escapeHtml(generated)} ·
      ${deadlines.length} deadline${deadlines.length === 1 ? "" : "s"} ·
      Range ${escapeHtml(range)}
    </div>
    <table>
      <thead><tr>
        <th>Due date</th><th>Client</th><th>Entity</th><th>Form</th>
        <th>Jurisdiction</th><th>Status</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="6" class="subtle">No deadlines in scope.</td></tr>`}</tbody>
    </table>
    <div class="footer">
      Source: DueDateHQ · This document was generated from the firm's deadline
      record at the timestamp above. Client communications and per-task audit
      trails are exported separately.
    </div>
  `;
}

function buildJsonPayload(
  deadlines: Deadline[],
  clients: Map<string, Client>,
  firmName: string
) {
  return {
    schema: "duedatehq.export.v1",
    generatedAt: new Date().toISOString(),
    firm: firmName,
    count: deadlines.length,
    deadlines: deadlines.map((d) => {
      const c = clients.get(d.clientId);
      return {
        id: d.id,
        client: c
          ? {
              id: c.id,
              name: c.name,
              entityType: c.entityType,
              primaryState: c.primaryState,
              email: c.contactEmail,
            }
          : null,
        form: d.form,
        jurisdiction: d.jurisdiction,
        officialDueDate: d.officialDueDate,
        status: d.status,
        completedAt: d.completedAt ?? null,
        bundleId: d.bundleId ?? null,
      };
    }),
  };
}

export function ExportModal({
  open,
  deadlines,
  clients,
  title = "Export deadlines",
  firmName = "Mitchell CPA",
  onClose,
}: {
  open: boolean;
  /** Deadlines eligible for the "current" scope (e.g. current dashboard filter). */
  deadlines: Deadline[];
  clients: Client[];
  title?: string;
  firmName?: string;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<Scope>("current");
  const [format, setFormat] = useState<Format>("csv");
  const [recipient, setRecipient] = useState<Recipient>("download");
  const [flash, setFlash] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState<string>("2026-01-01");
  const [rangeEnd, setRangeEnd] = useState<string>("2026-12-31");
  const labelId = useModalLabelId();

  useEffect(() => {
    if (open) {
      setScope("current");
      setFormat("csv");
      setRecipient("download");
      setFlash(null);
    }
  }, [open]);

  const clientsById = useMemo(() => {
    const m = new Map<string, Client>();
    clients.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  const scoped = useMemo(() => {
    if (scope === "current") return deadlines;
    if (scope === "all") {
      const clientIds = new Set(clients.map((c) => c.id));
      return deadlines.filter((d) => clientIds.has(d.clientId));
    }
    return deadlines.filter(
      (d) => d.officialDueDate >= rangeStart && d.officialDueDate <= rangeEnd
    );
  }, [scope, deadlines, clients, rangeStart, rangeEnd]);

  const onRun = () => {
    if (recipient !== "download") {
      setFlash(
        `Would email ${scoped.length} deadline${
          scoped.length === 1 ? "" : "s"
        } as ${format.toUpperCase()} to ${
          recipient === "email_self" ? "you" : "your coworker"
        }. (Not wired in this mock.)`
      );
      return;
    }
    if (format === "csv") {
      downloadBlob(
        "duedatehq-export.csv",
        buildCsv(scoped, clientsById),
        "text/csv"
      );
      setFlash(`Downloaded ${scoped.length} deadlines as CSV.`);
    } else if (format === "ical") {
      downloadBlob(
        "duedatehq-export.ics",
        buildIcal(scoped, clientsById),
        "text/calendar"
      );
      setFlash(
        `Downloaded .ics — subscribe in Google/Outlook/Apple Calendar for live updates.`
      );
    } else if (format === "json") {
      downloadJson(
        "duedatehq-export.json",
        buildJsonPayload(scoped, clientsById, firmName)
      );
      setFlash(
        `Downloaded ${scoped.length} deadlines as JSON. Stable schema: duedatehq.export.v1.`
      );
    } else {
      // PDF: open browser print dialog with structured HTML — user saves as PDF
      const html = buildPdfHtml(scoped, clientsById, firmName, title);
      printHtmlAsPdf(html, title);
      setFlash(
        `Opened the print dialog — choose "Save as PDF" to download. ${scoped.length} deadlines included.`
      );
    }
  };

  return (
    <Modal open={open} onClose={onClose} ariaLabelledBy={labelId} size="lg">
      <Modal.Header id={labelId} title={title} />

      <Modal.Body className="space-y-4 text-sm" scroll>
        <div>
          <div className="text-xs font-medium text-ink-700 mb-2">
            What to include
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Card
              active={scope === "current"}
              onClick={() => setScope("current")}
              label="Current view"
              hint={`${deadlines.length} deadline${
                deadlines.length === 1 ? "" : "s"
              }`}
            />
            <Card
              active={scope === "all"}
              onClick={() => setScope("all")}
              label="All deadlines"
              hint="Every client"
            />
            <Card
              active={scope === "range"}
              onClick={() => setScope("range")}
              label="Date range"
              hint="Pick start / end"
            />
          </div>
          {scope === "range" && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="flex-1 px-2 py-1 rounded border border-line text-sm focus:outline-none focus:ring-2 focus:ring-indigo"
              />
              <span className="text-ink-400">→</span>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="flex-1 px-2 py-1 rounded border border-line text-sm focus:outline-none focus:ring-2 focus:ring-indigo"
              />
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-medium text-ink-700 mb-2">Format</div>
          <div className="grid grid-cols-4 gap-2">
            <Card
              active={format === "csv"}
              onClick={() => setFormat("csv")}
              label="CSV"
              hint="Raw data"
            />
            <Card
              active={format === "pdf"}
              onClick={() => setFormat("pdf")}
              label="PDF"
              hint="Print-ready"
            />
            <Card
              active={format === "json"}
              onClick={() => setFormat("json")}
              label="JSON"
              hint="Audit trail"
            />
            <Card
              active={format === "ical"}
              onClick={() => setFormat("ical")}
              label="iCal (.ics)"
              hint="Subscribe"
            />
          </div>
          {format === "ical" && (
            <p className="mt-2 text-xs text-ink-500">
              Subscribe once — deadlines update automatically in Google /
              Outlook / Apple Calendar.
            </p>
          )}
          {format === "pdf" && (
            <p className="mt-2 text-xs text-ink-500">
              Opens your browser's print dialog — pick "Save as PDF" or send to
              a printer.
            </p>
          )}
          {format === "json" && (
            <p className="mt-2 text-xs text-ink-500">
              Structured export with stable schema (duedatehq.export.v1) for
              audit trails and integrations.
            </p>
          )}
        </div>

        <div>
          <div className="text-xs font-medium text-ink-700 mb-2">Recipient</div>
          <div className="grid grid-cols-3 gap-2">
            <Card
              active={recipient === "download"}
              onClick={() => setRecipient("download")}
              label="Download"
              hint="Saved to your computer"
            />
            <Card
              active={recipient === "email_self"}
              onClick={() => setRecipient("email_self")}
              label="Email me"
              hint="Sarah Chen"
            />
            <Card
              active={recipient === "email_coworker"}
              onClick={() => setRecipient("email_coworker")}
              label="Email coworker"
              hint="Team tier"
              disabled
            />
          </div>
        </div>

        <div className="text-xs text-ink-500 bg-sunken border border-line rounded px-3 py-2">
          Preview: <strong>{scoped.length}</strong> deadline
          {scoped.length === 1 ? "" : "s"} · range{" "}
          {scoped.length > 0 ? (
            <>
              {formatLongDate(
                scoped.reduce(
                  (m, d) =>
                    d.officialDueDate < m ? d.officialDueDate : m,
                  scoped[0].officialDueDate
                )
              )}{" "}
              →{" "}
              {formatLongDate(
                scoped.reduce(
                  (m, d) =>
                    d.officialDueDate > m ? d.officialDueDate : m,
                  scoped[0].officialDueDate
                )
              )}
            </>
          ) : (
            "—"
          )}
        </div>

        {flash && (
          <div className="rounded border border-ok-border bg-ok-bg text-ok-ink text-sm px-3 py-2 inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" aria-hidden />
            <span>{flash}</span>
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
          disabled={scoped.length === 0}
          className="text-sm px-3 py-1.5 rounded bg-indigo text-white hover:bg-indigo-hover disabled:opacity-40"
        >
          {recipient === "download"
            ? format === "pdf"
              ? "Open print dialog"
              : "Download"
            : "Send"}
        </button>
      </Modal.Footer>
    </Modal>
  );
}

function Card({
  active,
  onClick,
  label,
  hint,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-left px-3 py-2 rounded border transition-colors ${
        active
          ? "border-accent bg-accent text-canvas"
          : disabled
          ? "border-line bg-sunken text-ink-400 cursor-not-allowed"
          : "border-line bg-surface text-ink-700 hover:bg-sunken"
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className={`text-xs ${active ? "text-canvas/70" : "text-ink-500"}`}>
        {hint}
      </div>
    </button>
  );
}
