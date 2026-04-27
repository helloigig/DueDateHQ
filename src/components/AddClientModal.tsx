import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { actions } from "../data/store";
import type { EntityType, StateCode } from "../types";
import { STATE_NAMES } from "../types";
import { useModalDialog } from "../hooks/useModalDialog";

const ENTITY_OPTIONS: EntityType[] = [
  "Individual",
  "LLC",
  "S-Corp",
  "C-Corp",
  "Partnership",
  "Trust",
];
const STATE_OPTIONS: StateCode[] = ["CA", "NY", "TX", "LA", "FL"];

function suggestBundle(entity: EntityType, state: StateCode): string {
  if (entity === "S-Corp") return `S-Corp Standard (${state})`;
  if (entity === "C-Corp") return `C-Corp Standard (${state})`;
  if (entity === "Partnership") return `Partnership Standard (${state})`;
  if (entity === "LLC") return `Multi-state LLC`;
  if (entity === "Trust") return `Trust Annual`;
  return `Individual + PTE`;
}

export function AddClientModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [entity, setEntity] = useState<EntityType>("Individual");
  const [state, setState] = useState<StateCode>("CA");
  const [nexus, setNexus] = useState<StateCode[]>([]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const dialogRef = useModalDialog(open, onClose);

  if (!open) return null;

  const bundle = suggestBundle(entity, state);

  const canSave = name.trim().length > 0 && email.trim().length > 0;

  const onSave = () => {
    const id = actions.addClient({
      name: name.trim(),
      entityType: entity,
      primaryState: state,
      nexusStates: nexus,
      contactEmail: email.trim(),
      contactPhone: phone.trim() || undefined,
      servicePackage: bundle,
    });
    reset();
    onClose();
    navigate(`/clients/${id}`);
  };

  const reset = () => {
    setName("");
    setEntity("Individual");
    setState("CA");
    setNexus([]);
    setEmail("");
    setPhone("");
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
        <div className="px-5 py-4 border-b border-slate-100 flex items-center">
          <h2 className="text-base font-semibold text-slate-900">New client</h2>
          <span className="ml-3 text-xs text-slate-400">
            ~2 min · deadlines auto-generate from the filing bundle
          </span>
          <button
            onClick={onClose}
            className="ml-auto text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm">
          <Field label="Client name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme LLC"
              className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
              data-autofocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Entity type" required>
              <select
                value={entity}
                onChange={(e) => setEntity(e.target.value as EntityType)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-200 bg-white"
              >
                {ENTITY_OPTIONS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Primary state" required>
              <select
                value={state}
                onChange={(e) => setState(e.target.value as StateCode)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-200 bg-white"
              >
                {STATE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATE_NAMES[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Nexus states (optional)">
            <div className="flex flex-wrap gap-1.5">
              {STATE_OPTIONS.filter((s) => s !== state).map((s) => {
                const on = nexus.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setNexus((cur) =>
                        cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]
                      )
                    }
                    className={`text-xs px-2 py-1 rounded border ${
                      on
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Contact email" required>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="client@example.com"
              className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </Field>

          <Field label="Phone (optional)">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-0100"
              className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </Field>

          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-3 py-2">
            Suggested filing bundle:{" "}
            <span className="font-medium text-slate-900">{bundle}</span>
            <div className="text-slate-500 mt-0.5">
              You can change this on the client page after creation.
            </div>
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
            Save client
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 mb-1 block">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
