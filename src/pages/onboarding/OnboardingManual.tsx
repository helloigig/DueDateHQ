import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { OnboardingShell } from "../../components/OnboardingShell";
import {
  AuthField,
  AuthInput,
  PrimaryButton,
  SecondaryButton,
  authInputClass,
} from "../auth/AuthShell";
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
      subtitle="Five rows is plenty to get started. You can add more anytime from Clients."
      brandLine="Quick-add takes < 60 seconds per client. AI suggests a service package automatically."
      wide
    >
      <div className="space-y-3">
        {drafts.map((d, i) => (
          <div
            key={i}
            className="bg-canvas border border-line rounded-md p-4 grid grid-cols-1 md:grid-cols-[1.4fr_140px_110px_1.6fr_auto] gap-4 items-end"
          >
            <AuthField label="Name">
              <AuthInput
                value={d.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Emily Hartfield"
              />
            </AuthField>
            <AuthField label="Entity">
              <select
                value={d.entityType}
                onChange={(e) =>
                  update(i, { entityType: e.target.value as EntityType })
                }
                className={authInputClass}
              >
                {ENTITIES.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </AuthField>
            <AuthField label="State">
              <select
                value={d.primaryState}
                onChange={(e) =>
                  update(i, { primaryState: e.target.value as StateCode })
                }
                className={authInputClass}
              >
                {(
                  [
                    "CA",
                    "FL",
                    "GA",
                    "IL",
                    "LA",
                    "MA",
                    "NJ",
                    "NY",
                    "PA",
                    "TX",
                  ] as StateCode[]
                ).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </AuthField>
            <AuthField label="Email">
              <AuthInput
                type="email"
                value={d.contactEmail}
                onChange={(e) => update(i, { contactEmail: e.target.value })}
                placeholder="emily@example.com"
              />
            </AuthField>
            <button
              onClick={() => remove(i)}
              disabled={drafts.length === 1}
              className="text-xs text-ink-500 hover:text-danger-ink disabled:opacity-30 inline-flex items-center gap-1 px-2 py-2 self-end"
              aria-label={`Remove row ${i + 1}`}
            >
              <X className="w-3.5 h-3.5" aria-hidden />
              <span>Remove</span>
            </button>
          </div>
        ))}
        <div className="flex items-center gap-3 pt-2">
          <SecondaryButton onClick={add}>
            <Plus className="w-3.5 h-3.5" aria-hidden /> Add another
          </SecondaryButton>
          <span className="ml-auto text-xs text-ink-500">
            {valid.length} ready
          </span>
          <PrimaryButton
            onClick={submit}
            disabled={valid.length === 0}
            loading={submitting}
          >
            {submitting
              ? "Adding"
              : `Add ${valid.length} & continue`}
          </PrimaryButton>
        </div>
      </div>
    </OnboardingShell>
  );
}
