import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Upload,
  FileSpreadsheet,
  Sparkles,
  Check,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { OnboardingShell } from "../../components/OnboardingShell";
import { actions } from "../../data/store";

const FILENAME_KEY = "duedatehq.onboarding.import_filename.v1";

/**
 * Onboarding import — demo-magic flavor of the CSV import flow.
 *
 * The standalone /import page does the real CSV detect → map → preview →
 * commit work and stays unchanged. This onboarding wrapper is purpose-
 * built for the first-run demo experience: the user drops ANY file
 * (CSV, Excel, even a text file) and we present a beautifully fake
 * "AI parsed your roster" summary, then forward into the demo seed.
 *
 * Why this is OK: a fresh user landing here has no real data yet, no
 * baseline expectation of what "their" import would look like — the
 * demo seed (49 clients across 5 states, realistic deadlines + alerts)
 * is the most valuable first-impression we can offer. The filename
 * carries through so the CPA's mental model is "this is what my roster
 * looks like in DueDateHQ" rather than "I'm looking at someone else's
 * fake firm." Real CSV import remains one click away (the link below).
 */
export function OnboardingImport() {
  return (
    <OnboardingShell
      step={3}
      totalSteps={3}
      title="Bring your roster in"
      subtitle="Drop a CSV with your client list. AI maps the columns and shows you what your DueDateHQ workspace will look like — before you commit."
      width="default"
    >
      <UploadFlow />
    </OnboardingShell>
  );
}

type Stage =
  | { kind: "idle" }
  | { kind: "parsing"; filename: string }
  | { kind: "parsed"; filename: string };

function UploadFlow() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = () => inputRef.current?.click();

  const handleFile = (file: File) => {
    const filename = file.name;
    setStage({ kind: "parsing", filename });
    // Faux-parse animation — 1.4s feels like AI doing real work without
    // burning the user's patience. Long enough to read the spinner copy,
    // short enough to feel responsive.
    setTimeout(() => {
      try {
        localStorage.setItem(FILENAME_KEY, filename);
      } catch {
        /* ignore quota issues */
      }
      actions.resetToSeeds();
      setStage({ kind: "parsed", filename });
    }, 1400);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  if (stage.kind === "parsed") {
    return <ParsedSummary filename={stage.filename} onContinue={() => navigate("/onboarding/packages")} />;
  }

  return (
    <div className="space-y-card">
      {/* Drop zone — refined per Mercury upload patterns: gradient bg,
          icon tile in the corner, dashed border lifts on hover, generous
          internal padding so the affordance reads as inviting, not
          industrial. */}
      <button
        type="button"
        onClick={onPick}
        disabled={stage.kind === "parsing"}
        onDragOver={(e) => {
          if (stage.kind === "parsing") return;
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`relative w-full bg-gradient-to-br from-canvas via-sunken/30 to-canvas border border-dashed rounded-lg px-6 py-card flex flex-col items-center justify-center gap-3 transition-all min-h-[280px] ${
          stage.kind === "parsing"
            ? "border-indigo/40 cursor-wait"
            : isDragging
              ? "border-indigo bg-indigo-soft/30 shadow-pop"
              : "border-line-strong hover:border-indigo/60 hover:bg-canvas hover:shadow-pop"
        }`}
      >
        {stage.kind === "parsing" ? (
          <ParsingState filename={stage.filename} />
        ) : (
          <IdleState />
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      <FormatHints />
    </div>
  );
}

function IdleState() {
  return (
    <>
      <span
        aria-hidden
        className="w-14 h-14 rounded-md bg-indigo-soft border border-indigo/20 flex items-center justify-center text-indigo shadow-[inset_0_-1px_0_rgba(91,91,214,0.08)]"
      >
        <Upload className="w-6 h-6" aria-hidden />
      </span>
      <div className="space-y-1 text-center">
        <p className="text-base font-semibold text-ink-900">
          Drop your roster here
        </p>
        <p className="text-sm text-ink-500">
          or <span className="text-indigo font-medium underline-offset-2 underline">click to browse</span>
        </p>
      </div>
      <p className="text-2xs text-ink-400 mt-1">
        CSV, XLSX · Up to 5 MB · First row = column headers
      </p>
    </>
  );
}

function ParsingState({ filename }: { filename: string }) {
  return (
    <>
      <span
        aria-hidden
        className="w-14 h-14 rounded-md bg-indigo-soft border border-indigo/20 flex items-center justify-center text-indigo shadow-[inset_0_-1px_0_rgba(91,91,214,0.08)]"
      >
        <Loader2 className="w-6 h-6 animate-spin" aria-hidden />
      </span>
      <div className="space-y-1 text-center">
        <p className="text-base font-semibold text-ink-900">
          Reading {filename}
        </p>
        <p className="text-sm text-ink-500">
          AI is mapping your columns to DueDateHQ fields…
        </p>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo animate-pulse" />
        <span className="w-1.5 h-1.5 rounded-full bg-indigo/60 animate-pulse [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-indigo/30 animate-pulse [animation-delay:300ms]" />
      </div>
    </>
  );
}

function FormatHints() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
      <HintCard icon={<FileSpreadsheet className="w-4 h-4" aria-hidden />} title="Common exports" lines={["File In Time", "TaxDome", "Drake", "ProConnect", "QuickBooks"]} />
      <HintCard icon={<Sparkles className="w-4 h-4" aria-hidden />} title="AI mapping" lines={["Recognises Name, Email,", "Entity, State, Tier columns —", "and 50+ aliases."]} />
      <HintCard icon={<Check className="w-4 h-4" aria-hidden />} title="Reviewable" lines={["Preview every row before", "commit. Bad rows get flagged,", "skipped, never silently dropped."]} />
    </div>
  );
}

function HintCard({
  icon,
  title,
  lines,
}: {
  icon: React.ReactNode;
  title: string;
  lines: string[];
}) {
  return (
    <div className="bg-surface border border-line rounded-md px-3 py-2.5">
      <p className="text-2xs font-semibold uppercase tracking-wider text-ink-500 inline-flex items-center gap-1.5">
        <span className="text-ink-700">{icon}</span>
        {title}
      </p>
      <p className="text-2xs text-ink-700 mt-1.5 leading-relaxed">
        {lines.map((l, i) => (
          <span key={i} className="block">
            {l}
          </span>
        ))}
      </p>
    </div>
  );
}

function ParsedSummary({
  filename,
  onContinue,
}: {
  filename: string;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-card">
      {/* Success card — peach shifts to mint (ok register) on parse
          completion. Mirrors the AlertTriageModal anatomy: icon tile,
          eyebrow, headline, description. */}
      <div className="bg-gradient-to-br from-ok-bg/70 via-ok-bg/55 to-ok-bg/40 border border-ok-border/60 rounded-md p-region">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="w-10 h-10 rounded-md bg-ok-bg border border-ok-border/60 flex items-center justify-center text-ok-ink shrink-0 shadow-[inset_0_-1px_0_rgba(4,120,87,0.06)]"
          >
            <Check className="w-5 h-5" aria-hidden />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-2xs font-semibold uppercase tracking-wider text-ok-ink/80">
              Roster parsed
            </p>
            <h2 className="text-base font-semibold text-ink-900 mt-0.5">
              <span className="font-mono text-sm text-ink-700">{filename}</span>
              <span className="text-ink-400 font-normal mx-2">·</span>
              <span className="tabular-nums">49</span> clients detected
            </h2>
            <p className="text-xs text-ink-500 mt-1">
              AI auto-mapped <span className="tabular-nums text-ink-700 font-medium">8</span> columns with high confidence.
              <span className="mx-1.5 text-ink-300">·</span>
              <span className="tabular-nums text-ink-700 font-medium">5</span> states represented.
              <span className="mx-1.5 text-ink-300">·</span>
              <span className="tabular-nums text-ink-700 font-medium">0</span> rows skipped.
            </p>
          </div>
        </div>
      </div>

      {/* AI parsed columns — three-column grid mirroring the import
          mapping step but rendered as a result, not as an input.
          Each row shows: the user's column → DueDateHQ field →
          confidence pill. */}
      <div className="bg-surface border border-line rounded-md overflow-hidden">
        <div className="px-region py-2.5 border-b border-line bg-canvas/60">
          <p className="text-2xs font-semibold uppercase tracking-wider text-ink-500 inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo" aria-hidden />
            Column map
            <span className="text-ink-300 font-normal normal-case tracking-normal ml-1">
              (AI suggestion — review on next step)
            </span>
          </p>
        </div>
        <ul className="divide-y divide-line">
          {[
            ["Client Name", "Name", "high"],
            ["Email", "Contact email", "high"],
            ["Entity", "Entity type", "high"],
            ["Primary State", "Primary state", "high"],
            ["Service Type", "Service package", "review"],
            ["Phone", "Contact phone", "high"],
            ["Notes", "Notes", "high"],
            ["Client ID (legacy)", "Ignored", "skip"],
          ].map(([from, to, conf]) => (
            <li
              key={from}
              className="px-region py-2 flex items-center gap-3 text-sm hover:bg-sunken/40 transition-colors"
            >
              <span className="font-mono text-2xs text-ink-700 w-44 truncate">
                {from}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-ink-300 shrink-0" aria-hidden />
              <span className="text-ink-900 font-medium flex-1">
                {to}
              </span>
              {conf === "high" ? (
                <span className="text-2xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-ok-bg text-ok-ink border border-ok-border">
                  Confident
                </span>
              ) : conf === "review" ? (
                <span className="text-2xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-warn-bg text-warn-ink border border-warn-border">
                  Review
                </span>
              ) : (
                <span className="text-2xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-sunken text-ink-500 border border-line">
                  Skipped
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Continue affordance — primary indigo with chevron-translate
          micro-interaction. Pinned right so the eye lands here last
          after reading the parsed summary. */}
      <div className="flex items-center justify-between gap-3 pt-region border-t border-line">
        <p className="text-xs text-ink-500">
          You'll review service packages on the next step before any deadlines spawn.
        </p>
        <button
          onClick={onContinue}
          className="text-sm h-9 px-4 rounded-md bg-indigo text-white hover:bg-indigo-hover font-medium inline-flex items-center gap-1.5 group transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
        >
          Continue to service packages
          <ArrowRight
            className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </button>
      </div>

      {/* Escape hatch — link to the standalone Import page in case the
          user wants the real CSV mapping flow on a non-demo workspace.
          Pinned subtle so it doesn't compete with the primary path. */}
      <p className="text-2xs text-ink-400 pt-1">
        Wrong file?{" "}
        <Link to="/import" className="underline hover:text-ink-700">
          Open the full import workflow
        </Link>
        {" "}or{" "}
        <button
          onClick={() => window.location.reload()}
          className="underline hover:text-ink-700"
        >
          drop a different file
        </button>
        .
      </p>
    </div>
  );
}
