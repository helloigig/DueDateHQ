import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { actions, useStore } from "../data/store";
import { trpc } from "../lib/api/client";
import { useClient } from "../hooks/useClients";
import { useDeadlinesForClient } from "../hooks/useDeadlines";
import { useTasksForClient } from "../hooks/useTasks";
import {
  useAiInsightsForClient,
  useImportedFactsForClient,
} from "../hooks/useAiInsights";
import { PageSkeleton } from "../components/skeletons/DashboardSkeleton";
import { ErrorState } from "../components/ErrorState";
import { bucketOf, daysBetween, formatLongDate, parseDate, TODAY } from "../data/dateHelpers";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  AddDeadlineModal,
  type AddDeadlinePrefill,
} from "../components/AddDeadlineModal";
import { FilingsTab } from "../components/FilingsTab";
import { EditClientModal } from "../components/EditClientModal";
import { ExportModal } from "../components/ExportModal";
import { ExportClientsButton } from "../components/ExportClientsButton";
import { StateChipGroup } from "../components/StateChipGroup";
import { STATE_NAMES, type StateCode } from "../types";
import { bundleByName, type FilingBundle } from "../data/bundles";
import { resolveFederalForm } from "../data/canonicalForm";
import type {
  ActivityEntry,
  ActivityType,
  Client,
  ClientNote,
  Deadline,
} from "../types";

// IA v0.7 §3.3 — five tabs (Engagement default + Habits + Predictions + To
// Do + Mailbox). Audit log + Documents + Contacts were day-1 surfaces in
// v0.6; v0.7 demotes them to the overflow menu since the rich tabs cover
// every primary daily flow.
type Tab =
  | "engagement"
  | "filings"
  | "habits"
  | "predictions"
  | "todo"
  | "mailbox"
  | "documents"
  | "contacts"
  | "audit";

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const clientQuery = useClient(id);
  const deadlinesQuery = useDeadlinesForClient(id);
  const client = clientQuery.data ?? null;
  const deadlines = deadlinesQuery.data ?? [];
  const [tab, setTab] = useState<Tab>("engagement");
  const [overflowOpen, setOverflowOpen] = useState(false);
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

  // The v0.7 Engagement tab only needs the "upcoming" bucket (used to count
  // how many deadlines are coming this quarter). The full deadline triage
  // bucketing lives on the Today + Timeline destinations now.
  const upcoming = useMemo(() => {
    const out: Deadline[] = [];
    for (const d of clientDeadlines) {
      if (d.status === "completed" || d.status === "filed_extension") continue;
      const bucket = bucketOf(d.officialDueDate);
      if (bucket === "overdue" || bucket === "this_week" || bucket === "this_month") {
        out.push(d);
      }
    }
    return out.sort((a, b) => a.officialDueDate.localeCompare(b.officialDueDate));
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
        <Link to="/clients" className="text-sm text-ink-500 hover:underline">
          ‹ Clients
        </Link>
        <p className="mt-6 text-ink-700">Client not found.</p>
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
      <Link to="/clients" className="text-sm text-ink-500 hover:underline">
        ‹ Clients
      </Link>

      <div className="mt-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-ink-900">
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
          <p className="text-sm text-ink-500 mt-1">
            {client.entityType} · {primaryStateName}
            {client.nexusStates.length > 0 && ` + ${client.nexusStates.length} nexus`} ·
            <span className="capitalize"> {client.status}</span> · Added {addedAtLabel}
          </p>
          {client.servicePackages.length > 0 && (
            <div className="mt-2 flex items-center flex-wrap gap-1.5">
              <span className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
                Service package{client.servicePackages.length === 1 ? "" : "s"}:
              </span>
              {client.servicePackages.map((p) => (
                <PackageChip key={p} packageName={p} client={client} />
              ))}
              <span className="text-2xs text-ink-400">
                · {clientDeadlines.length} deadline{clientDeadlines.length === 1 ? "" : "s"} auto-generated
              </span>
            </div>
          )}
        </div>
        <ExportClientsButton clientId={client.id} />
        {/* Legacy ExportModal still mounted (deadline iCal/PDF surfaces) but
            no longer the default trigger — env.useMockData callers can still
            reach it via setExportOpen if a future surface needs it. */}
        <button
          onClick={() => setEditOpen(true)}
          className="text-sm px-3 py-1.5 rounded border border-line hover:bg-sunken/40"
        >
          Edit
        </button>
        <button
          onClick={() => setArchiveOpen(true)}
          disabled={client.status === "archived"}
          className="text-sm px-3 py-1.5 rounded border border-line hover:bg-sunken/40 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Archive
        </button>
      </div>

      <ClientAiInsightsCard clientId={client.id} />

      <div className="mt-5 border-b border-line flex items-center gap-1 flex-wrap relative">
        {(
          [
            ["engagement", "🤝 Engagement"],
            ["filings", "📋 Filings"],
            ["habits", "🧠 Habits"],
            ["predictions", "🔮 Predictions"],
            ["todo", "✅ To Do"],
            ["mailbox", "✉️ Mailbox"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm ${
              tab === key
                ? "text-ink-900 border-b-2 border-ink-900 font-medium"
                : "text-ink-500 hover:text-ink-700"
            }`}
          >
            {label}
          </button>
        ))}
        {/* Overflow menu — Audit log + the v0.6 surfaces (Documents,
            Contacts) demoted out of the primary tab strip in v0.7. */}
        <div className="ml-auto relative">
          <button
            onClick={() => setOverflowOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={overflowOpen}
            className={`px-3 py-2 text-sm ${
              tab === "documents" || tab === "contacts" || tab === "audit"
                ? "text-ink-900 border-b-2 border-ink-900 font-medium"
                : "text-ink-500 hover:text-ink-700"
            }`}
            title="More — Audit log, Documents, Contacts"
          >
            …
          </button>
          {overflowOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 w-48 bg-surface border border-line rounded-md shadow-overlay py-1 z-30"
              onMouseLeave={() => setOverflowOpen(false)}
            >
              {(
                [
                  ["audit", `Audit log${client.activity?.length ? ` (${client.activity.length})` : ""}`],
                  ["documents", "Documents"],
                  ["contacts", "Contacts"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setTab(key);
                    setOverflowOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-sunken ${
                    tab === key ? "text-ink-900 font-medium" : "text-ink-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {tab === "engagement" && (
          <EngagementTab
            client={client}
            upcoming={upcoming}
            allDeadlines={clientDeadlines}
            onSwitchToToDo={() => setTab("todo")}
            onSwitchToHabits={() => setTab("habits")}
          />
        )}
        {tab === "filings" && (
          <FilingsTab
            client={client}
            deadlines={clientDeadlines}
            onAddDeadline={(prefill) => {
              setAddDeadlinePrefill(prefill);
              setAddDeadlineOpen(true);
            }}
          />
        )}
        {tab === "habits" && <HabitsTab client={client} />}
        {tab === "predictions" && <PredictionsTab client={client} />}
        {tab === "todo" && (
          <ToDoTab
            client={client}
            allDeadlines={clientDeadlines}
            onAddDeadline={() => setAddDeadlineOpen(true)}
            onOpenDocuments={() => setTab("documents")}
          />
        )}
        {tab === "mailbox" && <MailboxTab client={client} />}
        {tab === "documents" && <DocumentsTab client={client} />}
        {tab === "contacts" && <ContactsTab client={client} />}
        {tab === "audit" && <ActivityTab client={client} />}
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
              <p className="mt-2 text-warn-ink bg-warn-bg border border-warn-border rounded px-3 py-2">
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


/**
 * Service-package chip with a click-to-expand popover that shows the
 * bundle's actual composition (the specific filings the firm commits to
 * for clients on this package). Solves the "you can't tell what's actually
 * inside this bundle" gap — the chip used to deep-link to /settings/packages
 * which buried the answer two pages away.
 *
 * The popover renders against the bundle definition in `data/bundles.ts`,
 * resolves `JurisdictionSlot` (federal / primary / nexus) into concrete
 * state codes for THIS client, and shows due dates as MM-DD (no time-of-day,
 * per `feedback_deadlines_dates_only`).
 */
function PackageChip({
  packageName,
  client,
}: {
  packageName: string;
  client: Client;
}) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const bundle = bundleByName(packageName);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // No matching bundle (firm-custom package) — render a static chip with a
  // tooltip that explains why no breakdown is available.
  if (!bundle) {
    return (
      <Link
        to="/settings/packages"
        className="text-xs px-2 py-0.5 rounded border border-line bg-sunken/40 text-ink-700 hover:bg-sunken"
        title={`${packageName} — firm-custom package. View definition in Settings.`}
      >
        {packageName}
      </Link>
    );
  }

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${packageName} — ${bundle.templates.length} filings included. Click to view.`}
        className="text-xs px-2 py-0.5 rounded border border-line bg-sunken/40 text-ink-700 hover:bg-sunken inline-flex items-center gap-1"
      >
        {packageName}
        <span className="text-ink-400">▾</span>
      </button>
      {open && (
        <PackageDetailsPopover
          bundle={bundle}
          client={client}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function PackageDetailsPopover({
  bundle,
  client,
  onClose,
}: {
  bundle: FilingBundle;
  client: Client;
  onClose: () => void;
}) {
  // Resolve JurisdictionSlot → concrete state label for this client. The
  // bundle's templates use slot variables ("primary" / "nexus") so the same
  // bundle definition produces different filings for an LA client vs a CA
  // client. We render slot labels here instead of fake-state-coded values.
  const resolveSlot = (slot: "federal" | "primary" | "nexus") => {
    if (slot === "federal") return { label: "FED", title: "Federal" };
    if (slot === "primary")
      return {
        label: client.primaryState,
        title: STATE_NAMES[client.primaryState],
      };
    return {
      label: `NX×${client.nexusStates.length}`,
      title: `Nexus states: ${client.nexusStates.length > 0 ? client.nexusStates.join(", ") : "(none)"}`,
    };
  };

  const formatTemplateDate = (month: number, day: number) =>
    new Date(2000, month - 1, day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  return (
    <div
      role="dialog"
      aria-label={`${bundle.name} — bundle composition`}
      className="absolute z-30 left-0 top-full mt-1 w-80 bg-surface border border-line rounded-md shadow-overlay overflow-hidden"
    >
      <header className="px-3 py-2 border-b border-line bg-sunken/30">
        <p className="text-sm font-semibold text-ink-900">{bundle.name}</p>
        <p className="text-2xs text-ink-500 mt-0.5">{bundle.description}</p>
      </header>
      <div className="px-3 py-2 border-b border-line text-2xs text-ink-500 flex items-center gap-3">
        <span>
          <span className="text-ink-700 font-medium">
            {bundle.templates.length}
          </span>{" "}
          filing{bundle.templates.length === 1 ? "" : "s"} included
        </span>
        <span className="text-ink-300">·</span>
        <span>
          Applies to:{" "}
          <span className="text-ink-700">
            {bundle.entityTypes.join(" · ")}
          </span>
        </span>
      </div>
      <ul className="divide-y divide-line max-h-80 overflow-y-auto">
        {bundle.templates.map((t, i) => {
          const slot = resolveSlot(t.jurisdiction);
          // Try to resolve the bundle's free-text form name to a federal
          // catalog entry. If matched, surface a "↗ IRS" link so the CPA
          // can verify against the official PDF without leaving this view.
          // State-only / firm-custom rows (no catalog match) just render
          // the legacy text — no broken links.
          const canonical = resolveFederalForm(t.form);
          return (
            <li
              key={`${t.form}-${i}`}
              className="px-3 py-2 flex items-baseline gap-2 text-sm"
            >
              <span
                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-2xs font-semibold bg-sunken text-ink-700 border border-line shrink-0 uppercase tabular-nums"
                title={slot.title}
              >
                {slot.label}
              </span>
              <span className="flex-1 text-ink-900 truncate" title={canonical?.name ?? t.form}>
                {t.form}
              </span>
              {canonical && canonical.sources[0] && (
                <a
                  href={canonical.sources[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-2xs text-accent hover:underline shrink-0"
                  title={`IRS source for Form ${canonical.code}`}
                >
                  ↗ IRS
                </a>
              )}
              <span className="text-2xs text-ink-500 tabular-nums shrink-0">
                {formatTemplateDate(t.month, t.day)}
              </span>
            </li>
          );
        })}
      </ul>
      <footer className="px-3 py-2 bg-sunken/30 border-t border-line flex items-center justify-between text-2xs">
        <span className="text-ink-500">
          Out-of-scope work isn't covered by this package.
        </span>
        <Link
          to="/settings/packages"
          onClick={onClose}
          className="text-ink-700 hover:text-ink-900 underline"
        >
          Edit package →
        </Link>
      </footer>
    </div>
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
      <div className="bg-surface border border-line rounded-lg p-4">
        <label className="block text-xs font-medium text-ink-700 mb-1">
          New note
        </label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="e.g. Called client; waiting on W-2 copies by Friday."
          className="w-full px-3 py-2 rounded border border-line focus:outline-none focus:ring-2 focus:ring-indigo text-sm resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-ink-400">
            Notes are firm-internal — clients never see them.
          </span>
          <button
            onClick={onAdd}
            disabled={!draft.trim()}
            className="text-xs px-3 py-1.5 rounded bg-ink-900 text-white hover:bg-ink-900 disabled:opacity-40"
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
          className="flex-1 text-sm px-3 py-1.5 rounded border border-line bg-surface"
        />
        <span className="text-xs text-ink-400">
          {filtered.length} of {notes.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface border border-line rounded-lg p-6 text-center text-sm text-ink-500">
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
      className={`bg-surface border rounded-lg p-3 ${
        note.pinned ? "border-warn-border" : "border-line"
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-ink-500 mb-1">
        {note.pinned && (
          <span className="text-warn-ink font-medium">📌 Pinned</span>
        )}
        <span>{ts.toLocaleString("en-US")}</span>
        <span>·</span>
        <span>{note.authorName}</span>
        <button
          onClick={() => actions.toggleNotePin(clientId, note.id)}
          className="ml-auto text-ink-400 hover:text-warn-ink"
          title={note.pinned ? "Unpin" : "Pin"}
        >
          {note.pinned ? "Unpin" : "Pin"}
        </button>
        <button
          onClick={() => actions.deleteNote(clientId, note.id)}
          className="text-ink-400 hover:text-danger-ink"
          title="Delete"
        >
          Delete
        </button>
      </div>
      <p className="text-sm text-ink-700 whitespace-pre-wrap">{note.body}</p>
    </li>
  );
}

function ContactsTab({ client }: { client: Client }) {
  return (
    <div className="bg-surface border border-line rounded-lg p-5 space-y-2">
      <h3 className="text-sm font-semibold text-ink-700">Primary contact</h3>
      <div className="text-sm text-ink-700">
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
      <p className="text-xs text-ink-500 pt-2">
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
  email_sent: "📤",
  email_received: "📥",
  document_received: "📄",
  document_confirmed: "✔",
  document_flagged: "⚠",
  ai_inferred: "🤖",
  checklist_state_change: "•",
};

function ActivityTab({ client }: { client: Client }) {
  const activity = client.activity ?? [];
  if (activity.length === 0) {
    return (
      <div className="bg-surface border border-line rounded-lg p-6 text-center text-sm text-ink-500">
        No activity yet.
      </div>
    );
  }
  return (
    <ul className="bg-surface border border-line rounded-lg divide-y divide-line">
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
      <span className="w-5 text-center text-ink-400">{icon}</span>
      <div className="flex-1 min-w-0 text-sm">
        <div className="text-ink-700">{entry.summary}</div>
        <div className="text-xs text-ink-500 mt-0.5">
          {ts.toLocaleString("en-US")} · {entry.actorName}
        </div>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────
// IA v0.7 §3.3 Client detail tabs — Engagement / Habits / Predictions /
// To Do / Mailbox. Built from the spec painpoint→design-solution
// rubric: gap-over-fill (what client hasn't sent is the loudest
// element), green/yellow/red AI authority, Pattern 4 advisory awakening.
// ─────────────────────────────────────────────────────────────────────

type EngagementProps = {
  client: Client;
  upcoming: Deadline[];
  allDeadlines: Deadline[];
  onSwitchToToDo: () => void;
  onSwitchToHabits: () => void;
};

function EngagementTab({
  client,
  upcoming,
  allDeadlines,
  onSwitchToToDo,
  onSwitchToHabits,
}: EngagementProps) {
  const { checklistItems, tasks } = useStore();
  const insights = useAiInsightsForClient(client.id);
  const announcementsQuery = trpc.announcements.list.useQuery();
  const announcements = announcementsQuery.data ?? [];

  const taskIds = useMemo(
    () => tasks.filter((t) => t.clientId === client.id).map((t) => t.id),
    [tasks, client.id],
  );
  const taskIdSet = useMemo(() => new Set(taskIds), [taskIds]);

  // Gap-over-fill computation: what is this client still owing me?
  const waiting = useMemo(() => {
    let count = 0;
    let oldestDays: number | null = null;
    const now = Date.now();
    const taskCounts = new Map<string, number>();
    for (const ci of checklistItems) {
      if (!taskIdSet.has(ci.taskId)) continue;
      if (ci.state !== "requested_waiting" && ci.state !== "not_requested") continue;
      count++;
      taskCounts.set(ci.taskId, (taskCounts.get(ci.taskId) ?? 0) + 1);
      if (ci.lastReminderAt) {
        const days = Math.floor(
          (now - new Date(ci.lastReminderAt).getTime()) / (24 * 60 * 60 * 1000),
        );
        if (oldestDays == null || days > oldestDays) oldestDays = days;
      }
    }
    return { count, oldestDays, taskCount: taskCounts.size };
  }, [checklistItems, taskIdSet]);

  const activeAlerts = announcements.filter(
    (a) => !a.dismissed && a.affectedClientIds.includes(client.id),
  );
  const openInsights = insights.filter((i) => i.status === "open");
  const noteCount = client.noteEntries?.length ?? 0;

  // Relationship score — naive: 5 dots minus stuck-reminder penalty.
  const relationshipScore = Math.max(
    1,
    5 - (waiting.oldestDays != null && waiting.oldestDays > 14 ? 2 : 0) -
      (waiting.count > 5 ? 1 : 0),
  );

  // Relationship label (compact) — paired with the dot chip in the verdict.
  const relationshipLabel =
    relationshipScore <= 2
      ? "Stuck"
      : relationshipScore === 3
        ? "Watch"
        : "Healthy";

  // Compose the next-deadline-shift sentence for each active alert. When the
  // alert is a disaster_extension that already shifted a deadline on this
  // client, we prefer that wording ("1040 deadline shifted Oct 15 → Feb 15")
  // over the bare alert title — it's the actionable shape Sarah cares about.
  const shiftedDeadlineForAlert = (annId: string) => {
    const ann = activeAlerts.find((a) => a.id === annId);
    if (!ann?.newDeadline) return null;
    const match = allDeadlines.find(
      (d) => d.officialDueDate === ann.newDeadline,
    );
    return match ? match.form : null;
  };

  // Pick the dominant signal for the primary verb. Order matches the user's
  // mental priority: "what blocks this client → what just hit them → what
  // could grow them → just open the to-do."
  const primaryAction: { kind: "chase" | "alert" | "todo"; href?: string } =
    waiting.count > 0
      ? { kind: "chase" }
      : activeAlerts.length > 0
        ? { kind: "alert", href: `/alerts/${activeAlerts[0].id}` }
        : { kind: "todo" };

  return (
    <div className="space-y-4">
      {/* VERDICT BLOCK — the page's single most important thing. Compresses
          gap (waiting items), shock (regulatory impact on this client), and
          opportunity (Mode E insights) into three signal lines, with a
          relationship chip in the corner and one primary verb at the bottom.
          Replaces what used to be 5 co-equal cards (Services / Relationship /
          Opportunities / Regulatory / Notes) competing for attention. */}
      <section className="bg-surface border-2 border-line rounded-md p-4">
        <header className="flex items-center gap-2 mb-3">
          <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
            Status — what's true today
          </p>
          <span className="ml-auto inline-flex items-baseline gap-1.5 text-xs">
            <span
              className="tabular-nums tracking-wider"
              aria-label={`Relationship score ${relationshipScore} of 5`}
              title={`Score ${relationshipScore} of 5 — falls when reminders stay unsent`}
            >
              {"●".repeat(relationshipScore)}
              <span className="text-ink-300">
                {"○".repeat(5 - relationshipScore)}
              </span>
            </span>
            <span
              className={
                relationshipScore <= 2
                  ? "text-danger-ink font-medium"
                  : relationshipScore === 3
                    ? "text-warn-ink"
                    : "text-ok-ink"
              }
            >
              {relationshipLabel}
            </span>
          </span>
        </header>

        <ul className="space-y-2">
          {/* Gap signal */}
          <li className="text-sm flex items-baseline gap-2">
            {waiting.count > 0 ? (
              <>
                <span className="shrink-0">🚨</span>
                <span className="flex-1 min-w-0">
                  <strong className="text-ink-900">
                    Waiting on {client.name.split(" ")[0]}
                  </strong>
                  <span className="text-ink-700">
                    {" — "}
                    {waiting.count} item{waiting.count === 1 ? "" : "s"} across{" "}
                    {waiting.taskCount} task{waiting.taskCount === 1 ? "" : "s"}
                    {waiting.oldestDays != null && waiting.oldestDays > 0 && (
                      <> · oldest {waiting.oldestDays}d unsent</>
                    )}
                  </span>
                </span>
              </>
            ) : (
              <>
                <span className="shrink-0 text-ok-ink">✓</span>
                <span className="flex-1 text-ink-500">
                  Nothing waiting on this client
                </span>
              </>
            )}
          </li>

          {/* Shock signal — one line per active alert hitting this client */}
          {activeAlerts.length > 0 ? (
            activeAlerts.map((a) => {
              const shiftedForm = shiftedDeadlineForAlert(a.id);
              return (
                <li
                  key={a.id}
                  className="text-sm flex items-baseline gap-2"
                >
                  <span className="shrink-0">📅</span>
                  <span className="flex-1 min-w-0">
                    <strong className="text-ink-900">
                      {a.stateCode}: {a.title}
                    </strong>
                    {a.oldDeadline && a.newDeadline && (
                      <span className="text-ink-700">
                        {" "}
                        ·{" "}
                        {shiftedForm ? `${shiftedForm} ` : ""}
                        deadline shifted {formatLongDate(a.oldDeadline)} →{" "}
                        {formatLongDate(a.newDeadline)}
                      </span>
                    )}
                  </span>
                  <Link
                    to={`/alerts/${a.id}`}
                    className="text-2xs text-accent hover:underline shrink-0"
                  >
                    Review →
                  </Link>
                </li>
              );
            })
          ) : null}

          {/* Opportunity signal — only when non-empty (zero-state was noise) */}
          {openInsights.length > 0 && (
            <li className="text-sm flex items-baseline gap-2">
              <span className="shrink-0">✨</span>
              <span className="flex-1 min-w-0">
                <strong className="text-ink-900">
                  {openInsights[0].title}
                </strong>
                <span className="text-ink-700">
                  {" "}
                  · {openInsights[0].detail}
                </span>
                {openInsights.length > 1 && (
                  <span className="text-ink-500">
                    {" "}
                    · +{openInsights.length - 1} more
                  </span>
                )}
              </span>
            </li>
          )}
        </ul>

        {/* Primary verb — picks the dominant signal. Only one button — Yuqi's
            "one entrance, one name" rule. Secondary detail still reachable
            via tabs (To Do / Mailbox / etc.). */}
        <div className="mt-4 pt-3 border-t border-line flex items-center gap-2">
          {primaryAction.kind === "chase" && (
            <button
              onClick={onSwitchToToDo}
              className="px-3 py-1.5 rounded bg-ink-900 text-canvas text-sm font-medium hover:bg-ink-700"
            >
              Send {waiting.count} reminder{waiting.count === 1 ? "" : "s"}
            </button>
          )}
          {primaryAction.kind === "alert" && primaryAction.href && (
            <Link
              to={primaryAction.href}
              className="px-3 py-1.5 rounded bg-ink-900 text-canvas text-sm font-medium hover:bg-ink-700"
            >
              Review {activeAlerts[0].stateCode} alert
            </Link>
          )}
          {primaryAction.kind === "todo" && (
            <button
              onClick={onSwitchToToDo}
              className="px-3 py-1.5 rounded border border-line text-ink-700 text-sm hover:bg-sunken"
            >
              Open To-Do
            </button>
          )}
          <span className="text-2xs text-ink-500">
            {primaryAction.kind === "chase"
              ? "Open To-Do tab pre-filtered by waiting items"
              : primaryAction.kind === "alert"
                ? "Bundles email draft + deadline shift"
                : "All tasks for this client"}
          </span>
        </div>
      </section>

      {/* REFERENCE STRIP — services, tier, packages, deadline counts, since.
          Slimmed from a full card to a single condensed row. Pricing line
          dropped (was a Phase-1 italic placeholder). */}
      <section className="bg-surface border border-line rounded-md p-3 text-xs flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span>
          <span className="text-ink-500">Tier</span>{" "}
          <span className="text-ink-900 font-medium capitalize">
            {client.tier ?? "Standard"}
          </span>
        </span>
        <span className="text-ink-300">·</span>
        <span className="flex items-center gap-1">
          <span className="text-ink-500">Packages</span>{" "}
          {client.servicePackages.length > 0 ? (
            client.servicePackages.map((p) => (
              <span
                key={p}
                className="px-1.5 py-0.5 rounded border border-line bg-sunken/40 text-2xs"
              >
                {p}
              </span>
            ))
          ) : (
            <span className="text-ink-500">— none assigned</span>
          )}
        </span>
        <span className="text-ink-300">·</span>
        <span>
          <span className="text-ink-500">Open deadlines</span>{" "}
          <span className="text-ink-900 font-medium tabular-nums">
            {
              allDeadlines.filter(
                (d) =>
                  d.status !== "completed" && d.status !== "filed_extension",
              ).length
            }
          </span>{" "}
          <span className="text-ink-500">· {upcoming.length} upcoming</span>
        </span>
        <span className="text-ink-300">·</span>
        <span>
          <span className="text-ink-500">Since</span>{" "}
          <span className="text-ink-900">{formatLongDate(client.addedAt)}</span>
        </span>
      </section>

      {/* Notes pointer — full editor lives in Habits. */}
      <section className="bg-surface border border-line rounded-md p-4 flex items-baseline gap-3">
        <div className="flex-1">
          <h3 className="text-xs uppercase tracking-wider text-ink-500 font-semibold">
            Notes
          </h3>
          <p className="text-sm text-ink-700 mt-0.5">
            {noteCount > 0
              ? `${noteCount} note${noteCount === 1 ? "" : "s"} — full editor in Habits.`
              : "No notes yet. Use the Habits tab to capture firm memory about this client."}
          </p>
        </div>
        <button
          onClick={onSwitchToHabits}
          className="text-xs px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken"
        >
          Open Habits →
        </button>
      </section>
    </div>
  );
}

function HabitsTab({ client }: { client: Client }) {
  const facts = useImportedFactsForClient(client.id);
  const insights = useAiInsightsForClient(client.id);

  return (
    <div className="space-y-4">
      <section className="bg-surface border border-line rounded-md p-4">
        <header className="flex items-center gap-2 mb-2">
          <h3 className="text-xs uppercase tracking-wider text-ink-500 font-semibold">
            Multi-year patterns
          </h3>
          <span
            className="inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded-full border border-info-border bg-info-bg text-info-ink"
            title="Mode E + Mode B — narrated from imported history."
          >
            ✨ AI narrated
          </span>
        </header>
        {facts.length === 0 && insights.length === 0 ? (
          <p className="text-xs text-ink-500">
            <strong className="text-ink-700">Cold start:</strong> Personalized
            memory unlocks once you import a prior-year return for this client.
            Until then, AI uses substrate-based defaults (entity + state + cohort)
            for predictions and reminders.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {facts.slice(0, 6).map((f) => (
              <li key={f.id} className="text-ink-700">
                <span className="text-ink-500">{f.itemType}:</span>{" "}
                <span className="text-ink-900">
                  {f.observedAmount != null
                    ? `$${f.observedAmount.toLocaleString()}`
                    : f.observedDate
                      ? `arrived ${formatLongDate(f.observedDate)}`
                      : (f.note ?? "—")}
                </span>
                <span className="text-ink-400 text-2xs ml-2">({f.year})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <NotesTab client={client} />
    </div>
  );
}

function PredictionsTab({ client }: { client: Client }) {
  const facts = useImportedFactsForClient(client.id);
  return (
    <section className="bg-surface border border-line rounded-md p-4">
      <header className="flex items-center gap-2 mb-2">
        <h3 className="text-xs uppercase tracking-wider text-ink-500 font-semibold">
          Per-client expected timeline
        </h3>
        <span
          className="inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded-full border border-info-border bg-info-bg text-info-ink"
          title="Mode B — per-client arrival timing prediction"
        >
          ✨ Mode B prediction
        </span>
      </header>
      {facts.length === 0 ? (
        <div className="text-xs text-ink-500 space-y-2">
          <p>
            <strong className="text-ink-700">Cold start:</strong> Predictions
            unlock once you import this client's prior-year history. Until
            then, AI uses substrate-based generic timing ({client.entityType} ·{" "}
            {client.primaryState}) so reminders still fire on a sensible
            cadence.
          </p>
          <p>
            What you'll see here once history lands: per-client expected
            arrivals (W-2, K-1, 1099-DIV), Mode B reminder schedule, and Mode
            E anomaly watch list.
          </p>
        </div>
      ) : (
        <ul className="space-y-2 text-sm">
          {facts.map((f) => (
            <li key={f.id} className="text-ink-700">
              <span className="text-ink-500">{f.itemType}:</span>{" "}
              <span className="text-ink-900">
                {f.observedAmount != null
                  ? `$${f.observedAmount.toLocaleString()}`
                  : f.observedDate
                    ? `arrived ${formatLongDate(f.observedDate)}`
                    : (f.note ?? "—")}
              </span>
              <span className="text-ink-400 text-2xs ml-2">({f.year})</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ToDoTab({
  client,
  allDeadlines,
  onAddDeadline,
}: {
  client: Client;
  allDeadlines: Deadline[];
  onAddDeadline: () => void;
  onOpenDocuments: () => void;
}) {
  const { checklistItems, tasks } = useStore();
  const taskIds = useMemo(
    () => tasks.filter((t) => t.clientId === client.id).map((t) => t.id),
    [tasks, client.id],
  );
  const tasksByIdMap = useMemo(() => {
    const m = new Map<string, (typeof tasks)[number]>();
    for (const t of tasks) if (taskIds.includes(t.id)) m.set(t.id, t);
    return m;
  }, [tasks, taskIds]);
  const taskIdSet = useMemo(() => new Set(taskIds), [taskIds]);

  const items = useMemo(
    () => checklistItems.filter((ci) => taskIdSet.has(ci.taskId)),
    [checklistItems, taskIdSet],
  );
  const stillWaiting = items.filter(
    (ci) => ci.state === "requested_waiting" || ci.state === "not_requested",
  );
  const needsReview = items.filter(
    (ci) => ci.state === "received_unreviewed" || ci.state === "received_issue",
  );
  const completeCount = items.filter(
    (ci) => ci.state === "received_confirmed" || ci.state === "not_applicable",
  ).length;

  // Sort waiting by oldest reminder first (gap-over-fill).
  const waitingSorted = [...stillWaiting].sort((a, b) => {
    const at = a.lastReminderAt ? new Date(a.lastReminderAt).getTime() : Infinity;
    const bt = b.lastReminderAt ? new Date(b.lastReminderAt).getTime() : Infinity;
    return at - bt;
  });

  const taskLabel = (taskId: string) => {
    const task = tasksByIdMap.get(taskId);
    if (!task) return "—";
    return [task.formType, task.jurisdiction].filter(Boolean).join(" · ") || taskId;
  };

  const taskHref = (taskId: string) =>
    `/clients/${client.id}/tasks/${taskId}`;

  return (
    <div className="space-y-4">
      {/* 🚨 STILL WAITING ON CLIENT — primary, bordered, always-expanded. */}
      <section
        aria-labelledby="todo-still-waiting-heading"
        className="rounded-md border-2 border-warn-border bg-warn-bg/30 overflow-hidden"
      >
        <header className="flex items-baseline gap-2 px-4 py-3 border-b border-warn-border">
          <h3
            id="todo-still-waiting-heading"
            className="text-sm font-semibold text-warn-ink"
          >
            🚨 Still waiting on client
          </h3>
          <span className="text-2xs text-warn-ink/80 tabular-nums">
            {stillWaiting.length} item{stillWaiting.length === 1 ? "" : "s"}
          </span>
          <button
            onClick={onAddDeadline}
            className="ml-auto text-2xs px-2 py-0.5 rounded border border-warn-border text-warn-ink hover:bg-warn-bg/60"
          >
            + Add deadline
          </button>
        </header>
        {stillWaiting.length === 0 ? (
          <p className="px-4 py-4 text-xs text-ink-500">
            Nothing waiting on this client right now.
          </p>
        ) : (
          <ul className="divide-y divide-warn-border/50">
            {waitingSorted.map((ci) => {
              const days = ci.lastReminderAt
                ? Math.floor(
                    (Date.now() - new Date(ci.lastReminderAt).getTime()) /
                      (24 * 60 * 60 * 1000),
                  )
                : null;
              return (
                <li
                  key={ci.id}
                  className="flex items-baseline gap-3 px-4 py-2.5"
                >
                  <span className="text-warn-ink shrink-0">
                    {ci.state === "requested_waiting" ? "⏳" : "⏸"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-900 truncate">
                      {ci.label ?? "Item"}
                    </p>
                    <p className="text-2xs text-ink-500 truncate">
                      {taskLabel(ci.taskId)}
                      {days != null && ` · last reminder ${days}d ago`}
                      {ci.state === "not_requested" && " · not yet requested"}
                    </p>
                  </div>
                  <Link
                    to={taskHref(ci.taskId)}
                    className="text-2xs px-2 py-1 rounded border border-line bg-surface text-ink-700 hover:bg-sunken shrink-0"
                  >
                    {ci.state === "requested_waiting"
                      ? "Send reminder ↗"
                      : "Request now ↗"}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ⚠ NEEDS YOUR REVIEW — secondary, expanded by default. */}
      {needsReview.length > 0 && (
        <section className="bg-surface border border-line rounded-md overflow-hidden">
          <header className="flex items-baseline gap-2 px-4 py-3 border-b border-line">
            <h3 className="text-sm font-semibold text-ink-900">
              ⚠ Needs your review
            </h3>
            <span className="text-2xs text-ink-500 tabular-nums">
              {needsReview.length} item{needsReview.length === 1 ? "" : "s"}
            </span>
          </header>
          <ul className="divide-y divide-line">
            {needsReview.map((ci) => (
              <li key={ci.id} className="flex items-baseline gap-3 px-4 py-2.5">
                <span className="shrink-0">
                  {ci.state === "received_issue" ? "⚠" : "📥"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-900 truncate">{ci.label}</p>
                  <p className="text-2xs text-ink-500 truncate">
                    {taskLabel(ci.taskId)}
                    {ci.flagReason && ` · AI flag: ${ci.flagReason}`}
                  </p>
                </div>
                <Link
                  to={taskHref(ci.taskId)}
                  className="text-2xs px-2 py-1 rounded border border-line text-ink-700 hover:bg-sunken shrink-0"
                >
                  Review ↗
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Open deadlines — full per-task entry points so the CPA can pivot
          from a deadline directly into its task detail. Each row carries:
            • form + jurisdiction badge (federal vs state-specific)
            • status pill (overdue / due-soon / on-track / waiting)
            • the official due date AND the internal target date — both shift
              together when a state alert moves the deadline, so the CPA sees
              the buffer they have, not just the wall date
            • countdown ("in 12 days", "8 days overdue") for at-a-glance triage
          Rows are clickable when a Task exists for the deadline (1:1 at MVP). */}
      <section className="bg-surface border border-line rounded-md p-4">
        <header className="flex items-baseline gap-2 mb-2">
          <h3 className="text-xs uppercase tracking-wider text-ink-500 font-semibold">
            Open deadlines for this client
          </h3>
          <span className="text-2xs text-ink-500 tabular-nums">
            {allDeadlines.filter(
              (d) => d.status !== "completed" && d.status !== "filed_extension",
            ).length}{" "}
            open
          </span>
        </header>
        <ul className="divide-y divide-line">
          {allDeadlines
            .filter(
              (d) => d.status !== "completed" && d.status !== "filed_extension",
            )
            .slice(0, 8)
            .map((d) => {
              const task = tasksByIdMap.get(`t-${d.id}`) ??
                Array.from(tasksByIdMap.values()).find((t) => t.deadlineId === d.id);
              const days = daysBetween(TODAY, parseDate(d.officialDueDate));
              const isOverdue = days < 0;
              const isDueSoon = days >= 0 && days <= 7;
              const countdown = isOverdue
                ? `${Math.abs(days)}d overdue`
                : days === 0
                  ? "due today"
                  : `in ${days}d`;
              const pillClass = isOverdue
                ? "bg-danger-bg text-danger-ink border border-danger-border"
                : isDueSoon
                  ? "bg-warn-bg text-warn-ink border border-warn-border"
                  : "bg-sunken text-ink-700 border border-line";
              const row = (
                <div className="text-sm text-ink-900 flex items-baseline gap-3 py-1.5">
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-2xs font-semibold bg-sunken text-ink-700 border border-line shrink-0 uppercase">
                    {d.jurisdiction}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{d.form}</p>
                    {task && (
                      <p className="text-2xs text-ink-500 tabular-nums">
                        Internal target {formatLongDate(task.internalTargetDate)}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-2xs px-1.5 py-0.5 rounded tabular-nums shrink-0 ${pillClass}`}
                  >
                    {countdown}
                  </span>
                  <span className="text-xs text-ink-500 tabular-nums shrink-0 w-28 text-right">
                    {formatLongDate(d.officialDueDate)}
                  </span>
                </div>
              );
              return (
                <li key={d.id} className="first:pt-0 last:pb-0">
                  {task ? (
                    <Link
                      to={`/clients/${client.id}/tasks/${task.id}`}
                      className="block hover:bg-sunken/40 -mx-1 px-1 rounded"
                      title="Open task detail"
                    >
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
        </ul>
        {allDeadlines.filter(
          (d) => d.status !== "completed" && d.status !== "filed_extension",
        ).length > 8 && (
          <p className="text-2xs text-ink-500 mt-2">
            +
            {allDeadlines.filter(
              (d) => d.status !== "completed" && d.status !== "filed_extension",
            ).length - 8}{" "}
            more open
          </p>
        )}
      </section>

      <p className="text-2xs text-ink-400">
        ✓ {completeCount} item{completeCount === 1 ? "" : "s"} complete this tax
        year (open the related task to see source attachments).
      </p>
    </div>
  );
}

function MailboxTab({ client }: { client: Client }) {
  const { emailDrafts, tasks } = useStore();
  const clientTaskIds = useMemo(
    () => new Set(tasks.filter((t) => t.clientId === client.id).map((t) => t.id)),
    [tasks, client.id],
  );
  const drafts = emailDrafts.filter((d) =>
    d.taskId ? clientTaskIds.has(d.taskId) : false,
  );
  const sent = drafts.filter((d) => d.status === "sent");
  const pending = drafts.filter(
    (d) => d.status === "draft" || d.status === "scheduled",
  );

  return (
    <div className="space-y-4">
      <section className="bg-surface border border-line rounded-md overflow-hidden">
        <header className="flex items-baseline gap-2 px-4 py-3 border-b border-line">
          <h3 className="text-sm font-semibold text-ink-900">📥 Inbox</h3>
          <span className="text-2xs text-ink-500">
            inbound replies from {client.name}
          </span>
        </header>
        <p className="px-4 py-4 text-xs text-ink-500">
          Inbound replies (Method A forwarding + Method B OAuth pull) appear
          here, classified by intent (document_provided · timeline_pushback ·
          question_asked · off_topic · mismatched_attachment). Wires to{" "}
          <code className="text-2xs">trpc.inboundReplies.listForClient</code>{" "}
          when the BE adds a per-client filter.
        </p>
      </section>

      <section className="bg-surface border border-line rounded-md overflow-hidden">
        <header className="flex items-baseline gap-2 px-4 py-3 border-b border-line">
          <h3 className="text-sm font-semibold text-ink-900">📤 Outbox</h3>
          <span className="text-2xs text-ink-500 tabular-nums">
            {sent.length} sent
          </span>
        </header>
        {sent.length === 0 ? (
          <p className="px-4 py-4 text-xs text-ink-500">No sent reminders yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {sent.slice(0, 8).map((d) => (
              <li key={d.id} className="px-4 py-2.5">
                <p className="text-sm text-ink-900 truncate">
                  {d.subject ?? "Reminder"}
                </p>
                <p className="text-2xs text-ink-500 mt-0.5">
                  {d.sentAt ? formatLongDate(d.sentAt) : "—"} · {d.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-surface border border-line rounded-md overflow-hidden">
        <header className="flex items-baseline gap-2 px-4 py-3 border-b border-line">
          <h3 className="text-sm font-semibold text-ink-900">📝 Drafts</h3>
          <span
            className="inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded-full border border-info-border bg-info-bg text-info-ink"
            title="Mode D — drafts wait for your review before send."
          >
            ✨ AI drafted
          </span>
          <span className="text-2xs text-ink-500 tabular-nums">
            {pending.length} awaiting review
          </span>
        </header>
        {pending.length === 0 ? (
          <p className="px-4 py-4 text-xs text-ink-500">
            No drafts pending. AI pre-prepares chase emails when an item enters
            requested_waiting state.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((d) => (
              <li key={d.id} className="px-4 py-2.5">
                <p className="text-sm text-ink-900 truncate">
                  {d.subject ?? "Reminder"}
                </p>
                <p className="text-2xs text-ink-500 mt-0.5 truncate">
                  {d.body?.slice(0, 80)}…
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-surface border border-line rounded-md p-4">
        <h3 className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">
          Issues
        </h3>
        <p className="text-xs text-ink-500">
          Bounces, complaints, unsubscribes for this client surface here once
          the BE delivery-events router adds a per-client view.
        </p>
      </section>
    </div>
  );
}

/**
 * Compact Mode B/E summary card on the client header. Click to expand
 * for the full insights panel. Cold-start fallback per PRD §4.2.
 */
function ClientAiInsightsCard({ clientId }: { clientId: string }) {
  const insights = useAiInsightsForClient(clientId);
  const facts = useImportedFactsForClient(clientId);
  const open = insights.filter((i) => i.status === "open");
  const clientQuery = useClient(clientId);
  const client = clientQuery.data;

  // Layer B advisory triggers — derive from Mode E. Tag insights by
  // category for visual grouping. PRD §4.4 Layer B.
  const advisoryTriggers = open.filter((i) => i.mode === "E");
  // Churn-risk early warning — derive from heuristics on response patterns
  // and declined-advisory flags. Wireframe-grade: a stub heuristic that
  // counts as "at risk" when the client has open insights AND no recent
  // confirmed activity. Real implementation reads ImportedFact + activity.
  const churnRiskScore = computeChurnRiskScore(clientId, open.length);
  // Suppress churn-risk for newly-added clients — there's no engagement
  // history to flag yet, so any "elevated" signal is noise. 30-day grace
  // window aligns with the response-time-trend rolling window the real
  // implementation will use (PRD §4.4 Layer B).
  const isNewClient = (() => {
    if (!client?.addedAt) return true;
    const added = parseDate(client.addedAt);
    if (Number.isNaN(added.getTime())) return true;
    const daysSinceAdded =
      (TODAY.getTime() - added.getTime()) / (24 * 60 * 60 * 1000);
    return daysSinceAdded < 30;
  })();
  const showChurnRisk = churnRiskScore >= 2 && !isNewClient;

  if (open.length === 0 && facts.length === 0 && !showChurnRisk) {
    return (
      <div className="mt-4 bg-info-bg border border-info-border rounded-md px-4 py-2 text-xs text-info-ink">
        AI insights unlock once you import a prior-year return for this client.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {/* Layer B: advisory triggers (Mode E) — these are the "wages doubled
          → 401k convo" / "Schedule E disappeared → did the property sell?"
          surfaces. The lever for moving from preparer to advisor (Pattern 4). */}
      {advisoryTriggers.length > 0 && (
        <div className="bg-info-bg/40 border border-info-border rounded-md overflow-hidden">
          <header className="px-4 py-2 border-b border-info-border bg-info-bg/60 flex items-center gap-2">
            <span className="text-2xs uppercase tracking-wider text-info-ink font-semibold">
              Advisory opportunities
            </span>
            <span className="text-2xs text-info-ink/70">
              {advisoryTriggers.length} open
            </span>
          </header>
          <ul className="divide-y divide-info-border/40">
            {advisoryTriggers.slice(0, 4).map((i) => (
              <li key={i.id} className="px-4 py-2.5">
                <p className="text-sm text-ink-900 font-medium">{i.title}</p>
                <p className="text-xs text-ink-700 mt-0.5">{i.detail}</p>
                <p className="text-2xs italic text-info-ink/80 mt-1">
                  This is the kind of opportunity advisory work is built on.
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Layer B: churn risk — early-warning surface so the partner can
          schedule a check-in BEFORE the client leaves quietly. */}
      {showChurnRisk && (
        <div className="bg-warn-bg/40 border border-warn-border rounded-md px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xs uppercase tracking-wider text-warn-ink font-semibold">
              Churn risk
            </span>
            <span className="text-2xs text-warn-ink/70">
              {churnRiskScore >= 4 ? "high" : "elevated"}
            </span>
          </div>
          <p className="text-sm text-ink-900 font-medium mt-1">
            Schedule a check-in
          </p>
          <p className="text-xs text-ink-700 mt-0.5">
            {churnRiskSignals(churnRiskScore)}
          </p>
        </div>
      )}

      {/* Mode B / aggregated facts — shown only if no advisory items, since
          they're more ambient than actionable. */}
      {advisoryTriggers.length === 0 && facts.length > 0 && (
        <div className="bg-surface border border-line rounded-md px-4 py-2 text-xs text-ink-500">
          {facts.length} prior-year facts imported · personalised AI active.
        </div>
      )}
    </div>
  );
}

/** Wireframe heuristic for churn risk. Real implementation per PRD §4.4
 *  Layer B uses response-time trends + declined-advisory count + reduced
 *  service-package count. Here we stub it deterministically off clientId. */
function computeChurnRiskScore(clientId: string, openInsightCount: number): number {
  // Use a deterministic per-client seed so demo is stable.
  const seed = clientId
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = seed % 5; // 0..4
  return base + (openInsightCount > 1 ? 1 : 0);
}

function churnRiskSignals(score: number): string {
  if (score >= 4)
    return "Response time slowed 60% over 3 months · declined last 2 advisory suggestions · dropped 2 services last year. Strong signal — reach out this week.";
  if (score >= 3)
    return "Response time slowed · declined a recent advisory suggestion. Soft signal — worth a quick check-in.";
  return "Slight pattern change in engagement. Keep an eye on it.";
}

/**
 * Documents tab — IA §3.3. Longitudinal table: rows = document types,
 * columns = tax years. Each cell shows whether the doc was received in
 * that year. Powers the "did we have this last year" Mode E surface.
 */
function DocumentsTab({ client }: { client: Client }) {
  const facts = useImportedFactsForClient(client.id);
  const tasks = useTasksForClient(client.id);
  const checklistsByTaskId = useStore().checklistItems;
  const currentYear = new Date().getFullYear();

  // Collect all item types seen across prior facts + current checklists
  const allTypes = new Map<string, string>(); // itemType -> nice label
  for (const f of facts) {
    if (!allTypes.has(f.itemType)) {
      allTypes.set(f.itemType, f.itemType.replace(/_/g, " "));
    }
  }
  for (const ci of checklistsByTaskId) {
    if (!tasks.some((t) => t.id === ci.taskId)) continue;
    if (!allTypes.has(ci.itemType)) {
      allTypes.set(ci.itemType, ci.label);
    }
  }
  const types = Array.from(allTypes.entries());

  // Years: current + 3 priors
  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  if (types.length === 0) {
    return (
      <div className="bg-surface border border-line rounded-lg p-6 text-center text-sm text-ink-500">
        No document history yet.
        <p className="mt-1 text-xs">
          Connect QuickBooks or import a prior-year return to populate this view.
        </p>
      </div>
    );
  }

  function cellFor(itemType: string, year: number): "received" | "missing" | "current" {
    if (year === currentYear) {
      // From current task checklists
      const current = checklistsByTaskId.find(
        (ci) =>
          ci.itemType === itemType &&
          tasks.some((t) => t.id === ci.taskId) &&
          (ci.state === "received_confirmed" ||
            ci.state === "received_unreviewed" ||
            ci.state === "received_issue")
      );
      return current ? "current" : "missing";
    }
    const had = facts.some((f) => f.itemType === itemType && f.year === year);
    return had ? "received" : "missing";
  }

  return (
    <div className="bg-surface border border-line rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-line">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-700">
          Documents · longitudinal view
        </h3>
        <p className="text-xs text-ink-500 mt-1">
          Rows are document types. Columns are tax years. Highlights gaps where
          last year had a doc and this year doesn't (Mode E).
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-sunken/40 border-b border-line">
            <tr>
              <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-ink-500 font-semibold w-1/3">
                Document
              </th>
              {years.map((y) => (
                <th
                  key={y}
                  className="text-center px-4 py-2 text-xs uppercase tracking-wider text-ink-500 font-semibold"
                >
                  {y === currentYear ? `${y} (current)` : y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {types.map(([itemType, label]) => (
              <tr key={itemType}>
                <td className="px-4 py-2 text-ink-900 capitalize">{label}</td>
                {years.map((y) => {
                  const c = cellFor(itemType, y);
                  return (
                    <td key={y} className="px-4 py-2 text-center">
                      {c === "received" && (
                        <span className="text-ok-ink">●</span>
                      )}
                      {c === "current" && (
                        <span className="text-info-ink">●</span>
                      )}
                      {c === "missing" && (
                        <span className="text-ink-300">○</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 text-2xs text-ink-400 border-t border-line flex items-center gap-3">
        <span>
          <span className="text-ok-ink">●</span> received (prior)
        </span>
        <span>
          <span className="text-info-ink">●</span> received (this year)
        </span>
        <span>
          <span className="text-ink-300">○</span> missing
        </span>
      </div>
    </div>
  );
}

