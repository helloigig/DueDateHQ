import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  TOPIC_LABEL,
} from "../data/announcementLabels";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { BatchNotifyModal } from "../components/BatchNotifyModal";
import { DismissWithReasonDialog } from "../components/DismissWithReasonDialog";
import { BatchApplyProgress } from "../components/BatchApplyProgress";

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
  const [confirm, setConfirm] = useState<"batch" | null>(null);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [progress, setProgress] = useState<{
    total: number;
    done: number;
  } | null>(null);

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

  const doBatchAdjust = () => {
    if (!ann.oldDeadline || !ann.newDeadline) return;
    const ids = Array.from(selected);
    const total = ids.length;
    setConfirm(null);
    setProgress({ total, done: 0 });

    let i = 0;
    const tick = () => {
      i += 1;
      if (i <= total) {
        setProgress({ total, done: i });
        setTimeout(tick, Math.max(60, 240 - total * 8));
      } else {
        actions.batchAdjustDeadlines(
          ids,
          ann.oldDeadline!,
          ann.newDeadline!,
          ann.title
        );
        setProgress(null);
        setFlash(
          `${total} deadline${total === 1 ? "" : "s"} adjusted to ${formatLongDate(
            ann.newDeadline!
          )}.`
        );
      }
    };
    setTimeout(tick, 200);
  };

  const doDismissWithReason = (reason: string) => {
    actions.dismissAnnouncement(ann.id, reason);
    setDismissOpen(false);
    navigate("/alerts");
  };

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
              <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {TOPIC_LABEL[ann.type]}
              </span>
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
        <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm px-4 py-3">
          ✓ {flash}
        </div>
      )}

      <section className="mt-5 bg-white border border-slate-200 rounded-lg">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">
            📋 PARSED IMPACT
          </h2>
          <span
            className={`ml-auto text-xs px-2 py-0.5 rounded ${
              CONFIDENCE_TONE[ann.parseConfidence]
            }`}
          >
            AI parse: {CONFIDENCE_LABEL[ann.parseConfidence]}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              CONFIDENCE_TONE[ann.matchConfidence]
            }`}
          >
            AI match: {CONFIDENCE_LABEL[ann.matchConfidence]}
          </span>
        </div>
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
        <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-900">
          ⚠ Always verify against the official source before acting.{" "}
          <button className="underline">Report parsing issue</button>
        </div>
      </section>

      {(relatedAlerts.length > 0 || ann.relatedAnnouncementIds.length > 0) && (
        <section className="mt-5 bg-white border border-slate-200 rounded-lg">
          <div className="flex items-center px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Link2 className="w-3.5 h-3.5" aria-hidden />
              RELATED ALERTS
            </h2>
            <span className="ml-2 text-xs text-slate-500">
              {ann.relatedAnnouncementIds.length} cross-reference
              {ann.relatedAnnouncementIds.length === 1 ? "" : "s"}
            </span>
          </div>
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
        </section>
      )}

      <section className="mt-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">
            🎯 AFFECTED CLIENTS ({ann.affectedClientIds.length})
          </h2>
          <button
            onClick={toggleAll}
            className="ml-auto text-xs text-indigo-600 hover:underline"
          >
            {selected.size === (ann.affectedClientIds ?? []).length
              ? "Deselect all"
              : "Select all"}
          </button>
        </div>
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
                <span className="text-xs text-slate-500 w-32 truncate">
                  {c.county ? `${c.county}, ${c.primaryState}` : c.primaryState}
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

      <section className="mt-5 bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap gap-2 sticky bottom-0">
        <button
          onClick={() => setConfirm("batch")}
          disabled={selectedCount === 0 || !ann.newDeadline}
          className="px-4 py-2 rounded bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {ann.newDeadline ? (
            <>
              Adjust {selectedCount} deadline
              {selectedCount === 1 ? "" : "s"} to{" "}
              {formatLongDate(ann.newDeadline)}
            </>
          ) : (
            <>
              Review {selectedCount} deadline
              {selectedCount === 1 ? "" : "s"}
            </>
          )}
        </button>
        <button
          onClick={() => setNotifyOpen(true)}
          disabled={selectedCount === 0}
          className="px-4 py-2 rounded border border-slate-200 text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Notify {selectedCount} client{selectedCount === 1 ? "" : "s"} by email
        </button>
        <button className="px-4 py-2 rounded border border-slate-200 text-sm hover:bg-slate-50">
          Review one-by-one
        </button>
        <button
          onClick={() => setDismissOpen(true)}
          className="ml-auto px-4 py-2 rounded text-sm text-slate-500 hover:bg-slate-50"
        >
          Not applicable — dismiss
        </button>
      </section>

      <BatchApplyProgress
        open={!!progress}
        total={progress?.total ?? 0}
        done={progress?.done ?? 0}
        title={`Adjusting ${progress?.total ?? 0} deadline${
          (progress?.total ?? 0) === 1 ? "" : "s"
        }`}
        subtitle={
          ann.newDeadline
            ? `New deadline: ${formatLongDate(ann.newDeadline)}`
            : ""
        }
      />

      <ConfirmDialog
        open={confirm === "batch"}
        title={`Move ${selectedCount} deadline${
          selectedCount === 1 ? "" : "s"
        }?`}
        body={
          <>
            <p>
              Changing the official due date from{" "}
              <strong>
                {ann.oldDeadline ? formatLongDate(ann.oldDeadline) : "—"}
              </strong>{" "}
              to{" "}
              <strong>
                {ann.newDeadline ? formatLongDate(ann.newDeadline) : "—"}
              </strong>{" "}
              on {selectedCount} client deadline
              {selectedCount === 1 ? "" : "s"}.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Each change is recorded in the client activity log and can be
              reverted individually.
            </p>
          </>
        }
        confirmLabel="Apply changes"
        onConfirm={doBatchAdjust}
        onCancel={() => setConfirm(null)}
      />

      <BatchNotifyModal
        open={notifyOpen}
        announcement={ann}
        recipients={Array.from(selected)
          .map((cid) => clientsById.get(cid))
          .filter((c): c is NonNullable<typeof c> => !!c)}
        onClose={() => setNotifyOpen(false)}
        onSent={(count) =>
          setFlash(
            `Notification queued for ${count} recipient${count === 1 ? "" : "s"}.`
          )
        }
      />

      <DismissWithReasonDialog
        open={dismissOpen}
        onConfirm={doDismissWithReason}
        onCancel={() => setDismissOpen(false)}
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
