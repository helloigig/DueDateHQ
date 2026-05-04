import { useRef, useState } from "react";
import { Upload, FileText, X, Check, AlertTriangle } from "lucide-react";
import { trpc } from "../lib/api/client";
import { useFileUpload, useUploadStatus } from "../hooks/useFileUpload";
import { useStore } from "../data/store";

/**
 * Tier 3 import — prior-year return PDF upload + Claude extraction.
 *
 * Flow:
 *   1. CPA picks a PDF (drag-drop or file picker)
 *   2. FE requests a signed upload URL → PUTs PDF directly to Supabase
 *   3. FE calls imports.parsePriorYearReturn with the storageKey
 *   4. BE downloads the PDF, sends to Sonnet 4.5 with structured-output
 *      prompt, returns extracted fields + confidence
 *   5. FE shows the reviewer UI; CPA confirms or edits before commit
 *
 * Without Supabase Storage configured, the upload step throws a clean
 * error. Without Anthropic configured, the extraction returns the
 * deterministic stub. Both gates are visible in the UI.
 */
export function PriorYearUpload() {
  const status = useUploadStatus();
  const { upload, progress, reset } = useFileUpload();
  const parse = trpc.imports.parsePriorYearReturn.useMutation();
  const commit = trpc.imports.commitPriorYearReturn.useMutation();
  const { clients } = useStore();
  const [clientId, setClientId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [storageKey, setStorageKey] = useState<string | null>(null);

  const onPick = (f: File | null) => {
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) {
      alert("File too large — 50MB max");
      return;
    }
    setFile(f);
  };

  const onUpload = async () => {
    if (!file) return;
    parse.reset();
    commit.reset();
    setStorageKey(null);
    try {
      const result = await upload({
        file,
        kind: "prior_year_return",
      });
      setStorageKey(result.storageKey);
      await parse.mutateAsync({
        storageKey: result.storageKey,
        clientId: clientId || undefined,
      });
    } catch {
      // upload hook surfaces the error in progress state
    }
  };

  const onCommit = async () => {
    const fields = parse.data?.fields;
    if (!fields || !clientId) return;
    await commit.mutateAsync({
      clientId,
      taxYear: fields.taxYear ?? new Date().getFullYear() - 1,
      fields: {
        clientName: fields.clientName,
        ein: fields.ein,
        entityType: fields.entityType,
        priorAGI: fields.priorAGI,
        formsFiled: fields.formsFiled,
        k1Sources: fields.k1Sources,
        confidence: fields.confidence,
      },
      sourceStorageKey: storageKey ?? undefined,
    });
  };

  const onClear = () => {
    setFile(null);
    reset();
    parse.reset();
    commit.reset();
    setStorageKey(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const isReady = file && progress.state !== "uploading" && !parse.isPending;
  const extracted = parse.data?.fields;

  return (
    <section className="bg-surface border border-line rounded-md overflow-hidden">
      <header className="px-4 py-2.5 border-b border-line bg-sunken/40 flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-ink-700" aria-hidden />
        <h3 className="text-sm font-semibold text-ink-900">
          Upload a prior-year return
        </h3>
        <span className="text-2xs text-ink-500 ml-1">
          PDF — Sonnet 4.5 extracts the fields
        </span>
      </header>

      <div className="px-4 py-3 space-y-3">
        {!status.data?.configured && (
          <p className="text-2xs text-warn-ink bg-warn-bg/40 border border-warn-border rounded px-2 py-1">
            Storage not yet configured. Set SUPABASE_URL +
            SUPABASE_SERVICE_ROLE_KEY in backend env to enable real uploads.
          </p>
        )}

        {/* File picker / dropzone */}
        {!file && (
          <label
            htmlFor="prior-year-pdf"
            className="block border-2 border-dashed border-line rounded p-6 text-center cursor-pointer hover:bg-sunken/30 transition-colors"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const f = e.dataTransfer.files[0];
              if (f) onPick(f);
            }}
          >
            <Upload className="w-6 h-6 text-ink-400 mx-auto" aria-hidden />
            <p className="text-sm text-ink-700 mt-2">
              Drop a PDF here or click to pick
            </p>
            <p className="text-2xs text-ink-500 mt-1">
              50MB max · multi-page returns OK
            </p>
            <input
              ref={fileInput}
              id="prior-year-pdf"
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
          </label>
        )}

        {/* Selected file → bind to client + upload */}
        {file && progress.state !== "done" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-canvas border border-line rounded px-3 py-2">
              <FileText className="w-4 h-4 text-ink-700 shrink-0" aria-hidden />
              <span className="text-sm text-ink-900 truncate flex-1">
                {file.name}
              </span>
              <span className="text-2xs text-ink-500 tabular-nums">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <button
                onClick={onClear}
                className="text-ink-400 hover:text-ink-900 p-0.5"
                aria-label="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-ink-700 mb-1 block">
                Bind to client (optional)
              </span>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full border border-line rounded px-3 py-2 text-sm bg-surface"
              >
                <option value="">— Don't bind (just extract) —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="text-2xs text-ink-400 mt-1 block">
                When bound, the extracted facts are written to this
                client's prior-year history (Mode E uses them).
              </span>
            </label>

            <button
              onClick={onUpload}
              disabled={!isReady}
              className="text-sm px-4 py-1.5 rounded bg-indigo text-white hover:bg-indigo-hover disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden />
              {progress.state === "uploading"
                ? `Uploading… ${progress.pct}%`
                : parse.isPending
                  ? "Reading PDF…"
                  : progress.state === "requesting"
                    ? "Preparing…"
                    : "Upload + extract"}
            </button>

            {progress.state === "uploading" && (
              <div className="h-1 bg-line rounded overflow-hidden">
                <div
                  className="h-full bg-accent transition-[width] duration-200"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
            )}
            {progress.state === "failed" && (
              <p className="text-xs text-danger-ink bg-danger-bg/40 border border-danger-border rounded px-3 py-2">
                Upload failed: {progress.error}
              </p>
            )}
            {parse.error && (
              <p className="text-xs text-danger-ink bg-danger-bg/40 border border-danger-border rounded px-3 py-2">
                Extraction failed: {parse.error.message}
              </p>
            )}
          </div>
        )}

        {/* Extracted fields review */}
        {extracted && (
          <div className="bg-canvas border border-line rounded p-3 space-y-2">
            <div className="flex items-baseline gap-2">
              <h4 className="text-xs font-semibold text-ink-900">
                Extracted fields
              </h4>
              <span
                className={[
                  "text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded border",
                  extracted.confidence >= 0.8
                    ? "bg-ok-bg text-ok-ink border-ok-border"
                    : extracted.confidence >= 0.5
                      ? "bg-info-bg text-info-ink border-info-border"
                      : "bg-warn-bg text-warn-ink border-warn-border",
                ].join(" ")}
              >
                {extracted.confidence >= 0.8
                  ? "high confidence"
                  : extracted.confidence >= 0.5
                    ? "medium confidence"
                    : "low confidence"}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-2xs">
              <ExtractedField
                label="Tax year"
                value={extracted.taxYear ? String(extracted.taxYear) : null}
              />
              <ExtractedField
                label="Entity type"
                value={extracted.entityType}
              />
              <ExtractedField
                label="Client name"
                value={extracted.clientName}
              />
              <ExtractedField label="EIN" value={extracted.ein} />
              <ExtractedField
                label="Prior AGI"
                value={
                  extracted.priorAGI
                    ? `$${extracted.priorAGI.toLocaleString()}`
                    : null
                }
              />
              <ExtractedField
                label="Forms filed"
                value={extracted.formsFiled.join(", ") || null}
              />
              {extracted.k1Sources.length > 0 && (
                <ExtractedField
                  label="K-1 sources"
                  value={extracted.k1Sources.join(", ")}
                  span
                />
              )}
            </dl>
            <div className="flex items-center gap-2 pt-2 border-t border-line flex-wrap">
              {commit.data ? (
                <span className="text-2xs text-ok-ink inline-flex items-center gap-1">
                  <Check className="w-3 h-3" aria-hidden />
                  Wrote {commit.data.inserted} fact{commit.data.inserted === 1 ? "" : "s"}
                  {commit.data.factTypes.length > 0 && (
                    <span className="text-ink-500 ml-1">
                      ({commit.data.factTypes.join(", ")})
                    </span>
                  )}
                </span>
              ) : parse.data?.readyForCommit ? (
                <button
                  onClick={onCommit}
                  disabled={!clientId || commit.isPending}
                  className="text-xs px-3 py-1 rounded bg-indigo text-white hover:bg-indigo-hover disabled:opacity-40 disabled:cursor-not-allowed"
                  title={
                    !clientId
                      ? "Bind to a client above before committing"
                      : "Write extracted facts to imported_facts (Mode E memory)"
                  }
                >
                  <Check className="w-3 h-3 inline mr-1" aria-hidden />
                  {commit.isPending
                    ? "Writing…"
                    : !clientId
                      ? "Confirm + write (bind a client first)"
                      : "Confirm + write"}
                </button>
              ) : (
                <span className="text-2xs text-warn-ink inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" aria-hidden />
                  Below 0.7 confidence — review needed before commit
                </span>
              )}
              {commit.error && (
                <span className="text-2xs text-danger-ink">
                  {commit.error.message}
                </span>
              )}
              <button
                onClick={onClear}
                className="ml-auto text-xs px-3 py-1 rounded text-ink-500 hover:bg-sunken"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ExtractedField({
  label,
  value,
  span: spanCol,
}: {
  label: string;
  value: string | null;
  span?: boolean;
}) {
  return (
    <div className={spanCol ? "col-span-2" : ""}>
      <dt className="text-ink-500 uppercase tracking-wide font-semibold">
        {label}
      </dt>
      <dd
        className={[
          "mt-0.5",
          value ? "text-ink-900" : "text-ink-400 italic",
        ].join(" ")}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}
