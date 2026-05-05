import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Check } from "lucide-react";
import { OnboardingShell } from "../../components/OnboardingShell";
import { useStore } from "../../data/store";
import { BUNDLES } from "../../data/bundles";
import { suggestBundleForEntity } from "../../data/bundles";
import type { Client } from "../../types";

/**
 * Step 2.5 — confirm AI-suggested service packages per client. PRD §3.17
 * step 4. Auto-suggests via inbound-classifier substrate (entity + state); user confirms
 * or picks differently. Bulk action: "Apply S-Corp Standard to all S-Corps."
 *
 * Inserted between roster import and Done so the user sees their substrate-
 * driven AI working before landing on the dashboard.
 */
export function OnboardingPackages() {
  const navigate = useNavigate();
  const { clients } = useStore();
  const activeClients = clients.filter((c) => c.status === "active");

  // Build per-client AI suggestion. Pre-seeds confirmedFor so the user can
  // accept-all in one click.
  const initial = useMemo(() => {
    const out: Record<string, string> = {};
    for (const c of activeClients) {
      // If they already have an assigned package (e.g., via assignBundle from
      // the Add Client modal), respect that. Otherwise propose via substrate.
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
    // Wireframe: assignments are already on the client (seed) or were set by
    // suggestBundleForEntity — no-op here. Production would dispatch via
    // actions.assignBundle for any newly-confirmed mappings.
    navigate("/onboarding/done");
  };

  const allConfirmed =
    activeClients.length > 0 && confirmedFor.size === activeClients.length;

  // Group by entity for the bulk-apply hint
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
      title="Confirm service packages"
      subtitle="AI suggested a package for each client based on entity type and state. Glance, click 'Accept all' if they look right, or change individually."
    >
      {activeClients.length === 0 ? (
        <div className="bg-surface border border-line rounded-md p-6 text-center text-sm text-ink-500">
          No clients yet — we'll suggest packages once you add some.
          <button
            onClick={() => navigate("/onboarding/done")}
            className="ml-2 text-ink-900 underline"
          >
            Skip
          </button>
        </div>
      ) : (
        <>
          <div className="bg-surface border border-line rounded-md overflow-hidden">
            <header className="flex items-center px-4 py-3 border-b border-line bg-sunken/40">
              <Sparkles className="w-3.5 h-3.5 text-ink-500 mr-1.5" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-700">
                {activeClients.length} clients · {confirmedFor.size} confirmed
              </span>
              <button
                onClick={acceptAll}
                className="ml-auto text-xs px-3 py-1 rounded bg-indigo text-white hover:bg-indigo-hover"
              >
                Accept all suggestions
              </button>
            </header>
            <div className="max-h-[400px] overflow-y-auto">
              {groups.map(([entity, list]) => (
                <div key={entity} className="border-b border-line last:border-b-0">
                  <div className="px-4 py-2 bg-sunken/30 text-2xs uppercase tracking-wider text-ink-500 font-semibold flex items-center gap-2">
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
                      <li className="px-4 py-2 text-2xs text-ink-500">
                        + {list.length - 8} more {entity} clients (auto-applied)
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={next}
              className="text-sm px-5 py-2 rounded bg-indigo text-white hover:bg-indigo-hover"
            >
              {allConfirmed ? "Continue" : "Apply suggestions and continue"}
            </button>
            <p className="text-xs text-ink-500">
              You can clone or customize any package later in Settings → Service Packages.
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
    <li className="px-4 py-2.5 flex items-center gap-3">
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
        className="text-xs border border-line rounded px-2 py-1.5 bg-surface text-ink-700 max-w-[200px]"
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
          className="text-2xs uppercase tracking-wide px-2 py-1 rounded border border-ok-border bg-ok-bg text-ok-ink hover:bg-ok-bg/70"
        >
          Confirm
        </button>
      )}
    </li>
  );
}
