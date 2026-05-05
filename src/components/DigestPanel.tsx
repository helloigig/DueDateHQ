import { useState } from "react";
import { Mail, ChevronRight, X } from "lucide-react";
import { useDigestForFirm } from "../hooks/useFilesFromClients";
import { useSession } from "../data/session";
import { useStore } from "../data/store";

/**
 * Firm-wide digest panel on Dashboard. One click → consolidated chase
 * emails for every client with pending docs. Each digest aggregates
 * ALL of one client's open tasks into one AI-drafted instead of
 * sending N emails per client (one per task).
 *
 * The CPA reviews each digest before send — no auto-send. Phase 2
 * adds opt-in auto-send for trusted templates.
 *
 * Hidden when there are zero clients (cold-start firms have nothing
 * to chase).
 */
export function DigestPanel() {
  const session = useSession();
  const { clients } = useStore();
  const generate = useDigestForFirm();
  const [open, setOpen] = useState(false);

  if (clients.length === 0) return null;

  const cpaSignature = `${session?.userName ?? "Sarah Mitchell"}\n${session?.firmName ?? "Mitchell CPA"}`;

  const onGenerate = async () => {
    setOpen(true);
    if (!generate.data && !generate.isPending) {
      await generate.mutateAsync({
        cpaSignature,
        tone: "warm",
      });
    }
  };

  const digests = generate.data ?? [];

  return (
    <>
      <section className="bg-surface border border-line rounded-md overflow-hidden">
        <header className="px-4 py-2.5 border-b border-line bg-sunken/40 flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-ink-700" aria-hidden />
          <h2 className="text-sm font-semibold text-ink-900">
            Today's chase digests
          </h2>
          <span className="text-2xs text-ink-500">
            one consolidated email per client
          </span>
          <button
            onClick={onGenerate}
            disabled={generate.isPending}
            className="ml-auto text-xs px-3 py-1 rounded bg-indigo text-white hover:bg-indigo-hover disabled:opacity-40 inline-flex items-center gap-1"
          >
            {generate.isPending
              ? "Generating…"
              : digests.length > 0
                ? "View / refresh"
                : "Generate"}
            <ChevronRight className="w-3 h-3" aria-hidden />
          </button>
        </header>
        <div className="px-4 py-3 text-xs text-ink-500">
          Real CPAs batch their morning chases into one consolidated email
          per client — saves the client from receiving 3 separate emails
          for 3 open tasks. Click Generate to see your queue.
        </div>
      </section>

      {open && (
        <DigestPreviewModal
          digests={digests}
          loading={generate.isPending}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

interface DigestRow {
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  tasks: Array<{
    taskId: string;
    formType: string;
    forwardingEmail: string;
    pendingItems: Array<{ itemType: string; label: string }>;
  }>;
  draft: {
    subject: string;
    body: string;
    aiSources: Array<{ kind: string; note: string }>;
    inferenceId: number;
  } | null;
}

function DigestPreviewModal({
  digests,
  loading,
  onClose,
}: {
  digests: DigestRow[];
  loading: boolean;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = digests.find((d) => d.clientId === selected) ?? digests[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface border border-line rounded-lg shadow-overlay w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <header className="flex items-center px-4 py-3 border-b border-line">
          <h2 className="text-sm font-semibold text-ink-900">
            Chase digests — {digests.length} client
            {digests.length === 1 ? "" : "s"}
          </h2>
          <button
            onClick={onClose}
            className="ml-auto text-ink-500 hover:text-ink-900 p-1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-ink-500">
            Generating…
          </div>
        ) : digests.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-ink-500 px-4 text-center">
            No clients have pending chases right now. Quiet morning.
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar — list of clients with pending digests */}
            <aside className="w-56 border-r border-line overflow-y-auto bg-sunken/40">
              <ul className="divide-y divide-line">
                {digests.map((d) => {
                  const total = d.tasks.reduce(
                    (n, t) => n + t.pendingItems.length,
                    0,
                  );
                  const isActive = active?.clientId === d.clientId;
                  return (
                    <li key={d.clientId}>
                      <button
                        onClick={() => setSelected(d.clientId)}
                        className={[
                          "w-full text-left px-3 py-2.5 hover:bg-surface",
                          isActive ? "bg-surface" : "",
                        ].join(" ")}
                      >
                        <p className="text-sm font-medium text-ink-900 truncate">
                          {d.clientName}
                        </p>
                        <p className="text-2xs text-ink-500 mt-0.5">
                          {d.tasks.length} task
                          {d.tasks.length === 1 ? "" : "s"} · {total}{" "}
                          item{total === 1 ? "" : "s"}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            {/* Main — preview of the selected digest */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {active ? (
                <>
                  <p className="text-2xs text-ink-500">
                    To: {active.clientEmail ?? "(no email on file)"}
                  </p>
                  <h3 className="text-sm font-semibold text-ink-900 mt-2">
                    {active.draft?.subject ?? "(no subject)"}
                  </h3>
                  <pre className="mt-3 text-xs text-ink-700 whitespace-pre-wrap font-sans bg-canvas border border-line rounded p-3">
                    {active.draft?.body ?? "(generating draft…)"}
                  </pre>

                  <div className="mt-4 pt-4 border-t border-line">
                    <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold mb-2">
                      Consolidated from
                    </p>
                    <ul className="space-y-1 text-xs text-ink-700">
                      {active.tasks.map((t) => (
                        <li key={t.taskId}>
                          <span className="font-medium">{t.formType}</span>
                          <span className="text-ink-400"> — </span>
                          {t.pendingItems.map((p) => p.label).join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 pt-4 border-t border-line flex items-center gap-2">
                    <button
                      onClick={onClose}
                      className="text-sm px-3 py-1.5 rounded text-ink-500 hover:bg-sunken"
                    >
                      Close
                    </button>
                    <button
                      disabled
                      className="ml-auto text-sm px-4 py-1.5 rounded bg-accent text-canvas opacity-40 cursor-not-allowed"
                      title="Send wiring lands in the next pass — for now, copy the body and send manually."
                    >
                      Send (Phase 2)
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-500">
                  Pick a client on the left to preview.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
