import { Minus, Plus, Check } from "lucide-react";
import type { Client, EntityType, StateCode } from "../types";
import { STATE_NAMES } from "../types";
import { useDeadlinesForClient } from "../hooks/useDeadlines";
import { ConfirmModal } from "./ui/ConfirmModal";

export interface MigrationPatch {
  entityType: EntityType;
  primaryState: StateCode;
  nexusStates: StateCode[];
}

export function MigrationPreviewModal({
  open,
  client,
  patch,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  client: Client | null;
  patch: MigrationPatch | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const deadlinesQuery = useDeadlinesForClient(
    open && client ? client.id : undefined,
  );

  if (!open || !client || !patch) return null;

  const allDeadlines = deadlinesQuery.data ?? [];
  const clientDeadlines = allDeadlines.filter(
    (d) => d.status !== "completed" && d.status !== "filed_extension"
  );

  const entityChanged = patch.entityType !== client.entityType;
  const stateChanged = patch.primaryState !== client.primaryState;
  const priorNexus = new Set(client.nexusStates);
  const nextNexus = new Set(patch.nexusStates);
  const droppedNexus = [...priorNexus].filter((s) => !nextNexus.has(s));
  const addedNexus = [...nextNexus].filter((s) => !priorNexus.has(s));

  const removed = clientDeadlines.filter((d) => {
    if (d.jurisdiction === "federal") return entityChanged && isEntitySpecific(d.form);
    if (d.jurisdiction === client.primaryState && stateChanged) return true;
    if (droppedNexus.includes(d.jurisdiction as StateCode)) return true;
    return false;
  });

  const addedCount = (() => {
    let n = 0;
    if (entityChanged) n += 3;
    if (stateChanged) n += 4;
    n += addedNexus.length * 2;
    return n;
  })();

  const kept = clientDeadlines.filter((d) => !removed.includes(d));

  const summary = buildHeadline(client, patch);

  return (
    <ConfirmModal
      open={open}
      onOpenChange={(o) => !o && onCancel()}
      title="Preview deadline changes"
      description={summary}
      body={
        <div className="space-y-3 text-sm">
          <MigrationRow
            icon={<Minus className="w-3.5 h-3.5" aria-hidden />}
            tone="danger"
            label={`Removes ${removed.length} pending deadline${
              removed.length === 1 ? "" : "s"
            }`}
            detail={
              removed.length > 0
                ? removed.slice(0, 3).map((d) => d.form).join(" · ") +
                  (removed.length > 3 ? ` · +${removed.length - 3} more` : "")
                : "None — no deadlines tied to the old values."
            }
          />
          <MigrationRow
            icon={<Plus className="w-3.5 h-3.5" aria-hidden />}
            tone="ok"
            label={`Adds ${addedCount} new deadline${
              addedCount === 1 ? "" : "s"
            }`}
            detail={addedDetail(patch, entityChanged, stateChanged, addedNexus)}
          />
          <MigrationRow
            icon={<Check className="w-3.5 h-3.5" aria-hidden />}
            tone="neutral"
            label={`Keeps ${kept.length} overlapping deadline${
              kept.length === 1 ? "" : "s"
            }`}
            detail="Federal + unchanged-state deadlines are preserved."
          />
          <p className="text-xs text-ink-500 pt-1">
            A single activity entry is logged summarizing all three counts. Removed
            deadlines stay recoverable via the activity log for 24h.
          </p>
        </div>
      }
      commitLabel="Apply changes"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

function buildHeadline(client: Client, patch: MigrationPatch): string {
  const parts: string[] = [];
  if (patch.entityType !== client.entityType) {
    parts.push(`Entity ${client.entityType} → ${patch.entityType}`);
  }
  if (patch.primaryState !== client.primaryState) {
    parts.push(
      `Primary state ${STATE_NAMES[client.primaryState]} → ${
        STATE_NAMES[patch.primaryState]
      }`
    );
  }
  const priorNexus = new Set(client.nexusStates);
  const nextNexus = new Set(patch.nexusStates);
  const droppedNexus = [...priorNexus].filter((s) => !nextNexus.has(s));
  const addedNexus = [...nextNexus].filter((s) => !priorNexus.has(s));
  if (droppedNexus.length > 0)
    parts.push(`Removes nexus: ${droppedNexus.join(", ")}`);
  if (addedNexus.length > 0)
    parts.push(`Adds nexus: ${addedNexus.join(", ")}`);
  return parts.join(" · ") || "No changes detected.";
}

function addedDetail(
  patch: MigrationPatch,
  entityChanged: boolean,
  stateChanged: boolean,
  addedNexus: StateCode[]
): string {
  const bits: string[] = [];
  if (entityChanged) bits.push(`${patch.entityType} forms`);
  if (stateChanged) bits.push(`${STATE_NAMES[patch.primaryState]} filings`);
  for (const n of addedNexus) bits.push(`${STATE_NAMES[n]} nexus filings`);
  return bits.length > 0 ? bits.join(" · ") : "None.";
}

function isEntitySpecific(form: string): boolean {
  const lc = form.toLowerCase();
  return (
    lc.includes("1120") ||
    lc.includes("1065") ||
    lc.includes("1040") ||
    lc.includes("s-corp") ||
    lc.includes("partnership") ||
    lc.includes("trust")
  );
}

function MigrationRow({
  icon,
  tone,
  label,
  detail,
}: {
  icon: React.ReactNode;
  tone: "danger" | "ok" | "neutral";
  label: string;
  detail: string;
}) {
  const toneClass =
    tone === "danger"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-canvas text-ink-700 border-line";
  return (
    <div className={`border rounded px-3 py-2 ${toneClass}`}>
      <div className="flex items-center gap-2 font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-xs mt-0.5 opacity-80">{detail}</div>
    </div>
  );
}
