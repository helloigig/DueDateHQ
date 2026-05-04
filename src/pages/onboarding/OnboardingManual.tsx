import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingShell } from "../../components/OnboardingShell";
import { actions } from "../../data/store";
import type { EntityType, StateCode } from "../../types";

const ENTITIES: EntityType[] = [
  "Individual",
  "LLC",
  "S-Corp",
  "C-Corp",
  "Partnership",
  "Trust",
];

interface DraftClient {
  name: string;
  entityType: EntityType;
  primaryState: StateCode;
  contactEmail: string;
}

const EMPTY: DraftClient = {
  name: "",
  entityType: "Individual",
  primaryState: "CA",
  contactEmail: "",
};

export function OnboardingManual() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<DraftClient[]>([{ ...EMPTY }]);
  const [submitting, setSubmitting] = useState(false);

  const update = (i: number, patch: Partial<DraftClient>) => {
    setDrafts((prev) =>
      prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d))
    );
  };

  const add = () => setDrafts((prev) => [...prev, { ...EMPTY }]);
  const remove = (i: number) =>
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));

  const valid = drafts.filter(
    (d) => d.name.trim() && d.contactEmail.trim()
  );

  const submit = () => {
    setSubmitting(true);
    for (const d of valid) {
      actions.addClient({
        name: d.name.trim(),
        entityType: d.entityType,
        primaryState: d.primaryState,
        contactEmail: d.contactEmail.trim(),
      });
    }
    navigate("/onboarding/packages");
  };

  return (
    <OnboardingShell
      step={3}
      totalSteps={3}
      title="Add your first clients"
      subtitle="Five rows is plenty to start. Add more anytime from Clients."
    >
      <div className="space-y-3">
        {drafts.map((d, i) => (
          <div
            key={i}
            className="bg-surface border border-line rounded-md p-3 grid grid-cols-1 md:grid-cols-[1fr_140px_100px_1fr_auto] gap-2 items-end"
          >
            <Field label="Name">
              <input
                value={d.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Emily Hartfield"
                className="w-full border border-line rounded px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Entity">
              <select
                value={d.entityType}
                onChange={(e) =>
                  update(i, { entityType: e.target.value as EntityType })
                }
                className="w-full border border-line rounded px-2 py-1.5 text-sm bg-surface"
              >
                {ENTITIES.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="State">
              <select
                value={d.primaryState}
                onChange={(e) =>
                  update(i, { primaryState: e.target.value as StateCode })
                }
                className="w-full border border-line rounded px-2 py-1.5 text-sm bg-surface"
              >
                {(["CA", "NY", "TX", "FL", "LA"] as StateCode[]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Email">
              <input
                value={d.contactEmail}
                onChange={(e) => update(i, { contactEmail: e.target.value })}
                placeholder="emily@example.com"
                className="w-full border border-line rounded px-2 py-1.5 text-sm"
              />
            </Field>
            <button
              onClick={() => remove(i)}
              disabled={drafts.length === 1}
              className="text-xs text-ink-500 hover:text-ink-900 px-2 py-1.5 disabled:opacity-30"
            >
              Remove
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <button
            onClick={add}
            className="text-sm px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-sunken"
          >
            + Add another
          </button>
          <span className="ml-auto text-xs text-ink-500">
            {valid.length} ready
          </span>
          <button
            onClick={submit}
            disabled={valid.length === 0 || submitting}
            className="text-sm px-4 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Adding…" : `Add ${valid.length} & continue`}
          </button>
        </div>
      </div>
    </OnboardingShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-2xs uppercase tracking-wider text-ink-500 font-semibold block mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
