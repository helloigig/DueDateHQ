import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { actions } from "../data/store";
import type { EntityType, StateCode } from "../types";
import { STATE_NAMES } from "../types";
import { useModalDialog } from "../hooks/useModalDialog";
import { trpc } from "../lib/api/client";
import { env } from "../config";

const ENTITY_OPTIONS: EntityType[] = [
  "Individual",
  "LLC",
  "S-Corp",
  "C-Corp",
  "Partnership",
  "Trust",
];
const STATE_OPTIONS: StateCode[] = ["CA", "NY", "TX", "LA", "FL"];

// Mock-mode local fallback. Real mode pulls from BE via servicePackages.suggestForClient.
function localSuggestBundle(entity: EntityType, state: StateCode): string {
  if (entity === "S-Corp") return `S-Corp Standard (${state})`;
  if (entity === "C-Corp") return `C-Corp Standard (${state})`;
  if (entity === "Partnership") return `Partnership Standard (${state})`;
  if (entity === "LLC") return `LLC Pass-Through (${state})`;
  if (entity === "Trust") return `Trust Annual`;
  return `Individual + ${state}`;
}

const EMAIL_RE =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
}

type Step = "form" | "review";

export function AddClientModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  // Form state
  const [name, setName] = useState("");
  const [entity, setEntity] = useState<EntityType>("Individual");
  const [state, setState] = useState<StateCode>("CA");
  const [nexus, setNexus] = useState<StateCode[]>([]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [step, setStep] = useState<Step>("form");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dialogRef = useModalDialog(open, onClose);

  // Real-mode package suggestion. Re-runs when entity/state changes.
  const suggestQuery = trpc.servicePackages.suggestForClient.useQuery(
    { entityType: entity, primaryState: state },
    { enabled: !env.useMockApi && open, staleTime: 60_000 },
  );

  const suggestedPackageName = useMemo(() => {
    if (env.useMockApi) return localSuggestBundle(entity, state);
    return suggestQuery.data?.name ?? null;
  }, [entity, state, suggestQuery.data?.name]);

  const suggestedPackageId = env.useMockApi ? null : suggestQuery.data?.id ?? null;

  const createMut = trpc.clients.create.useMutation();
  const assignMut = trpc.servicePackages.assignToClient.useMutation();

  // Reset everything when the modal closes.
  useEffect(() => {
    if (!open) {
      setName("");
      setEntity("Individual");
      setState("CA");
      setNexus([]);
      setEmail("");
      setPhone("");
      setErrors({});
      setStep("form");
      setSubmitError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  // ─── Validation ──────────────────────────────────────────────────────
  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!name.trim()) next.name = "Required.";
    if (name.trim().length > 200) next.name = "Keep it under 200 chars.";
    if (!email.trim()) {
      next.email = "Required — used for reminders + audit-trail exports.";
    } else if (!EMAIL_RE.test(email.trim())) {
      next.email = "Doesn't look like a valid email address.";
    }
    if (phone.trim() && phone.trim().length > 40) {
      next.phone = "Too long.";
    }
    return next;
  }

  function onContinue() {
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;
    setSubmitError(null);
    setStep("review");
  }

  async function onConfirm() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      if (env.useMockApi) {
        const id = actions.addClient({
          name: name.trim(),
          entityType: entity,
          primaryState: state,
          nexusStates: nexus,
          contactEmail: email.trim(),
          contactPhone: phone.trim() || undefined,
          servicePackage: suggestedPackageName ?? "Individual + Federal",
        });
        onClose();
        navigate(`/clients/${id}`);
        return;
      }
      // Real mode: create client → assign suggested package → navigate.
      const created = await createMut.mutateAsync({
        name: name.trim(),
        entityType: entity,
        primaryState: state,
        nexusStates: nexus,
        contactEmail: email.trim(),
        contactPhone: phone.trim() || null,
        tier: "standard",
      });
      if (suggestedPackageId) {
        await assignMut.mutateAsync({
          clientId: created.id,
          packageId: suggestedPackageId,
          year: new Date().getFullYear(),
        });
      }
      // Refresh caches so list/detail show the new client + spawned deadlines.
      void utils.clients.list.invalidate();
      void utils.deadlines.listForTriage.invalidate();
      void utils.deadlines.listForClient.invalidate();
      void utils.tasks.list.invalidate();
      onClose();
      navigate(`/clients/${created.id}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Couldn't save the client.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────
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
          <h2 className="text-base font-semibold text-slate-900">
            {step === "form" ? "New client" : "Review and confirm"}
          </h2>
          <span className="ml-3 text-xs text-slate-400">
            {step === "form"
              ? "Step 1 of 2 · ~2 min"
              : "Step 2 of 2 · last chance to edit"}
          </span>
          <button
            onClick={onClose}
            className="ml-auto text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {step === "form" && (
          <FormStep
            name={name}
            setName={setName}
            entity={entity}
            setEntity={setEntity}
            state={state}
            setState={setState}
            nexus={nexus}
            setNexus={setNexus}
            email={email}
            setEmail={setEmail}
            phone={phone}
            setPhone={setPhone}
            errors={errors}
            suggestedPackageName={suggestedPackageName}
            suggestionLoading={!env.useMockApi && suggestQuery.isLoading}
          />
        )}

        {step === "review" && (
          <ReviewStep
            name={name}
            entity={entity}
            state={state}
            nexus={nexus}
            email={email}
            phone={phone}
            suggestedPackageName={suggestedPackageName}
            hasPackage={!!suggestedPackageId || env.useMockApi}
          />
        )}

        {submitError && (
          <div className="px-5 pb-3">
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {submitError}
            </div>
          </div>
        )}

        <div className="px-5 py-3 bg-slate-50 rounded-b-lg flex items-center justify-end gap-2">
          {step === "form" ? (
            <>
              <button
                onClick={onClose}
                className="text-sm px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={onContinue}
                className="text-sm px-3 py-1.5 rounded font-medium text-white bg-slate-900 hover:bg-slate-800"
              >
                Continue → review
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep("form")}
                disabled={submitting}
                className="text-sm px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                ← Back to edit
              </button>
              <button
                onClick={() => void onConfirm()}
                disabled={submitting}
                className="text-sm px-3 py-1.5 rounded font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
              >
                {submitting ? "Saving…" : "Confirm and create"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: form ─────────────────────────────────────────────────────
function FormStep(props: {
  name: string;
  setName: (s: string) => void;
  entity: EntityType;
  setEntity: (e: EntityType) => void;
  state: StateCode;
  setState: (s: StateCode) => void;
  nexus: StateCode[];
  setNexus: (fn: (cur: StateCode[]) => StateCode[]) => void;
  email: string;
  setEmail: (s: string) => void;
  phone: string;
  setPhone: (s: string) => void;
  errors: FormErrors;
  suggestedPackageName: string | null;
  suggestionLoading: boolean;
}) {
  const {
    name,
    setName,
    entity,
    setEntity,
    state,
    setState,
    nexus,
    setNexus,
    email,
    setEmail,
    phone,
    setPhone,
    errors,
    suggestedPackageName,
    suggestionLoading,
  } = props;

  return (
    <div className="px-5 py-4 space-y-3 text-sm">
      <Field label="Client name" required error={errors.name}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme LLC"
          className={`w-full px-2.5 py-1.5 rounded border focus:outline-none focus:ring-2 ${
            errors.name
              ? "border-red-300 focus:ring-red-500"
              : "border-slate-200 focus:ring-slate-900"
          }`}
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
                    cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
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

      <Field label="Contact email" required error={errors.email}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="client@example.com"
          className={`w-full px-2.5 py-1.5 rounded border focus:outline-none focus:ring-2 ${
            errors.email
              ? "border-red-300 focus:ring-red-500"
              : "border-slate-200 focus:ring-slate-900"
          }`}
        />
      </Field>

      <Field label="Phone (optional)" error={errors.phone}>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 555-0100"
          className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </Field>

      <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-3 py-2">
        Suggested filing bundle:{" "}
        {suggestionLoading ? (
          <span className="text-slate-400">finding the right one…</span>
        ) : suggestedPackageName ? (
          <span className="font-medium text-slate-900">
            {suggestedPackageName}
          </span>
        ) : (
          <span className="text-slate-500">
            no exact match — you can pick one on the next screen
          </span>
        )}
        <div className="text-slate-500 mt-0.5">
          We&apos;ll create deadlines from this bundle after you confirm. You
          can change it anytime on the client page.
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: review ──────────────────────────────────────────────────
function ReviewStep(props: {
  name: string;
  entity: EntityType;
  state: StateCode;
  nexus: StateCode[];
  email: string;
  phone: string;
  suggestedPackageName: string | null;
  hasPackage: boolean;
}) {
  const { name, entity, state, nexus, email, phone, suggestedPackageName, hasPackage } =
    props;
  return (
    <div className="px-5 py-4 space-y-4 text-sm">
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
          About to create
        </p>
        <dl className="space-y-1.5 text-sm">
          <Row label="Client" value={name} />
          <Row label="Entity" value={entity} />
          <Row
            label="Primary state"
            value={`${state} — ${STATE_NAMES[state]}`}
          />
          {nexus.length > 0 && (
            <Row label="Nexus states" value={nexus.join(", ")} />
          )}
          <Row label="Contact email" value={email} />
          {phone && <Row label="Phone" value={phone} />}
        </dl>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
          What happens on confirm
        </p>
        <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-5">
          <li>The client record is created in your firm.</li>
          {hasPackage && suggestedPackageName ? (
            <li>
              Filing bundle{" "}
              <span className="font-medium text-slate-900">
                {suggestedPackageName}
              </span>{" "}
              is assigned, which generates this year&apos;s deadlines + Mode A
              baseline checklists automatically.
            </li>
          ) : (
            <li>
              No filing bundle is assigned yet — you&apos;ll pick one from the
              client&apos;s page once it loads.
            </li>
          )}
          <li>
            Per-task forwarding emails are minted (clients can reply with
            documents directly to the right place).
          </li>
        </ul>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="text-slate-500 w-32 shrink-0">{label}</dt>
      <dd className="text-slate-900 font-medium">{value}</dd>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 mb-1 block">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {error && (
        <span className="text-2xs text-red-600 mt-1 block">{error}</span>
      )}
    </label>
  );
}
