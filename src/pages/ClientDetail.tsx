import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ClipboardList,
  Brain,
  Sparkles,
  CircleCheck,
  Mail,
  Pin,
  Siren,
  Check,
  CheckCircle2,
  Plus,
  Pencil,
  Hourglass,
  Star,
  Archive,
  ArrowLeftRight,
  StickyNote,
  Tag,
  Send,
  Inbox,
  FileText,
  AlertTriangle,
  Bot,
  Pause,
  type LucideIcon,
} from "lucide-react";
import { actions, useStore } from "../data/store";
import { trpc } from "../lib/api/client";
import { env } from "../config";
import {
  useAddNote,
  useArchiveClient,
  useClient,
  useUpdateClient,
} from "../hooks/useClients";
import { useDeadlinesForClient } from "../hooks/useDeadlines";
import { useTasksForClient } from "../hooks/useTasks";
import {
  useAiInsightsForClient,
  useImportedFactsForClient,
} from "../hooks/useAiInsights";
import { PageSkeleton } from "../components/skeletons/DashboardSkeleton";
import { ErrorState } from "../components/ErrorState";
import { daysBetween, formatLongDate, parseDate, TODAY } from "../data/dateHelpers";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  AddDeadlineModal,
  type AddDeadlinePrefill,
} from "../components/AddDeadlineModal";
import { FilingsTab } from "../components/FilingsTab";
import { EditClientModal } from "../components/EditClientModal";
import { ExportModal } from "../components/ExportModal";
import { ExportClientsButton } from "../components/ExportClientsButton";
import { PinClientButton } from "../components/Sidebar";
import { BackLink } from "../components/ui/BackLink";
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

// IA v0.8 amendment 2026-05-05 — Engagement tab retired.
//
// The Engagement tab showed: a 5-dot relationship-score gauge (stub
// heuristic, decorative), tier/packages/since meta (now in header
// meta line), notes pointer (already in primary tab strip), and the
// same open-deadline list that To Do already shows. Three views of
// four deadlines under three tabs was redundancy, not separation.
// Tier + since + deadline counts now live as a meta line under the
// client name; the gauge is gone (it was measuring nothing real).
//
// Tab strip: To Do | Filings | Mailbox | Notes
// Held over for deep-link compatibility but routed via overflow menu:
// documents / contacts / audit.
//
// Engagement tab key still mapped for `?tab=engagement` URLs that
// existed in the wild — it silently aliases to "todo".
type Tab =
  | "todo"
  | "filings"
  | "mailbox"
  | "notes"
  | "engagement"
  | "documents"
  | "contacts"
  | "audit";

/**
 * Pretty-print an entity_type enum value (`s_corp`, `c_corp`, `non_profit`)
 * for the header badge. Mirrors the canonical display strings the seed
 * data + the FE form dropdowns use ("S-Corp", "C-Corp", "Non-Profit"),
 * so users see a familiar label rather than the SQL spelling.
 */
function entityTypeDisplay(et: string): string {
  switch (et) {
    case "individual":
      return "Individual";
    case "llc":
      return "LLC";
    case "s_corp":
      return "S-Corp";
    case "c_corp":
      return "C-Corp";
    case "partnership":
      return "Partnership";
    case "trust":
      return "Trust";
    case "non_profit":
      return "Non-Profit";
    default:
      return et;
  }
}

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const clientQuery = useClient(id);
  const deadlinesQuery = useDeadlinesForClient(id);
  const client = clientQuery.data ?? null;
  const deadlines = deadlinesQuery.data ?? [];
  const archiveClientMut = useArchiveClient();
  const [tab, setTab] = useState<Tab>("todo");
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
  const activeDeadlineCount = clientDeadlines.filter(
    (d) => d.status !== "completed" && d.status !== "filed_extension"
  ).length;
  // "Working on" — the distinct formTypes among active deadlines. Used
  // to badge the client header so the CPA can read at-a-glance which
  // filings the firm is in the middle of for this client.
  const workingOnFormTypes = Array.from(
    new Set(
      clientDeadlines
        .filter((d) => d.status !== "completed" && d.status !== "filed_extension")
        .map((d) => d.form),
    ),
  );

  const onArchiveConfirm = () => {
    if (env.useMockData) {
      actions.archiveClient(client.id);
    } else {
      // Real mode hits clients.archive — onSuccess invalidates the
      // clients cache so the list view drops this row on next render.
      archiveClientMut.mutate({ id: client.id });
    }
    setArchiveOpen(false);
    navigate("/clients");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
      <BackLink fallback="/clients" fallbackLabel="Clients" />


      <div className="mt-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-ink-900">
              {client.name}
            </h1>
            {/* Entity-type badge — replaces the old comma-separated meta
                line. The dot-separated `s_corp · Texas · active · Added —`
                pattern was decorative noise; the data lives in the badge
                row and AI summary below. */}
            <span
              className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-sunken text-ink-700 border border-line"
              title="Entity type"
            >
              {entityTypeDisplay(client.entityType)}
            </span>
            <StateChipGroup
              primary={client.primaryState}
              nexus={client.nexusStates}
            />
            {/* "Working on" badge — the filings the firm is currently
                executing for this client. Pulls from active (not-completed,
                not-extended) deadlines, deduped by formType. Caps at 3 +
                "+N more" so a packed roster doesn't break the line. */}
            {workingOnFormTypes.length > 0 && (
              <span
                className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-info-bg text-info-ink border border-info-border"
                title="Active filings the firm is currently executing"
              >
                Working on: {workingOnFormTypes.slice(0, 3).join(", ")}
                {workingOnFormTypes.length > 3 && ` +${workingOnFormTypes.length - 3}`}
              </span>
            )}
            {client.status === "archived" && (
              <span className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-sunken text-ink-500">
                Archived
              </span>
            )}
          </div>
          {/* Engagement meta line — replaces the dropped Engagement tab.
              Surfaces the contract scope axes the user reads at-a-glance:
              tier · service packages · open deadline counts · since.
              All read-only; deeper edits live in the modals (Edit /
              service package settings). */}
          <div className="mt-2 text-xs text-ink-500 flex items-center flex-wrap gap-x-2 gap-y-1">
            <span>
              <span className="text-ink-400">Tier</span>{" "}
              <span className="text-ink-700 font-medium capitalize">
                {client.tier ?? "standard"}
              </span>
            </span>
            <span className="text-ink-300" aria-hidden>·</span>
            {client.servicePackages.length > 0 ? (
              <span className="inline-flex items-center gap-1">
                <span className="text-ink-400">
                  {client.servicePackages.length === 1
                    ? "Package"
                    : "Packages"}
                </span>
                {client.servicePackages.map((p) => (
                  <PackageChip key={p} packageName={p} client={client} />
                ))}
              </span>
            ) : (
              <span>
                <span className="text-ink-400">Packages</span>{" "}
                <span className="text-ink-500">— none assigned</span>
              </span>
            )}
            <span className="text-ink-300" aria-hidden>·</span>
            <span>
              <span className="text-ink-400">Open deadlines</span>{" "}
              <span className="text-ink-700 font-medium tabular-nums">
                {clientDeadlines.filter(
                  (d) =>
                    d.status !== "completed" &&
                    d.status !== "filed_extension",
                ).length}
              </span>
            </span>
            <span className="text-ink-300" aria-hidden>·</span>
            <span>
              <span className="text-ink-400">Since</span>{" "}
              <span className="text-ink-700">{addedAtLabel}</span>
            </span>
          </div>
          {/* AI behaviour summary — placeholder until the BE composer
              ships. Phase 2 derives the sentence from activity_events:
              avg response time to chases, extension history, mode A
              confidence rates, pushback frequency. Override persists
              on clients.ai_summary_override. */}
          <ClientAiSummary client={client} />
        </div>
        <PinClientButton clientId={client.id} />
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
        {/* Tab order — IA v0.7 §3.3 amendment 2026-05-04: To Do leads
            because it's the only tab the CPA actually opens during the
            day (chase / confirm / send). Engagement = contract/scope
            (what we're paid to do); Filings = past + current + projected
            timeline; Habits + Predictions fold into Filings as the
            "Multi-year patterns" section since they describe the same
            history axis. Notes promoted from sub-section to a real tab
            so firm-internal memory has its own destination. */}
        {(
          [
            ["todo", "To Do", CircleCheck],
            ["filings", "Filings", ClipboardList],
            ["mailbox", "Mailbox", Mail],
            ["notes", "Notes", Brain],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm ${
              tab === key
                ? "text-ink-900 border-b-2 border-ink-900 font-medium"
                : "text-ink-500 hover:text-ink-700"
            }`}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden />
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
        {tab === "todo" && (
          <ToDoTab
            client={client}
            allDeadlines={clientDeadlines}
            onAddDeadline={() => setAddDeadlineOpen(true)}
            onOpenDocuments={() => setTab("documents")}
          />
        )}
        {/* Engagement tab retired 2026-05-05 — see type Tab comment.
            Existing ?tab=engagement deep links silently route to todo. */}
        {tab === "engagement" && (
          <ToDoTab
            client={client}
            allDeadlines={clientDeadlines}
            onAddDeadline={() => setAddDeadlineOpen(true)}
            onOpenDocuments={() => setTab("documents")}
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
        {tab === "mailbox" && <MailboxTab client={client} />}
        {tab === "notes" && <NotesTab client={client} />}
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
  const notes = client.noteEntries ?? [];
  const addNoteMutation = useAddNote();

  // Sort: pinned first, then newest. Search field removed per
  // 2026-05-04 feedback — notes are short and few; the timeline is
  // the search affordance. Cmd+F still works in-page if needed.
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [notes]);

  const onAdd = () => {
    const body = draft.trim();
    if (!body) return;
    if (env.useMockData) {
      actions.addNote(client.id, body);
    } else {
      addNoteMutation.mutate({ clientId: client.id, body });
    }
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
            className="text-xs px-3 py-1.5 rounded bg-indigo text-white hover:bg-indigo-hover disabled:opacity-40"
          >
            Add note
          </button>
        </div>
      </div>

      {sortedNotes.length === 0 ? (
        <div className="bg-surface border border-line rounded-lg p-6 text-center text-sm text-ink-500">
          No notes yet. Add your first above.
        </div>
      ) : (
        <ul className="space-y-2">
          {sortedNotes.map((n) => (
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
          <span className="inline-flex items-center gap-1 text-warn-ink font-medium">
            <Pin className="w-3 h-3" aria-hidden />
            Pinned
          </span>
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

const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  status_change: Check,
  deadline_added: Plus,
  deadline_updated: Pencil,
  extension_filed: Hourglass,
  client_created: Star,
  client_edited: Pencil,
  client_archived: Archive,
  batch_adjust: ArrowLeftRight,
  note_added: StickyNote,
  bundle_assigned: Tag,
  email_sent: Send,
  email_received: Inbox,
  document_received: FileText,
  document_confirmed: CheckCircle2,
  document_flagged: AlertTriangle,
  ai_inferred: Bot,
  checklist_state_change: CircleCheck,
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
  const Icon = ACTIVITY_ICONS[entry.type] ?? CircleCheck;
  return (
    <li className="px-4 py-2.5 flex items-start gap-3">
      <span className="w-5 flex items-center justify-center text-ink-400">
        <Icon className="w-3.5 h-3.5" aria-hidden />
      </span>
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

// EngagementTab removed 2026-05-05 per dogfooding feedback —
// the tab duplicated content already shown in To Do (gap signals)
// and Filings (deadline counts), and the relationship score / verdict
// block was reimplementable as inline meta on the client header. Tier,
// packages, open deadlines and "since" now live in the meta line right
// under the client name. Deep links with `?tab=engagement` are aliased
// to `?tab=todo` (see resolveActiveTab below) for back-compat.

// HabitsTab + PredictionsTab removed 2026-05-04 per IA amendment —
// multi-year patterns + per-client expected timeline now live as
// sub-sections inside FilingsTab (the "Multi-year patterns" block).
// They described the same history axis and didn't earn separate tabs.
// To restore historic-only deep-link compatibility, /clients/:id?tab=habits
// would need to redirect to ?tab=filings#patterns, but the URL contract
// was internal-only so we don't gate the change on it.

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
  const { checklistItems: storeChecklistItems, tasks: storeTasks } = useStore();
  // ── Source-of-truth fix (2026-05-05) ───────────────────────────────────
  // Today's Action Queue reads from trpc.todoItems.list (BE-aggregated).
  // ToDoTab used to read from useStore().checklistItems which is empty
  // in real mode, so the same client showed "7 items / Send 4 reminders"
  // on Today and "0 items / Nothing waiting" here. Same query now powers
  // both surfaces.
  const todoQuery = trpc.todoItems.list.useQuery({ limit: 200 });
  const liveTodoItems = todoQuery.data?.items ?? [];
  // Mode B rows include a per-checklist-item snapshot. Flatten across
  // every TodoItem that belongs to this client, attaching the parent
  // task metadata so the per-item rows can render formType/jurisdiction
  // exactly the way Today's expanded panel does.
  type WaitingItem = {
    id: string;
    label: string;
    state:
      | "not_requested"
      | "requested_waiting"
      | "received_unreviewed"
      | "received_confirmed"
      | "received_issue"
      | "not_applicable";
    taskId?: string;
    taskName?: string;
    dueDate?: string;
    lastReminderAt?: string;
  };

  const liveItems = useMemo<WaitingItem[]>(() => {
    const out: WaitingItem[] = [];
    for (const it of liveTodoItems) {
      if (it.clientId !== client.id) continue;
      const ci = (it as { checklistItems?: WaitingItem[] }).checklistItems;
      if (ci && ci.length > 0) {
        for (const c of ci) {
          out.push({
            id: c.id,
            label: c.label,
            state: c.state,
            taskId: it.taskId,
            taskName: it.task,
            dueDate: it.dueDate,
          });
        }
      } else if (
        it.verb === "Confirm" ||
        it.source === "mode_a_inbound" ||
        it.source === "mode_c_anomaly"
      ) {
        // Confirm/anomaly TodoItems carry a single checklist item in
        // their action; expose as one row.
        out.push({
          id: it.id,
          label: it.action.replace(/^[^·]+·\s*/, ""),
          state:
            it.source === "mode_c_anomaly" ? "received_issue" : "received_unreviewed",
          taskId: it.taskId,
          taskName: it.task,
          dueDate: it.dueDate,
        });
      }
    }
    return out;
  }, [liveTodoItems, client.id]);

  // Mock-mode fallback: read raw checklistItems from the store. Only
  // used when env.useMockData is true; real mode trusts the BE.
  const taskIds = useMemo(
    () => storeTasks.filter((t) => t.clientId === client.id).map((t) => t.id),
    [storeTasks, client.id],
  );
  const tasksByIdMap = useMemo(() => {
    const m = new Map<string, (typeof storeTasks)[number]>();
    for (const t of storeTasks) if (taskIds.includes(t.id)) m.set(t.id, t);
    return m;
  }, [storeTasks, taskIds]);
  const taskIdSet = useMemo(() => new Set(taskIds), [taskIds]);
  const mockItems = useMemo<WaitingItem[]>(
    () =>
      storeChecklistItems
        .filter((ci) => taskIdSet.has(ci.taskId))
        .map((ci) => {
          const task = tasksByIdMap.get(ci.taskId);
          return {
            id: ci.id,
            label: ci.label,
            state: ci.state,
            taskId: ci.taskId,
            taskName: task
              ? [task.formType, task.jurisdiction].filter(Boolean).join(" · ")
              : undefined,
            lastReminderAt: ci.lastReminderAt ?? undefined,
          };
        }),
    [storeChecklistItems, taskIdSet, tasksByIdMap],
  );
  const items = env.useMockData ? mockItems : liveItems;

  const stillWaiting = items.filter(
    (ci) => ci.state === "requested_waiting" || ci.state === "not_requested",
  );
  const needsReview = items.filter(
    (ci) => ci.state === "received_unreviewed" || ci.state === "received_issue",
  );
  const completeCount = items.filter(
    (ci) => ci.state === "received_confirmed" || ci.state === "not_applicable",
  ).length;

  // Sort waiting by oldest reminder first (gap-over-fill). Items
  // without a lastReminderAt (i.e. not_requested) sort to the bottom
  // since they haven't started the loop yet.
  const waitingSorted = [...stillWaiting].sort((a, b) => {
    const at = a.lastReminderAt ? new Date(a.lastReminderAt).getTime() : Infinity;
    const bt = b.lastReminderAt ? new Date(b.lastReminderAt).getTime() : Infinity;
    return at - bt;
  });

  const taskHref = (taskId?: string) =>
    taskId ? `/clients/${client.id}/tasks/${taskId}` : `/clients/${client.id}`;

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
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-warn-ink"
          >
            <Siren className="w-4 h-4" aria-hidden />
            Still waiting on client
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
                  <span className="text-warn-ink shrink-0 flex items-center">
                    {ci.state === "requested_waiting" ? (
                      <Hourglass className="w-3.5 h-3.5" aria-hidden />
                    ) : (
                      <Pause className="w-3.5 h-3.5" aria-hidden />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-900 truncate">
                      {ci.label ?? "Item"}
                    </p>
                    <p className="text-2xs text-ink-500 truncate">
                      {ci.taskName ?? "—"}
                      {days != null && ` · last reminder ${days}d ago`}
                      {ci.state === "not_requested" &&
                        " · First reminder pending"}
                    </p>
                  </div>
                  {/* Honest label: this navigates to TaskDetail (where
                      the EmailDraftModal lives) — it does NOT compose
                      from here. The arrow ↗ communicates the navigate.
                      Earlier copy "Send reminder ↗" / "Request now ↗"
                      promised an inline send the link can't deliver,
                      so users hit a dead end. Once the per-row inline
                      composer is wired, this can flip back to the
                      action-verb labels with a real onClick. */}
                  <Link
                    to={taskHref(ci.taskId)}
                    className="text-2xs px-2 py-1 rounded border border-line bg-surface text-ink-700 hover:bg-sunken shrink-0"
                    title={
                      ci.state === "requested_waiting"
                        ? "Open task to send a reminder"
                        : "Open task to request this item"
                    }
                  >
                    Open task ↗
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
            <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900">
              <AlertTriangle className="w-4 h-4 text-warn-ink" aria-hidden />
              Needs your review
            </h3>
            <span className="text-2xs text-ink-500 tabular-nums">
              {needsReview.length} item{needsReview.length === 1 ? "" : "s"}
            </span>
          </header>
          <ul className="divide-y divide-line">
            {needsReview.map((ci) => (
              <li key={ci.id} className="flex items-baseline gap-3 px-4 py-2.5">
                <span className="shrink-0 flex items-center">
                  {ci.state === "received_issue" ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-warn-ink" aria-hidden />
                  ) : (
                    <Inbox className="w-3.5 h-3.5 text-ink-500" aria-hidden />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-900 truncate">{ci.label}</p>
                  <p className="text-2xs text-ink-500 truncate">
                    {ci.taskName ?? "—"}
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

      <p className="inline-flex items-center gap-1 text-2xs text-ink-400">
        <Check className="w-3 h-3" aria-hidden />
        {completeCount} item{completeCount === 1 ? "" : "s"} complete this tax
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
          <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900">
            <Inbox className="w-4 h-4" aria-hidden />
            Inbox
          </h3>
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
          <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900">
            <Send className="w-4 h-4" aria-hidden />
            Outbox
          </h3>
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
          <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900">
            <StickyNote className="w-4 h-4" aria-hidden />
            Drafts
          </h3>
          <span
            className="inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded-full border border-info-border bg-info-bg text-info-ink"
            title="Mode D — drafts wait for your review before send."
          >
            <Sparkles className="w-3 h-3" aria-hidden />
            AI drafted
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

/**
 * AI-generated client behaviour summary. Phase 1 placeholder — Phase 2
 * wires this to a server-side composer that derives 2-3 sentences from
 * the firm's activity_events for this client:
 *
 *   • avg response time to chase emails (inbound_replies vs email_drafts)
 *   • reminder-to-receipt ratio (how many chases per item received)
 *   • Mode A confidence rate (avg aiConfidence on classified docs)
 *   • extension history (count of tasks.status === "filed_extension")
 *   • pushback frequency (replyIntent === "timeline_pushback" rate)
 *   • mismatched-attachment rate (replyIntent === "mismatched_attachment")
 *   • bounce rate on outbound to this client
 *   • AI insight resolution rate (Mode E aiInferences.wasActedOn)
 *
 * The CPA can edit the auto-text manually; the override persists to
 * `clients.ai_summary_override` (Phase 2 schema). Until the composer
 * lands, this renders a static placeholder so the UI isn't empty —
 * better than a hidden affordance the user can't discover.
 */
function ClientAiSummary({ client }: { client: Client }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const updateClientMut = useUpdateClient();
  // Stub composer — picks a contextual placeholder based on tier so
  // demos read naturally. Phase 2 replaces this with the real signal-
  // composed sentence from the BE.
  const placeholder =
    client.tier === "premium"
      ? "Premium engagement — fast responder, clean quarterly handoffs. Watch for K-1 lag in March."
      : client.tier === "custom"
        ? "Custom-scoped engagement — review the package details before kicking off the next filing."
        : "Reliable filer — no recent flags. Insights will refine here as activity accumulates.";
  const summary = client.aiSummaryOverride ?? placeholder;

  if (editing) {
    return (
      <section className="mt-2 bg-info-bg border border-info-border rounded-md p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full text-sm bg-surface border border-line rounded px-2 py-1.5 text-ink-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            onClick={() => setEditing(false)}
            className="text-xs px-2.5 py-1 rounded text-ink-500 hover:text-ink-900"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const next = draft.trim() || null;
              if (env.useMockData) {
                actions.updateClient(client.id, { aiSummaryOverride: next });
              } else {
                // Real mode persists via clients.update — the patch
                // shape on the BE accepts aiSummaryOverride (added in
                // the same change that introduced this UI). On success
                // useUpdateClient invalidates clients.get so the
                // header re-reads the new override.
                updateClientMut.mutate({
                  id: client.id,
                  patch: { aiSummaryOverride: next },
                });
              }
              setEditing(false);
            }}
            className="text-xs px-2.5 py-1 rounded bg-accent text-canvas hover:bg-accent-hover"
          >
            Save
          </button>
        </div>
        <p className="mt-1.5 text-2xs text-ink-500">
          Manual override — replaces the auto-generated summary until you
          clear it. Phase 2: regenerate from latest activity nightly.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-2 bg-info-bg/40 border border-info-border/60 rounded-md p-3 flex items-start gap-2">
      <Sparkles
        className="w-3.5 h-3.5 text-info-ink shrink-0 translate-y-0.5"
        aria-hidden
      />
      <p className="flex-1 text-sm text-ink-700 leading-relaxed italic">
        {summary}
      </p>
      <button
        onClick={() => {
          setDraft(summary);
          setEditing(true);
        }}
        className="text-2xs text-ink-500 hover:text-ink-900 underline shrink-0"
        title={
          client.aiSummaryOverride
            ? "Edit your override"
            : "Edit and override the AI-generated summary"
        }
      >
        Edit
      </button>
    </section>
  );
}

