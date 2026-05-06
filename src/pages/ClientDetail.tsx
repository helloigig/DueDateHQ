import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
  Phone,
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
  Megaphone,
  ChevronRight,
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
import { useAnnouncements } from "../hooks/useAnnouncements";
import { useDeadlinesForClient } from "../hooks/useDeadlines";
import { useTasksForClient } from "../hooks/useTasks";
import {
  useAiInsightsForClient,
  useImportedFactsForClient,
} from "../hooks/useAiInsights";
import { PageSkeleton } from "../components/skeletons/DashboardSkeleton";
import { ErrorState } from "../components/ErrorState";
import {
  formatLongDate,
  formatShortDate,
  parseDate,
  TODAY,
} from "../data/dateHelpers";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  AddDeadlineModal,
  type AddDeadlinePrefill,
} from "../components/AddDeadlineModal";
import { FilingsTab } from "../components/FilingsTab";
import { TaskPanel } from "../components/TaskPanel";
import { EditClientModal } from "../components/EditClientModal";
import { ExportModal } from "../components/ExportModal";
import { ExportClientsButton } from "../components/ExportClientsButton";
import { PinClientButton } from "../components/Sidebar";
import { BackLink } from "../components/ui/BackLink";
import { PageContainer } from "../components/ui/PageContainer";
import { StateBadge } from "../components/ui/StateBadge";
import { StateChipGroup } from "../components/StateChipGroup";
import { ClientChip } from "../components/ClientChip";
import { STATE_NAMES, type StateCode } from "../types";
import { bundleByName, type FilingBundle } from "../data/bundles";
import { resolveFederalForm } from "../data/canonicalForm";
import type {
  ActivityEntry,
  ActivityType,
  Client,
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
// Tab strip: Work | Mailbox | Notes
// Held over for deep-link compatibility but routed via overflow menu:
// documents / contacts / audit.
//
// Yuqi audit 2026-05-06: To Do + Filings merged into a single "Work"
// tab. The two former tabs were two views of the same task set —
// To Do filtered to "still waiting / needs review" docs, Filings
// listed deadlines + status pills — and forced the user to swap tabs
// to reconcile "what's the plan" vs "what's blocking it." Work
// renders the filing list (calendar-truth structure) AND the doc
// checklist (action-truth) on one surface so the relationship is
// visible without tab-swapping.
//
// `todo`, `filings`, and `engagement` are kept as URL aliases so old
// deep links (?tab=todo, ?tab=filings, ?tab=engagement) silently
// route to `work` instead of 404'ing.
type Tab =
  | "work"
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
  const [tab, setTab] = useState<Tab>("work");
  // Tracks whether the user explicitly clicked a tab. Once true, the
  // default-tab effect below stops auto-switching — Sarah's manual
  // selection wins. Yuqi audit 2026-05-05: "if To Do is empty, default
  // to Filings tab."
  const tabExplicitRef = useRef(false);
  const onTabChange = (next: Tab) => {
    tabExplicitRef.current = true;
    setTab(next);
  };
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addDeadlineOpen, setAddDeadlineOpen] = useState(false);
  const [addDeadlinePrefill, setAddDeadlinePrefill] = useState<
    AddDeadlinePrefill | undefined
  >(undefined);
  const [exportOpen, setExportOpen] = useState(false);
  // Year + Form header filters retired 2026-05-06 — they were
  // duplicating axis-within-client navigation that the Filings tab's
  // own grouping already covers. `filteredDeadlines` (below) keeps
  // its name as a pass-through alias so the To Do / Filings / Mailbox
  // tabs that consume it don't change their prop contracts.

  // Default tab is always Work post-merge (To Do + Filings collapsed
  // into one surface, so there's no longer a "swap to Filings when
  // To Do is empty" branch to implement).

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
      <PageContainer variant="wide">
        <ErrorState
          title="Couldn't load this client."
          message={
            clientQuery.error instanceof Error
              ? clientQuery.error.message
              : undefined
          }
          onRetry={() => clientQuery.refetch()}
        />
      </PageContainer>
    );
  }

  if (!client) {
    return (
      <PageContainer variant="wide">
        <Link to="/clients" className="text-sm text-ink-500 hover:underline">
          ‹ Clients
        </Link>
        <p className="mt-6 text-ink-700">Client not found.</p>
      </PageContainer>
    );
  }

  const addedAtLabel = formatLongDate(client.addedAt);
  const activeDeadlineCount = clientDeadlines.filter(
    (d) => d.status !== "completed" && d.status !== "filed_extension"
  ).length;
  // Header summary — Yuqi audit 2026-05-06: previous version listed every
  // active form by name ("PA RCT-101 (corporate), PA RCT-101 (final),
  // 1120 (extension)") which duplicated the Filings tab line-for-line.
  // The header should be a glance-level summary; the per-form detail
  // belongs in the Work tab. Compute the soonest official due date so
  // the header carries the "next thing on the calendar" instead.
  const activeDeadlines = clientDeadlines.filter(
    (d) => d.status !== "completed" && d.status !== "filed_extension",
  );
  const nextDueDate = activeDeadlines
    .map((d) => d.officialDueDate)
    .sort()[0];

  // Pass-through alias — header filters retired; tabs still consume
  // `filteredDeadlines` by name.
  const filteredDeadlines = clientDeadlines;

  // Per-client KPIs — match the shape of Timeline's stat strip so the
  // user trains on one mental model across the two surfaces. Computed
  // off `clientDeadlines` (unfiltered) because the stats describe the
  // CLIENT's overall state, not the currently-filtered slice.
  //   - behind: deadlines past internal target, still active
  //   - extended: deadlines that filed an extension (active but
  //     paused at the IRS-extended date)
  //   - active: not-completed, not-extended (open work)
  // Phase 1 — `awaiting docs` would require checklist data which is
  // already used elsewhere in the component but not aggregated here;
  // surfacing later via TaskActivityTimeline inputs.
  const kpis = (() => {
    let behind = 0;
    let extended = 0;
    let active = 0;
    for (const d of clientDeadlines) {
      if (d.status === "completed") continue;
      if (d.status === "filed_extension") {
        extended++;
        continue;
      }
      active++;
      if (d.internalDueDate) {
        const internal = parseDate(d.internalDueDate);
        if (!Number.isNaN(internal.getTime()) && internal < TODAY) {
          behind++;
        }
      }
    }
    return { active, behind, extended };
  })();

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

  // Back-link target — preserves the originating surface when the user
  // arrived from a non-/clients context. Yuqi audit 2026-05-06: clicking
  // a client chip on /alerts/:id used to land here with no return path
  // beyond the browser back button; the back link said "Back to
  // Clients" regardless of how the user got here. Now: if the URL
  // carries `?fromAlert=:id`, the link points back at that alert.
  const fromAlertId = searchParams.get("fromAlert");
  const backFallback = fromAlertId ? `/alerts/${fromAlertId}` : "/clients";
  const backLabel = fromAlertId ? "alert" : "Clients";

  return (
    <PageContainer variant="wide">
      <BackLink fallback={backFallback} fallbackLabel={backLabel} />


      {/* Header redesign 2026-05-06.
          Row 1 — identity (name + entity + states + archived) on the left;
                  action group (pin / export / edit / archive / + Add deadline)
                  on the right. Three previously-separate strips (tier-package-
                  since, contact, stat) collapse into the 2-column body block
                  below. */}
      <div className="mt-3 flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <ClientChip
              client={client}
              size="lg"
              as="span"
              showTier={false}
              showState={false}
            />
            <span
              className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-info-bg/60 text-info-ink border border-info-border font-semibold"
              title="Entity type"
            >
              {entityTypeDisplay(client.entityType)}
            </span>
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
        </div>
        {/* Action group — Pin / Export / Edit collapsed to icon-only (canonical
            tooltips + aria-labels carry the affordance); Archive stays text
            (destructive); + Add deadline is the primary CTA in indigo. */}
        <div className="flex flex-wrap items-center gap-1 shrink-0">
          <PinClientButton clientId={client.id} />
          <ExportClientsButton clientId={client.id} iconOnly />
          <button
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-ink-500 hover:text-ink-900 hover:bg-sunken transition-colors"
            title="Edit client"
            aria-label="Edit client"
          >
            <Pencil className="w-4 h-4" aria-hidden />
          </button>
          <button
            onClick={() => setArchiveOpen(true)}
            disabled={client.status === "archived"}
            className="ml-1 text-sm px-3 py-1.5 rounded-md border border-line hover:bg-sunken/40 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Archive
          </button>
          <button
            onClick={() => {
              setAddDeadlinePrefill(undefined);
              setAddDeadlineOpen(true);
            }}
            className="text-sm px-3 py-1.5 rounded-md bg-indigo text-white hover:bg-indigo-hover inline-flex items-center gap-1.5 shadow-sm"
            title="Add a new deadline / task for this client"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden />
            Add deadline
          </button>
        </div>
      </div>

      {/* Header body — meta line + working-on row. The right-rail
          ClientAiSummaryCard ("AI generated based on history" + "X prior-
          year facts on file") was dropped 2026-05-06: the copy was meta-
          narration about AI rather than a concrete signal, mirrored
          forever-no-list "AI is learning" pattern, and ate header
          real estate. Concrete advisory signals already surface as
          Opportunities and inside Activity tab. */}
      <div className="mt-3 mb-region">
        <div className="min-w-0 space-y-2">
          {/* Meta row: primary service package + email-icon-button +
              phone-icon-button + "Since {date}". Email and phone collapse
              to icon-only buttons (mailto: / tel:) — saves horizontal
              space and matches the mockup. */}
          <div className="text-xs text-ink-700 flex items-center flex-wrap gap-x-2 gap-y-1">
            {client.servicePackages.length > 0 && (
              <span className="inline-flex items-center gap-1">
                {client.servicePackages.slice(0, 1).map((p) => (
                  <PackageChip key={p} packageName={p} client={client} />
                ))}
                {client.servicePackages.length > 1 && (
                  <span
                    className="text-2xs text-ink-500"
                    title={`Also: ${client.servicePackages.slice(1).join(", ")}`}
                  >
                    +{client.servicePackages.length - 1}
                  </span>
                )}
              </span>
            )}
            {client.contactEmail && (
              <a
                href={`mailto:${client.contactEmail}`}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-line text-ink-500 hover:text-ink-900 hover:bg-sunken transition-colors"
                title={`Email ${client.contactEmail}`}
                aria-label={`Email ${client.contactEmail}`}
              >
                <Mail className="w-3.5 h-3.5" aria-hidden />
              </a>
            )}
            {client.contactPhone && (
              <a
                href={`tel:${client.contactPhone}`}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-line text-ink-500 hover:text-ink-900 hover:bg-sunken transition-colors"
                title={`Call ${client.contactPhone}`}
                aria-label={`Call ${client.contactPhone}`}
              >
                <Phone className="w-3.5 h-3.5" aria-hidden />
              </a>
            )}
            {addedAtLabel && (
              <span className="text-ink-500">
                Since <span className="text-ink-700">{addedAtLabel}</span>
              </span>
            )}
          </div>

          {/* Header status line: filing count + status chip + next due
              date. Yuqi audit 2026-05-06: previous version listed every
              active form by name, duplicating the Filings tab. The
              header now reads as a glance summary ("3 filings · 1
              behind · next due May 8") so a CPA scanning the page top
              can answer "is anything wrong, what's next" without their
              eye getting pulled into a comma-separated form list. The
              per-form detail belongs in the Work tab below. */}
          {kpis.active > 0 && (
            <div className="text-sm text-ink-700 flex items-baseline flex-wrap gap-x-2 gap-y-1">
              <span className="text-ink-500">
                <span className="font-semibold text-ink-900 tabular-nums">
                  {kpis.active}
                </span>{" "}
                filing{kpis.active === 1 ? "" : "s"}
              </span>
              <span className="text-ink-300" aria-hidden>
                ·
              </span>
              {kpis.behind > 0 ? (
                <span className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded border border-warn-border bg-warn-bg/60 text-warn-ink font-medium">
                  <AlertTriangle className="w-3 h-3" aria-hidden />
                  {kpis.behind} behind
                </span>
              ) : kpis.extended > 0 ? (
                <span className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded border border-info-border bg-info-bg/60 text-info-ink font-medium">
                  <FileText className="w-3 h-3" aria-hidden />
                  {kpis.extended} on extension
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded border border-success-border bg-success-bg/60 text-success-ink font-medium">
                  <CheckCircle2 className="w-3 h-3" aria-hidden />
                  All on track
                </span>
              )}
              {nextDueDate && (
                <>
                  <span className="text-ink-300" aria-hidden>
                    ·
                  </span>
                  <span className="text-ink-500">
                    next due{" "}
                    <span className="text-ink-900 font-medium">
                      {formatLongDate(nextDueDate)}
                    </span>
                  </span>
                </>
              )}
            </div>
          )}

          {/* Override surface — only renders when the user has authored
              a manual AI summary. */}
          <ClientAiSummary client={client} />
        </div>
      </div>

      {/* Active state alerts touching this client. Without this section,
          /clients/:id was the one place in the demo where an affected
          client showed no signal of the alert affecting them — you could
          land on Suncoast Advisors with no hint that the FL hurricane
          prep extension applies. Renders null when there are no active
          alerts for this client. */}
      <ClientStateAlertsCard clientId={client.id} />

      {/* Cross-year-insighter advisory triggers + churn-risk deep callout.
          Kept below the header so they don't crowd identity, but above
          the tab strip so they're impossible to miss when present. The
          card returns null entirely when there's nothing to surface. */}
      <ClientAiInsightsCard clientId={client.id} />

      <div className="mt-5 border-b border-line flex items-center gap-1 flex-wrap relative">
        {/* Tab order — Yuqi audit 2026-05-06: Work leads (Filings + To Do
            merged). Mailbox = inbound thread / chase replies. Notes = firm-
            internal memory. Documents / Contacts / Audit log live in the
            overflow ("…") menu — referenced often enough to deep-link, not
            often enough to earn primary tab real estate. */}
        {(
          [
            ["work", "Work", ClipboardList],
            ["mailbox", "Mailbox", Mail],
            ["notes", "Notes", Brain],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm ${
              tab === key
                ? "text-ink-900 border-b-[1.5px] border-ink-900 font-medium"
                : "border-b-[1.5px] border-transparent text-ink-500 hover:text-ink-700"
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
                ? "text-ink-900 border-b-[1.5px] border-ink-900 font-medium"
                : "border-b-[1.5px] border-transparent text-ink-500 hover:text-ink-700"
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
                    onTabChange(key);
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
        {/* Work tab — merged To Do + Filings. Filings (calendar-truth
            structure) renders first to give the "where is this client
            at across all filings" overview; ToDo (action-truth) renders
            below as the per-doc chase work for whichever filings are
            currently active. They consume the same `filteredDeadlines`
            so counts always reconcile.
            Old `?tab=todo`, `?tab=filings`, and `?tab=engagement` deep
            links silently land here. */}
        {(tab === "work" ||
          tab === "todo" ||
          tab === "filings" ||
          tab === "engagement") && (
          <>
            <FilingsTab
              client={client}
              deadlines={filteredDeadlines}
              onAddDeadline={(prefill) => {
                setAddDeadlinePrefill(prefill);
                setAddDeadlineOpen(true);
              }}
            />
            <ToDoTab
              client={client}
              allDeadlines={filteredDeadlines}
              onAddDeadline={() => setAddDeadlineOpen(true)}
              onOpenDocuments={() => onTabChange("documents")}
            />
          </>
        )}
        {tab === "mailbox" && <MailboxTab client={client} />}
        {tab === "notes" && <NotesTab client={client} />}
        {tab === "documents" && <DocumentsTab client={client} />}
        {tab === "contacts" && <ContactsTab client={client} />}
        {tab === "audit" && <ActivityTab client={client} />}
      </div>

      {/* Task side panel — mounts when the URL carries `?task=:taskId`.
          Yuqi audit 2026-05-05: "I am thinking to have the task as the
          side panel to the Client detail page." Right-anchored 640px
          drawer overlays the page; close clears the query param so the
          back button + URL share work intuitively. The standalone
          /clients/:id/tasks/:taskId route stays live as a deep-link
          fallback for users who land on a task URL directly. */}
      {searchParams.get("task") && (
        <TaskPanel
          clientId={client.id}
          taskId={searchParams.get("task")!}
          onClose={() => {
            const next = new URLSearchParams(searchParams);
            next.delete("task");
            setSearchParams(next, { replace: true });
          }}
        />
      )}

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
    </PageContainer>
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
  const clientNotes = client.noteEntries ?? [];
  const addNoteMutation = useAddNote();

  // Yuqi audit 2026-05-06: the Notes tab used to show only client-spine
  // notes — task-level judgment ("K-1 will be late for this 1040")
  // was buried inside each task page, invisible from the client
  // overview. Pull the per-client task-notes aggregation from the new
  // BE endpoint so this surface shows EVERY note attached to ANY task
  // for this client + the client-level notes, in one feed. Each note
  // is tagged with its origin (Client · or Task formType) so the user
  // can tell which scope a note lives at.
  const taskNotesQuery = (
    trpc.taskNotes as unknown as {
      listForClient: {
        useQuery: (input: { clientId: string }) => {
          data?: Array<{
            id: string;
            taskId: string;
            body: string;
            pinned: boolean;
            authorName: string;
            createdAt: string;
            taskFormType: string;
            taskJurisdiction: string;
          }>;
        };
      };
    }
  ).listForClient.useQuery({ clientId: client.id });
  const taskLevelNotes = taskNotesQuery.data ?? [];

  type FeedNote = {
    id: string;
    body: string;
    pinned: boolean;
    authorName: string;
    createdAt: string;
    /** "Client" for client-spine notes, or the task's display label
     *  for per-task notes. Drives the small origin chip on each row. */
    scope: { kind: "client" } | { kind: "task"; taskId: string; label: string };
  };

  const sortedNotes = useMemo<FeedNote[]>(() => {
    const out: FeedNote[] = [];
    for (const n of clientNotes) {
      out.push({
        id: n.id,
        body: n.body,
        pinned: n.pinned,
        authorName: n.authorName,
        createdAt: n.createdAt,
        scope: { kind: "client" },
      });
    }
    for (const n of taskLevelNotes) {
      out.push({
        id: n.id,
        body: n.body,
        pinned: n.pinned,
        authorName: n.authorName,
        createdAt: n.createdAt,
        scope: {
          kind: "task",
          taskId: n.taskId,
          label: [n.taskFormType, n.taskJurisdiction].filter(Boolean).join(" · "),
        },
      });
    }
    return out.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [clientNotes, taskLevelNotes]);

  const onAdd = async () => {
    const body = draft.trim();
    if (!body) return;
    if (env.useMockData) {
      actions.addNote(client.id, body);
      toast.success("Note added");
      setDraft("");
      return;
    }
    // Real mode — await the BE so a 4xx surfaces as an error toast
    // instead of silently dropping the draft text. Yuqi audit
    // 2026-05-05: was previously fire-and-forget + clear-the-textarea,
    // which destroyed the user's typing on a network failure.
    try {
      await addNoteMutation.mutateAsync({ clientId: client.id, body });
      toast.success("Note added");
      setDraft("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't save the note.";
      toast.error(`Add note failed — ${message}`);
    }
  };
  const isAddingNote = addNoteMutation.isPending;

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
            disabled={!draft.trim() || isAddingNote}
            className="text-xs px-3 py-1.5 rounded bg-indigo text-white hover:bg-indigo-hover disabled:opacity-40"
          >
            {isAddingNote ? "Saving…" : "Add note"}
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
            <UnifiedNoteItem
              key={`${n.scope.kind}-${n.id}`}
              note={n}
              clientId={client.id}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

type FeedNoteShape = {
  id: string;
  body: string;
  pinned: boolean;
  authorName: string;
  createdAt: string;
  scope: { kind: "client" } | { kind: "task"; taskId: string; label: string };
};

function UnifiedNoteItem({
  note,
  clientId,
}: {
  note: FeedNoteShape;
  clientId: string;
}) {
  const ts = new Date(note.createdAt);
  return (
    <li
      className={`bg-surface border rounded-lg p-3 ${
        note.pinned ? "border-warn-border" : "border-line"
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-ink-500 mb-1 flex-wrap">
        {/* Origin chip — Client-spine notes get a quiet "Client" pill;
            task-level notes get a chip with the task name that links
            to TaskDetail. Yuqi audit 2026-05-06 — the Notes tab
            previously hid task notes; this chip exposes which scope
            each note lives at. */}
        {note.scope.kind === "task" ? (
          <Link
            to={`/clients/${clientId}?task=${note.scope.taskId}`}
            className="text-2xs px-1.5 py-0.5 rounded bg-info-bg/60 text-info-ink border border-info-border hover:bg-info-bg"
            title="Open the task this note belongs to"
          >
            Task · {note.scope.label}
          </Link>
        ) : (
          <span className="text-2xs px-1.5 py-0.5 rounded bg-sunken text-ink-500 border border-line">
            Client
          </span>
        )}
        {note.pinned && (
          <span className="inline-flex items-center gap-1 text-warn-ink font-medium">
            <Pin className="w-3 h-3" aria-hidden />
            Pinned
          </span>
        )}
        <span>{ts.toLocaleString("en-US")}</span>
        <span>·</span>
        <span>{note.authorName}</span>
        {/* Pin / Delete only available for client-spine notes here —
            task notes are managed from their own task page (TaskNotesPanel)
            so the per-scope mutation surface stays clean. */}
        {note.scope.kind === "client" && (
          <>
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
          </>
        )}
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
  allDeadlines: _allDeadlines,
  onAddDeadline,
}: {
  client: Client;
  /** @deprecated 2026-05-06 — the per-tab "Open deadlines" list was
   *  dropped (it duplicated the Filings tab). Prop kept on the API
   *  so existing callers don't break. */
  allDeadlines: Deadline[];
  onAddDeadline: () => void;
  onOpenDocuments: () => void;
}) {
  const { checklistItems: storeChecklistItems, tasks: storeTasks } = useStore();
  // ── Source-of-truth fix (2026-05-06) ───────────────────────────────────
  // Yuqi audit: task page said "1 of 1 items waiting", client page said
  // "Nothing waiting on this client". They disagreed because the client
  // page filtered todoItems.list — a chase-loop aggregation that
  // returns empty for fresh clients whose items haven't been requested
  // yet. The new checklists.listForClient endpoint joins
  // checklist_items → tasks → deadlines and returns the canonical
  // per-client checklist; both pages now read from the same source.
  // FE router types are stale until BE redeploys; cast through unknown.
  const checklistsQuery = (
    trpc.checklists as unknown as {
      listForClient: {
        useQuery: (input: { clientId: string }) => {
          data?: Array<{
            id: string;
            label: string;
            state:
              | "not_requested"
              | "requested_waiting"
              | "received_unreviewed"
              | "received_confirmed"
              | "received_issue"
              | "not_applicable";
            taskId: string;
            taskFormType: string;
            taskJurisdiction: string;
            taskOfficialDueDate?: string | null;
            lastReminderAt?: string | null;
          }>;
        };
      };
    }
  ).listForClient.useQuery({ clientId: client.id });
  const liveChecklistItems = checklistsQuery.data ?? [];
  // arrival-timing rows include a per-checklist-item snapshot. Flatten across
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
    return liveChecklistItems.map((ci) => ({
      id: ci.id,
      label: ci.label,
      state: ci.state,
      taskId: ci.taskId,
      taskName: [ci.taskFormType, ci.taskJurisdiction]
        .filter(Boolean)
        .join(" · "),
      dueDate: ci.taskOfficialDueDate ?? undefined,
      lastReminderAt: ci.lastReminderAt ?? undefined,
    }));
  }, [liveChecklistItems]);

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
            dueDate: task?.officialDueDate,
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

  // Group items by their parent task (one filing = one task = one
  // deadline). Yuqi audit 2026-05-05 — the previous flat list lost the
  // CPA's actual mental model: "what does THIS filing still need?"
  // Grouping by task surfaces the deadline as the unit of work. Within
  // each group, items keep insertion order from the BE (sorted by
  // checklistItems.sortOrder). Groups themselves sort by earliest
  // dueDate so the most-imminent deadline shows first.
  type WaitingGroup = {
    taskId: string | undefined;
    taskName: string;
    dueDate?: string;
    items: WaitingItem[];
    /** Most recent reminder across the group's items — feeds the
     *  per-group "Last reminder Xd ago" footer. */
    lastReminderAt?: string;
  };
  const groupByTask = (rows: WaitingItem[]): WaitingGroup[] => {
    const map = new Map<string, WaitingGroup>();
    for (const row of rows) {
      const key = row.taskId ?? "__none__";
      let g = map.get(key);
      if (!g) {
        g = {
          taskId: row.taskId,
          taskName: row.taskName ?? "Task",
          dueDate: row.dueDate,
          items: [],
          lastReminderAt: undefined,
        };
        map.set(key, g);
      }
      g.items.push(row);
      if (row.lastReminderAt) {
        if (
          !g.lastReminderAt ||
          new Date(row.lastReminderAt) > new Date(g.lastReminderAt)
        ) {
          g.lastReminderAt = row.lastReminderAt;
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const at = a.dueDate ? parseDate(a.dueDate).getTime() : Infinity;
      const bt = b.dueDate ? parseDate(b.dueDate).getTime() : Infinity;
      return at - bt;
    });
  };
  const waitingGroups = useMemo(() => groupByTask(stillWaiting), [stillWaiting]);
  const reviewGroups = useMemo(() => groupByTask(needsReview), [needsReview]);

  // Internal task links use ?task= query form so they open the side
  // panel on this same client page (Yuqi audit 2026-05-05). Falls back
  // to /clients/:id when no taskId. External task links (Action Queue,
  // Mail, Alerts) still navigate to /clients/:id/tasks/:taskId; that
  // route stays live as a deep-link fallback.
  const taskHref = (taskId?: string) =>
    taskId
      ? `/clients/${client.id}?task=${taskId}`
      : `/clients/${client.id}`;

  /** Per-state human label shown on the right side of each item row.
   *  Mirrors the screenshot: "Waiting" / "Not requested" / "Unreviewed". */
  const itemStatusLabel = (s: WaitingItem["state"]): string => {
    switch (s) {
      case "requested_waiting":
        return "Waiting";
      case "not_requested":
        return "Not requested";
      case "received_unreviewed":
        return "Unreviewed";
      case "received_issue":
        return "Issue";
      default:
        return "";
    }
  };

  const daysAgo = (iso: string): number =>
    Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));

  // Tasks chip strip dropped 2026-05-06 — it duplicated the Filings tab
  // (same per-task navigable units, same chase/review signals). To Do is
  // the doc-bucket surface (Still waiting / Needs review); Filings is
  // the per-task surface. The chase/review counts are still readable as
  // group headers inside the two sections below.

  return (
    <div className="space-y-4">
      {/* 🚨 STILL WAITING ON CLIENT — primary surface. Yuqi note
          2026-05-05: panel chrome stays neutral even when populated;
          the warning signal is carried by the small siren icon + the
          yellow "{N} items" pill. Tinting the whole panel turned the
          page yellow whenever any item was waiting — overpowered the
          deadline groups. The pill + icon are enough at a glance. */}
      <section
        aria-labelledby="todo-still-waiting-heading"
        className="rounded-md overflow-hidden border border-line bg-surface"
      >
        <header className="flex items-baseline gap-2 px-4 py-3 border-b border-line">
          <h3
            id="todo-still-waiting-heading"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900"
          >
            <Siren className="w-4 h-4 text-warn-ink" aria-hidden />
            Still waiting on client
          </h3>
          {stillWaiting.length > 0 ? (
            <span className="text-2xs tabular-nums px-1.5 py-0.5 rounded border border-warn-border text-warn-ink bg-warn-bg/60">
              {stillWaiting.length} item{stillWaiting.length === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="text-2xs tabular-nums text-ink-500">
              0 items
            </span>
          )}
          <button
            onClick={onAddDeadline}
            className="ml-auto text-2xs px-2 py-0.5 rounded border border-line text-ink-700 hover:bg-sunken"
          >
            + Add deadline
          </button>
        </header>
        {stillWaiting.length === 0 ? (
          <p className="px-4 py-4 text-xs text-ink-500">
            Nothing waiting on this client right now.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {waitingGroups.map((g) => {
              const days =
                g.lastReminderAt != null ? daysAgo(g.lastReminderAt) : null;
              const itemCount = g.items.length;
              return (
                <div key={g.taskId ?? "_"} className="px-4 py-3">
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <h4 className="text-sm font-semibold text-ink-900">
                      {g.taskName}
                    </h4>
                    {g.dueDate && (
                      <span className="text-2xs text-ink-500">
                        due {formatShortDate(g.dueDate)}
                      </span>
                    )}
                    <span className="text-2xs text-ink-400">·</span>
                    <span className="text-2xs text-ink-500 tabular-nums">
                      {itemCount} item{itemCount === 1 ? "" : "s"}
                    </span>
                    {/* Honest label — navigates to TaskDetail; the ↗
                        carries that affordance. The EmailDraftModal /
                        per-item send live there. */}
                    <Link
                      to={taskHref(g.taskId)}
                      className="ml-auto text-2xs px-2 py-1 rounded border border-line bg-surface text-ink-700 hover:bg-sunken shrink-0"
                      title="Open task"
                    >
                      Open task ↗
                    </Link>
                  </div>
                  <ul className="space-y-1">
                    {g.items.map((ci) => (
                      <li
                        key={ci.id}
                        className="flex items-baseline gap-2 text-sm"
                      >
                        <span className="text-ink-500 shrink-0 flex items-center">
                          {ci.state === "requested_waiting" ? (
                            <Hourglass className="w-3.5 h-3.5" aria-hidden />
                          ) : (
                            <Pause className="w-3.5 h-3.5" aria-hidden />
                          )}
                        </span>
                        <span className="flex-1 min-w-0 text-ink-900 truncate">
                          {ci.label ?? "Item"}
                        </span>
                        <span className="text-2xs text-ink-500 shrink-0">
                          {itemStatusLabel(ci.state)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {days != null && (
                    <p className="mt-2 text-2xs text-ink-400">
                      Last reminder {days}d ago.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ⚠ NEEDS YOUR REVIEW — secondary, expanded by default.
          Same deadline-grouped layout as "Still waiting" so the two
          panels read as a coherent surface. Header carries an item
          count + a task count so Sarah can see "5 items across 3
          tasks" at a glance. */}
      {needsReview.length > 0 && (
        <section className="bg-surface border border-line rounded-md overflow-hidden">
          <header className="flex items-baseline gap-2 px-4 py-3 border-b border-line">
            <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900">
              <AlertTriangle className="w-4 h-4 text-warn-ink" aria-hidden />
              Needs your review
            </h3>
            <span className="text-2xs text-ink-500 tabular-nums">
              {needsReview.length} item{needsReview.length === 1 ? "" : "s"}
              {reviewGroups.length > 0 && (
                <>
                  {" · "}
                  {reviewGroups.length} task
                  {reviewGroups.length === 1 ? "" : "s"}
                </>
              )}
            </span>
          </header>
          <div className="divide-y divide-line">
            {reviewGroups.map((g) => {
              const itemCount = g.items.length;
              return (
                <div key={g.taskId ?? "_"} className="px-4 py-3">
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <h4 className="text-sm font-semibold text-ink-900">
                      {g.taskName}
                    </h4>
                    {g.dueDate && (
                      <span className="text-2xs text-ink-500">
                        due {formatShortDate(g.dueDate)}
                      </span>
                    )}
                    <span className="text-2xs text-ink-400">·</span>
                    <span className="text-2xs text-ink-500 tabular-nums">
                      {itemCount} item{itemCount === 1 ? "" : "s"}
                    </span>
                    <Link
                      to={taskHref(g.taskId)}
                      className="ml-auto text-2xs px-2 py-1 rounded border border-line bg-surface text-ink-700 hover:bg-sunken shrink-0"
                      title="Open task to review"
                    >
                      Review ↗
                    </Link>
                  </div>
                  <ul className="space-y-1">
                    {g.items.map((ci) => (
                      <li
                        key={ci.id}
                        className="flex items-baseline gap-2 text-sm"
                      >
                        <span className="shrink-0 flex items-center">
                          {ci.state === "received_issue" ? (
                            <AlertTriangle
                              className="w-3.5 h-3.5 text-warn-ink"
                              aria-hidden
                            />
                          ) : (
                            <Inbox
                              className="w-3.5 h-3.5 text-ink-500"
                              aria-hidden
                            />
                          )}
                        </span>
                        <span className="flex-1 min-w-0 text-ink-900 truncate">
                          {ci.label}
                        </span>
                        <span className="text-2xs text-ink-500 shrink-0">
                          {itemStatusLabel(ci.state)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* "Open deadlines for this client" section dropped 2026-05-06 —
          Yuqi audit: this list duplicated the Filings tab's "Filing
          plan" section (same 4 deadlines, same client). To Do is for
          chase-flow items (what does the client owe me); Filings is
          for the deadline portfolio (what's the shape of the year).
          Two clean concepts. The Tasks chip strip at the top of this
          tab + the Filings tab cover the navigation surface. */}

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
            title="email-drafter — drafts wait for your review before send."
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
 * Active state alerts touching this client. Surfaces the back-edge of the
 * alert ↔ client relationship — /alerts shows "Affects N clients" with
 * names, but until now /clients/:id had no reciprocal signal. Renders
 * null when no active alerts include this client in `affectedClientIds`.
 */
function ClientStateAlertsCard({ clientId }: { clientId: string }) {
  const announcementsQuery = useAnnouncements({ activeOnly: true });
  const alerts = (announcementsQuery.data ?? []).filter(
    (a) => !a.dismissed && a.affectedClientIds.includes(clientId),
  );
  const [expanded, setExpanded] = useState(false);

  if (alerts.length === 0) return null;

  // Collapsed by default 2026-05-06: a 7-alert block at the top of
  // every client page swallowed first-screen real estate before the
  // CPA could see Tasks / To Do. The summary line carries the
  // count + per-alert action lives one click away inside this section
  // (or directly on /alerts). Auto-expanded only when there's a single
  // alert (no signal vs noise concern with N=1).
  const showList = expanded || alerts.length === 1;
  const headerLabel = `Active state ${alerts.length === 1 ? "alert" : "alerts"} for this client`;

  return (
    <section
      className="mt-5 bg-warn-bg/40 border border-warn-border/60 rounded-md px-region py-region"
      aria-label="Active state alerts affecting this client"
    >
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        disabled={alerts.length === 1}
        aria-expanded={showList}
        aria-controls={`client-alerts-${clientId}`}
        className="w-full flex items-center gap-2 text-left disabled:cursor-default"
      >
        <Megaphone className="w-3.5 h-3.5 text-warn-ink shrink-0" aria-hidden />
        <span className="text-2xs uppercase tracking-wider font-semibold text-warn-ink">
          {headerLabel}
        </span>
        <span className="text-2xs text-ink-500 tabular-nums">
          · {alerts.length}
        </span>
        {alerts.length > 1 && (
          <span className="ml-auto text-2xs text-warn-ink inline-flex items-center gap-0.5">
            {expanded ? "Hide" : "Show"}
            <ChevronRight
              className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
              aria-hidden
            />
          </span>
        )}
      </button>
      {showList && (
        <ul
          id={`client-alerts-${clientId}`}
          className="flex flex-col gap-1.5 mt-2.5"
        >
          {alerts.map((a) => (
            <li key={a.id}>
              <Link
                to={`/alerts/${a.id}`}
                className="group flex items-center gap-3 px-2.5 py-2 rounded-md bg-surface/70 border border-warn-border/40 hover:bg-surface hover:border-warn-border/80 transition-colors"
              >
                <StateBadge code={a.stateCode} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink-900 truncate">{a.title}</div>
                  <div className="text-2xs text-ink-500 mt-0.5 truncate">
                    {a.authority}
                    {a.newDeadline && (
                      <>
                        <span className="mx-1.5 text-ink-300">·</span>
                        <span>Deadline shifts to {formatLongDate(a.newDeadline)}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-2xs text-ink-500 group-hover:text-ink-900 inline-flex items-center gap-0.5 shrink-0">
                  Review
                  <ChevronRight
                    className="w-3 h-3 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Compact arrival-timing / cross-year summary card on the client header. Click to expand
 * for the full insights panel. Cold-start fallback per PRD §4.2.
 */
function ClientAiInsightsCard({ clientId }: { clientId: string }) {
  const insights = useAiInsightsForClient(clientId);
  const open = insights.filter((i) => i.status === "open");

  // 2026-05-06: this card now scopes ONLY to advisory triggers
  // (cross-year-insighter signals like "wages doubled → 401k convo").
  // Churn-risk + facts-imported are folded into the header-rail
  // ClientAiSummaryCard so they don't compete for ink with the deeper
  // advisory list. PRD §4.4 Layer B.
  const advisoryTriggers = open.filter((i) => i.mode === "E");
  if (advisoryTriggers.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-2">
      {/* Layer B: advisory triggers (cross-year-insighter) — these are the "wages doubled
          → 401k convo" / "Schedule E disappeared → did the property sell?"
          surfaces. The lever for moving from preparer to advisor (Pattern 4).
          Yuqi audit 2026-05-05: was rendered in info-blue, which crashed
          into the warn-yellow used for chase / overdue elsewhere on the
          page (two competing accents). Now neutral surface + line border —
          the heading "Advisory opportunities" + the content carry meaning;
          color reserved for state ("needs your attention"), not for category. */}
      {advisoryTriggers.length > 0 && (
        <div className="bg-surface border border-line rounded-md overflow-hidden">
          <header className="px-4 py-2 border-b border-line bg-sunken/40 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-wider text-ink-700 font-semibold">
              <Sparkles className="w-3 h-3 text-ink-500" aria-hidden />
              Advisory opportunities
            </span>
            <span className="text-2xs text-ink-500">
              {advisoryTriggers.length} open
            </span>
          </header>
          <ul className="divide-y divide-line">
            {advisoryTriggers.slice(0, 4).map((i) => (
              <li key={i.id} className="px-4 py-2.5">
                <p className="text-sm text-ink-900 font-medium">{i.title}</p>
                <p className="text-xs text-ink-700 mt-0.5">{i.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Churn-risk + facts-filler retired from this card 2026-05-06 —
          both signals are now folded into the header-rail
          ClientAiSummaryCard. This card keeps a single responsibility:
          actionable advisory opportunities. */}
    </div>
  );
}

// ClientAiSummaryCard + computeChurnRiskScore removed 2026-05-06 —
// see header-body comment above. The right-rail "AI generated based on
// history" narrative was meta-narration without a concrete call to
// action; concrete advisory signals already surface as Opportunities
// cards and inside the Activity feed.

/**
 * Documents tab — IA §3.3. Longitudinal table: rows = document types,
 * columns = tax years. Each cell shows whether the doc was received in
 * that year. Powers the "did we have this last year" cross-year-insighter surface.
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
          last year had a doc and this year doesn't (cross-year-insighter).
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
 *   • inbound-classifier confidence rate (avg aiConfidence on classified docs)
 *   • extension history (count of tasks.status === "filed_extension")
 *   • pushback frequency (replyIntent === "timeline_pushback" rate)
 *   • mismatched-attachment rate (replyIntent === "mismatched_attachment")
 *   • bounce rate on outbound to this client
 *   • AI insight resolution rate (cross-year-insighter aiInferences.wasActedOn)
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
  // Yuqi audit 2026-05-06: the previous "Reliable filer — no recent
  // flags. Insights will refine here as activity accumulates."
  // placeholder is redundant with the existing "AI insights unlock
  // once you import a prior-year return" label that already renders
  // below. Drop the stub. Render this component ONLY when the user
  // has explicitly authored an override; otherwise return null and
  // let the AI-insights-unlock label do the talking.
  const override = client.aiSummaryOverride;
  if (!override && !editing) return null;
  const summary = override ?? "";

  if (editing) {
    return (
      <section className="mt-2 bg-sunken/40 border border-line rounded-md p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full text-sm bg-surface border border-line rounded px-2 py-1.5 text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
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

  // Yuqi audit 2026-05-05: previously rendered in info-blue (bg-info-bg/40
  // border-info-border/60), which fought the warn-yellow used for chase /
  // overdue and read like a system warning rather than a contextual note.
  // The override is supposed to be a quiet annotation the partner left for
  // themselves — render it as the visual equivalent of a margin note, not
  // a banner. Sparkles icon retained as the "AI-touched / overridable"
  // hint; everything else neutral.
  return (
    <section className="mt-2 flex items-start gap-2 text-sm text-ink-700 leading-relaxed">
      <Sparkles
        className="w-3.5 h-3.5 text-ink-400 shrink-0 translate-y-0.5"
        aria-hidden
      />
      <p className="flex-1 italic">{summary}</p>
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

