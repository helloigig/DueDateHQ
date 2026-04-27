import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { actions } from "../data/store";
import { useClient } from "../hooks/useClients";
import { useDeadlinesForClient } from "../hooks/useDeadlines";
import { PageSkeleton } from "../components/skeletons/DashboardSkeleton";
import { ErrorState } from "../components/ErrorState";
import { bucketOf, formatLongDate, parseDate, TODAY } from "../data/dateHelpers";
import { DeadlineRow } from "../components/DeadlineRow";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  AddDeadlineModal,
  type AddDeadlinePrefill,
} from "../components/AddDeadlineModal";
import { EditClientModal } from "../components/EditClientModal";
import { ExportModal } from "../components/ExportModal";
import { StateChipGroup } from "../components/StateChipGroup";
import { STATE_NAMES, type StateCode } from "../types";
import { BUNDLES } from "../data/bundles";
import type {
  ActivityEntry,
  ActivityType,
  Client,
  ClientNote,
  Deadline,
} from "../types";

type Tab = "deadlines" | "notes" | "contacts" | "activity";

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const clientQuery = useClient(id);
  const deadlinesQuery = useDeadlinesForClient(id);
  const client = clientQuery.data ?? null;
  const deadlines = deadlinesQuery.data ?? [];
  const [tab, setTab] = useState<Tab>("deadlines");
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

  const clientDeadlines = deadlines;

  const { upcoming, thisYear, completed, extensions } = useMemo(() => {
    const upcoming: Deadline[] = [];
    const thisYear: Deadline[] = [];
    const completed: Deadline[] = [];
    const extensions: Deadline[] = [];
    for (const d of clientDeadlines) {
      if (d.status === "filed_extension") {
        extensions.push(d);
        continue;
      }
      if (d.status === "completed") {
        completed.push(d);
        continue;
      }
      const bucket = bucketOf(d.officialDueDate);
      if (bucket === "overdue" || bucket === "this_week" || bucket === "this_month") {
        upcoming.push(d);
      } else {
        thisYear.push(d);
      }
    }
    const byDate = (a: Deadline, b: Deadline) =>
      a.officialDueDate.localeCompare(b.officialDueDate);
    upcoming.sort(byDate);
    thisYear.sort(byDate);
    completed.sort(byDate);
    extensions.sort(byDate);
    return { upcoming, thisYear, completed, extensions };
  }, [clientDeadlines]);

  if (clientQuery.isLoading) return <PageSkeleton title="Loading client…" />;
  if (clientQuery.error) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
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

  if (!client) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-10">
        <Link to="/clients" className="text-sm text-slate-500 hover:underline">
          ‹ Clients
        </Link>
        <p className="mt-6 text-slate-600">Client not found.</p>
      </div>
    );
  }

  const addedAtLabel = formatLongDate(client.addedAt);
  const primaryStateName = STATE_NAMES[client.primaryState];
  const activeDeadlineCount = clientDeadlines.filter(
    (d) => d.status !== "completed" && d.status !== "filed_extension"
  ).length;

  const onArchiveConfirm = () => {
    actions.archiveClient(client.id);
    setArchiveOpen(false);
    navigate("/clients");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
      <Link to="/clients" className="text-sm text-slate-500 hover:underline">
        ‹ Clients
      </Link>

      <div className="mt-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-slate-900">
              {client.name}
            </h1>
            <StateChipGroup
              primary={client.primaryState}
              nexus={client.nexusStates}
            />
            {client.status === "archived" && (
              <span className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-sunken text-ink-500">
                Archived
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {client.entityType} · {primaryStateName}
            {client.nexusStates.length > 0 && ` + ${client.nexusStates.length} nexus`} ·
            <span className="capitalize"> {client.status}</span> · Added {addedAtLabel}
          </p>
        </div>
        <button
          onClick={() => setExportOpen(true)}
          className="text-sm px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50"
        >
          Export
        </button>
        <button
          onClick={() => setEditOpen(true)}
          className="text-sm px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50"
        >
          Edit
        </button>
        <button
          onClick={() => setArchiveOpen(true)}
          disabled={client.status === "archived"}
          className="text-sm px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Archive
        </button>
      </div>

      <div className="mt-5 border-b border-slate-200 flex gap-1">
        {(
          [
            ["deadlines", `Deadlines (${clientDeadlines.length})`],
            ["notes", `Notes${client.noteEntries?.length ? ` (${client.noteEntries.length})` : ""}`],
            ["contacts", "Contacts"],
            ["activity", `Activity${client.activity?.length ? ` (${client.activity.length})` : ""}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm ${
              tab === key
                ? "text-slate-900 border-b-2 border-slate-900 font-medium"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-5">
        {tab === "deadlines" && (
          <DeadlinesTab
            client={client}
            upcoming={upcoming}
            thisYear={thisYear}
            completed={completed}
            extensions={extensions}
            allDeadlines={clientDeadlines}
            onAddDeadline={() => setAddDeadlineOpen(true)}
          />
        )}
        {tab === "notes" && <NotesTab client={client} />}
        {tab === "contacts" && <ContactsTab client={client} />}
        {tab === "activity" && <ActivityTab client={client} />}
      </div>

      <ConfirmDialog
        open={archiveOpen}
        title={`Archive ${client.name}?`}
        destructive
        requireAcknowledge={
          activeDeadlineCount > 0
            ? `I understand ${activeDeadlineCount} active deadline${
                activeDeadlineCount === 1 ? "" : "s"
              } will drop off my triage.`
            : undefined
        }
        body={
          <>
            <p>
              Archived clients don't count against your tier and are excluded
              from dashboard counts. Their history is retained for 7 years.
            </p>
            {activeDeadlineCount > 0 && (
              <p className="mt-2 text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                This client has {activeDeadlineCount} active deadline
                {activeDeadlineCount === 1 ? "" : "s"}. They'll disappear from
                your triage immediately. You can unarchive anytime.
              </p>
            )}
          </>
        }
        confirmLabel="Archive"
        onConfirm={onArchiveConfirm}
        onCancel={() => setArchiveOpen(false)}
      />

      <AddDeadlineModal
        open={addDeadlineOpen}
        client={client}
        prefill={addDeadlinePrefill}
        onClose={() => {
          setAddDeadlineOpen(false);
          setAddDeadlinePrefill(undefined);
        }}
      />

      <EditClientModal
        open={editOpen}
        client={client}
        onClose={() => setEditOpen(false)}
      />

      <ExportModal
        open={exportOpen}
        deadlines={clientDeadlines}
        clients={[client]}
        title={`Export — ${client.name}`}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}

function DeadlinesTab({
  client,
  upcoming,
  thisYear,
  completed,
  extensions,
  allDeadlines,
  onAddDeadline,
}: {
  client: Client;
  upcoming: Deadline[];
  thisYear: Deadline[];
  completed: Deadline[];
  extensions: Deadline[];
  allDeadlines: Deadline[];
  onAddDeadline: () => void;
}) {
  const [yearOpen, setYearOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);

  const nextUpcoming = upcoming[0];
  const nextLabel = nextUpcoming
    ? `${formatLongDate(nextUpcoming.officialDueDate)} · ${nextUpcoming.form}`
    : "None scheduled";
  const nextDaysRaw = nextUpcoming
    ? Math.round(
        (parseDate(nextUpcoming.officialDueDate).getTime() - TODAY.getTime()) /
          86400000
      )
    : 0;

  return (
    <>
      <BundleManager client={client} />

      {nextUpcoming && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm">
          <span className="text-slate-500">Next up: </span>
          <span className="text-slate-900 font-medium">{nextLabel}</span>
          <span className="text-slate-500">
            {" "}
            ·{" "}
            {nextDaysRaw === 0
              ? "due today"
              : nextDaysRaw < 0
              ? `${-nextDaysRaw}d overdue`
              : `in ${nextDaysRaw}d`}
          </span>
        </div>
      )}

      <Section
        title={`Upcoming (${upcoming.length})`}
        actions={
          <button
            onClick={onAddDeadline}
            className="text-xs px-2.5 py-1 rounded bg-slate-900 text-white hover:bg-slate-800"
          >
            + Deadline
          </button>
        }
      >
        {upcoming.length === 0 ? (
          <div className="px-4 py-4 text-sm text-slate-500">
            Nothing upcoming.
          </div>
        ) : (
          upcoming.map((d) => (
            <DeadlineRow key={d.id} deadline={d} client={client} />
          ))
        )}
      </Section>

      {extensions.length > 0 && (
        <Section title={`Extensions filed (${extensions.length})`}>
          {extensions.map((e) => (
            <ExtensionRow
              key={e.id}
              original={e}
              linked={allDeadlines.find(
                (d) => d.id === e.linkedExtensionDeadlineId
              )}
            />
          ))}
        </Section>
      )}

      <CollapsibleSection
        title={`This year (${thisYear.length})`}
        open={yearOpen}
        onToggle={() => setYearOpen((v) => !v)}
      >
        {thisYear.map((d) => (
          <DeadlineRow key={d.id} deadline={d} client={client} />
        ))}
      </CollapsibleSection>

      <CollapsibleSection
        title={`Completed (${completed.length})`}
        open={completedOpen}
        onToggle={() => setCompletedOpen((v) => !v)}
      >
        {completed.map((d) => (
          <DeadlineRow key={d.id} deadline={d} client={client} />
        ))}
      </CollapsibleSection>

      {client.relatedClientIds && client.relatedClientIds.length > 0 && (
        <Section title="🔗 Related clients">
          {client.relatedClientIds.map((id) => (
            <div key={id} className="px-4 py-2 text-sm text-slate-600">
              {id}
            </div>
          ))}
        </Section>
      )}
    </>
  );
}

function ExtensionRow({
  original,
  linked,
}: {
  original: Deadline;
  linked?: Deadline;
}) {
  const submitted = original.extensionSubmittedAt
    ? new Date(original.extensionSubmittedAt)
    : null;
  const approved = original.extensionApprovedAt
    ? new Date(original.extensionApprovedAt)
    : null;

  return (
    <div className="px-4 py-3 border-b border-slate-100 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="text-slate-400 text-lg leading-none pt-1">⏳</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-900">
              {original.form}
            </span>
            <span className="text-xs text-slate-500">
              original due {formatLongDate(original.officialDueDate)}
            </span>
            {linked && (
              <>
                <span className="text-slate-300">→</span>
                <span className="text-sm text-slate-900 font-medium">
                  {formatLongDate(linked.officialDueDate)}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1.5 text-xs">
            <StatusPill
              label={
                submitted
                  ? `Submitted ${submitted.toLocaleDateString("en-US")}`
                  : "Not submitted"
              }
              tone={submitted ? "filled" : "muted"}
            />
            <span className="text-slate-300">·</span>
            <StatusPill
              label={
                approved
                  ? `Approved ${approved.toLocaleDateString("en-US")}`
                  : "Awaiting approval"
              }
              tone={approved ? "success" : "pending"}
            />
            <span className="text-slate-300">·</span>
            <StatusPill
              label={
                linked
                  ? `Extended deadline ${linked.officialDueDate}`
                  : "No extension deadline linked"
              }
              tone={linked ? "filled" : "muted"}
            />
          </div>
        </div>

        {!approved && submitted && (
          <button
            onClick={() => actions.markExtensionApproved(original.id)}
            className="text-xs px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 shrink-0"
            title="Simulate IRS/state approval"
          >
            Mark approved
          </button>
        )}
      </div>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "filled" | "muted" | "pending" | "success";
}) {
  const cls =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "pending"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : tone === "filled"
      ? "bg-slate-100 text-slate-700 border-slate-200"
      : "bg-white text-slate-400 border-slate-200";
  return (
    <span className={`px-1.5 py-0.5 rounded border text-[11px] ${cls}`}>
      {label}
    </span>
  );
}

function NotesTab({ client }: { client: Client }) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const notes = client.noteEntries ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    if (!q) return sorted;
    return sorted.filter((n) => n.body.toLowerCase().includes(q));
  }, [notes, query]);

  const onAdd = () => {
    const body = draft.trim();
    if (!body) return;
    actions.addNote(client.id, body);
    setDraft("");
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <label className="block text-xs font-medium text-slate-600 mb-1">
          New note
        </label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="e.g. Called client; waiting on W-2 copies by Friday."
          className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-400">
            Notes are firm-internal — clients never see them.
          </span>
          <button
            onClick={onAdd}
            disabled={!draft.trim()}
            className="text-xs px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40"
          >
            Add note
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          className="flex-1 text-sm px-3 py-1.5 rounded border border-slate-200 bg-white"
        />
        <span className="text-xs text-slate-400">
          {filtered.length} of {notes.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-sm text-slate-500">
          {notes.length === 0
            ? "No notes yet. Add your first above."
            : `No notes match "${query}".`}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => (
            <NoteItem key={n.id} note={n} clientId={client.id} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NoteItem({
  note,
  clientId,
}: {
  note: ClientNote;
  clientId: string;
}) {
  const ts = new Date(note.createdAt);
  return (
    <li
      className={`bg-white border rounded-lg p-3 ${
        note.pinned ? "border-amber-300" : "border-slate-200"
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
        {note.pinned && (
          <span className="text-amber-700 font-medium">📌 Pinned</span>
        )}
        <span>{ts.toLocaleString("en-US")}</span>
        <span>·</span>
        <span>{note.authorName}</span>
        <button
          onClick={() => actions.toggleNotePin(clientId, note.id)}
          className="ml-auto text-slate-400 hover:text-amber-700"
          title={note.pinned ? "Unpin" : "Pin"}
        >
          {note.pinned ? "Unpin" : "Pin"}
        </button>
        <button
          onClick={() => actions.deleteNote(clientId, note.id)}
          className="text-slate-400 hover:text-red-600"
          title="Delete"
        >
          Delete
        </button>
      </div>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.body}</p>
    </li>
  );
}

function ContactsTab({ client }: { client: Client }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
      <h3 className="text-sm font-semibold text-slate-700">Primary contact</h3>
      <div className="text-sm text-slate-600">
        <div>
          <a
            href={`mailto:${client.contactEmail}`}
            className="text-indigo-600 hover:underline"
          >
            {client.contactEmail}
          </a>
        </div>
        {client.contactPhone && <div>{client.contactPhone}</div>}
      </div>
      <p className="text-xs text-slate-500 pt-2">
        All automated reminders go to this address. Client replies land in your
        own inbox — we don't thread or store them.
      </p>
    </div>
  );
}

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  status_change: "✓",
  deadline_added: "➕",
  deadline_updated: "✎",
  extension_filed: "⏳",
  client_created: "★",
  client_edited: "✎",
  client_archived: "📦",
  batch_adjust: "⇄",
  note_added: "📝",
  bundle_assigned: "🏷",
};

function ActivityTab({ client }: { client: Client }) {
  const activity = client.activity ?? [];
  if (activity.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-sm text-slate-500">
        No activity yet.
      </div>
    );
  }
  return (
    <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
      {activity.map((a) => (
        <ActivityItem key={a.id} entry={a} />
      ))}
    </ul>
  );
}

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const ts = new Date(entry.timestamp);
  const icon = ACTIVITY_ICONS[entry.type] ?? "·";
  return (
    <li className="px-4 py-2.5 flex items-start gap-3">
      <span className="w-5 text-center text-slate-400">{icon}</span>
      <div className="flex-1 min-w-0 text-sm">
        <div className="text-slate-700">{entry.summary}</div>
        <div className="text-xs text-slate-500 mt-0.5">
          {ts.toLocaleString("en-US")} · {entry.actorName}
        </div>
      </div>
    </li>
  );
}

function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700 flex-1">{title}</h3>
        {actions}
      </div>
      <div>{children}</div>
    </section>
  );
}

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <span className="flex-1 text-left">{title}</span>
        <span className="text-slate-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}

function BundleManager({ client }: { client: Client }) {
  const [picking, setPicking] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const assigned = client.servicePackages;
  const available = BUNDLES.filter(
    (b) =>
      b.entityTypes.includes(client.entityType) &&
      !assigned.includes(b.name)
  );

  const onAssign = (id: string) => {
    actions.assignBundle(client.id, id);
    setPicking(false);
  };

  const bundleFromName = (name: string) =>
    BUNDLES.find((b) => b.name === name);

  const removalTarget = removing ? bundleFromName(removing) : null;

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-700">
            Filing bundles
          </h3>
          {available.length > 0 && (
            <button
              onClick={() => setPicking((v) => !v)}
              className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
            >
              {picking ? "Cancel" : "+ Assign"}
            </button>
          )}
        </div>

        {assigned.length === 0 ? (
          <p className="text-sm text-slate-500">
            No filing bundle assigned. Deadlines won't auto-generate until one
            is assigned.
          </p>
        ) : (
          <ul className="text-sm text-slate-600 space-y-1">
            {assigned.map((pkg) => {
              const bundle = bundleFromName(pkg);
              return (
                <li
                  key={pkg}
                  className="flex items-center gap-2 py-1"
                >
                  <span className="text-slate-900">{pkg}</span>
                  {bundle && (
                    <span className="text-2xs text-slate-500">
                      · {bundle.description}
                    </span>
                  )}
                  {bundle && (
                    <button
                      onClick={() => setRemoving(pkg)}
                      className="ml-auto text-2xs text-slate-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {picking && available.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="text-2xs text-slate-500 mb-2">
              Available bundles for {client.entityType} clients:
            </p>
            <ul className="space-y-1">
              {available.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-slate-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-900 font-medium">
                      {b.name}
                    </div>
                    <div className="text-2xs text-slate-500">
                      {b.description} · {b.templates.length} deadline template
                      {b.templates.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <button
                    onClick={() => onAssign(b.id)}
                    className="text-xs px-2.5 py-1 rounded bg-slate-900 text-white hover:bg-slate-800 shrink-0"
                  >
                    Assign
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!removalTarget}
        destructive
        title={`Remove bundle "${removalTarget?.name ?? ""}"?`}
        body={
          removalTarget ? (
            <>
              <p>
                Pending (not-started) deadlines generated by this bundle will be
                deleted. Anything already in progress, completed, or deferred
                stays.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                This is recorded in the client activity log.
              </p>
            </>
          ) : null
        }
        confirmLabel="Remove bundle"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removalTarget) {
            actions.unassignBundle(client.id, removalTarget.id);
          }
          setRemoving(null);
        }}
      />
    </>
  );
}
