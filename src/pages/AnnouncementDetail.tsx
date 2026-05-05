import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { History, Link2, Check, Target, FileText, AlertTriangle } from "lucide-react";
import { actions } from "../data/store";
import { trpc } from "../lib/api/client";
import { useAnnouncement, useAnnouncements } from "../hooks/useAnnouncements";
import { useClients } from "../hooks/useClients";
import { PageSkeleton } from "../components/skeletons/DashboardSkeleton";
import { ErrorState } from "../components/ErrorState";
import { formatLongDate } from "../data/dateHelpers";
import {
  CONFIDENCE_LABEL,
  SOURCE_AUTHORITY_LABEL,
  SOURCE_AUTHORITY_TOOLTIP,
  TAX_TYPE_LABEL,
} from "../data/announcementLabels";
import {
  ALERT_TYPE_CONFIG,
  type AlertActionKind,
} from "../data/alertTypeConfig";
import { AlertActionBar, AlertTypeChip } from "../components/AlertActionBar";
import { BatchNotifyModal } from "../components/BatchNotifyModal";
import { BatchTagModal } from "../components/BatchTagModal";
import { CatalogChangeReviewPanel } from "../components/CatalogChangeReviewPanel";
import { DismissWithReasonDialog } from "../components/DismissWithReasonDialog";
import { NexusCheckModal } from "../components/NexusCheckModal";
import { RecomputeEstimatesModal } from "../components/RecomputeEstimatesModal";
import { SchedulePlanningCallModal } from "../components/SchedulePlanningCallModal";
import { useSession } from "../data/session";

const CONFIDENCE_TONE = {
  high: "bg-emerald-50 text-emerald-700",
  medium: "bg-sunken text-ink-700",
  low: "bg-amber-50 text-amber-700",
} as const;

export function AnnouncementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const announcementQuery = useAnnouncement(id);
  const clientsQuery = useClients();
  const allAnnouncementsQuery = useAnnouncements();
  const ann = announcementQuery.data ?? null;
  const clients = clientsQuery.data?.items ?? [];
  const allAnnouncements = allAnnouncementsQuery.data ?? [];

  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (ann) setSelected(new Set(ann.affectedClientIds ?? []));
  }, [ann?.id, (ann?.affectedClientIds ?? []).join(",")]);

  const [flash, setFlash] = useState<string | null>(null);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  // Per-variant modal open state. Only one open at a time; opening one
  // closes any others. handleAlertAction below picks the right modal.
  const [tagOpen, setTagOpen] = useState(false);
  const [planningCallOpen, setPlanningCallOpen] = useState(false);
  const [recomputeOpen, setRecomputeOpen] = useState(false);
  const [nexusOpen, setNexusOpen] = useState(false);
  // Admin gating for the form_change variant. We don't yet model multi-user
  // roles — every signed-in user is treated as the firm's catalog admin.
  // When multi-user lands (pro/team tiers w/ users.role), wire a real
  // role check here.
  const _session = useSession();
  const isAdmin = true;
  void _session;

  // ─── tRPC mutations for the 5 variant action surfaces ──────────────────
  // Each mutation routes to MOCK adapter (mock-link) in dev mode and to
  // the real BE (alertActions / federalForms routers) in prod. Mocks log
  // payload to console + return realistic-shape responses; real handlers
  // mutate Postgres + return the same shape.
  const tagClients = trpc.alertActions.tagClientsForRelief.useMutation();
  const schedulePlanningCalls =
    trpc.alertActions.schedulePlanningCalls.useMutation();
  const recomputeEstimates = trpc.alertActions.recomputeEstimates.useMutation();
  const undoRecomputeEstimates =
    trpc.alertActions.undoRecomputeEstimates.useMutation();
  const runNexusCheck = trpc.alertActions.runNexusCheck.useMutation();
  const addNexusFilings = trpc.alertActions.addNexusFilings.useMutation();
  const applyChangeEvent = trpc.federalForms.applyChangeEvent.useMutation();
  const rejectChangeEvent = trpc.federalForms.rejectChangeEvent.useMutation();
  const acknowledgeChangeEvent =
    trpc.federalForms.acknowledgeChangeEvent.useMutation();
  // Captures the last bundled batch-adjust so the flash banner can offer a
  // one-click undo. Cleared when the banner is dismissed or another action
  // overwrites it. Only set when adjustedCount > 0 — pure email sends are
  // not "undoable" in the same sense (the email already left the queue).
  const [lastBatch, setLastBatch] = useState<{
    clientIds: string[];
    oldIso: string;
    newIso: string;
    title: string;
  } | null>(null);

  // Recompute undo state. Set when recomputeEstimates returns an undoToken
  // (5-min window per BE). Cleared when undo is clicked, the window expires,
  // or another action overwrites the flash banner. Distinct from lastBatch
  // because the underlying undo procedure is different (deadline date shift
  // vs estimate amount shift) and the BE manages this token's lifetime.
  const [lastRecompute, setLastRecompute] = useState<{
    undoToken: string;
    expiresAt: number; // ms epoch
    count: number;
  } | null>(null);

  // Auto-clear lastRecompute when its window expires so the Undo button
  // disappears from the flash banner instead of letting the user click a
  // dead token. We re-render every 30s while a token is active; not exact
  // but cheap and good enough for the 5-min window.
  useEffect(() => {
    if (!lastRecompute) return;
    const ms = lastRecompute.expiresAt - Date.now();
    if (ms <= 0) {
      setLastRecompute(null);
      return;
    }
    const timer = setTimeout(() => setLastRecompute(null), ms);
    return () => clearTimeout(timer);
  }, [lastRecompute]);

  const undoLastBatch = () => {
    if (!lastBatch) return;
    actions.batchAdjustDeadlines(
      lastBatch.clientIds,
      lastBatch.newIso,
      lastBatch.oldIso,
      `Undo: ${lastBatch.title}`
    );
    setFlash(
      `Reverted: ${lastBatch.clientIds.length} deadline${lastBatch.clientIds.length === 1 ? "" : "s"} restored to ${formatLongDate(lastBatch.oldIso)}.`
    );
    setLastBatch(null);
  };

  // Deep-link from the Today banner: any of `?action=review|adjust|notify`
  // opens the unified review modal. The modal itself bundles the deadline
  // shift for disaster_extension alerts via an in-modal toggle, so callers
  // no longer need to pick a verb up-front. We strip the param after
  // consuming it so a refresh doesn't re-open the dialog.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedAction = searchParams.get("action");
  useEffect(() => {
    if (!ann || !requestedAction) return;
    if (
      requestedAction === "review" ||
      requestedAction === "adjust" ||
      requestedAction === "notify"
    ) {
      setNotifyOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  }, [ann?.id, requestedAction]);

  const clientsById = useMemo(() => {
    const m = new Map<string, (typeof clients)[number]>();
    clients.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  if (announcementQuery.isLoading)
    return <PageSkeleton title="Loading announcement…" />;

  if (announcementQuery.error) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <ErrorState
          title="Couldn't load this announcement."
          message={
            announcementQuery.error instanceof Error
              ? announcementQuery.error.message
              : undefined
          }
          onRetry={() => announcementQuery.refetch()}
        />
      </div>
    );
  }

  if (!ann) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-10">
        <Link to="/alerts" className="text-sm text-ink-500 hover:underline">
          ‹ Alerts
        </Link>
        <p className="mt-6 text-ink-700">Announcement not found.</p>
      </div>
    );
  }

  const toggle = (cid: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(cid)) n.delete(cid);
      else n.add(cid);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === ann.affectedClientIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(ann.affectedClientIds));
    }
  };

  const selectedCount = selected.size;

  const doDismissWithReason = (reason: string) => {
    actions.dismissAnnouncement(ann.id, reason);
    setDismissOpen(false);
    navigate("/alerts");
  };

  const isDisasterShift =
    ann.type === "disaster_extension" && !!ann.oldDeadline && !!ann.newDeadline;

  // Per-alertType config — drives header chip tone, verdict copy, primary
  // verb, action shape, etc. See data/alertTypeConfig.ts for the table
  // and docs/specs/alert-detail-variants.md for design rationale.
  const alertCfg = ALERT_TYPE_CONFIG[ann.type];

  const handleAlertAction = (kind: AlertActionKind) => {
    // Reset all variant modals so only one is open at a time.
    setTagOpen(false);
    setPlanningCallOpen(false);
    setRecomputeOpen(false);
    setNexusOpen(false);
    setNotifyOpen(false);

    switch (kind) {
      case "open_batch_notify":
        // disaster_extension primary — bundles deadline shift + email.
        setNotifyOpen(true);
        break;
      case "open_batch_notify_no_shift":
        // Variant secondaries that need a generic notification email
        // (e.g. nexus_change "notify only", penalty_relief "tag + email"
        // when tag-without-email is desired). Routes through the existing
        // BatchNotifyModal which already supports notify-only mode.
        setNotifyOpen(true);
        break;
      case "open_batch_tag_modal":
        // penalty_relief — annotative; tags clients for filing-time review.
        setTagOpen(true);
        break;
      case "open_planning_call_modal":
        // pte_change — conversational; creates planning_calls + Today TodoItems.
        setPlanningCallOpen(true);
        break;
      case "open_recompute_modal":
        // rate_change — computational; recomputes estimate amounts.
        setRecomputeOpen(true);
        break;
      case "open_nexus_check_modal":
        // nexus_change — discovery; per-client questionnaire then add filings.
        setNexusOpen(true);
        break;
      case "route_admin_queue":
        // form_change — admin reviewer queue lives at /settings/federal-forms.
        // For non-admin users the AlertActionBar's primary verb is "Acknowledge"
        // and routes here only when admin clicks.
        navigate(`/settings/federal-forms?event=${ann.id}`);
        break;
      case "route_calendar_schedule":
        // Calendar integration uses per-call deep-links (Google, Outlook,
        // .ics download) inside the planning_call modal — no OAuth scopes
        // required. Real calendar sync via OAuth is a Phase 2 add.
        setPlanningCallOpen(true);
        break;
    }
  };

  // Recipients used by all per-variant modals. Computed once so the modals
  // share the user's checkbox state.
  const selectedRecipients = Array.from(selected)
    .map((cid) => clientsById.get(cid))
    .filter((c): c is NonNullable<typeof c> => !!c);

  const relatedAlerts = ann.relatedAnnouncementIds
    .map((rid) => allAnnouncements.find((a) => a.id === rid))
    .filter((a): a is NonNullable<typeof a> => !!a);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
      <Link to="/alerts" className="text-sm text-ink-500 hover:underline">
        ‹ Alerts
      </Link>

      <div className="mt-4 border border-line bg-surface rounded-lg p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded text-sm font-semibold bg-sunken text-ink-900 border border-line shrink-0">
            {ann.stateCode}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3">
              <h1 className="flex-1 text-2xl font-semibold text-ink-900">
                {ann.title}
              </h1>
              <span className="text-xs text-ink-500 text-right shrink-0 max-w-[40%]">
                {ann.authority}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              <AlertTypeChip type={ann.type} />
              <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-sunken text-ink-700 border border-line">
                {TAX_TYPE_LABEL[ann.taxType]}
              </span>
              {ann.retroactive && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-sunken text-ink-700 border border-line">
                  <History className="w-3 h-3" aria-hidden />
                  Retroactive
                </span>
              )}
            </div>

            <div className="text-sm text-ink-700 mt-3">
              Issued {formatLongDate(ann.issuanceDate)}
              {ann.effectiveDate &&
                ` · Effective ${formatLongDate(ann.effectiveDate)}`}{" "}
              · Detected {new Date(ann.detectedAt).toLocaleString("en-US")}
            </div>

            <div className="mt-3 flex items-center gap-3 text-sm">
              <a
                href={ann.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                View official source ↗
              </a>
              <span className="text-ink-400">·</span>
              <span
                className="text-ink-700"
                title={SOURCE_AUTHORITY_TOOLTIP[ann.sourceAuthority]}
              >
                Source: {SOURCE_AUTHORITY_LABEL[ann.sourceAuthority]}
              </span>
            </div>
          </div>
        </div>
      </div>

      {flash && (
        <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm px-4 py-3 flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 flex-1">
            <Check className="w-3.5 h-3.5 shrink-0" aria-hidden />
            {flash}
          </span>
          {lastBatch && (
            <button
              onClick={undoLastBatch}
              className="text-xs px-2.5 py-1 rounded border border-emerald-300 text-emerald-800 hover:bg-emerald-100 shrink-0"
            >
              Undo
            </button>
          )}
          {lastRecompute && (
            <button
              onClick={async () => {
                try {
                  const result = await undoRecomputeEstimates.mutateAsync({
                    undoToken: lastRecompute.undoToken,
                  });
                  setFlash(
                    `Reverted: ${result.restoredCount} estimate${result.restoredCount === 1 ? "" : "s"} restored.`,
                  );
                } catch (err) {
                  setFlash(
                    `Couldn't undo — ${err instanceof Error ? err.message : "window expired"}`,
                  );
                }
                setLastRecompute(null);
              }}
              className="text-xs px-2.5 py-1 rounded border border-emerald-300 text-emerald-800 hover:bg-emerald-100 shrink-0"
            >
              Undo recompute
            </button>
          )}
        </div>
      )}

      {/* form_change: render the catalog-review panel inline. Admins see a
          full diff with apply/modify/reject; non-admins see an acknowledge
          banner. Renders BEFORE the verdict block because the catalog change
          is the main object — the affected clients list below is supporting
          context (which clients use the form, informational only). */}
      {ann.type === "form_change" && (
        <CatalogChangeReviewPanel
          announcement={ann}
          isAdmin={isAdmin}
          // Form number is parsed from the alert title for the design-stage
          // mock; production passes a structured `affectedFormNumber` field
          // from the BE that the federal-register parser extracts.
          formNumber={ann.title.match(/Form ([\w-]+)/)?.[1] ?? "—"}
          affectedClientCount={ann.affectedClientIds.length}
          onApply={async (overrides) => {
            try {
              const result = await applyChangeEvent.mutateAsync({
                // Mock change_event id — production passes the event row's
                // bigserial id from announcement.changeEventId once the
                // detailWithAffected query exposes it on the alert.
                eventId: 1,
                userOverrides: overrides,
              });
              setFlash(
                `Catalog updated · ${result.fieldsApplied.length} field${result.fieldsApplied.length === 1 ? "" : "s"} applied · ${ann.affectedClientIds.length} client${ann.affectedClientIds.length === 1 ? "" : "s"}' metadata refreshed`,
              );
            } catch (err) {
              setFlash(
                `Couldn't apply change — ${err instanceof Error ? err.message : "try again"}`,
              );
            }
          }}
          onReject={async (reason) => {
            try {
              await rejectChangeEvent.mutateAsync({
                eventId: 1,
                reason,
              });
              setFlash("Catalog change rejected");
            } catch (err) {
              setFlash(
                `Couldn't reject — ${err instanceof Error ? err.message : "try again"}`,
              );
            }
          }}
          onAcknowledge={async () => {
            try {
              await acknowledgeChangeEvent.mutateAsync({ eventId: 1 });
              setFlash("Acknowledged · removed from Today");
            } catch (err) {
              setFlash(
                `Couldn't acknowledge — ${err instanceof Error ? err.message : "try again"}`,
              );
            }
          }}
        />
      )}

      {/* VERDICT — who's affected + the action they need. Surfaces first because
          Sarah's mental order is "who do I act on" → "what do I do" → (only if
          uncertain) "let me audit the parse." Evidence sits below in collapsed
          <details> blocks. Headline + empty-state copy vary by alertType
          (sourced from alertTypeConfig). */}
      <section className="mt-5 bg-surface border border-line rounded-lg overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b border-line">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-700">
            <Target className="w-4 h-4" aria-hidden />
            {alertCfg.verdictHeadline(ann.affectedClientIds.length, clients.length)}
          </h2>
          {ann.affectedClientIds.length > 0 && !alertCfg.isAdminGated && (
            <button
              onClick={toggleAll}
              className="ml-auto text-xs text-indigo-600 hover:underline"
            >
              {selected.size === (ann.affectedClientIds ?? []).length
                ? "Deselect all"
                : "Select all"}
            </button>
          )}
        </div>
        {ann.affectedClientIds.length === 0 ? (
          // Empty state — type-specific copy. Page stays reachable so CPA can
          // read evidence + dismiss with reason.
          <div className="px-4 py-10 text-center">
            <div className="w-10 h-10 rounded-full bg-sunken mx-auto flex items-center justify-center">
              <Check className="w-5 h-5 text-ink-700" aria-hidden />
            </div>
            <p className="text-sm font-medium text-ink-900 mt-3">
              {alertCfg.emptyStateCopy(ann)}
            </p>
            <p className="text-xs text-ink-500 mt-1 max-w-xs mx-auto">
              No deadlines need to move, and no notifications are queued.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
              <Link
                to="/clients"
                className="text-xs px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-canvas"
              >
                Review your client list
              </Link>
              <button
                onClick={() => setDismissOpen(true)}
                className="text-xs px-3 py-1.5 rounded text-ink-500 hover:bg-canvas"
              >
                Dismiss this alert
              </button>
            </div>
          </div>
        ) : null}
        <ul className="divide-y divide-line">
          {(ann.affectedClientIds ?? []).map((cid) => {
            const c = clientsById.get(cid);
            if (!c) return null;
            const checked = selected.has(cid);
            const addParams = new URLSearchParams({
              addDeadline: "1",
              jurisdiction: ann.stateCode,
              source: `${ann.stateCode}: ${ann.title}`,
            });
            if (ann.newDeadline) addParams.set("date", ann.newDeadline);
            const suggestedForm = suggestFormForAnnouncement(ann.type, c.entityType);
            if (suggestedForm) addParams.set("form", suggestedForm);
            return (
              <li key={cid} className="flex items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(cid)}
                  className="w-4 h-4 accent-indigo-600"
                />
                <Link
                  to={`/clients/${cid}`}
                  className="text-sm text-ink-900 font-medium hover:underline w-52 truncate"
                >
                  {c.name}
                </Link>
                <span className="text-xs text-ink-500 w-44 truncate">
                  {alertCfg.perClientRowChip
                    ? alertCfg.perClientRowChip(c, ann)
                    : c.county
                      ? `${c.county}, ${c.primaryState}`
                      : c.primaryState}
                </span>
                <span className="text-xs text-ink-500 flex-1 truncate">
                  {c.entityType}
                </span>
                <Link
                  to={`/clients/${cid}?${addParams.toString()}`}
                  className="text-xs px-2 py-1 rounded border border-line text-ink-700 hover:bg-canvas shrink-0"
                  title="Open client and pre-fill a deadline from this alert"
                >
                  + Deadline
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Skip the sticky AlertActionBar for form_change — its action shape
          (Apply / Modify / Reject for admin, Acknowledge for non-admin)
          lives inside <CatalogChangeReviewPanel /> rendered above the
          verdict block. Two action surfaces would compete and confuse. */}
      {ann.type !== "form_change" && ann.affectedClientIds.length > 0 && (
        <AlertActionBar
          announcement={ann}
          selectedCount={selectedCount}
          onAction={handleAlertAction}
          onDismiss={() => setDismissOpen(true)}
          helperText={
            isDisasterShift && ann.newDeadline
              ? `Bundles deadline shift to ${formatLongDate(ann.newDeadline)}`
              : undefined
          }
        />
      )}

      {/* EVIDENCE — collapsed by default. The reader has already seen the
          verdict (affected clients) and acted; these blocks are here for
          audit, not gating. We expand parsed-impact automatically when
          confidence is low so a sketchy parse can't hide. */}
      <details
        className="mt-5 bg-surface border border-line rounded-lg group"
        open={ann.parseConfidence === "low" || ann.matchConfidence === "low"}
      >
        <summary className="cursor-pointer list-none flex items-center gap-2 px-4 py-3 text-sm font-semibold text-ink-700 hover:bg-canvas rounded-t-lg group-open:border-b group-open:border-line">
          <span className="text-xs text-ink-400 group-open:rotate-90 transition-transform">▶</span>
          <FileText className="w-4 h-4 text-ink-500" aria-hidden />
          What the alert says
          <span
            className={`ml-auto text-xs px-2 py-0.5 rounded ${CONFIDENCE_TONE[ann.parseConfidence]}`}
          >
            AI parse: {CONFIDENCE_LABEL[ann.parseConfidence]}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded ${CONFIDENCE_TONE[ann.matchConfidence]}`}
          >
            AI match: {CONFIDENCE_LABEL[ann.matchConfidence]}
          </span>
        </summary>
        <dl className="divide-y divide-line text-sm">
          <Row label="Summary">{ann.summary}</Row>
          {(ann.counties ?? []).length > 0 && (
            <Row label="Counties">{(ann.counties ?? []).join(", ")}</Row>
          )}
          {(ann.entityTypes ?? []).length > 0 && (
            <Row label="Entities">{(ann.entityTypes ?? []).join(" · ")}</Row>
          )}
          {(ann.taxTypes ?? []).length > 0 && (
            <Row label="Taxes">{(ann.taxTypes ?? []).join(" · ")}</Row>
          )}
          {ann.oldDeadline && (
            <Row label="Old deadline">{formatLongDate(ann.oldDeadline)}</Row>
          )}
          {ann.newDeadline && (
            <Row label="New deadline">
              <span className="font-medium text-ink-900">
                {formatLongDate(ann.newDeadline)}
              </span>
            </Row>
          )}
        </dl>
        {(ann.parseConfidence === "low" || ann.matchConfidence === "low") && (
          <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-900 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
            <span>
              Low confidence — verify against the official source before acting.{" "}
              <button className="underline">Report parsing issue</button>
            </span>
          </div>
        )}
      </details>

      {(relatedAlerts.length > 0 || ann.relatedAnnouncementIds.length > 0) && (
        <details className="mt-3 bg-surface border border-line rounded-lg group">
          <summary className="cursor-pointer list-none flex items-center gap-2 px-4 py-3 text-sm font-semibold text-ink-700 hover:bg-canvas rounded-t-lg group-open:border-b group-open:border-line">
            <span className="text-xs text-ink-400 group-open:rotate-90 transition-transform">▶</span>
            <Link2 className="w-3.5 h-3.5" aria-hidden />
            Related alerts
            <span className="ml-2 text-xs text-ink-500 font-normal">
              {ann.relatedAnnouncementIds.length} cross-reference
              {ann.relatedAnnouncementIds.length === 1 ? "" : "s"}
            </span>
          </summary>
          <ul className="divide-y divide-line">
            {relatedAlerts.map((rel) => (
              <li key={rel.id} className="px-4 py-2.5">
                <Link
                  to={`/alerts/${rel.id}`}
                  className="flex items-start gap-2 hover:underline"
                >
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-2xs font-semibold bg-sunken text-ink-900 border border-line shrink-0 mt-0.5">
                    {rel.stateCode}
                  </span>
                  <span className="text-sm text-ink-900">
                    {rel.title}
                    <span className="text-xs text-ink-500 ml-2">
                      · {rel.authority}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
            {ann.relatedAnnouncementIds
              .filter((rid) => !allAnnouncements.some((a) => a.id === rid))
              .map((rid) => (
                <li key={rid} className="px-4 py-2.5 text-xs text-ink-500">
                  <span className="font-mono">{rid}</span> — referenced but not
                  yet in your feed
                </li>
              ))}
          </ul>
          <div className="px-4 py-2 bg-canvas border-t border-line text-xs text-ink-500">
            Disaster declarations are often dual-source (IRS §7508A + state
            DOR). Cross-references help you reconcile overlapping postponement
            dates.
          </div>
        </details>
      )}

      <BatchNotifyModal
        open={notifyOpen}
        announcement={ann}
        recipients={Array.from(selected)
          .map((cid) => clientsById.get(cid))
          .filter((c): c is NonNullable<typeof c> => !!c)}
        onClose={() => setNotifyOpen(false)}
        onSent={(count, adjustedCount) => {
          setFlash(
            adjustedCount > 0
              ? `Drafts queued for ${count} client${count === 1 ? "" : "s"} · ${adjustedCount} deadline${adjustedCount === 1 ? "" : "s"} moved to ${formatLongDate(ann.newDeadline!)}.`
              : `Drafts queued for ${count} client${count === 1 ? "" : "s"}.`
          );
          if (adjustedCount > 0 && ann.oldDeadline && ann.newDeadline) {
            setLastBatch({
              clientIds: Array.from(selected),
              oldIso: ann.oldDeadline,
              newIso: ann.newDeadline,
              title: ann.title,
            });
          } else {
            setLastBatch(null);
          }
        }}
      />

      <DismissWithReasonDialog
        open={dismissOpen}
        onConfirm={doDismissWithReason}
        onCancel={() => setDismissOpen(false)}
      />

      {/* Variant-specific action modals — only one is open at a time per
          handleAlertAction's reset logic. Each uses selectedRecipients
          computed from the verdict block's checkboxes. BE handlers are
          stub-level for now (logs + flash); real backend procedures land
          in migration 0007 + announcements router updates. */}
      <BatchTagModal
        open={tagOpen}
        announcement={ann}
        recipients={selectedRecipients}
        onClose={() => setTagOpen(false)}
        onConfirm={async ({ clientIds, composeEmail }) => {
          setTagOpen(false);
          try {
            const result = await tagClients.mutateAsync({
              announcementId: ann.id,
              clientIds,
              expiresAt: ann.effectiveDate ?? null,
            });
            const dupNote =
              result.duplicateCount > 0
                ? ` (${result.duplicateCount} already tagged)`
                : "";
            setFlash(
              `${result.taggedCount} client${result.taggedCount === 1 ? "" : "s"} tagged${dupNote} · Untag (24h window)${composeEmail ? " · drafts queued" : ""}`,
            );
          } catch (err) {
            setFlash(
              `Couldn't tag clients — ${err instanceof Error ? err.message : "try again"}`,
            );
          }
        }}
      />

      <SchedulePlanningCallModal
        open={planningCallOpen}
        announcement={ann}
        recipients={selectedRecipients}
        onClose={() => setPlanningCallOpen(false)}
        onConfirm={async ({ clientIds, suggestedWindow, composeEmail }) => {
          setPlanningCallOpen(false);
          try {
            const result = await schedulePlanningCalls.mutateAsync({
              announcementId: ann.id,
              clientIds,
              suggestedWindow,
            });
            setFlash(
              `${result.callsCreated} call${result.callsCreated === 1 ? "" : "s"} flagged on Today queue${composeEmail ? " · drafts queued" : ""}`,
            );
          } catch (err) {
            setFlash(
              `Couldn't schedule calls — ${err instanceof Error ? err.message : "try again"}`,
            );
          }
        }}
      />

      <RecomputeEstimatesModal
        open={recomputeOpen}
        announcement={ann}
        recipients={selectedRecipients}
        onClose={() => setRecomputeOpen(false)}
        onConfirm={async ({ selections, composeEmail }) => {
          setRecomputeOpen(false);
          // Flatten the per-client `estimateIds` into the BE's expected
          // shape `selections: [{ deadlineId, overrideAmountCents? }]`.
          const flatSelections = selections.flatMap((s) =>
            s.estimateIds.map((id) => ({ deadlineId: id })),
          );
          try {
            const result = await recomputeEstimates.mutateAsync({
              announcementId: ann.id,
              selections: flatSelections,
              // Default to federal 2026 — for state-scoped alerts the BE
              // would derive this from the announcement's stateCode/year.
              ruleJurisdiction: "federal" as const,
              ruleTaxYear: 2026,
            });
            const bankNote =
              result.bankUpdateTodos > 0
                ? ` · ${result.bankUpdateTodos} bank-instruction TodoItem${result.bankUpdateTodos === 1 ? "" : "s"} queued`
                : "";
            setFlash(
              `${result.recomputedCount} estimate${result.recomputedCount === 1 ? "" : "s"} recomputed${bankNote}${composeEmail ? " · drafts queued" : ""} · Undo (5min)`,
            );
            // Stash undo token so the flash banner offers Undo for 5 min.
            // Clears the older lastBatch (deadline-shift undo) since they
            // share the same flash banner slot.
            if (result.undoToken) {
              setLastBatch(null);
              setLastRecompute({
                undoToken: result.undoToken,
                expiresAt: new Date(result.expiresAt).getTime(),
                count: result.recomputedCount,
              });
            }
          } catch (err) {
            setFlash(
              `Couldn't recompute — ${err instanceof Error ? err.message : "try again"}`,
            );
          }
        }}
      />

      <NexusCheckModal
        open={nexusOpen}
        announcement={ann}
        recipients={selectedRecipients}
        onClose={() => setNexusOpen(false)}
        onConfirm={async ({
          clientId,
          answers,
          selectedFilings,
          notifyOnly,
        }) => {
          if (notifyOnly) {
            setFlash(`Notification queued for client · No filings added`);
            return;
          }
          try {
            // Step 1: persist nexus check (BE writes nexus_questionnaire_runs
            // + upserts client_state_nexus.status).
            const checkResult = await runNexusCheck.mutateAsync({
              announcementId: ann.id,
              clientId,
              state: ann.stateCode,
              // V1 maps every nexus_change alert to "sales" — real BE will
              // surface nexusKind via the announcement payload.
              nexusKind: "sales" as const,
              answers,
            });
            // Step 2: if user picked filings, batch-add them.
            if (
              checkResult.status === "established" &&
              selectedFilings.length > 0
            ) {
              const addResult = await addNexusFilings.mutateAsync({
                announcementId: ann.id,
                clientId,
                state: ann.stateCode,
                filings: selectedFilings.map((formCode) => ({
                  formCode,
                  formName: formCode,
                })),
              });
              setFlash(
                `${addResult.filingsAdded} filing${addResult.filingsAdded === 1 ? "" : "s"} added · Undo (24h)`,
              );
            } else {
              setFlash(
                `Nexus check saved — ${checkResult.status.replace(/_/g, " ")}`,
              );
            }
          } catch (err) {
            setFlash(
              `Couldn't run nexus check — ${err instanceof Error ? err.message : "try again"}`,
            );
          }
        }}
      />
    </div>
  );
}

function suggestFormForAnnouncement(
  type: string,
  entity: string
): string | null {
  const lowerType = type.toLowerCase();
  if (lowerType.includes("disaster") || lowerType.includes("penalty")) {
    if (entity === "Individual") return "1040 (extension)";
    if (entity === "S-Corp") return "1120-S (extension)";
    if (entity === "C-Corp") return "1120 (extension)";
    if (entity === "Partnership") return "1065 (extension)";
    if (entity === "Trust") return "1041 (trust)";
    return "1040 (extension)";
  }
  if (lowerType.includes("pte")) return "PTE election";
  if (lowerType.includes("nexus")) return "Sales tax Q";
  return null;
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-6 px-4 py-3">
      <dt className="w-32 shrink-0 text-xs uppercase tracking-wide text-ink-500 mt-0.5">
        {label}
      </dt>
      <dd className="text-ink-700">{children}</dd>
    </div>
  );
}
