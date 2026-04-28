import { useEffect, useState } from "react";
import type { Client, EntityType, StateCode } from "../types";
import { STATE_CODES, STATE_NAMES } from "../types";
import { useModalDialog } from "../hooks/useModalDialog";
import { MigrationPreviewModal } from "./MigrationPreviewModal";
import { useUpdateClient } from "../hooks/useClients";

const ENTITY_OPTIONS: EntityType[] = [
  "Individual",
  "LLC",
  "S-Corp",
  "C-Corp",
  "Partnership",
  "Trust",
];
const STATE_OPTIONS: readonly StateCode[] = STATE_CODES;

export function EditClientModal({
  open,
  client,
  onClose,
}: {
  open: boolean;
  client: Client | null;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [entity, setEntity] = useState<EntityType>("Individual");
  const [state, setState] = useState<StateCode>("CA");
  const [nexus, setNexus] = useState<StateCode[]>([]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [migrationOpen, setMigrationOpen] = useState(false);
  const updateClient = useUpdateClient();

  useEffect(() => {
    if (open && client) {
      setName(client.name);
      setEntity(client.entityType);
      setState(client.primaryState);
      setNexus([...client.nexusStates]);
      setEmail(client.contactEmail);
      setPhone(client.contactPhone ?? "");
    }
  }, [open, client]);

  const dialogRef = useModalDialog(open, onClose);

  if (!open || !client) return null;

  const canSave = name.trim().length > 0 && email.trim().length > 0;

  const stateOrEntityChanged =
    entity !== client.entityType ||
    state !== client.primaryState ||
    JSON.stringify(nexus.sort()) !==
      JSON.stringify([...client.nexusStates].sort());

  const commitSave = () => {
    updateClient.mutate(
      {
        id: client.id,
        patch: {
          name: name.trim(),
          entityType: entity,
          primaryState: state,
          nexusStates: nexus,
          contactEmail: email.trim(),
          contactPhone: phone.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setMigrationOpen(false);
          onClose();
        },
      }
    );
  };

  const onSave = () => {
    if (stateOrEntityChanged) {
      setMigrationOpen(true);
    } else {
      commitSave();
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
          <h2 className="text-sm font-semibold text-slate-900">Edit client</h2>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-xs font-medium text-slate-600 mb-1 block">
              Client name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">
                Entity type
              </span>
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
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">
                Primary state
              </span>
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
            </label>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-600 mb-1 block">
              Nexus states
            </span>
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
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-600 mb-1 block">
              Contact email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600 mb-1 block">
              Phone (optional)
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </label>

          {stateOrEntityChanged && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              You've changed entity, state, or nexus. You'll see a preview of
              added/removed deadlines before anything is applied.
            </div>
          )}
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
            {stateOrEntityChanged ? "Review changes" : "Save changes"}
          </button>
        </div>
      </div>
      <MigrationPreviewModal
        open={migrationOpen}
        client={client}
        patch={
          stateOrEntityChanged
            ? {
                entityType: entity,
                primaryState: state,
                nexusStates: nexus,
              }
            : null
        }
        onCancel={() => setMigrationOpen(false)}
        onConfirm={commitSave}
      />
    </div>
  );
}
