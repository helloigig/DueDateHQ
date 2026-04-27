import { useEffect, useMemo, useState } from "react";
import type { Client, Deadline } from "../types";
import { formatLongDate } from "../data/dateHelpers";
import { useModalDialog } from "../hooks/useModalDialog";

type Scope = "current" | "all" | "range";
type Format = "csv" | "pdf" | "ical";
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

export function ExportModal({
  open,
  deadlines,
  clients,
  title = "Export deadlines",
  onClose,
}: {
  open: boolean;
  /** Deadlines eligible for the "current" scope (e.g. current dashboard filter). */
  deadlines: Deadline[];
  clients: Client[];
  title?: string;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<Scope>("current");
  const [format, setFormat] = useState<Format>("csv");
  const [recipient, setRecipient] = useState<Recipient>("download");
  const [flash, setFlash] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState<string>("2026-01-01");
  const [rangeEnd, setRangeEnd] = useState<string>("2026-12-31");

  useEffect(() => {
    if (open) {
      setScope("current");
      setFormat("csv");
      setRecipient("download");
      setFlash(null);
    }
  }, [open]);

  const dialogRef = useModalDialog(open, onClose);

  const clientsById = useMemo(() => {
    const m = new Map<string, Client>();
    clients.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  const scoped = useMemo(() => {
    if (scope === "current") return deadlines;
    if (scope === "all") {
      // "all" = every active deadline in the client list
      const clientIds = new Set(clients.map((c) => c.id));
      return deadlines.filter((d) => clientIds.has(d.clientId));
    }
    return deadlines.filter(
      (d) =>
        d.officialDueDate >= rangeStart && d.officialDueDate <= rangeEnd
    );
    // note: "all" currently = same set in mock; in prod it'd come from server
  }, [scope, deadlines, clients, rangeStart, rangeEnd]);

  if (!open) return null;

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
      const content = buildCsv(scoped, clientsById);
      downloadBlob("duedatehq-export.csv", content, "text/csv");
      setFlash(`Downloaded ${scoped.length} deadlines as CSV.`);
    } else if (format === "ical") {
      const content = buildIcal(scoped, clientsById);
      downloadBlob(
        "duedatehq-export.ics",
        content,
        "text/calendar"
      );
      setFlash(
        `Downloaded .ics — subscribe in Google/Outlook/Apple Calendar for live updates.`
      );
    } else {
      // PDF stub — real PDF would be server-rendered
      const content = `DueDateHQ — Deadline report\n\n${scoped
        .map((d) => {
          const c = clientsById.get(d.clientId);
          return `${d.officialDueDate}  ${c?.name ?? ""}  ${d.form}  (${
            d.status
          })`;
        })
        .join("\n")}`;
      downloadBlob("duedatehq-export.pdf.txt", content, "text/plain");
      setFlash(
        `PDF export is server-rendered in production. Downloaded a text stub for now.`
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg mx-4 outline-none"
      >
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        </div>

        <div className="px-5 py-4 space-y-4 text-sm">
          <div>
            <div className="text-xs font-medium text-slate-600 mb-2">
              What to include
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ScopeCard
                active={scope === "current"}
                onClick={() => setScope("current")}
                label="Current view"
                hint={`${deadlines.length} deadline${
                  deadlines.length === 1 ? "" : "s"
                }`}
              />
              <ScopeCard
                active={scope === "all"}
                onClick={() => setScope("all")}
                label="All deadlines"
                hint="Every client"
              />
              <ScopeCard
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
                  className="flex-1 px-2 py-1 rounded border border-slate-200 text-sm"
                />
                <span className="text-slate-400">→</span>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="flex-1 px-2 py-1 rounded border border-slate-200 text-sm"
                />
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-medium text-slate-600 mb-2">Format</div>
            <div className="grid grid-cols-3 gap-2">
              <FormatCard
                active={format === "csv"}
                onClick={() => setFormat("csv")}
                label="CSV"
                hint="Raw data"
              />
              <FormatCard
                active={format === "pdf"}
                onClick={() => setFormat("pdf")}
                label="PDF"
                hint="Client-facing"
              />
              <FormatCard
                active={format === "ical"}
                onClick={() => setFormat("ical")}
                label="iCal (.ics)"
                hint="Subscribe"
              />
            </div>
            {format === "ical" && (
              <p className="mt-2 text-xs text-slate-500">
                Subscribe once — deadlines update automatically in Google /
                Outlook / Apple Calendar.
              </p>
            )}
          </div>

          <div>
            <div className="text-xs font-medium text-slate-600 mb-2">
              Recipient
            </div>
            <div className="grid grid-cols-3 gap-2">
              <FormatCard
                active={recipient === "download"}
                onClick={() => setRecipient("download")}
                label="Download"
                hint="File saved to your computer"
              />
              <FormatCard
                active={recipient === "email_self"}
                onClick={() => setRecipient("email_self")}
                label="Email me"
                hint="Sarah Chen"
              />
              <FormatCard
                active={recipient === "email_coworker"}
                onClick={() => setRecipient("email_coworker")}
                label="Email coworker"
                hint="Team tier"
                disabled
              />
            </div>
          </div>

          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-2">
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
            <div className="rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm px-3 py-2">
              ✓ {flash}
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 rounded-b-lg flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50"
          >
            Close
          </button>
          <button
            onClick={onRun}
            disabled={scoped.length === 0}
            className="text-sm px-3 py-1.5 rounded font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
          >
            {recipient === "download" ? "Download" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScopeCard({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left px-3 py-2 rounded border transition-colors ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className={`text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
        {hint}
      </div>
    </button>
  );
}

function FormatCard({
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
          ? "border-slate-900 bg-slate-900 text-white"
          : disabled
          ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className={`text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
        {hint}
      </div>
    </button>
  );
}
