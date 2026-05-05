import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Client, StateCode } from "../types";
import { actions } from "../data/store";
import { toIso, addDays, TODAY } from "../data/dateHelpers";
import { useModalDialog } from "../hooks/useModalDialog";
import { useQuickAddDeadline } from "../hooks/useDeadlines";
import { env } from "../config";
import { FEDERAL_FORMS } from "../data/federalForms";

// Curated short list of the most common selections for quick picking.
// Pinned at the top of the dropdown so the day-to-day case is one click.
const COMMON_FORMS = [
  "1040 (federal)",
  "1040 (extension)",
  "1065 (federal)",
  "1065 (extension)",
  "1120 (federal)",
  "1120 (extension)",
  "1120-S (federal)",
  "1120-S (extension)",
  "1041 (trust)",
  "Q1 estimate (federal)",
  "Q2 estimate (federal)",
  "Q3 estimate (federal)",
  "Q4 estimate (federal)",
  "Sales tax Q",
  "PTE election",
];
import { trpc } from "../lib/api/client";

// Long list — every federal form from the catalog. Rendered as a separate
// optgroup so the CPA can pick a niche form (Form 5471 for foreign corp,
// Form 990-EZ for nonprofit, etc.) without falling back to free-text.
// Each catalog entry surfaces its form code + name so the CPA sees what
// they're picking.
const CATALOG_FORM_OPTIONS = FEDERAL_FORMS.map((f) => ({
  value: `${f.code} (federal)`,
  label: `Form ${f.code} — ${f.name.length > 60 ? f.name.slice(0, 57) + "…" : f.name}`,
}));

export interface AddDeadlinePrefill {
  form?: string;
  jurisdiction?: "federal" | StateCode;
  date?: string;
  sourceNote?: string;
}

/**
 * Federal-form picker option as rendered in the dropdown. The `value` is
 * what we send to actions.addDeadline; `label` is what the user sees.
 *
 * Two synthetic options sit alongside the real catalog rows:
 *   - "__custom__"  — free-text fallback for niche forms / state-only
 *                     deadlines like "PTE election"
 *   - "__llm__"     — placeholder when the user types a form_number we
 *                     don't recognize and we need the BE to extract it
 */
type FormOption = {
  value: string;
  label: string;
  groupLabel: string;
  /** Matches federal_forms.confidence_score; rendered as a small chip
   *  when the row was LLM-extracted so the user knows it's machine
   *  metadata, not curated. */
  confidence?: number;
  needsReview?: boolean;
};

const SYNTHETIC_OPTIONS = {
  custom: "__custom__",
  extractWithLlm: "__llm__",
} as const;

/**
 * Static fallbacks the modal still allows. These aren't federal_forms
 * rows by design — they're state-level shortcuts and per-task one-offs
 * the catalog will never list. Kept as a small group at the bottom of
 * the dropdown.
 */
const STATIC_FALLBACK_FORMS: FormOption[] = [
  {
    value: "Q1 estimate (federal)",
    label: "Q1 estimate (federal)",
    groupLabel: "Quick add",
  },
  {
    value: "Q2 estimate (federal)",
    label: "Q2 estimate (federal)",
    groupLabel: "Quick add",
  },
  {
    value: "Q3 estimate (federal)",
    label: "Q3 estimate (federal)",
    groupLabel: "Quick add",
  },
  {
    value: "Q4 estimate (federal)",
    label: "Q4 estimate (federal)",
    groupLabel: "Quick add",
  },
  { value: "Sales tax Q", label: "Sales tax Q", groupLabel: "Quick add" },
  { value: "PTE election", label: "PTE election", groupLabel: "Quick add" },
];

const CATEGORY_LABELS: Record<string, string> = {
  income: "Income tax",
  estimated: "Estimated tax",
  payroll: "Payroll / employment",
  info_return: "Information returns",
  extension: "Extensions",
  amendment: "Amendments",
  nonprofit: "Nonprofit",
  estate_gift: "Estate / gift",
  excise: "Excise",
  international: "International",
  other: "Other",
};

export function AddDeadlineModal({
  open,
  client,
  onClose,
  prefill,
}: {
  open: boolean;
  client: Client | null;
  onClose: () => void;
  prefill?: AddDeadlinePrefill;
}) {
  const [form, setForm] = useState("");
  const [jurisdiction, setJurisdiction] = useState<"federal" | StateCode>(
    "federal",
  );
  const [date, setDate] = useState(toIso(addDays(TODAY, 30)));
  const [customForm, setCustomForm] = useState("");
  const quickAddMut = useQuickAddDeadline();

  // Pull the federal forms catalog from the BE. When `entityType` is
  // known we filter server-side to the entity's applicable forms; CPAs
  // can always type a custom string for the cross-entity edge cases.
  const formsQuery = trpc.federalForms.list.useQuery(
    client?.entityType
      ? { entityType: client.entityType }
      : undefined,
    { enabled: open },
  );

  // Fold the BE catalog + static fallbacks into a single FormOption[]
  // that the dropdown can render with grouping. We sort by category
  // first (matching the BE's default ordering) then by form number.
  const formOptions = useMemo<FormOption[]>(() => {
    const catalog = formsQuery.data ?? [];
    const fromCatalog: FormOption[] = catalog.map((f) => ({
      value: f.formNumber,
      label: `Form ${f.formNumber} — ${f.formName}`,
      groupLabel: CATEGORY_LABELS[f.category] ?? "Other",
      confidence: f.confidenceScore,
      needsReview: f.status === "pending_review",
    }));
    return [...fromCatalog, ...STATIC_FALLBACK_FORMS];
  }, [formsQuery.data]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, FormOption[]>();
    for (const opt of formOptions) {
      const arr = byGroup.get(opt.groupLabel) ?? [];
      arr.push(opt);
      byGroup.set(opt.groupLabel, arr);
    }
    return Array.from(byGroup.entries());
  }, [formOptions]);

  useEffect(() => {
    if (!open || !client) return;
    const f = prefill?.form;
    const knownValues = new Set(formOptions.map((o) => o.value));
    if (f && knownValues.has(f)) {
      setForm(f);
      setCustomForm("");
    } else if (f) {
      setForm(SYNTHETIC_OPTIONS.custom);
      setCustomForm(f);
    } else {
      // Default to the first option from the catalog when available;
      // fall back to a static option so the dropdown is never empty.
      setForm(formOptions[0]?.value ?? STATIC_FALLBACK_FORMS[0].value);
      setCustomForm("");
    }
    setJurisdiction(prefill?.jurisdiction ?? client.primaryState);
    setDate(prefill?.date ?? toIso(addDays(TODAY, 30)));
  }, [open, client, prefill, formOptions]);

  const dialogRef = useModalDialog(open, onClose);

  if (!open || !client) return null;

  const resolvedForm =
    form === SYNTHETIC_OPTIONS.custom ? customForm.trim() : form;
  const canSave = resolvedForm.length > 0 && date.length > 0;

  const isSaving = quickAddMut.isPending;
  const onSave = async () => {
    if (env.useMockData) {
      actions.addDeadline(client.id, resolvedForm, jurisdiction, date);
      toast.success(`${resolvedForm} added · due ${date}`);
      onClose();
      return;
    }
    // Real mode — await mutateAsync so we can surface success/error
    // toasts and keep the modal open if the BE rejects (so the user
    // doesn't lose their entry to a silent failure). Yuqi audit
    // 2026-05-05: was previously fire-and-forget + close immediately,
    // which meant a 4xx from the BE looked exactly like success.
    try {
      await quickAddMut.mutateAsync({
        clientId: client.id,
        form: resolvedForm,
        jurisdiction,
        officialDueDate: date,
      });
      toast.success(`${resolvedForm} added · due ${date}`);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't save the deadline.";
      toast.error(`Add deadline failed — ${message}`);
    }
  };

  const jurisdictionOptions: Array<"federal" | StateCode> = [
    "federal",
    client.primaryState,
    ...client.nexusStates,
  ];

  // Selected option metadata — used to render the LLM/curated chip when
  // a user picks a form whose row was extracted by the LLM.
  const selectedOpt = formOptions.find((o) => o.value === form);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-lg shadow-xl border border-line w-full max-w-md mx-4 outline-none"
      >
        <div className="px-5 py-3 border-b border-line">
          <h2 className="text-sm font-semibold text-ink-900">
            Add a deadline to {client.name}
          </h2>
          <p className="text-xs text-ink-500 mt-0.5">
            {prefill?.sourceNote ??
              "Use for one-offs not covered by a service package."}
          </p>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-xs font-medium text-ink-700 mb-1 block">
              Form / service
              {formsQuery.isLoading && (
                <span className="ml-2 text-2xs text-ink-400 font-normal">
                  loading catalog…
                </span>
              )}
            </span>
            <select
              value={form}
              onChange={(e) => setForm(e.target.value)}
              disabled={formsQuery.isLoading}
              className="w-full px-2.5 py-1.5 rounded border border-line bg-surface disabled:opacity-50"
            >
              <optgroup label="Most common">
                {COMMON_FORMS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </optgroup>
              <optgroup label="All federal forms">
                {CATALOG_FORM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
              <option value="__custom__">Other / custom…</option>
              {groups.map(([groupLabel, items]) => (
                <optgroup key={groupLabel} label={groupLabel}>
                  {items.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                      {opt.needsReview ? " · needs review" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value={SYNTHETIC_OPTIONS.custom}>
                Other / custom…
              </option>
            </select>
            {selectedOpt &&
              selectedOpt.confidence !== undefined &&
              selectedOpt.confidence < 1.0 && (
                <p className="mt-1 text-2xs text-warn-ink">
                  AI-extracted entry · {(selectedOpt.confidence * 100).toFixed(0)}%
                  confidence
                  {selectedOpt.needsReview && " · pending admin review"}
                </p>
              )}
          </label>

          {form === SYNTHETIC_OPTIONS.custom && (
            <label className="block">
              <span className="text-xs font-medium text-ink-700 mb-1 block">
                Custom form name
              </span>
              <input
                value={customForm}
                onChange={(e) => setCustomForm(e.target.value)}
                placeholder="e.g. NYC UBT, 5471, 8606…"
                className="w-full px-2.5 py-1.5 rounded border border-line focus:outline-none focus:ring-2 focus:ring-indigo"
                autoFocus
              />
              <p className="mt-1 text-2xs text-ink-500">
                Federal form numbers we don't have curated will be auto-extracted by AI on save.
              </p>
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-ink-700 mb-1 block">
                Jurisdiction
              </span>
              <select
                value={jurisdiction}
                onChange={(e) =>
                  setJurisdiction(e.target.value as typeof jurisdiction)
                }
                className="w-full px-2.5 py-1.5 rounded border border-line bg-surface"
              >
                {jurisdictionOptions.map((j) => (
                  <option key={j} value={j}>
                    {j === "federal" ? "Federal" : j}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-700 mb-1 block">
                Official due date
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-line focus:outline-none focus:ring-2 focus:ring-indigo"
              />
            </label>
          </div>
        </div>

        <div className="px-5 py-3 bg-canvas rounded-b-lg flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded border border-line bg-surface hover:bg-canvas"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!canSave || isSaving}
            className="text-sm px-3 py-1.5 rounded font-medium text-white bg-indigo hover:bg-indigo-hover disabled:opacity-40"
          >
            {isSaving ? "Saving…" : "Add deadline"}
          </button>
        </div>
      </div>
    </div>
  );
}
