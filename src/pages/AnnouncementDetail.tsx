import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Mail, TriangleAlert } from "lucide-react";
import { useAnnouncement, useBatchAdjustFromAnnouncement, useDismissAnnouncement, useMarkAnnouncementRead } from "../hooks/useAnnouncements";
import { useClients } from "../hooks/useClients";
import { PageSkeleton } from "../components/skeletons/DashboardSkeleton";
import { ErrorState } from "../components/ErrorState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { BatchNotifyModal } from "../components/BatchNotifyModal";
import { formatLongDate } from "../data/dateHelpers";

export function AnnouncementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const announcementQuery = useAnnouncement(id);
  const clientsQuery = useClients();
  const markRead = useMarkAnnouncementRead();
  const batchAdjust = useBatchAdjustFromAnnouncement();
  const dismissAnnouncement = useDismissAnnouncement();

  const announcement = announcementQuery.data ?? null;
  const clients = clientsQuery.data?.items ?? [];
  const clientsById = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients]
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [confirmBatch, setConfirmBatch] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!announcement) return;
    setSelected(announcement.affectedClientIds);
    if (!announcement.read) {
      markRead.mutate({ id: announcement.id });
    }
  }, [announcement, markRead]);

  if (announcementQuery.isLoading || clientsQuery.isLoading) {
    return <PageSkeleton title="Loading alert..." />;
  }

  if (announcementQuery.error || clientsQuery.error) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <ErrorState
          title="Couldn't load this alert."
          message={
            (announcementQuery.error ?? clientsQuery.error) instanceof Error
              ? (announcementQuery.error ?? clientsQuery.error)?.message
              : undefined
          }
          onRetry={() => {
            announcementQuery.refetch();
            clientsQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (!announcement) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        <Link to="/alerts" className="text-sm text-ink-500 hover:underline">
          Back to alerts
        </Link>
        <p className="mt-6 text-ink-600">Alert not found.</p>
      </div>
    );
  }

  const selectedClients = clients.filter((client) => selected.includes(client.id));

  const allSelected =
    selected.length > 0 &&
    selected.length === announcement.affectedClientIds.length;

  const toggleClient = (clientId: string) => {
    setSelected((current) =>
      current.includes(clientId)
        ? current.filter((idValue) => idValue !== clientId)
        : [...current, clientId]
    );
  };

  const toggleAll = () => {
    setSelected(
      allSelected ? [] : announcement.affectedClientIds.slice()
    );
  };

  const applyBatchAdjust = () => {
    batchAdjust.mutate(
      { id: announcement.id, clientIds: selected },
      {
        onSuccess: () => {
          setFlash(
            `Adjusted ${selected.length} client deadline${
              selected.length === 1 ? "" : "s"
            }.`
          );
          setConfirmBatch(false);
        },
      }
    );
  };

  const dismiss = () => {
    dismissAnnouncement.mutate(
      { id: announcement.id },
      {
        onSuccess: () => navigate("/alerts"),
      }
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <Link to="/alerts" className="text-sm text-ink-500 hover:underline">
        Back to alerts
      </Link>

      <header className="border border-line bg-surface rounded-md p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-1 rounded border border-line text-ink-500">
                {announcement.authority}
              </span>
              <span className="text-xs px-2 py-1 rounded border border-line text-ink-500">
                {announcement.type.replace(/_/g, " ")}
              </span>
              <span className="text-xs px-2 py-1 rounded border border-line text-ink-500">
                confidence {announcement.confidence}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-ink-900">
              {announcement.stateCode}: {announcement.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-ink-600">
              {announcement.summary}
            </p>
          </div>
          <a
            href={announcement.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken inline-flex items-center gap-2"
          >
            View official source
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            label="Published"
            value={formatLongDate(announcement.publishedDate)}
          />
          <InfoCard
            label="Detected"
            value={new Date(announcement.detectedAt).toLocaleString()}
          />
          <InfoCard
            label="Affected clients"
            value={String(announcement.affectedClientIds.length)}
          />
          <InfoCard
            label="Deadline change"
            value={
              announcement.newDeadline
                ? `${announcement.oldDeadline ?? "Current"} -> ${announcement.newDeadline}`
                : "Review required"
            }
          />
        </div>
      </header>

      {flash && (
        <div className="border border-line bg-surface rounded-md px-4 py-3 text-sm text-ink-700">
          {flash}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <section className="border border-line bg-surface rounded-md overflow-hidden">
          <header className="px-5 py-4 border-b border-line flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">
                Affected clients
              </h2>
              <p className="text-sm text-ink-600">
                Select clients to adjust deadlines or send notification drafts.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleAll}
              className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
            >
              {allSelected ? "Clear selection" : "Select all"}
            </button>
          </header>

          <div className="divide-y divide-line">
            {announcement.affectedClientIds.map((clientId) => {
              const client = clientsById.get(clientId);
              if (!client) return null;
              const selectedNow = selected.includes(clientId);
              return (
                <div
                  key={clientId}
                  className="px-5 py-4 flex flex-col gap-3 xl:grid xl:grid-cols-[auto_minmax(0,1fr)_180px_auto] xl:items-center"
                >
                  <label className="inline-flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedNow}
                      onChange={() => toggleClient(clientId)}
                    />
                    <span className="text-sm font-medium text-ink-900">
                      {client.name}
                    </span>
                  </label>
                  <div className="text-sm text-ink-600">
                    {client.entityType} · {client.primaryState} · {client.contactEmail}
                  </div>
                  <div className="text-xs text-ink-500">
                    Packages:{" "}
                    {client.servicePackages.length > 0
                      ? client.servicePackages.join(", ")
                      : "none"}
                  </div>
                  <div className="flex xl:justify-end">
                    <Link
                      to={`/clients/${clientId}`}
                      className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
                    >
                      Open client
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <Panel
            icon={TriangleAlert}
            title="Parsed impact"
            description="This is the structured interpretation, not the legal source of truth."
          >
            <div className="space-y-2 text-sm text-ink-600">
              <ImpactRow label="Entities" value={announcement.entityTypes.join(", ")} />
              <ImpactRow label="Taxes" value={announcement.taxTypes.join(", ")} />
              <ImpactRow
                label="Counties"
                value={announcement.counties.length > 0 ? announcement.counties.join(", ") : "Statewide"}
              />
              <ImpactRow
                label="Old deadline"
                value={announcement.oldDeadline ? formatLongDate(announcement.oldDeadline) : "N/A"}
              />
              <ImpactRow
                label="New deadline"
                value={announcement.newDeadline ? formatLongDate(announcement.newDeadline) : "Not parsed"}
              />
            </div>
          </Panel>

          <Panel
            icon={Mail}
            title="Actions"
            description="From here the alert turns into client-visible work."
          >
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setConfirmBatch(true)}
                disabled={selected.length === 0}
                className="w-full text-left text-sm px-3 py-3 rounded-md border border-line hover:bg-sunken disabled:opacity-60"
              >
                Batch-adjust {selected.length} selected client
                {selected.length === 1 ? "" : "s"}
              </button>
              <button
                type="button"
                onClick={() => setNotifyOpen(true)}
                disabled={selected.length === 0}
                className="w-full text-left text-sm px-3 py-3 rounded-md border border-line hover:bg-sunken disabled:opacity-60"
              >
                Draft notify-client email
              </button>
              <button
                type="button"
                onClick={() => setConfirmDismiss(true)}
                className="w-full text-left text-sm px-3 py-3 rounded-md border border-line hover:bg-sunken"
              >
                Dismiss alert for this firm
              </button>
            </div>
          </Panel>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmBatch}
        title={`Adjust ${selected.length} client deadline${
          selected.length === 1 ? "" : "s"
        }?`}
        body={
          <p>
            This applies the alert's parsed deadline change to the selected
            clients and logs the action to their activity history.
          </p>
        }
        confirmLabel="Apply adjustment"
        onConfirm={applyBatchAdjust}
        onCancel={() => setConfirmBatch(false)}
      />

      <ConfirmDialog
        open={confirmDismiss}
        title="Dismiss this alert?"
        body={
          <p>
            Dismissing removes the alert from active review for this firm but
            keeps the record available in the archived list.
          </p>
        }
        confirmLabel="Dismiss"
        onConfirm={dismiss}
        onCancel={() => setConfirmDismiss(false)}
      />

      <BatchNotifyModal
        open={notifyOpen}
        announcement={announcement}
        recipients={selectedClients}
        onClose={() => setNotifyOpen(false)}
        onSent={(count) =>
          setFlash(`Queued notify-client drafts for ${count} recipient${count === 1 ? "" : "s"}.`)
        }
      />
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof TriangleAlert;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-line bg-surface rounded-md p-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-md border border-line flex items-center justify-center">
          <Icon className="w-4 h-4 text-ink-900" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
          <p className="text-xs text-ink-500">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border border-line rounded-md px-4 py-4">
      <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-ink-900">{value}</div>
    </div>
  );
}

function ImpactRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border border-line rounded-md px-3 py-3">
      <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-1 text-sm text-ink-900">{value}</div>
    </div>
  );
}
