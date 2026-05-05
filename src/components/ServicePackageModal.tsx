/**
 * ServicePackageModal — preview + edit a service package (system bundle
 * or firm-custom). One modal handles three modes:
 *
 *   - "view"   — read-only preview of a system bundle (clone button to
 *                fork into a custom). Shown from /settings/packages.
 *   - "edit"   — edit a firm-custom bundle (add/remove templates).
 *   - "create" — start from blank or clone a system bundle.
 *
 * Custom bundles live in the FE store at MVP (see useCustomBundles); when
 * the backend adds a `firm_service_bundles` table, swap the hook for the
 * tRPC mutations and the rest of the UI stays the same.
 *
 * Spec ties:
 *   - feedback_more_than_mvp — full add/edit/delete in one PR, not a stub
 *   - feedback_lightweight_dashboard — Settings is admin/audit, not daily;
 *     so verbose layout is fine here (this is where the CPA tunes the
 *     templates that drive every client onboarding for the rest of the year)
 */
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, FileText, Copy } from "lucide-react";
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
import type {
  DeadlineTemplate,
  FilingBundle,
  JurisdictionSlot,
} from "../data/bundles";
import type { EntityType } from "../types";
import { FEDERAL_FORMS } from "../data/federalForms";

type Mode = "view" | "edit" | "create";

interface Props {
  open: boolean;
  mode: Mode;
  /** When set, the modal opens prefilled with this bundle's templates.
   *  In "view" mode this is the system bundle being previewed.
   *  In "edit" mode this is the custom bundle being edited.
   *  In "create" mode this is the optional clone source. */
  bundle?: FilingBundle;
  onClose: () => void;
  onSave?: (bundle: FilingBundle) => void;
  onDelete?: (bundleId: string) => void;
  /** Distinguishes system bundles (read-only) from firm-custom (editable). */
  isSystemBundle?: boolean;
}

const ENTITY_OPTIONS: EntityType[] = [
  "Individual",
  "C-Corp",
  "S-Corp",
  "Partnership",
  "LLC",
  "Trust",
];

const JURISDICTION_LABEL: Record<JurisdictionSlot, string> = {
  federal: "Federal",
  primary: "Primary state",
  nexus: "Each nexus state",
};

const FORM_OPTIONS = FEDERAL_FORMS.map((f) => ({
  code: f.code,
  label: `${f.code} — ${f.name}`,
  defaultDueDate: f.dueDate,
}));

export function ServicePackageModal({
  open,
  mode,
  bundle,
  onClose,
  onSave,
  onDelete,
  isSystemBundle = false,
}: Props) {
  const editable = mode !== "view";

  const initial: FilingBundle = useMemo(
    () =>
      bundle ?? {
        id: `custom-${Date.now()}`,
        name: "",
        description: "",
        entityTypes: [],
        templates: [],
      },
    [bundle?.id, mode],
  );

  const [draft, setDraft] = useState<FilingBundle>(initial);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const updateField = <K extends keyof FilingBundle>(
    key: K,
    value: FilingBundle[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));

  const toggleEntity = (e: EntityType) =>
    setDraft((d) => ({
      ...d,
      entityTypes: d.entityTypes.includes(e)
        ? d.entityTypes.filter((x) => x !== e)
        : [...d.entityTypes, e],
    }));

  const addTemplate = () =>
    setDraft((d) => ({
      ...d,
      templates: [
        ...d.templates,
        {
          form: FORM_OPTIONS[0]?.label ?? "",
          jurisdiction: "federal",
          month: 4,
          day: 15,
        },
      ],
    }));

  const updateTemplate = (idx: number, patch: Partial<DeadlineTemplate>) =>
    setDraft((d) => ({
      ...d,
      templates: d.templates.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    }));

  const removeTemplate = (idx: number) =>
    setDraft((d) => ({
      ...d,
      templates: d.templates.filter((_, i) => i !== idx),
    }));

  const handleSave = () => {
    if (!onSave) return;
    if (!draft.name.trim()) return;
    if (draft.entityTypes.length === 0) return;
    if (draft.templates.length === 0) return;
    onSave(draft);
    onClose();
  };

  const handleClone = () => {
    if (!onSave) return;
    const cloned: FilingBundle = {
      ...draft,
      id: `custom-${Date.now()}`,
      name: `${draft.name} (custom)`,
    };
    onSave(cloned);
    onClose();
  };

  const title =
    mode === "view"
      ? draft.name || "Service package"
      : mode === "edit"
        ? `Edit · ${draft.name || "service package"}`
        : "Create service package";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === "view"
              ? "Preview this package's filings. Clone to make a firm-custom version you can edit."
              : "Each template generates one deadline + checklist when applied to a client. Federal templates produce one deadline; primary/nexus state templates expand against the client's state list."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Identity */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-2xs uppercase tracking-wide text-ink-500">
                Name
              </span>
              <input
                type="text"
                value={draft.name}
                disabled={!editable}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="e.g. S-Corp + nexus"
                className="mt-1 w-full text-sm px-2 py-1.5 rounded border border-line bg-surface disabled:bg-sunken disabled:text-ink-500"
              />
            </label>
            <label className="block">
              <span className="text-2xs uppercase tracking-wide text-ink-500">
                Description
              </span>
              <input
                type="text"
                value={draft.description}
                disabled={!editable}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="What this package covers"
                className="mt-1 w-full text-sm px-2 py-1.5 rounded border border-line bg-surface disabled:bg-sunken disabled:text-ink-500"
              />
            </label>
          </div>

          {/* Entity types */}
          <div>
            <span className="text-2xs uppercase tracking-wide text-ink-500 block mb-1.5">
              Applies to entity types
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ENTITY_OPTIONS.map((e) => {
                const active = draft.entityTypes.includes(e);
                return (
                  <button
                    key={e}
                    type="button"
                    disabled={!editable}
                    onClick={() => toggleEntity(e)}
                    className={`text-xs px-2 py-1 rounded border ${
                      active
                        ? "bg-info-bg text-info-ink border-info-border"
                        : "bg-surface text-ink-700 border-line"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Templates */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-2xs uppercase tracking-wide text-ink-500">
                Filings in this package ({draft.templates.length})
              </span>
              {editable && (
                <button
                  type="button"
                  onClick={addTemplate}
                  className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-line text-ink-700 hover:bg-sunken"
                >
                  <Plus className="w-3 h-3" aria-hidden /> Add filing
                </button>
              )}
            </div>
            {draft.templates.length === 0 ? (
              <p className="text-sm text-ink-500 italic px-3 py-4 border border-dashed border-line rounded">
                {editable
                  ? "No filings yet. Add at least one to save this package."
                  : "This package contains no filings."}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {draft.templates.map((t, i) => (
                  <li
                    key={i}
                    className="grid gap-2 sm:grid-cols-[2fr_1fr_auto_auto] items-center px-2 py-1.5 rounded border border-line bg-surface"
                  >
                    {editable ? (
                      <input
                        type="text"
                        value={t.form}
                        onChange={(e) =>
                          updateTemplate(i, { form: e.target.value })
                        }
                        list="ddhq-form-options"
                        className="text-sm px-2 py-1 rounded border border-line bg-canvas"
                        placeholder="Form (e.g. 1120-S)"
                      />
                    ) : (
                      <span className="text-sm font-medium text-ink-900 inline-flex items-center gap-1">
                        <FileText className="w-3 h-3 text-ink-400" aria-hidden />
                        {t.form}
                      </span>
                    )}
                    {editable ? (
                      <select
                        value={t.jurisdiction}
                        onChange={(e) =>
                          updateTemplate(i, {
                            jurisdiction: e.target
                              .value as JurisdictionSlot,
                          })
                        }
                        className="text-xs px-2 py-1 rounded border border-line bg-canvas"
                      >
                        {(Object.keys(JURISDICTION_LABEL) as JurisdictionSlot[]).map(
                          (j) => (
                            <option key={j} value={j}>
                              {JURISDICTION_LABEL[j]}
                            </option>
                          ),
                        )}
                      </select>
                    ) : (
                      <span className="text-xs text-ink-500">
                        {JURISDICTION_LABEL[t.jurisdiction]}
                      </span>
                    )}
                    <span className="text-xs tabular-nums text-ink-700 inline-flex items-center gap-1">
                      {editable ? (
                        <>
                          <input
                            type="number"
                            min={1}
                            max={12}
                            value={t.month}
                            onChange={(e) =>
                              updateTemplate(i, {
                                month: Math.max(
                                  1,
                                  Math.min(12, Number(e.target.value) || 1),
                                ),
                              })
                            }
                            className="w-12 text-xs px-1.5 py-1 rounded border border-line bg-canvas tabular-nums"
                            aria-label="Month"
                          />
                          /
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={t.day}
                            onChange={(e) =>
                              updateTemplate(i, {
                                day: Math.max(
                                  1,
                                  Math.min(31, Number(e.target.value) || 1),
                                ),
                              })
                            }
                            className="w-12 text-xs px-1.5 py-1 rounded border border-line bg-canvas tabular-nums"
                            aria-label="Day"
                          />
                        </>
                      ) : (
                        <>Due {String(t.month).padStart(2, "0")}/{String(t.day).padStart(2, "0")}</>
                      )}
                    </span>
                    {editable && (
                      <button
                        type="button"
                        onClick={() => removeTemplate(i)}
                        className="text-ink-500 hover:text-danger-ink p-1 rounded hover:bg-sunken"
                        aria-label="Remove filing"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <datalist id="ddhq-form-options">
              {FORM_OPTIONS.map((f) => (
                <option key={f.code} value={f.label} />
              ))}
            </datalist>
          </div>
        </DialogBody>

        <DialogFooter>
          {mode === "edit" && onDelete && !isSystemBundle && (
            <Button
              variant="outline"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete "${draft.name}"? Clients already using this package keep their current deadlines.`,
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
          {mode === "view" && isSystemBundle && (
            <Button onClick={handleClone}>
              <Copy className="w-3.5 h-3.5 mr-1" aria-hidden />
              Clone to firm-custom
            </Button>
          )}
          {editable && (
            <Button
              onClick={handleSave}
              disabled={
                !draft.name.trim() ||
                draft.entityTypes.length === 0 ||
                draft.templates.length === 0
              }
            >
              {mode === "create" ? "Create package" : "Save changes"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
