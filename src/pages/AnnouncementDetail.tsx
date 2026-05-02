import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { History, Link2 } from "lucide-react";
import { actions } from "../data/store";
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
  medium: "bg-slate-100 text-slate-700",
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
  // Admin gating for the form_change variant. For solo tier (Sarah's
  // persona — sole-prop CPA) the user is always the owner. Pro/team tiers
  // will need a real users.role check — added when multi-user comes online.
  const session = useSession();
  const isAdmin = session?.tier === "solo" || session?.tier === undefined;
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
        <Link to="/alerts" className="text-sm text-slate-500 hover:underline">
          ‹ Alerts
        </Link>
        <p className="mt-6 text-slate-600">Announcement not found.</p>
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
        // P2 — calendar integration. For now the planning_call modal
        // captures the intent and creates a TodoItem.
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
      <Link to="/alerts" className="text-sm text-slate-500 hover:underline">
        ‹ Alerts
      </Link>

      <div className="mt-4 border border-slate-200 bg-white rounded-lg p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded text-sm font-semibold bg-slate-100 text-slate-900 border border-slate-200 shrink-0">
            {ann.stateCode}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3">
              <h1 className="flex-1 text-2xl font-semibold text-slate-900">
                {ann.title}
              </h1>
              <span className="text-xs text-slate-500 text-right shrink-0 max-w-[40%]">
                {ann.authority}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              <AlertTypeChip type={ann.type} />
              <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {TAX_TYPE_LABEL[ann.taxType]}
              </span>
              {ann.retroactive && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  <History className="w-3 h-3" aria-hidden />
                  Retroactive
                </span>
              )}
            </div>

            <div className="text-sm text-slate-600 mt-3">
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
              <span className="text-slate-400">·</span>
              <span
                className="text-slate-600"
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
          <span className="flex-1">✓ {flash}</span>
          {lastBatch && (
            <button
              onClick={undoLastBatch}
              className="text-xs px-2.5 py-1 rounded border border-emerald-300 text-emerald-800 hover:bg-emerald-100 shrink-0"
            >
              Undo
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
          affectedClientCount={ann.affectedClientIds.length}
          onApply={(overrides) => {
            console.info("[alerts] applyChangeEvent (mock)", {
              announcementId: ann.id,
              overrides,
            });
            setFlash(
              `Catalog updated · ${ann.affectedClientIds.length} clients' form metadata refreshed`,
            );
          }}
          onReject={(reason) => {
            console.info("[alerts] rejectChangeEvent (mock)", {
              announcementId: ann.id,
              reason,
            });
            setFlash("Catalog change rejected");
          }}
          onAcknowledge={() => {
            console.info("[alerts] acknowledgeChangeEvent (mock)", {
              announcementId: ann.id,
            });
            setFlash("Acknowledged · removed from Today");
          }}
        />
      )}

      {/* VERDICT — who's affected + the action they need. Surfaces first because
          Sarah's mental order is "who do I act on" → "what do I do" → (only if
          uncertain) "let me audit the parse." Evidence sits below in collapsed
          <details> blocks. Headline + empty-state copy vary by alertType
          (sourced from alertTypeConfig). */}
      <section className="mt-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">
            🎯 {alertCfg.verdictHeadline(ann.affectedClientIds.length, clients.length)}
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
            <div className="w-10 h-10 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-lg">
              ✓
            </div>
            <p className="text-sm font-medium text-slate-900 mt-3">
              {alertCfg.emptyStateCopy(ann)}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              No deadlines need to move, and no notifications are queued.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
              <Link
                to="/clients"
                className="text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Review your client list
              </Link>
              <button
                onClick={() => setDismissOpen(true)}
                className="text-xs px-3 py-1.5 rounded text-slate-500 hover:bg-slate-50"
              >
                Dismiss this alert
              </button>
            </div>
          </div>
        ) : null}
        <ul className="divide-y divide-slate-100">
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
                  className="text-sm text-slate-900 font-medium hover:underline w-52 truncate"
                >
                  {c.name}
                </Link>
                <span className="text-xs text-slate-500 w-44 truncate">
                  {alertCfg.perClientRowChip
                    ? alertCfg.perClientRowChip(c, ann)
                    : c.county
                      ? `${c.county}, ${c.primaryState}`
                      : c.primaryState}
                </span>
                <span className="text-xs text-slate-500 flex-1 truncate">
                  {c.entityType}
                </span>
                <Link
                  to={`/clients/${cid}?${addParams.toString()}`}
                  className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
                  title="Open client and pre-fill a deadline from this alert"
                >
                  + Deadline
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {(ann.affectedClientIds.length > 0 || alertCfg.isAdminGated) && (
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
        className="mt-5 bg-white border border-slate-200 rounded-lg group"
        open={ann.parseConfidence === "low" || ann.matchConfidence === "low"}
      >
        <summary className="cursor-pointer list-none flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-t-lg group-open:border-b group-open:border-slate-100">
          <span className="text-xs text-slate-400 group-open:rotate-90 transition-transform">▶</span>
          📄 What the alert says
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
        <dl className="divide-y divide-slate-100 text-sm">
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
              <span className="font-medium text-slate-900">
                {formatLongDate(ann.newDeadline)}
              </span>
            </Row>
          )}
        </dl>
        {(ann.parseConfidence === "low" || ann.matchConfidence === "low") && (
          <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-900">
            ⚠ Low confidence — verify against the official source before acting.{" "}
            <button className="underline">Report parsing issue</button>
          </div>
        )}
      </details>

      {(relatedAlerts.length > 0 || ann.relatedAnnouncementIds.length > 0) && (
        <details className="mt-3 bg-white border border-slate-200 rounded-lg group">
          <summary className="cursor-pointer list-none flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-t-lg group-open:border-b group-open:border-slate-100">
            <span className="text-xs text-slate-400 group-open:rotate-90 transition-transform">▶</span>
            <Link2 className="w-3.5 h-3.5" aria-hidden />
            Related alerts
            <span className="ml-2 text-xs text-slate-500 font-normal">
              {ann.relatedAnnouncementIds.length} cross-reference
              {ann.relatedAnnouncementIds.length === 1 ? "" : "s"}
            </span>
          </summary>
          <ul className="divide-y divide-slate-100">
            {relatedAlerts.map((rel) => (
              <li key={rel.id} className="px-4 py-2.5">
                <Link
                  to={`/alerts/${rel.id}`}
                  className="flex items-start gap-2 hover:underline"
                >
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-2xs font-semibold bg-slate-100 text-slate-900 border border-slate-200 shrink-0 mt-0.5">
                    {rel.stateCode}
                  </span>
                  <span className="text-sm text-slate-900">
                    {rel.title}
                    <span className="text-xs text-slate-500 ml-2">
                      · {rel.authority}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
            {ann.relatedAnnouncementIds
              .filter((rid) => !allAnnouncements.some((a) => a.id === rid))
              .map((rid) => (
                <li key={rid} className="px-4 py-2.5 text-xs text-slate-500">
                  <span className="font-mono">{rid}</span> — referenced but not
                  yet in your feed
                </li>
              ))}
          </ul>
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
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
        onConfirm={({ clientIds, composeEmail }) => {
          console.info("[alerts] tagClientsForRelief (mock)", {
            announcementId: ann.id,
            clientIds,
            composeEmail,
          });
          setTagOpen(false);
          setFlash(
            `${clientIds.length} client${clientIds.length === 1 ? "" : "s"} tagged · Untag (24h window)`,
          );
        }}
      />

      <SchedulePlanningCallModal
        open={planningCallOpen}
        announcement={ann}
        recipients={selectedRecipients}
        onClose={() => setPlanningCallOpen(false)}
        onConfirm={({ clientIds, suggestedWindow, composeEmail }) => {
          console.info("[alerts] schedulePlanningCalls (mock)", {
            announcementId: ann.id,
            clientIds,
            suggestedWindow,
            composeEmail,
          });
          setPlanningCallOpen(false);
          setFlash(
            `${clientIds.length} call${clientIds.length === 1 ? "" : "s"} flagged on Today queue · Open queue`,
          );
        }}
      />

      <RecomputeEstimatesModal
        open={recomputeOpen}
        announcement={ann}
        recipients={selectedRecipients}
        onClose={() => setRecomputeOpen(false)}
        onConfirm={({ selections, composeEmail }) => {
          const totalEstimates = selections.reduce(
            (acc, s) => acc + s.estimateIds.length,
            0,
          );
          console.info("[alerts] recomputeEstimates (mock)", {
            announcementId: ann.id,
            selections,
            composeEmail,
          });
          setRecomputeOpen(false);
          setFlash(
            `${totalEstimates} estimate${totalEstimates === 1 ? "" : "s"} recomputed · Undo (5min)`,
          );
        }}
      />

      <NexusCheckModal
        open={nexusOpen}
        announcement={ann}
        recipients={selectedRecipients}
        onClose={() => setNexusOpen(false)}
        onConfirm={({ clientId, answers, selectedFilings, notifyOnly }) => {
          console.info("[alerts] runNexusCheck (mock)", {
            announcementId: ann.id,
            clientId,
            answers,
            selectedFilings,
            notifyOnly,
          });
          if (notifyOnly) {
            setFlash(`Notification queued for client · No filings added`);
          } else {
            setFlash(
              `${selectedFilings.length} filing${selectedFilings.length === 1 ? "" : "s"} added · Undo (24h)`,
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
      <dt className="w-32 shrink-0 text-xs uppercase tracking-wide text-slate-500 mt-0.5">
        {label}
      </dt>
      <dd className="text-slate-700">{children}</dd>
    </div>
  );
}
