/**
 * DependencyChainEditor — modal for creating + editing firm-custom
 * "wait for X before Y" rules.
 *
 * Why this matters for the CPA: the system chains (1065 → K-1 → 1040) cover
 * pass-through entities, but real engagements have firm-specific chains:
 *
 *   • "Bookkeeping close" must finish before Q estimate
 *   • "Year-end planning meeting" must finish before any 1040 prep
 *   • "Trust 1041" must finish before beneficiary 1040 K-1 reconciliation
 *
 * Without authoring, the CPA either (a) leaves dependencies implicit and
 * gets surprised when something starts too early, or (b) papers over the
 * gap with calendar reminders that drift. Custom chains let them encode
 * "the way this firm actually works" once and have the system enforce it
 * across every client.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Trash2 } from "lucide-react";
import type {
  DependencyChain,
  DependencyKind,
} from "../hooks/useDependencyChains";
import { FEDERAL_FORMS } from "../data/federalForms";

const KIND_LABEL: Record<DependencyKind, string> = {
  form: "Federal form",
  milestone: "Milestone (per-task)",
  external: "External handoff",
};

const MILESTONE_OPTIONS = [
  { ref: "books_close", label: "Bookkeeping close" },
  { ref: "client_meeting", label: "Client planning meeting" },
  { ref: "review_complete", label: "Reviewer sign-off" },
  { ref: "preparer_done", label: "Preparer hand-off" },
  { ref: "engagement_signed", label: "Engagement letter signed" },
];

interface Props {
  open: boolean;
  initial?: DependencyChain;
  onClose: () => void;
  onSave: (chain: DependencyChain) => void;
  onDelete?: (id: string) => void;
  isSystemChain?: boolean;
}

export function DependencyChainEditor({
  open,
  initial,
  onClose,
  onSave,
  onDelete,
  isSystemChain = false,
}: Props) {
  const [draft, setDraft] = useState<DependencyChain>(
    initial ?? blankChain(),
  );

  useEffect(() => {
    setDraft(initial ?? blankChain());
  }, [initial?.id, open]);

  const editable = !isSystemChain;
  const isValid =
    draft.name.trim().length > 0 &&
    draft.waitFor.ref.trim().length > 0 &&
    draft.blocks.ref.trim().length > 0;

  const handleSave = () => {
    if (!isValid) return;
    onSave({ ...draft, name: draft.name.trim() });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            {isSystemChain
              ? `System chain · ${draft.name}`
              : initial
                ? `Edit chain · ${draft.name || "untitled"}`
                : "New dependency chain"}
          </DialogTitle>
          <DialogDescription>
            "Wait for X before Y." Hard chains block the dependent from
            starting; soft chains warn but let work proceed.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <label className="block">
            <span className="text-2xs uppercase tracking-wide text-ink-500">
              Name
            </span>
            <input
              type="text"
              value={draft.name}
              disabled={!editable}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Books close → Q estimate"
              className="mt-1 w-full text-sm px-2 py-1.5 rounded border border-line bg-surface disabled:bg-sunken disabled:text-ink-500"
            />
          </label>

          <label className="block">
            <span className="text-2xs uppercase tracking-wide text-ink-500">
              Description
            </span>
            <textarea
              value={draft.description ?? ""}
              disabled={!editable}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              rows={2}
              placeholder="What this chain enforces and when it kicks in."
              className="mt-1 w-full text-sm px-2 py-1.5 rounded border border-line bg-surface disabled:bg-sunken disabled:text-ink-500"
            />
          </label>

          <RefPicker
            label="Wait for"
            ref={draft.waitFor}
            onChange={(r) => setDraft({ ...draft, waitFor: r })}
            disabled={!editable}
          />
          <RefPicker
            label="Before"
            ref={draft.blocks}
            onChange={(r) => setDraft({ ...draft, blocks: r })}
            disabled={!editable}
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-2xs uppercase tracking-wide text-ink-500">
                Enforcement
              </span>
              <select
                value={draft.enforcement}
                disabled={!editable}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    enforcement: e.target.value as "hard" | "soft",
                  })
                }
                className="mt-1 w-full text-sm px-2 py-1.5 rounded border border-line bg-surface disabled:bg-sunken disabled:text-ink-500"
              >
                <option value="hard">Hard — block the dependent</option>
                <option value="soft">Soft — warn but allow</option>
              </select>
            </label>
            <label className="block">
              <span className="text-2xs uppercase tracking-wide text-ink-500">
                Buffer (days)
              </span>
              <input
                type="number"
                min={0}
                max={30}
                value={draft.bufferDays}
                disabled={!editable}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    bufferDays: Math.max(
                      0,
                      Math.min(30, Number(e.target.value) || 0),
                    ),
                  })
                }
                className="mt-1 w-full text-sm px-2 py-1.5 rounded border border-line bg-surface disabled:bg-sunken disabled:text-ink-500"
              />
            </label>
          </div>

          {editable && (
            <p className="text-2xs text-ink-500 leading-relaxed">
              Buffer = days of slack after the wait-for completes before
              the dependent can start. Useful when a hand-off needs review
              time (e.g. wait 2 days for the reviewer to finalize K-1s).
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          {editable && initial && onDelete && (
            <Button
              variant="outline"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete "${draft.name}"? This stops blocking dependent tasks immediately.`,
                  )
                ) {
                  onDelete(draft.id);
                  onClose();
                }
              }}
              className="mr-auto text-danger-ink"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" aria-hidden />
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {editable ? "Cancel" : "Close"}
          </Button>
          {editable && (
            <Button onClick={handleSave} disabled={!isValid}>
              {initial ? "Save chain" : "Create chain"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefPicker({
  label,
  ref,
  onChange,
  disabled,
}: {
  label: string;
  ref: { kind: DependencyKind; ref: string };
  onChange: (next: { kind: DependencyKind; ref: string }) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <span className="text-2xs uppercase tracking-wide text-ink-500 block mb-1">
        {label}
      </span>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={ref.kind}
          disabled={disabled}
          onChange={(e) =>
            onChange({ kind: e.target.value as DependencyKind, ref: "" })
          }
          className="text-sm px-2 py-1.5 rounded border border-line bg-surface disabled:bg-sunken disabled:text-ink-500"
        >
          {(Object.keys(KIND_LABEL) as DependencyKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        {ref.kind === "form" ? (
          <select
            value={ref.ref}
            disabled={disabled}
            onChange={(e) =>
              onChange({ kind: ref.kind, ref: e.target.value })
            }
            className="text-sm px-2 py-1.5 rounded border border-line bg-surface disabled:bg-sunken disabled:text-ink-500"
          >
            <option value="">Choose form…</option>
            {FEDERAL_FORMS.map((f) => (
              <option key={f.code} value={f.code}>
                {f.code} — {f.name}
              </option>
            ))}
          </select>
        ) : ref.kind === "milestone" ? (
          <select
            value={ref.ref}
            disabled={disabled}
            onChange={(e) =>
              onChange({ kind: ref.kind, ref: e.target.value })
            }
            className="text-sm px-2 py-1.5 rounded border border-line bg-surface disabled:bg-sunken disabled:text-ink-500"
          >
            <option value="">Choose milestone…</option>
            {MILESTONE_OPTIONS.map((m) => (
              <option key={m.ref} value={m.ref}>
                {m.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={ref.ref}
            disabled={disabled}
            onChange={(e) =>
              onChange({ kind: ref.kind, ref: e.target.value })
            }
            placeholder="e.g. Bookkeeping team handoff"
            className="text-sm px-2 py-1.5 rounded border border-line bg-surface disabled:bg-sunken disabled:text-ink-500"
          />
        )}
      </div>
    </div>
  );
}

function blankChain(): DependencyChain {
  return {
    id: `chain-${Date.now()}`,
    name: "",
    description: "",
    waitFor: { kind: "form", ref: "" },
    blocks: { kind: "form", ref: "" },
    enforcement: "hard",
    bufferDays: 0,
    createdAt: new Date().toISOString(),
  };
}
