import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, FileText, Sparkles, AlertTriangle } from "lucide-react";
import type { Client } from "../types";
import type { Deadline } from "../types";
import { trpc } from "../lib/api/client";
import type { FederalFormDTO } from "../lib/api/router";
import type { AddDeadlinePrefill } from "./AddDeadlineModal";

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
      <header className="flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">
            Federal filings
          </h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Catalog-driven applicability for {client.name}.
            <span className="text-ink-400">
              {" "}
              · Entity: {client.entityType}
            </span>
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
        <section className="border-2 border-warn-border bg-warn-bg/30 rounded-md">
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

      {/* Footer note — provenance is the trust signal. */}
      <p className="text-2xs text-ink-400 px-1">
        Catalog source: backend federal_forms table · Federal Register
        change-detection running every 6h.
      </p>
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
          <span className="text-2xs text-ok-ink font-medium">Covered ✓</span>
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
