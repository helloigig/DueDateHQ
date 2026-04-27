import { useEffect, useState } from "react";
import type { Client, StateCode } from "../types";
import { actions } from "../data/store";
import { toIso, addDays, TODAY } from "../data/dateHelpers";
import { useModalDialog } from "../hooks/useModalDialog";

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

export interface AddDeadlinePrefill {
  form?: string;
  jurisdiction?: "federal" | StateCode;
  date?: string;
  sourceNote?: string;
}

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
    "federal"
  );
  const [date, setDate] = useState(toIso(addDays(TODAY, 30)));
  const [customForm, setCustomForm] = useState("");

  useEffect(() => {
    if (open && client) {
      const f = prefill?.form;
      if (f && COMMON_FORMS.includes(f)) {
        setForm(f);
        setCustomForm("");
      } else if (f) {
        setForm("__custom__");
        setCustomForm(f);
      } else {
        setForm(COMMON_FORMS[0]);
        setCustomForm("");
      }
      setJurisdiction(prefill?.jurisdiction ?? client.primaryState);
      setDate(prefill?.date ?? toIso(addDays(TODAY, 30)));
    }
  }, [open, client, prefill]);

  const dialogRef = useModalDialog(open, onClose);

  if (!open || !client) return null;

  const resolvedForm = form === "__custom__" ? customForm.trim() : form;
  const canSave = resolvedForm.length > 0 && date.length > 0;

  const onSave = () => {
    actions.addDeadline(client.id, resolvedForm, jurisdiction, date);
    onClose();
  };

  const jurisdictionOptions: Array<"federal" | StateCode> = [
    "federal",
    client.primaryState,
    ...client.nexusStates,
  ];

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
        className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md mx-4 outline-none"
      >
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">
            Add a deadline to {client.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {prefill?.sourceNote ??
              "Use for one-offs not covered by a filing bundle."}
          </p>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-xs font-medium text-slate-600 mb-1 block">
              Form / service
            </span>
            <select
              value={form}
              onChange={(e) => setForm(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded border border-slate-200 bg-white"
            >
              {COMMON_FORMS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
              <option value="__custom__">Other / custom…</option>
            </select>
          </label>

          {form === "__custom__" && (
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">
                Custom form name
              </span>
              <input
                value={customForm}
                onChange={(e) => setCustomForm(e.target.value)}
                placeholder="e.g. NYC UBT"
                className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                autoFocus
              />
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">
                Jurisdiction
              </span>
              <select
                value={jurisdiction}
                onChange={(e) =>
                  setJurisdiction(e.target.value as typeof jurisdiction)
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-200 bg-white"
              >
                {jurisdictionOptions.map((j) => (
                  <option key={j} value={j}>
                    {j === "federal" ? "Federal" : j}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">
                Official due date
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </label>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50 rounded-b-lg flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!canSave}
            className="text-sm px-3 py-1.5 rounded font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
          >
            Add deadline
          </button>
        </div>
      </div>
    </div>
  );
}
