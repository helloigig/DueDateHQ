import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Clock3, FileText, Inbox, NotebookPen, Users2 } from "lucide-react";
import { useClient, useAddNote, useArchiveClient, useDeleteNote, useToggleNotePin } from "../hooks/useClients";
import { PageSkeleton } from "../components/skeletons/DashboardSkeleton";
import { ErrorState } from "../components/ErrorState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  AddDeadlineModal,
  type AddDeadlinePrefill,
} from "../components/AddDeadlineModal";
import { EditClientModal } from "../components/EditClientModal";
import { ExportModal } from "../components/ExportModal";
import { StateChipGroup } from "../components/StateChipGroup";
import { STATE_NAMES, type ActivityEntry, type ClientNote, type Deadline, type StateCode } from "../types";

type Tab = "tasks" | "documents" | "history" | "notes" | "activity";

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const clientQuery = useClient(id);
  const payload = clientQuery.data ?? null;
  const client = payload?.client ?? null;

  const archiveClient = useArchiveClient();
  const addNote = useAddNote();
  const toggleNotePin = useToggleNotePin();
  const deleteNote = useDeleteNote();

  const [tab, setTab] = useState<Tab>("tasks");
  const [noteBody, setNoteBody] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addDeadlineOpen, setAddDeadlineOpen] = useState(false);
  const [addDeadlinePrefill, setAddDeadlinePrefill] = useState<
    AddDeadlinePrefill | undefined
  >(undefined);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("addDeadline") === "1") {
      const form = searchParams.get("form") ?? undefined;
      const jurisdictionParam = searchParams.get("jurisdiction");
      const date = searchParams.get("date") ?? undefined;
      const sourceNote = searchParams.get("source") ?? undefined;
      const jurisdiction =
        jurisdictionParam === "federal"
          ? ("federal" as const)
          : (jurisdictionParam as StateCode | null) ?? undefined;
      setAddDeadlinePrefill({
        form,
        jurisdiction: jurisdiction ?? undefined,
        date,
        sourceNote,
      });
      setAddDeadlineOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("addDeadline");
      next.delete("form");
      next.delete("jurisdiction");
      next.delete("date");
      next.delete("source");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const tasks = (payload?.tabs.tasks ?? []) as Deadline[];
  const documents = (payload?.tabs.documents ?? []).map((row) => ({
    id: row.id,
    factType: row.factType,
    period: row.period,
    value: String(row.value ?? ""),
    importTier: row.importTier,
  }));
  const history = (payload?.tabs.history ?? []) as Deadline[];
  const notes = (payload?.tabs.notes ?? []) as ClientNote[];
  const activity = (payload?.tabs.activity ?? []) as ActivityEntry[];

  const openTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status !== "completed" && task.status !== "filed_extension")
        .sort((a, b) => a.officialDueDate.localeCompare(b.officialDueDate)),
    [tasks]
  );

  if (clientQuery.isLoading) return <PageSkeleton title="Loading client..." />;

  if (clientQuery.error) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <ErrorState
          title="Couldn't load this client."
          message={
            clientQuery.error instanceof Error
              ? clientQuery.error.message
              : undefined
          }
          onRetry={() => clientQuery.refetch()}
        />
      </div>
    );
  }

  if (!client || !payload) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        <Link to="/clients" className="text-sm text-ink-500 hover:underline">
          Back to clients
        </Link>
        <p className="mt-6 text-ink-600">Client not found.</p>
      </div>
    );
  }

  const primaryStateName = STATE_NAMES[client.primaryState];
  const doArchive = () => {
    archiveClient.mutate({ id: client.id });
    navigate("/clients");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <Link to="/clients" className="text-sm text-ink-500 hover:underline">
        Back to clients
      </Link>

      <header className="border border-line bg-surface rounded-md p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold text-ink-900">
                {client.name}
              </h1>
              <span className="text-xs px-2 py-1 rounded border border-line text-ink-500">
                {client.entityType}
              </span>
              <span className="text-xs px-2 py-1 rounded border border-line text-ink-500 capitalize">
                {client.status}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-600">
              <span>{primaryStateName}</span>
              <span>-</span>
              <span>{client.contactEmail}</span>
              <span>-</span>
              <span>
                {client.servicePackages.length > 0
                  ? client.servicePackages.join(", ")
                  : "No service package assigned"}
              </span>
            </div>
            <div className="mt-3">
              <StateChipGroup
                primary={client.primaryState}
                nexus={client.nexusStates}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAddDeadlineOpen(true)}
              className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
            >
              Add deadline
            </button>
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
            >
              Export
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setArchiveOpen(true)}
              className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
            >
              Archive
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <MiniStat
            label="Open tasks"
            value={String(payload.aiInsights.openTasks)}
            helper="Current live work"
          />
          <MiniStat
            label="Next due window"
            value={payload.aiInsights.nextWindow ?? "None"}
            helper="Earliest open due date"
          />
          <MiniStat
            label="Imported facts"
            value={String(payload.aiInsights.importedFactCount)}
            helper="Historical context on file"
          />
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-4">
          <section className="border border-line bg-surface rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex flex-wrap gap-2">
              {(
                [
                  ["tasks", `Tasks (${openTasks.length})`],
                  ["documents", `Documents (${documents.length})`],
                  ["history", `History (${history.length})`],
                  ["notes", `Notes (${notes.length})`],
                  ["activity", `Activity (${activity.length})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`text-sm px-3 py-2 rounded-md ${
                    tab === key
                      ? "bg-sunken text-ink-900"
                      : "text-ink-500 hover:bg-sunken"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {tab === "tasks" && (
                <TaskList tasks={openTasks} clientId={client.id} emptyCopy="No open tasks for this client." />
              )}
              {tab === "documents" && <DocumentsTab rows={documents} />}
              {tab === "history" && (
                <TaskList tasks={history} clientId={client.id} emptyCopy="No completed task history yet." />
              )}
              {tab === "notes" && (
                <NotesTab
                  notes={notes}
                  body={noteBody}
                  onChangeBody={setNoteBody}
                  onAdd={() => {
                    if (!noteBody.trim()) return;
                    addNote.mutate(
                      { clientId: client.id, body: noteBody.trim() },
                      {
                        onSuccess: () => setNoteBody(""),
                      }
                    );
                  }}
                  onTogglePin={(noteId) =>
                    toggleNotePin.mutate({ clientId: client.id, noteId })
                  }
                  onDelete={(noteId) =>
                    deleteNote.mutate({ clientId: client.id, noteId })
                  }
                />
              )}
              {tab === "activity" && <ActivityTab rows={activity} />}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <SidePanel
            icon={Clock3}
            title="Task spine"
            description="The client page is longitudinal. The task page is operational."
          >
            {openTasks.length === 0 ? (
              <div className="text-sm text-ink-500">No open tasks right now.</div>
            ) : (
              <div className="space-y-2">
                {openTasks.slice(0, 4).map((task) => (
                  <Link
                    key={task.id}
                    to={task.taskId ? `/clients/${client.id}/tasks/${task.taskId}` : `/clients/${client.id}`}
                    className="block border border-line rounded-md px-3 py-3 hover:bg-sunken"
                  >
                    <div className="text-sm font-medium text-ink-900">{task.form}</div>
                    <div className="mt-1 text-xs text-ink-500">
                      Due {task.officialDueDate} · {task.status}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SidePanel>

          <SidePanel
            icon={Users2}
            title="Contacts and related clients"
            description="Shared context around the client record."
          >
            <div className="space-y-3">
              {(client.contacts ?? []).map((contact) => (
                <div key={contact.id} className="border border-line rounded-md px-3 py-3">
                  <div className="text-sm font-medium text-ink-900">
                    {contact.name ?? "Primary contact"}
                  </div>
                  <div className="mt-1 text-xs text-ink-500">
                    {contact.email ?? "No email"} · {contact.phone ?? "No phone"}
                  </div>
                </div>
              ))}
              {(client.contacts ?? []).length === 0 && (
                <div className="text-sm text-ink-500">No contacts recorded yet.</div>
              )}
              {client.relatedClientIds?.length ? (
                <div className="border border-line rounded-md px-3 py-3 text-sm text-ink-600">
                  Related client ids: {client.relatedClientIds.join(", ")}
                </div>
              ) : null}
            </div>
          </SidePanel>

          <SidePanel
            icon={Inbox}
            title="AI context"
            description="What the system already knows about this client."
          >
            <div className="space-y-2 text-sm text-ink-600">
              <div className="border border-line rounded-md px-3 py-3">
                Imported facts: {payload.aiInsights.importedFactCount}
              </div>
              <div className="border border-line rounded-md px-3 py-3">
                Next due window: {payload.aiInsights.nextWindow ?? "Not yet predicted"}
              </div>
            </div>
          </SidePanel>
        </aside>
      </div>

      <ConfirmDialog
        open={archiveOpen}
        title={`Archive ${client.name}?`}
        destructive
        body={
          <p>
            Archived clients disappear from active triage, but their record and
            history stay available for later reference.
          </p>
        }
        confirmLabel="Archive"
        onConfirm={doArchive}
        onCancel={() => setArchiveOpen(false)}
      />

      <AddDeadlineModal
        open={addDeadlineOpen}
        client={client}
        onClose={() => {
          setAddDeadlineOpen(false);
          setAddDeadlinePrefill(undefined);
        }}
        prefill={addDeadlinePrefill}
      />

      <EditClientModal
        open={editOpen}
        client={client}
        onClose={() => setEditOpen(false)}
      />

      <ExportModal
        open={exportOpen}
        deadlines={[...openTasks, ...history]}
        clients={[client]}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}

function TaskList({
  tasks,
  clientId,
  emptyCopy,
}: {
  tasks: Deadline[];
  clientId: string;
  emptyCopy: string;
}) {
  if (tasks.length === 0) {
    return <div className="text-sm text-ink-500">{emptyCopy}</div>;
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="border border-line rounded-md px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <div className="text-sm font-medium text-ink-900">{task.form}</div>
            <div className="mt-1 text-xs text-ink-500">
              Due {task.officialDueDate} · {task.status} · {task.jurisdiction}
            </div>
          </div>
          <Link
            to={task.taskId ? `/clients/${clientId}/tasks/${task.taskId}` : `/clients/${clientId}`}
            className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken inline-flex items-center gap-2"
          >
            {task.taskId ? "Open task" : "Open record"}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ))}
    </div>
  );
}

function DocumentsTab({
  rows,
}: {
  rows: Array<{ id: string; factType: string; period: string; value: string; importTier: number }>;
}) {
  if (rows.length === 0) {
    return <div className="text-sm text-ink-500">No imported documents or facts yet.</div>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="border border-line rounded-md px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-ink-900">
            <FileText className="w-4 h-4" />
            {row.factType}
          </div>
          <div className="mt-2 text-sm text-ink-600">
            Period {row.period} · Tier {row.importTier}
          </div>
          <div className="mt-2 text-xs text-ink-500 whitespace-pre-wrap">
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function NotesTab({
  notes,
  body,
  onChangeBody,
  onAdd,
  onTogglePin,
  onDelete,
}: {
  notes: ClientNote[];
  body: string;
  onChangeBody: (value: string) => void;
  onAdd: () => void;
  onTogglePin: (noteId: string) => void;
  onDelete: (noteId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="border border-line rounded-md p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-ink-900">
          <NotebookPen className="w-4 h-4" />
          Add note
        </div>
        <textarea
          value={body}
          onChange={(event) => onChangeBody(event.target.value)}
          rows={4}
          className="mt-3 w-full px-3 py-2 rounded-md border border-line text-sm"
          placeholder="What matters about this client right now?"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onAdd}
            className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
          >
            Save note
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="text-sm text-ink-500">No notes yet.</div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="border border-line rounded-md p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-1 rounded border border-line text-ink-500">
                  {note.authorName}
                </span>
                <span className="text-xs text-ink-500">
                  {new Date(note.createdAt).toLocaleString()}
                </span>
                {note.pinned && (
                  <span className="text-xs px-2 py-1 rounded border border-line text-ink-500">
                    pinned
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm text-ink-700 whitespace-pre-wrap">
                {note.body}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onTogglePin(note.id)}
                  className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
                >
                  {note.pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(note.id)}
                  className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityTab({
  rows,
}: {
  rows: ActivityEntry[];
}) {
  if (rows.length === 0) {
    return <div className="text-sm text-ink-500">No activity yet.</div>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="border border-line rounded-md px-4 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-ink-900">{row.summary}</span>
            <span className="text-xs text-ink-500">{row.actorName}</span>
          </div>
          <div className="mt-1 text-xs text-ink-500">
            {new Date(row.timestamp).toLocaleString()} · {row.type}
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="border border-line rounded-md px-4 py-4">
      <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-ink-900">{value}</div>
      <div className="mt-1 text-xs text-ink-500">{helper}</div>
    </div>
  );
}

function SidePanel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Clock3;
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
