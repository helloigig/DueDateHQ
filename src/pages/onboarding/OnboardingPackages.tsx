import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Check } from "lucide-react";
import { OnboardingShell } from "../../components/OnboardingShell";
import { PrimaryButton, SecondaryButton, authInputClass } from "../auth/AuthShell";
import { useStore } from "../../data/store";
import { BUNDLES } from "../../data/bundles";
import { suggestBundleForEntity } from "../../data/bundles";
import type { Client } from "../../types";

/**
 * Step 2.5 — confirm AI-suggested service packages per client. PRD §3.17
 * step 4. Auto-suggests via Mode A substrate (entity + state); user confirms
 * or picks differently.
 */
export function OnboardingPackages() {
  const navigate = useNavigate();
  const { clients } = useStore();
  const activeClients = clients.filter((c) => c.status === "active");

  const initial = useMemo(() => {
    const out: Record<string, string> = {};
    for (const c of activeClients) {
      out[c.id] =
        c.servicePackages[0] ?? suggestBundleForEntity(c.entityType).name;
    }
    return out;
  }, [activeClients]);

  const [assignments, setAssignments] = useState<Record<string, string>>(initial);
  const [confirmedFor, setConfirmedFor] = useState<Set<string>>(new Set());

  const update = (clientId: string, packageName: string) => {
    setAssignments((p) => ({ ...p, [clientId]: packageName }));
    setConfirmedFor((s) => new Set(s).add(clientId));
  };

  const confirm = (clientId: string) => {
    setConfirmedFor((s) => new Set(s).add(clientId));
  };

  const acceptAll = () => {
    setConfirmedFor(new Set(activeClients.map((c) => c.id)));
  };

  const next = () => {
    navigate("/onboarding/done");
  };

  const allConfirmed =
    activeClients.length > 0 && confirmedFor.size === activeClients.length;

  const groups = useMemo(() => {
    const byEntity = new Map<string, Client[]>();
    for (const c of activeClients) {
      if (!byEntity.has(c.entityType)) byEntity.set(c.entityType, []);
      byEntity.get(c.entityType)!.push(c);
    }
    return Array.from(byEntity.entries());
  }, [activeClients]);

  return (
    <OnboardingShell
      step={3}
      totalSteps={3}
      estimate="~1 minute"
      title="Confirm service packages"
      subtitle="AI suggested a package for each client based on entity type and state. Glance, click 'Accept all' if they look right, or change individually."
      brandLine="Mode A substrate-driven. Entity + State + Industry + Cohort make this useful Day 1 — no 'AI is learning' here."
      wide
    >
      {activeClients.length === 0 ? (
        <div className="bg-canvas border border-line rounded-md p-8 text-center">
          <p className="text-sm text-ink-500">
            No clients yet — we'll suggest packages once you add some.
          </p>
          <button
            onClick={() => navigate("/onboarding/done")}
            className="mt-3 text-sm text-indigo hover:underline font-medium"
          >
            Skip to dashboard →
          </button>
        </div>
      ) : (
        <>
          <div className="bg-canvas border border-line rounded-md overflow-hidden">
            <header className="flex items-center px-5 py-3 border-b border-line bg-surface">
              <Sparkles className="w-3.5 h-3.5 text-indigo mr-2" aria-hidden />
              <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-ink-700">
                {activeClients.length} clients · {confirmedFor.size} confirmed
              </span>
              <SecondaryButton
                onClick={acceptAll}
                className="ml-auto !py-1 !px-3 text-xs"
              >
                Accept all suggestions
              </SecondaryButton>
            </header>
            <div className="max-h-[420px] overflow-y-auto">
              {groups.map(([entity, list]) => (
                <div key={entity} className="border-b border-line last:border-b-0">
                  <div className="px-5 py-2 bg-surface text-2xs uppercase tracking-[0.18em] text-ink-500 font-semibold flex items-center gap-2">
                    <span>{entity}</span>
                    <span className="text-ink-400">{list.length}</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {list.slice(0, 8).map((c) => (
                      <ClientRow
                        key={c.id}
                        client={c}
                        assignment={assignments[c.id]}
                        confirmed={confirmedFor.has(c.id)}
                        onChange={(pkg) => update(c.id, pkg)}
                        onConfirm={() => confirm(c.id)}
                      />
                    ))}
                    {list.length > 8 && (
                      <li className="px-5 py-2 text-2xs text-ink-500 bg-surface/50">
                        + {list.length - 8} more {entity} clients (auto-applied)
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4 flex-wrap">
            <PrimaryButton onClick={next}>
              {allConfirmed ? "Continue" : "Apply suggestions and continue"}
            </PrimaryButton>
            <p className="text-xs text-ink-500 flex-1">
              You can clone or customize any package later in Settings →
              Service Packages.
            </p>
          </div>
        </>
      )}
    </OnboardingShell>
  );
}

function ClientRow({
  client,
  assignment,
  confirmed,
  onChange,
  onConfirm,
}: {
  client: Client;
  assignment: string;
  confirmed: boolean;
  onChange: (pkg: string) => void;
  onConfirm: () => void;
}) {
  return (
    <li className="px-5 py-3 flex items-center gap-3 bg-canvas">
      <span className="w-5 h-5 shrink-0">
        {confirmed ? (
          <span className="w-5 h-5 rounded-full bg-ok-bg border border-ok-border text-ok-ink flex items-center justify-center">
            <Check className="w-3 h-3" aria-hidden />
          </span>
        ) : (
          <span className="w-5 h-5 rounded-full border border-warn-border bg-warn-bg" />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink-900 truncate">{client.name}</p>
        <p className="text-2xs text-ink-500">
          {client.entityType} · {client.primaryState}
        </p>
      </div>
      <select
        value={assignment}
        onChange={(e) => onChange(e.target.value)}
        className={[authInputClass, "max-w-[220px] !py-1.5"].join(" ")}
      >
        {BUNDLES.map((b) => (
          <option key={b.id} value={b.name}>
            {b.name}
          </option>
        ))}
      </select>
      {!confirmed && (
        <button
          onClick={onConfirm}
          className="text-2xs uppercase tracking-wide font-semibold px-2.5 py-1 rounded-pill border border-ok-border bg-ok-bg text-ok-ink hover:bg-ok-bg/70 transition-colors"
        >
          Confirm
        </button>
      )}
    </li>
  );
}
