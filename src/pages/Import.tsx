import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCommitImport } from "../hooks/useImports";
import {
  DETECTED_ROWS,
  DETECTED_SOURCE,
  FIELD_MAPPING,
  type DetectedRow,
  type FieldMapping,
} from "../data/mockImportData";
import type { EntityType, StateCode } from "../types";
import { STATE_NAMES } from "../types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  parseCsv,
  detectMapping,
  rowsFromCsv,
  detectSource,
} from "../data/csvParser";

type Step = "upload" | "map" | "preview" | "committing" | "done";

const STEP_ORDER: Step[] = ["upload", "map", "preview", "committing", "done"];
const STEP_LABELS: Record<Exclude<Step, "done" | "committing">, string> = {
  upload: "Upload",
  map: "Map fields",
  preview: "Preview",
};

export function Import() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<DetectedRow[]>(DETECTED_ROWS);
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<number>(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [detectedSource, setDetectedSource] = useState<string>(DETECTED_SOURCE);
  const [mapping, setMapping] = useState<FieldMapping[]>(FIELD_MAPPING);

  const readyCount = rows.filter((r) => r.issues.length === 0).length;
  const flaggedCount = rows.length - readyCount;

  const progressIndex = STEP_ORDER.indexOf(step);

  const onFileLoaded = (name: string, text: string) => {
    const parsed = parseCsv(text);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      return { error: "No rows detected. Is this a CSV with a header row?" };
    }
    const detected = detectMapping(parsed.headers);
    const source = detectSource(parsed.headers);
    const parsedRows = rowsFromCsv(parsed.headers, parsed.rows, detected);
    setFileName(name);
    setDetectedSource(source);
    setMapping(detected);
    setRows(parsedRows);
    return { count: parsedRows.length };
  };

  const loadDemoData = () => {
    setFileName("demo-clients.csv");
    setDetectedSource(DETECTED_SOURCE);
    setMapping(FIELD_MAPPING);
    setRows(DETECTED_ROWS);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
      <Link to="/clients" className="text-sm text-ink-500 hover:underline">
        ‹ Clients
      </Link>
      <h1 className="mt-3 text-xl font-semibold text-ink-900">
        Upload clients from CSV
      </h1>

      <ol className="mt-5 mb-6 flex items-center gap-2 text-sm">
        {(Object.keys(STEP_LABELS) as Array<keyof typeof STEP_LABELS>).map(
          (s, i) => {
            const done = progressIndex > i;
            const current =
              step === s || (step === "committing" && i === 2) || (step === "done" && i === 2);
            return (
              <li key={s} className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    done
                      ? "bg-emerald-500 text-white"
                      : current
                      ? "bg-ink-900 text-white"
                      : "bg-line text-ink-500"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className={
                    current ? "text-ink-900 font-medium" : "text-ink-500"
                  }
                >
                  {STEP_LABELS[s]}
                </span>
                {i < 2 && <span className="text-ink-300 mx-1">→</span>}
              </li>
            );
          }
        )}
      </ol>

      {step === "upload" && (
        <UploadStep
          onFileLoaded={onFileLoaded}
          onDemo={() => {
            loadDemoData();
            setStep("map");
          }}
          onNext={() => setStep("map")}
          fileName={fileName}
        />
      )}

      {step === "map" && (
        <MapStep
          mapping={mapping}
          detectedSource={detectedSource}
          onBack={() => setStep("upload")}
          onNext={() => setStep("preview")}
        />
      )}

      {step === "preview" && (
        <PreviewStep
          rows={rows}
          readyCount={readyCount}
          flaggedCount={flaggedCount}
          onRowFix={(i, patch) =>
            setRows((prev) =>
              prev.map((r, idx) =>
                idx === i
                  ? {
                      ...r,
                      ...patch,
                      issues: recomputeIssues({ ...r, ...patch }),
                    }
                  : r
              )
            )
          }
          onBack={() => setStep("map")}
          onCommit={() => setStep("committing")}
        />
      )}

      {step === "committing" && (
        <CommittingStep
          rows={rows.filter((r) => r.issues.length === 0)}
          onDone={(ids, skippedCount) => {
            setImportedIds(ids);
            setSkipped(skippedCount);
            setStep("done");
          }}
          skippedTotal={flaggedCount}
        />
      )}

      {step === "done" && (
        <DoneStep
          importedCount={importedIds.length}
          skippedCount={skipped}
          onDashboard={() => navigate("/")}
          onClients={() => navigate("/clients")}
        />
      )}
    </div>
  );
}

function recomputeIssues(r: DetectedRow): string[] {
  const issues: string[] = [];
  if (!r.entityType) issues.push("entity_missing");
  if (!r.primaryState) issues.push("state_unknown");
  if (!r.email) issues.push("email_missing");
  return issues;
}

function UploadStep({
  onFileLoaded,
  onDemo,
  onNext,
  fileName,
}: {
  onFileLoaded: (
    name: string,
    text: string
  ) => { count?: number; error?: string };
  onDemo: () => void;
  onNext: () => void;
  fileName: string | null;
}) {
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "ok"; name: string; count: number }
    | { kind: "error"; message: string }
  >(fileName ? { kind: "idle" } : { kind: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setStatus({ kind: "error", message: "File exceeds 5 MB." });
      return;
    }
    const text = await file.text();
    const result = onFileLoaded(file.name, text);
    if (result.error) {
      setStatus({ kind: "error", message: result.error });
    } else if (typeof result.count === "number") {
      setStatus({ kind: "ok", name: file.name, count: result.count });
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const hasFile = status.kind === "ok";

  return (
    <div className="bg-surface border border-line rounded-lg p-8">
      <button
        type="button"
        onClick={onPick}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`w-full border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center gap-3 transition-colors ${
          hasFile
            ? "border-emerald-400 bg-emerald-50"
            : isDragging
            ? "border-line-strong bg-canvas"
            : "border-line-strong hover:border-line-strong hover:bg-canvas"
        }`}
      >
        <span className="text-4xl">{hasFile ? "✓" : "↑"}</span>
        <div className="text-sm font-medium text-ink-700">
          {hasFile
            ? `${status.name} · ${status.count} row${
                status.count === 1 ? "" : "s"
              } detected`
            : "Drop CSV here or click to browse"}
        </div>
        <div className="text-xs text-ink-500">
          Max 5 MB · First row should be column headers
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />

      {status.kind === "error" && (
        <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {status.message}
        </div>
      )}

      <div className="mt-5 text-xs text-ink-500">
        <p>
          You can export client lists as CSV from File In Time, TaxDome, Drake,
          ProConnect, QuickBooks — or save a plain Excel sheet as CSV.
        </p>
        <p className="mt-2">
          Don't see yours? Any CSV with client data works — you'll confirm the
          column mapping in the next step.
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onDemo}
          className="text-sm px-3 py-1.5 rounded border border-line hover:bg-canvas text-ink-700"
        >
          Try with demo data
        </button>
        <button
          disabled={!hasFile}
          onClick={onNext}
          className="text-sm px-4 py-2 rounded font-medium text-white bg-ink-900 hover:bg-ink-900 disabled:opacity-40"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

function MapStep({
  mapping,
  detectedSource,
  onBack,
  onNext,
}: {
  mapping: FieldMapping[];
  detectedSource: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const confidence: "high" | "low" =
    mapping.filter((m) => m.confidence === "high").length >= 3 ? "high" : "low";
  return (
    <div className="bg-surface border border-line rounded-lg">
      <div className="px-5 py-4 border-b border-line">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-700">
            Map fields
          </span>
          <span
            className={`ml-auto text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${
              confidence === "high"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            AI · {confidence} confidence
          </span>
        </div>
        <p className="text-xs text-ink-500 mt-1">
          Detected: <strong>{detectedSource}</strong>. Review the column
          mapping; re-map anything that looks off.
        </p>
      </div>

      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-ink-500 bg-canvas">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Your column</th>
            <th className="text-left px-4 py-2 font-medium">→</th>
            <th className="text-left px-4 py-2 font-medium">DueDateHQ field</th>
            <th className="text-left px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {mapping.map((m) => (
            <tr key={m.sourceColumn}>
              <td className="px-4 py-2.5 text-ink-700">{m.sourceColumn}</td>
              <td className="px-4 py-2.5 text-ink-400">→</td>
              <td className="px-4 py-2.5 text-ink-900">
                {humanTargetField(m.targetField)}
              </td>
              <td className="px-4 py-2.5">
                {m.confidence === "high" && (
                  <span className="text-emerald-600 text-xs">✓ Confident</span>
                )}
                {m.confidence === "low" && (
                  <span className="text-amber-700 bg-amber-50 text-xs px-2 py-0.5 rounded">
                    ⚠ Review
                  </span>
                )}
                {m.confidence === "ignore" && (
                  <span className="text-ink-500 text-xs">Ignored</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-5 py-3 bg-canvas rounded-b-lg flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm px-3 py-1.5 rounded border border-line bg-surface hover:bg-canvas"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="text-sm px-4 py-2 rounded font-medium text-white bg-ink-900 hover:bg-ink-900"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

function humanTargetField(key: string): string {
  const map: Record<string, string> = {
    client_name: "Name",
    entity_type: "Entity type",
    primary_state: "Primary state",
    contact_email: "Contact email",
    contact_phone: "Contact phone",
    bundle: "Service package",
    __ignored__: "[Ignore]",
  };
  return map[key] ?? key;
}

const ENTITY_OPTIONS: EntityType[] = [
  "Individual",
  "LLC",
  "S-Corp",
  "C-Corp",
  "Partnership",
  "Trust",
];
const STATE_OPTIONS: StateCode[] = ["CA", "NY", "TX", "LA", "FL"];

function PreviewStep({
  rows,
  readyCount,
  flaggedCount,
  onRowFix,
  onBack,
  onCommit,
}: {
  rows: DetectedRow[];
  readyCount: number;
  flaggedCount: number;
  onRowFix: (i: number, patch: Partial<DetectedRow>) => void;
  onBack: () => void;
  onCommit: () => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="bg-surface border border-line rounded-lg">
      <div className="px-5 py-4 border-b border-line flex items-center gap-3">
        <h2 className="text-sm font-semibold text-ink-700">
          Preview ({rows.length} rows)
        </h2>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
            ✓ {readyCount} ready
          </span>
          {flaggedCount > 0 && (
            <span className="text-warn-ink bg-warn-bg border border-warn-border px-2 py-0.5 rounded font-medium">
              {flaggedCount} row{flaggedCount === 1 ? "" : "s"} need attention
            </span>
          )}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-ink-500 bg-canvas">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Name</th>
            <th className="text-left px-4 py-2 font-medium">Entity</th>
            <th className="text-left px-4 py-2 font-medium">State</th>
            <th className="text-left px-4 py-2 font-medium">Email</th>
            <th className="text-left px-4 py-2 font-medium">Bundle</th>
            <th className="text-right px-4 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => {
            const issue = r.issues.length > 0;
            return (
              <Fragment key={i}>
                <tr
                  className={issue ? "bg-amber-50/50" : "hover:bg-canvas"}
                >
                  <td className="px-4 py-2.5 text-ink-900">
                    {issue && <span className="text-amber-600 mr-1">⚠</span>}
                    {r.name}
                  </td>
                  <td className="px-4 py-2.5 text-ink-700">
                    {r.entityType ?? (
                      <span className="text-amber-700">?</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ink-700">
                    {r.primaryState ?? (
                      <span className="text-amber-700">?</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ink-700">
                    {r.email || <span className="text-amber-700">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-ink-700">
                    {r.bundle ?? <span className="text-ink-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {issue && (
                      <button
                        onClick={() => setEditing(editing === i ? null : i)}
                        className="text-xs px-2 py-1 rounded bg-ink-900 text-white hover:bg-ink-900"
                      >
                        {editing === i ? "Cancel" : "Fix inline"}
                      </button>
                    )}
                  </td>
                </tr>
                {editing === i && (
                  <tr className="bg-amber-50">
                    <td colSpan={6} className="px-4 py-3">
                      <FixInline
                        row={r}
                        onPatch={(patch) => {
                          onRowFix(i, patch);
                          // close editor once row has zero issues
                          const resolved = recomputeIssues({
                            ...r,
                            ...patch,
                          });
                          if (resolved.length === 0) setEditing(null);
                        }}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Action bar — sticks to the viewport bottom while the user scrolls
          the table to fix flagged rows. Border-top + surface bg keeps it
          legible against scrolled content underneath. */}
      <div className="sticky bottom-0 px-5 py-3 bg-surface border-t border-line rounded-b-lg flex items-center justify-between z-10">
        <button
          onClick={onBack}
          className="text-sm px-3 py-1.5 rounded border border-line bg-surface hover:bg-canvas"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          {flaggedCount > 0 && (
            <span className="text-xs text-ink-500">
              {flaggedCount} problematic row{flaggedCount === 1 ? "" : "s"}{" "}
              will be skipped
            </span>
          )}
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={readyCount === 0}
            className="text-sm px-4 py-2 rounded font-medium text-white bg-ink-900 hover:bg-ink-900 disabled:opacity-40"
          >
            Commit {readyCount} client{readyCount === 1 ? "" : "s"} →
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title={`Import ${readyCount} client${readyCount === 1 ? "" : "s"}?`}
        body={
          <>
            <p>
              We'll create <strong>{readyCount}</strong> client record
              {readyCount === 1 ? "" : "s"}, assign service packages, and generate
              this year's deadlines.
            </p>
            {flaggedCount > 0 && (
              <p className="mt-2">
                <strong>{flaggedCount}</strong> flagged row
                {flaggedCount === 1 ? "" : "s"} will be skipped. You can import
                them later from Settings › Imports.
              </p>
            )}
            <p className="mt-2 text-xs text-ink-500">
              You can undo this import from Settings › Imports for the next 7
              days.
            </p>
          </>
        }
        confirmLabel="Import"
        onConfirm={() => {
          setConfirmOpen(false);
          onCommit();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function FixInline({
  row,
  onPatch,
}: {
  row: DetectedRow;
  onPatch: (patch: Partial<DetectedRow>) => void;
}) {
  const [entity, setEntity] = useState<EntityType | "">(row.entityType ?? "");
  const [state, setState] = useState<StateCode | "">(row.primaryState ?? "");
  const [email, setEmail] = useState(row.email);

  const save = () => {
    onPatch({
      entityType: entity || null,
      primaryState: state || null,
      email: email.trim(),
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      {row.issues.includes("entity_missing") ||
      row.issues.includes("entity_ambiguous") ? (
        <label className="text-xs text-ink-700">
          <span className="block mb-1">Entity type</span>
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value as EntityType)}
            className="px-2 py-1 rounded border border-line bg-surface text-sm"
          >
            <option value="">— pick —</option>
            {ENTITY_OPTIONS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {row.issues.includes("state_unknown") && (
        <label className="text-xs text-ink-700">
          <span className="block mb-1">Primary state</span>
          <select
            value={state}
            onChange={(e) => setState(e.target.value as StateCode)}
            className="px-2 py-1 rounded border border-line bg-surface text-sm"
          >
            <option value="">— pick —</option>
            {STATE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATE_NAMES[s]}
              </option>
            ))}
          </select>
        </label>
      )}

      {row.issues.includes("email_missing") && (
        <label className="text-xs text-ink-700">
          <span className="block mb-1">Contact email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="contact@example.com"
            className="px-2 py-1 rounded border border-line bg-surface text-sm"
          />
        </label>
      )}

      <button
        onClick={save}
        className="text-xs px-3 py-1.5 rounded bg-ink-900 text-white hover:bg-ink-900"
      >
        Save row
      </button>
    </div>
  );
}

function CommittingStep({
  rows,
  onDone,
  skippedTotal,
}: {
  rows: DetectedRow[];
  onDone: (ids: string[], skipped: number) => void;
  skippedTotal: number;
}) {
  const [progress, setProgress] = useState(0);

  const payload = useMemo(
    () =>
      rows.map((r) => ({
        name: r.name,
        entityType: r.entityType!,
        primaryState: r.primaryState!,
        contactEmail: r.email,
        contactPhone: r.phone,
        servicePackage: r.bundle ?? undefined,
      })),
    [rows]
  );

  const commit = useCommitImport();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let pct = 0;
    const tick = () => {
      if (cancelled) return;
      pct += 12 + Math.random() * 8;
      if (pct >= 100) {
        setProgress(100);
        commit.mutate(
          {
            rows: payload,
            source: "CSV",
            skippedCount: skippedTotal,
          },
          {
            onSuccess: ({ ids }) => {
              setTimeout(() => {
                if (!cancelled) onDone(ids, skippedTotal);
              }, 250);
            },
            onError: (err) => {
              if (cancelled) return;
              setError(err.message);
            },
          }
        );
      } else {
        setProgress(pct);
        setTimeout(tick, 220);
      }
    };
    setTimeout(tick, 200);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doneRows = Math.min(
    rows.length,
    Math.floor((progress / 100) * rows.length)
  );
  const totalDeadlines = rows.length * 12;
  const doneDeadlines = Math.min(
    totalDeadlines,
    Math.floor((progress / 100) * totalDeadlines)
  );

  // Phases run in order: 0–40% create clients, 40–70% assign bundles, 70–100% generate deadlines.
  const phases: Array<{
    label: string;
    detail: string;
    startPct: number;
    endPct: number;
  }> = [
    {
      label: "Creating client records",
      detail: `${doneRows} of ${rows.length}`,
      startPct: 0,
      endPct: 40,
    },
    {
      label: "Assigning service packages",
      detail: `${Math.min(
        rows.length,
        Math.max(
          0,
          Math.floor(((progress - 40) / 30) * rows.length)
        )
      )} of ${rows.length}`,
      startPct: 40,
      endPct: 70,
    },
    {
      label: "Generating deadlines for 2026",
      detail: `${doneDeadlines} of ${totalDeadlines}`,
      startPct: 70,
      endPct: 100,
    },
  ];

  return (
    <div className="bg-surface border border-line rounded-lg p-8">
      <h2 className="text-sm font-semibold text-ink-700">Importing…</h2>
      <div className="mt-4 h-2 rounded-full bg-sunken overflow-hidden">
        <div
          className="h-full bg-ink-900 transition-[width] duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-ink-700 tabular-nums">
        {Math.floor(progress)}% — {doneRows} of {rows.length} clients
      </p>

      <ul className="mt-4 text-sm space-y-2">
        {phases.map((p) => {
          const active = progress >= p.startPct && progress < p.endPct;
          const done = progress >= p.endPct;
          return (
            <li key={p.label} className="flex items-center gap-2">
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                    ? "bg-ink-900 text-white"
                    : "bg-line text-ink-500"
                }`}
                aria-hidden
              >
                {done ? "✓" : ""}
              </span>
              <span
                className={`text-sm ${
                  done || active ? "text-ink-900" : "text-ink-400"
                }`}
              >
                {p.label}
              </span>
              <span className="ml-auto text-xs text-ink-500 tabular-nums">
                {done || active ? p.detail : "queued"}
              </span>
            </li>
          );
        })}
      </ul>

      {error && (
        <div className="mt-4 text-sm text-danger-ink bg-danger-bg border border-danger-border rounded px-3 py-2">
          Import failed: {error}
        </div>
      )}
    </div>
  );
}

function DoneStep({
  importedCount,
  skippedCount,
  onDashboard,
  onClients,
}: {
  importedCount: number;
  skippedCount: number;
  onDashboard: () => void;
  onClients: () => void;
}) {
  // fake deadline count: ~12 per client
  const generatedDeadlines = importedCount * 12;
  return (
    <div className="bg-surface border border-line rounded-lg p-8 text-center">
      <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
        ✓
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink-900">
        Import complete
      </h2>
      <dl className="mt-4 inline-block text-sm text-left space-y-1">
        <div className="flex gap-8">
          <dt className="w-48 text-ink-500">Clients imported</dt>
          <dd className="font-medium text-ink-900">{importedCount}</dd>
        </div>
        {skippedCount > 0 && (
          <div className="flex gap-8">
            <dt className="w-48 text-ink-500">Skipped (needs attention)</dt>
            <dd className="font-medium text-amber-700">{skippedCount}</dd>
          </div>
        )}
        <div className="flex gap-8">
          <dt className="w-48 text-ink-500">Deadlines generated</dt>
          <dd className="font-medium text-ink-900">
            {generatedDeadlines.toLocaleString()}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={onDashboard}
          className="text-sm px-4 py-2 rounded font-medium text-white bg-ink-900 hover:bg-ink-900"
        >
          Go to dashboard →
        </button>
        <button
          onClick={onClients}
          className="text-sm px-4 py-2 rounded border border-line hover:bg-canvas"
        >
          See all clients
        </button>
      </div>

      <p className="mt-5 text-xs text-ink-500">
        You can undo this import from Settings › Imports for the next 7 days.
      </p>
    </div>
  );
}
