/**
 * Settings → Federal Forms (admin reviewer queue).
 *
 * Surfaces `federal_form_change_events` from the BE so an admin can
 * Apply / Reject parsed catalog changes detected by the federal-register
 * polling worker.
 *
 * Spec: docs/specs/alert-detail-form-change.md §6 (admin variant)
 *
 * Companion routes: /alerts/:id (form_change variant) routes here via
 * "Open admin reviewer queue →" verb.
 *
 * V1 scope:
 *   - List unreviewed events (default) + toggle to show all-time history
 *   - Per-event row: form / changeKind chip / summary / parse-confidence
 *     chip / source notice link / Apply / Reject buttons
 *   - Reject collects required reason via shadcn Dialog
 *   - Apply uses the BE-returned event id (no in-page diff editor; for
 *     deep diff editing, /alerts/:eventId still surfaces
 *     <CatalogChangeReviewPanel /> in modify mode)
 *
 * V2:
 *   - Inline per-field diff with "modify before apply"
 *   - Filter by form / change kind / age
 *   - Bulk apply (e.g. all high-confidence in one click)
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  ExternalLink,
  FileText,
  Inbox,
  X,
} from "lucide-react";
import { trpc } from "../lib/api/client";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { SectionHeader } from "../components/ui/SectionHeader";

const CHANGE_KIND_LABEL: Record<string, string> = {
  due_date_change: "Due date change",
  form_revision: "Form revision",
  new_form: "New form",
  deprecation: "Form deprecated",
  instructions_update: "Instructions update",
  other: "Other",
};

const CONFIDENCE_TONE: Record<string, string> = {
  high: "bg-ok-bg text-ok-ink border-ok-border",
  medium: "bg-sunken text-ink-700 border-line",
  low: "bg-warn-bg text-warn-ink border-warn-border",
};

export function SettingsFederalFormsPanel() {
  const [includeReviewed, setIncludeReviewed] = useState(false);
  const queue = trpc.federalForms.recentChanges.useQuery({
    limit: 50,
    includeReviewed,
  });
  const utils = trpc.useUtils();
  const applyMutation = trpc.federalForms.applyChangeEvent.useMutation({
    onSuccess: () => utils.federalForms.recentChanges.invalidate(),
  });
  const rejectMutation = trpc.federalForms.rejectChangeEvent.useMutation({
    onSuccess: () => utils.federalForms.recentChanges.invalidate(),
  });

  const [rejectTarget, setRejectTarget] = useState<{
    eventId: number;
    formNumber: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionFlash, setActionFlash] = useState<string | null>(null);

  const events = queue.data ?? [];

  return (
    <section className="space-y-4">
      <header>
        <SectionHeader title="Federal forms catalog" />
        <p className="-mt-region text-sm text-ink-500">
          Federal Register polling detected the changes below. Apply to update
          the catalog (drives FilingsTab + AddDeadlineModal); reject if the AI
          parsed wrong. Source notices link out for verification.
        </p>
      </header>

      <div className="flex items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={includeReviewed}
            onChange={(e) => setIncludeReviewed(e.target.checked)}
            className="w-4 h-4 accent-info-solid"
          />
          <span className="text-ink-700">Show reviewed (history)</span>
        </label>
        <Link
          to="/alerts?type=form_change"
          className="ml-auto text-xs text-ink-500 hover:text-ink-900 hover:underline"
        >
          See form_change alerts on /alerts →
        </Link>
      </div>

      {actionFlash && (
        <div className="rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm px-4 py-2 inline-flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" aria-hidden />
          <span>{actionFlash}</span>
        </div>
      )}

      {queue.isLoading && (
        <div className="bg-surface border border-line rounded-lg p-6 text-center text-sm text-ink-500">
          Loading reviewer queue…
        </div>
      )}

      {!queue.isLoading && events.length === 0 && (
        <div className="bg-surface border border-line rounded-lg p-10 text-center">
          <Inbox className="w-8 h-8 mx-auto text-ink-400" aria-hidden />
          <p className="mt-3 text-sm font-medium text-ink-900">
            {includeReviewed
              ? "No catalog changes have been processed yet."
              : "No pending catalog changes."}
          </p>
          <p className="mt-1 text-xs text-ink-500 max-w-md mx-auto">
            The federal-register-poller runs every 6h. When IRS or Treasury
            publishes a notice that touches a form in the catalog, it shows
            up here for your review.
          </p>
        </div>
      )}

      {events.length > 0 && (
        <ul className="bg-surface border border-line rounded-lg divide-y divide-line">
          {events.map((event) => {
            const tone =
              CONFIDENCE_TONE[event.notice.parseConfidence ?? "medium"] ??
              CONFIDENCE_TONE.medium;
            const isResolved = !!event.appliedAt;
            return (
              <li key={event.eventId} className="px-4 py-3">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-mono font-semibold text-ink-900">
                    Form {event.form.formNumber}
                  </span>
                  <span className="text-sm text-ink-700 truncate">
                    {event.form.formName}
                  </span>
                  <span className="ml-auto text-2xs px-1.5 py-0.5 rounded bg-sunken text-ink-700 border border-line">
                    {CHANGE_KIND_LABEL[event.changeKind] ?? event.changeKind}
                  </span>
                  <span
                    className={`text-2xs px-1.5 py-0.5 rounded border ${tone}`}
                    title={`AI parse confidence: ${event.notice.parseConfidence}`}
                  >
                    AI: {event.notice.parseConfidence}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-ink-700">{event.summary}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-ink-500">
                  <span>
                    Detected {new Date(event.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-ink-400">·</span>
                  <a
                    href={event.notice.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-ink-500 hover:text-ink-900 hover:underline"
                  >
                    <FileText className="w-3 h-3" aria-hidden />
                    {event.notice.title.length > 60
                      ? event.notice.title.slice(0, 57) + "…"
                      : event.notice.title}
                    <ExternalLink className="w-2.5 h-2.5" aria-hidden />
                  </a>
                </div>
                {isResolved && (
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-ok-ink">
                    <Check className="w-3 h-3" aria-hidden />
                    Applied {new Date(event.appliedAt!).toLocaleDateString()}
                  </p>
                )}
                {!isResolved && (
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          const result = await applyMutation.mutateAsync({
                            eventId: event.eventId,
                          });
                          setActionFlash(
                            `Form ${event.form.formNumber} updated (${result.fieldsApplied.join(", ")})`,
                          );
                        } catch (err) {
                          setActionFlash(
                            `Couldn't apply — ${err instanceof Error ? err.message : "try again"}`,
                          );
                        }
                      }}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" aria-hidden />
                      Apply change
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setRejectTarget({
                          eventId: event.eventId,
                          formNumber: event.form.formNumber,
                        })
                      }
                    >
                      <X className="w-3.5 h-3.5 mr-1" aria-hidden />
                      Reject change
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              Reject Form {rejectTarget?.formNumber} catalog change?
            </DialogTitle>
            <DialogDescription>
              The change_event will be marked rejected with this reason.
              No catalog mutation. The reason feeds the parser feedback loop.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Duplicate of prior change · Editorial-only re-publish · AI parsed wrong field"
              className="w-full text-sm px-3 py-2 rounded border border-line focus:outline-none focus:ring-2 focus:ring-danger-solid/30"
              rows={3}
              autoFocus
            />
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!rejectTarget) return;
                try {
                  await rejectMutation.mutateAsync({
                    eventId: rejectTarget.eventId,
                    reason: rejectReason.trim(),
                  });
                  setActionFlash(
                    `Form ${rejectTarget.formNumber} catalog change rejected`,
                  );
                } catch (err) {
                  setActionFlash(
                    `Couldn't reject — ${err instanceof Error ? err.message : "try again"}`,
                  );
                }
                setRejectTarget(null);
                setRejectReason("");
              }}
              disabled={rejectReason.trim().length === 0}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
