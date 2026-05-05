import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, FileText, Sparkles, AlertTriangle, Check, ChevronRight, Mail, X, Circle, Pencil, FileCheck, CalendarClock, PauseCircle, AlertCircle } from "lucide-react";
import type { LucideProps } from "lucide-react";
import { toast } from "sonner";
import type { Client } from "../types";
import type { Deadline, DeadlineStatus } from "../types";
import { trpc } from "../lib/api/client";
import { actions } from "../data/store";
import { env } from "../config";
import type { FederalFormDTO } from "../lib/api/router";
import type { AddDeadlinePrefill } from "./AddDeadlineModal";
import { useTasksForClient } from "../hooks/useTasks";
import { useSelection } from "../hooks/useSelection";
import { BatchChaseDrawer } from "./BatchChaseDrawer";
import { formatLongDate } from "../data/dateHelpers";
import { StatusPill } from "./ui/StatusPill";
import { DEADLINE_STATUS_META } from "../lib/statusMeta";

/**
 * Disambiguate quarterly/monthly federal forms (941 / 720 / 1099-NEC
 * etc.) — the BE has the same `form` value on each deadline so a
 * client with three 941s appears as "941 / 941 / 941" with only the
 * due date to tell them apart. Compute a period suffix from the due
 * date for known quarterly forms. Yuqi audit 2026-05-06 — "why are
 * there three 941? you need to differentiate that".
 */
function periodSuffix(form: string, dueDate: string): string | null {
  const formNumber = form.replace(/\s*\(.*\)\s*$/, "").trim().toUpperCase();
  const month = parseInt(dueDate.slice(5, 7), 10);
  // Form 941 (quarterly): due Apr / Jul / Oct / Jan-of-next-year
  // covering Q1 / Q2 / Q3 / Q4 respectively. Same schedule for 720.
  if (formNumber === "941" || formNumber === "720") {
    if (month === 4) return "Q1";
    if (month === 7) return "Q2";
    if (month === 10) return "Q3";
    if (month === 1) return "Q4";
  }
  return null;
}

/**
 * FilingsTab — surfaces the federal forms that apply to this client,
 * sourced from the BE `federal_forms` table via
 * `trpc.federalForms.applicabilityForClient`.
 *
 * Why a tab and not a card-on-engagement: filings deserve their own
 * surface — a CPA evaluating a new client's scope wants to see "what
 * federal forms is this person likely on the hook for" without scrolling
 * past relationship score and primary verb. Lives between Engagement
 * (relationship status) and Habits (history) in the IA.
 *
 * Per `feedback_gap_over_fill`: the page splits into three zones —
 *   - Already covered: forms whose deadlines are seeded for this client
 *   - Suggested: applicable forms with no active deadline yet
 *   - Reference: rest of the curated catalog for entity type
 *
 * The "suggested" zone is the gap surface — clicking opens
 * AddDeadlineModal pre-filled with the form number.
 */

interface Props {
  client: Client;
  /** All deadlines for this client; used to mark which forms are
   *  already covered. Passed in rather than re-queried so we share
   *  the deadlines query with the parent component. */
  deadlines: Deadline[];
  /** Open the AddDeadlineModal pre-filled with the given form. */
  onAddDeadline: (prefill: AddDeadlinePrefill) => void;
}

export function FilingsTab({ client, deadlines, onAddDeadline }: Props) {
  const applicabilityQuery = trpc.federalForms.applicabilityForClient.useQuery({
    clientId: client.id,
  });
  const applicability = applicabilityQuery.data;

  // Tasks for this client — needed to map a Deadline row to its
  // owning Task so the row can navigate into TaskDetail. 1:1 with
  // Deadline at MVP per types.ts comment, so a single .find() lookup
  // by deadlineId is fine. Yuqi audit 2026-05-05: filing rows looked
  // like data but had no affordance — wrap as Link.
  const tasks = useTasksForClient(client.id);
  const taskByDeadlineId = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasks) {
      if (t.deadlineId) m.set(t.deadlineId, t.id);
    }
    return m;
  }, [tasks]);

  // Batch select state — keyed on deadline.id. Drives the per-row
  // checkbox column + the sticky bottom toolbar that appears when ≥1
  // row is selected. Yuqi audit 2026-05-05: "Batch select on client:
  // multi-select filings + send together." Single-client × multi-
  // filings → one summary email; powered by BatchChaseDrawer with one
  // recipient, where the {{context}} merge captures the filing list.
  const filingsSelection = useSelection<Deadline>(
    deadlines,
    (d) => d.id,
  );
  const [batchDrawerOpen, setBatchDrawerOpen] = useState(false);
  const selectedDeadlines = filingsSelection.selectedItems;

  // Catalog for "Reference" zone — every active federal form for the
  // entity type, including ones already covered. Filtered client-side
  // to active rows only.
  const catalogQuery = trpc.federalForms.list.useQuery({
    entityType: client.entityType,
  });

  // Deadlines are stored as `form` strings on the FE; the BE stores
  // form_type on deadlines. Normalize both sides to compare. We don't
  // try to be clever with synonyms — the catalog uses canonical
  // form_numbers and that's what AddDeadlineModal writes into deadline.form.
  const coveredFormNumbers = useMemo(() => {
    const set = new Set<string>();
    for (const d of deadlines) {
      // The legacy COMMON_FORMS list wrote things like "1040 (federal)".
      // Strip the "(...)" suffix so old rows still match new catalog.
      const bare = d.form.replace(/\s*\(.*\)\s*$/, "").trim().toUpperCase();
      set.add(bare);
    }
    return set;
  }, [deadlines]);

  // Hoisted above early returns to satisfy Rules of Hooks — depends only
  // on `deadlines` (prop) and `currentYear`, not on `applicability`.
  const currentYear = String(new Date().getFullYear());
  const filingsByYear = useMemo(() => {
    const m = new Map<string, { year: string; deadlines: Deadline[] }>();
    for (const d of deadlines) {
      const year = d.officialDueDate.slice(0, 4);
      const entry = m.get(year) ?? { year, deadlines: [] };
      entry.deadlines.push(d);
      m.set(year, entry);
    }
    if (!m.has(currentYear)) {
      m.set(currentYear, { year: currentYear, deadlines: [] });
    }
    const all = Array.from(m.values());
    const current = all.filter((y) => y.year === currentYear);
    const future = all
      .filter((y) => y.year > currentYear)
      .sort((a, b) => a.year.localeCompare(b.year));
    const past = all
      .filter((y) => y.year < currentYear)
      .sort((a, b) => b.year.localeCompare(a.year));
    return [...current, ...future, ...past];
  }, [deadlines, currentYear]);

  if (applicabilityQuery.isLoading) {
    return (
      <div className="bg-surface border border-line rounded-lg p-6 text-center text-sm text-ink-500">
        Loading filings catalog…
      </div>
    );
  }
  if (applicabilityQuery.error) {
    return (
      <div className="bg-surface border border-danger-border rounded-lg p-4 text-sm text-danger-ink">
        Couldn't load federal forms.{" "}
        <button
          className="underline"
          onClick={() => applicabilityQuery.refetch()}
        >
          Retry
        </button>
      </div>
    );
  }
  if (!applicability) return null;

  const applicableForms = applicability.forms;

  // Partition into "covered" (already has a deadline row) and
  // "suggested" (applicable but no deadline yet — the gap).
  const covered: typeof applicableForms = [];
  const suggested: typeof applicableForms = [];
  for (const item of applicableForms) {
    if (coveredFormNumbers.has(item.form.formNumber.toUpperCase())) {
      covered.push(item);
    } else {
      suggested.push(item);
    }
  }

  // Reference zone — everything else in the catalog for this entity
  // type that isn't already in `applicableForms` (those are the
  // entity-matched ones; the catalog query catches forms whose
  // entity_types is broader, e.g. info-returns).
  const applicableNumbers = new Set(
    applicableForms.map((f) => f.form.formNumber),
  );
  const reference = (catalogQuery.data ?? []).filter(
    (f) => !applicableNumbers.has(f.formNumber),
  );

  return (
    <div className="space-y-4">
      {/* "This year's filings" — surfaces the actual planned deadlines
          for the current tax year first. Replaces the previously-empty
          catalog placeholder copy. Per dogfooding 2026-05-05: users
          opened Filings expecting their filings, got engineering meta
          copy instead. */}
      {/* Filing plan — always rendered now (filingsByYear always has at
          least the current year via the seed in the useMemo above), so
          even an empty client sees "2026 — no filings yet" with a clear
          add-deadline affordance. */}
      {(
        <section className="bg-surface border border-line rounded-md">
          <header className="px-4 py-3 border-b border-line flex items-baseline gap-2">
            <h3 className="text-sm font-semibold text-ink-900">
              Filing plan
            </h3>
            <span className="text-2xs text-ink-500">
              {deadlines.length} {deadlines.length === 1 ? "filing" : "filings"}{" "}
              across {filingsByYear.length}{" "}
              {filingsByYear.length === 1 ? "tax year" : "tax years"}
            </span>
          </header>
          <div className="divide-y divide-line">
            {filingsByYear.map(({ year, deadlines: yrFilings }) => {
              const isCurrentYear = year === currentYear;
              const statusCounts = yrFilings.reduce<
                Record<string, number>
              >((acc, d) => {
                acc[d.status] = (acc[d.status] ?? 0) + 1;
                return acc;
              }, {});
              return (
                <div key={year} className="px-4 py-3">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        isCurrentYear ? "text-ink-900" : "text-ink-700"
                      }`}
                    >
                      {year}
                    </span>
                    {isCurrentYear && (
                      <span className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-info-bg text-info-ink border border-info-border">
                        Current tax year
                      </span>
                    )}
                    <span className="ml-auto text-2xs text-ink-500 inline-flex items-center gap-2">
                      {statusCounts.completed && (
                        <span className="text-ok-ink">
                          {statusCounts.completed} filed
                        </span>
                      )}
                      {statusCounts.filed_extension && (
                        <span className="text-warn-ink">
                          {statusCounts.filed_extension} extended
                        </span>
                      )}
                      {(statusCounts.not_started ||
                        statusCounts.in_progress ||
                        statusCounts.deferred) && (
                        <span>
                          {(statusCounts.not_started ?? 0) +
                            (statusCounts.in_progress ?? 0) +
                            (statusCounts.deferred ?? 0)}{" "}
                          open
                        </span>
                      )}
                    </span>
                  </div>
                  {yrFilings.length === 0 && (
                    <p className="text-xs text-ink-400 px-2 py-1">
                      No filings tracked for this tax year yet.
                    </p>
                  )}
                  <ul className="space-y-0.5 -mx-2">
                    {yrFilings
                      .slice()
                      .sort((a, b) =>
                        a.officialDueDate.localeCompare(b.officialDueDate),
                      )
                      .map((d) => {
                        const taskId = taskByDeadlineId.get(d.id);
                        const period = periodSuffix(d.form, d.officialDueDate);
                        const isSelected = filingsSelection.has(d.id);
                        // Row interior — same layout whether the row is
                        // a Link or a plain <li>. Wrapping prevents drift
                        // between the two render paths. Checkbox lives
                        // OUTSIDE the Link wrapper so clicking it doesn't
                        // navigate; e.stopPropagation guards the row click
                        // path (mousedown captures via the Link's onClick).
                        const checkbox = (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => filingsSelection.toggle(d.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3.5 h-3.5 rounded border-line accent-indigo shrink-0"
                            aria-label={`Select ${d.form} for batch action`}
                          />
                        );
                        const interior = (
                          <>
                            <span
                              className={`text-2xs uppercase tracking-wide font-mono px-1.5 py-0.5 rounded shrink-0 ${
                                d.jurisdiction === "federal"
                                  ? "bg-ink-900 text-canvas"
                                  : "bg-sunken text-ink-700 border border-line"
                              }`}
                            >
                              {d.jurisdiction === "federal"
                                ? "FED"
                                : d.jurisdiction.toUpperCase()}
                            </span>
                            <span className="text-ink-900">
                              {d.form}
                              {period && (
                                <span
                                  className="ml-1.5 text-2xs px-1.5 py-0.5 rounded bg-sunken text-ink-700 border border-line tabular-nums"
                                  title={`${period} of fiscal year`}
                                >
                                  {period}
                                </span>
                              )}
                            </span>
                            <span className="text-2xs text-ink-400 ml-auto tabular-nums">
                              due {d.officialDueDate}
                            </span>
                            <FilingStatusPill status={d.status} />
                          </>
                        );
                        return (
                          <li
                            key={d.id}
                            className="flex items-center gap-2 px-2"
                          >
                            {checkbox}
                            {/* Row affordance — Yuqi audit 2026-05-05:
                                "each filing row should click into task
                                detail." When the deadline has an owning
                                Task (1:1 at MVP), wrap as Link with hover
                                + chevron. Orphaned deadlines (no Task)
                                fall back to plain <li> — should be rare
                                but the seed data may have them. */}
                            {taskId ? (
                              <Link
                                to={`/clients/${client.id}?task=${taskId}`}
                                className="flex-1 flex items-center gap-3 text-sm py-1.5 rounded hover:bg-sunken transition-colors group"
                                title={`Open ${d.form} task →`}
                              >
                                {interior}
                                <ChevronRight
                                  className="w-3.5 h-3.5 text-ink-300 group-hover:text-ink-500 shrink-0"
                                  aria-hidden
                                />
                              </Link>
                            ) : (
                              <div className="flex-1 flex items-center gap-3 text-sm py-1.5 text-ink-400">
                                {interior}
                              </div>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <header className="flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">
            Federal forms catalog
          </h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Applicability for {client.name}{" "}
            <span className="text-ink-400">· Entity: {client.entityType}</span>
          </p>
        </div>
        <Link
          to="/settings/federal-forms"
          className="text-2xs text-ink-500 hover:text-ink-700 hover:underline"
        >
          Catalog admin →
        </Link>
      </header>

      {/* GAP SURFACE — applicable forms with no deadline yet. Loud by
          design per `feedback_gap_over_fill`. */}
      {suggested.length > 0 && (
        <section className="border border-warn-border bg-warn-bg/30 rounded-md">
          <header className="px-4 py-2 border-b border-warn-border/50 flex items-baseline gap-2">
            <Sparkles className="w-3.5 h-3.5 text-warn-ink" aria-hidden />
            <h4 className="text-xs uppercase tracking-wider text-warn-ink font-semibold">
              Suggested — applicable but no deadline yet
            </h4>
            <span className="ml-auto text-2xs text-warn-ink">
              {suggested.length} form
              {suggested.length === 1 ? "" : "s"}
            </span>
          </header>
          <ul className="divide-y divide-warn-border/40">
            {suggested.map((item) => (
              <FormRow
                key={item.form.id}
                form={item.form}
                confidence={item.confidence}
                reason={item.reason}
                covered={false}
                onAdd={() =>
                  onAddDeadline({
                    form: item.form.formNumber,
                    jurisdiction: "federal",
                    sourceNote: `Suggested from federal forms catalog · ${item.reason}`,
                  })
                }
              />
            ))}
          </ul>
        </section>
      )}

      {/* COVERED — applicable forms with at least one deadline row. */}
      {covered.length > 0 && (
        <section className="bg-surface border border-line rounded-md">
          <header className="px-4 py-2 border-b border-line flex items-baseline gap-2">
            <FileText className="w-3.5 h-3.5 text-ok-ink" aria-hidden />
            <h4 className="text-xs uppercase tracking-wider text-ink-700 font-semibold">
              Covered — already on the calendar
            </h4>
            <span className="ml-auto text-2xs text-ink-500">
              {covered.length} form
              {covered.length === 1 ? "" : "s"}
            </span>
          </header>
          <ul className="divide-y divide-line">
            {covered.map((item) => (
              <FormRow
                key={item.form.id}
                form={item.form}
                confidence={item.confidence}
                reason={item.reason}
                covered={true}
              />
            ))}
          </ul>
        </section>
      )}

      {/* REFERENCE — additional federal forms in the catalog filtered
          by entity type but not auto-suggested (broader entity_types,
          per_event triggers, etc.). Collapsed by default per the
          gap-over-fill rule. */}
      <ReferenceSection
        forms={reference}
        onAdd={(formNumber) =>
          onAddDeadline({
            form: formNumber,
            jurisdiction: "federal",
            sourceNote: "Picked from federal forms catalog",
          })
        }
      />

      {/* Footer note dropped 2026-05-05 — was "Catalog source: backend
          federal_forms table · Federal Register change-detection running
          every 6h." which is internal implementation detail with zero
          user payoff. The Catalog admin link in the section header
          already carries the trust signal (curated + auditable). */}

      {/* Sticky bottom toolbar — appears when ≥1 filing is selected.
          Mirrors the /clients toolbar shape for consistency: pill-shaped
          dark surface, count + primary action + Clear, fixed to viewport
          bottom. Single primary action ("Send summary") for now; future
          additions could include "Mark deferred" / "Reassign" / etc. */}
      {filingsSelection.count > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-ink-900 text-canvas rounded-lg shadow-overlay flex items-center gap-3 px-4 py-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="text-xs tabular-nums">
            <span className="font-semibold">{filingsSelection.count}</span>{" "}
            {filingsSelection.count === 1 ? "filing" : "filings"} selected
          </span>
          <span className="text-ink-500 text-2xs" aria-hidden>
            ·
          </span>
          {/* Visible-but-inactive in real mode (production / live BE) —
              hover tooltip explains "coming soon" instead of firing a
              click-to-toast pattern. The full sending flow (mock mode +
              real-mode wiring through a sibling sendBatchPersonalised
              proc) ships in the next pass; until then the affordance
              stays discoverable for design review without misleading
              users about its state. Mock mode keeps the full clickable
              behaviour so demo / dogfooding flows remain intact. */}
          {env.useMockData ? (
            <button
              type="button"
              onClick={() => setBatchDrawerOpen(true)}
              className="text-xs px-2.5 py-1 rounded bg-indigo hover:bg-indigo-hover transition-colors inline-flex items-center gap-1"
            >
              <Mail className="w-3 h-3" aria-hidden />
              Send summary email
            </button>
          ) : (
            <button
              type="button"
              disabled
              title="Sending summary emails — coming soon"
              className="text-xs px-2.5 py-1 rounded bg-sunken/20 text-ink-300 cursor-not-allowed inline-flex items-center gap-1"
            >
              <Mail className="w-3 h-3" aria-hidden />
              Send summary email (soon)
            </button>
          )}
          <button
            type="button"
            onClick={() => filingsSelection.clear()}
            className="text-xs text-ink-300 hover:text-canvas transition-colors px-2 inline-flex items-center gap-1"
            aria-label="Clear selection"
          >
            <X className="w-3 h-3" aria-hidden />
            Clear
          </button>
        </div>
      )}

      <BatchChaseDrawer
        open={batchDrawerOpen}
        intent="chase"
        recipients={[
          {
            clientId: client.id,
            clientName: client.name,
            clientEmail: client.contactEmail,
            // Format the selected filings as a multi-line bulleted list
            // that drops cleanly into the {{context}} merge token. Each
            // line: "• 1040 — due Apr 15, 2026". The drawer's default
            // "chase" body just embeds {{context}} as-is, so this list
            // becomes the body's call-out.
            context: selectedDeadlines
              .slice()
              .sort((a, b) =>
                a.officialDueDate.localeCompare(b.officialDueDate),
              )
              .map(
                (d) =>
                  `• ${d.form} — due ${formatLongDate(d.officialDueDate)}`,
              )
              .join("\n"),
          },
        ]}
        seed={{
          subject: `${client.name} — heads up on your upcoming filings`,
          body:
            "Hi {{client_name}},\n\nQuick heads up on the filings we're tracking for you:\n\n{{context}}\n\nWe'll be in touch as each one gets closer; reach out anytime if you have questions or anything's changed on your end.\n\n— The team at your CPA",
        }}
        onClose={() => setBatchDrawerOpen(false)}
        onSend={async (payload) => {
          // Single recipient — straightforward send. Mock-mode writes a
          // draft + sends; real-mode could route through the same
          // emails.send mutation per recipient pattern as the /clients
          // batch-send. For now, mock-mode only since the "summary email"
          // BE proc isn't carved out yet — flagged TODO.
          if (env.useMockData) {
            for (const r of payload.recipients) {
              const draftId = actions.saveEmailDraft({
                taskId: `filings-summary-${r.clientId}`,
                clientId: r.clientId,
                // Single-recipient drawer here — recipient is always
                // `client`, so contactEmail comes off the prop. Falls
                // back to a placeholder if the client has no email on
                // file (the drawer also shows a warning strip in that
                // case so the user knows it's a stub send).
                to: client.contactEmail ?? `${r.clientName} <client@example.com>`,
                cc: "",
                subject: r.subject,
                body: r.body,
                tone: "casual",
                aiSources: [],
                sendMethod: "cpa_send",
                status: "draft",
              });
              actions.sendEmail(draftId);
            }
            toast.success(
              `Sent summary covering ${selectedDeadlines.length} ${
                selectedDeadlines.length === 1 ? "filing" : "filings"
              }`,
            );
          } else {
            // TODO(real-mode): wire through to a generic emails.send
            // proc that takes per-recipient subject + body. The
            // /clients batch-send path uses sendBatchFileRequest;
            // we'd want a sibling proc here for proper audit trail.
            toast.info(
              "Sending in real mode requires a backend deploy — coming next pass",
            );
          }
          // Real mode never reaches this handler — the toolbar Send
          // button is rendered as a disabled "coming soon" affordance
          // when env.useMockData is false. Mock-mode flow only:
          for (const r of payload.recipients) {
            const draftId = actions.saveEmailDraft({
              taskId: `filings-summary-${r.clientId}`,
              clientId: r.clientId,
              // Single-recipient drawer here — recipient is always
              // `client`, so contactEmail comes off the prop. Falls
              // back to a placeholder if the client has no email on
              // file (the drawer also shows a warning strip in that
              // case so the user knows it's a stub send).
              to: client.contactEmail ?? `${r.clientName} <client@example.com>`,
              cc: "",
              subject: r.subject,
              body: r.body,
              tone: "casual",
              aiSources: [],
              sendMethod: "cpa_send",
              status: "draft",
            });
            actions.sendEmail(draftId);
          }
          toast.success(
            `Sent summary covering ${selectedDeadlines.length} ${
              selectedDeadlines.length === 1 ? "filing" : "filings"
            }`,
          );
          setBatchDrawerOpen(false);
          filingsSelection.clear();
        }}
      />
    </div>
  );
}

function FormRow({
  form,
  confidence,
  reason,
  covered,
  onAdd,
}: {
  form: FederalFormDTO;
  confidence: "high" | "medium";
  reason: string;
  covered: boolean;
  onAdd?: () => void;
}) {
  const isLlmExtracted = form.extractionMethod !== "curated";
  const needsReview = form.status === "pending_review";

  return (
    <li className="px-4 py-2.5 flex items-baseline gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-mono font-semibold text-ink-900">
            Form {form.formNumber}
          </span>
          <span className="text-xs text-ink-700 truncate">
            {form.formName}
          </span>
          {isLlmExtracted && (
            <span
              className="text-2xs px-1.5 py-0.5 rounded border border-line bg-sunken/40 text-ink-500"
              title={reason}
            >
              AI · {(form.confidenceScore * 100).toFixed(0)}%
            </span>
          )}
          {needsReview && (
            <span className="text-2xs px-1.5 py-0.5 rounded bg-warn-bg text-warn-ink inline-flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" aria-hidden />
              needs review
            </span>
          )}
          {confidence === "medium" && !isLlmExtracted && (
            <span
              className="text-2xs text-ink-400"
              title={reason}
            >
              · broad entity match
            </span>
          )}
        </div>
        {form.notes && (
          <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">
            {form.notes}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {form.irsUrl && (
          <a
            href={form.irsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-2xs text-ink-500 hover:text-ink-700 inline-flex items-center gap-0.5"
            title="Open IRS reference"
          >
            IRS
            <ExternalLink className="w-2.5 h-2.5" aria-hidden />
          </a>
        )}
        {covered ? (
          <span className="inline-flex items-center gap-0.5 text-2xs text-ok-ink font-medium">
            Covered <Check className="w-3 h-3" aria-hidden />
          </span>
        ) : (
          onAdd && (
            <button
              onClick={onAdd}
              className="text-xs px-2 py-1 rounded border border-line bg-surface text-ink-700 hover:bg-sunken"
            >
              Add deadline
            </button>
          )
        )}
      </div>
    </li>
  );
}

const DEADLINE_ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Circle, Pencil, FileCheck, CalendarClock, PauseCircle, AlertCircle,
};

function FilingStatusPill({ status }: { status: DeadlineStatus }) {
  const meta = DEADLINE_STATUS_META[status];
  const Icon = DEADLINE_ICON_MAP[meta.icon];
  return (
    <StatusPill variant={meta.variant} size="xs" title={meta.title}>
      {Icon && <Icon size={11} aria-hidden />}
      {meta.label}
    </StatusPill>
  );
}

function ReferenceSection({
  forms,
  onAdd,
}: {
  forms: FederalFormDTO[];
  onAdd: (formNumber: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (forms.length === 0) return null;

  return (
    <section className="bg-surface border border-line rounded-md">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-4 py-2 flex items-baseline gap-2 hover:bg-sunken/40"
      >
        <span className="text-xs uppercase tracking-wider text-ink-500 font-semibold">
          Reference catalog
        </span>
        <span className="text-2xs text-ink-400">
          {forms.length} form{forms.length === 1 ? "" : "s"} (entity match,
          not auto-suggested)
        </span>
        <span className="ml-auto text-ink-400">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <ul className="divide-y divide-line border-t border-line">
          {forms.map((form) => (
            <FormRow
              key={form.id}
              form={form}
              confidence="medium"
              reason="Reference catalog row"
              covered={false}
              onAdd={() => onAdd(form.formNumber)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
