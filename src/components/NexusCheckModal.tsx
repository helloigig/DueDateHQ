/**
 * NexusCheckModal — nexus_change action surface.
 *
 * Per-client questionnaire → suggested filings → batch add deadlines.
 * Questions and filing suggestions are fetched from
 * `alertActions.getNexusQuestionnaire` per-state, which the BE backs with
 * the rule bank in backend/src/lib/nexus-rules.ts.
 *
 * Spec: docs/specs/alert-detail-nexus-change.md
 */
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import type { Announcement } from "../types";
import { trpc } from "../lib/api/client";

/** Slim recipient shape — covers both full Client objects from the
 *  store/clients router and the trimmed AffectedClient row used by
 *  the Alerts CopilotPane. Display-only fields are optional. */
export interface NexusRecipient {
  id: string;
  name: string;
  entityType?: string;
  primaryState?: string;
}
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

type NexusKind = "sales" | "income" | "payroll" | "franchise";

export interface NexusCheckModalProps {
  open: boolean;
  announcement: Announcement | null;
  recipients: NexusRecipient[];
  /** Defaults to "sales" — the most common nexus_change driver. */
  nexusKind?: NexusKind;
  onClose: () => void;
  onConfirm: (input: {
    clientId: string;
    answers: Record<string, boolean>;
    selectedFilings: string[];
    notifyOnly: boolean;
  }) => void;
}

export function NexusCheckModal({
  open,
  announcement,
  recipients,
  nexusKind = "sales",
  onClose,
  onConfirm,
}: NexusCheckModalProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [allAnswers, setAllAnswers] = useState<Record<string, Record<string, boolean>>>({});
  const [allSelections, setAllSelections] = useState<Record<string, Set<string>>>({});

  const activeClient = recipients[activeIndex] ?? null;

  // Per-state questionnaire from BE. Only fetch when modal is open and we
  // know the state — cached by tRPC for the session.
  const stateCode = announcement?.stateCode ?? "";
  const questionnaireQuery = trpc.alertActions.getNexusQuestionnaire.useQuery(
    { state: stateCode, nexusKind },
    { enabled: open && stateCode.length === 2 },
  );
  const questionnaire = questionnaireQuery.data ?? null;
  const questions = questionnaire?.questions ?? [];
  const filings = questionnaire?.suggestedFilings ?? [];

  // Result derivation: ≥2 yes-answers means established. Mirrors the BE
  // default heuristic in runNexusCheck so the FE can preview the call's
  // outcome before submission.
  const result = useMemo(() => {
    if (!activeClient || questions.length === 0)
      return { status: "not_started", confidence: "low" as const };
    const ans = allAnswers[activeClient.id] ?? {};
    const yesCount = Object.values(ans).filter(Boolean).length;
    const totalAnswered = Object.keys(ans).length;
    if (totalAnswered === 0) return { status: "not_started", confidence: "low" as const };
    if (totalAnswered < questions.length)
      return { status: "in_progress", confidence: "low" as const };
    if (yesCount >= 2) return { status: "established", confidence: "high" as const };
    if (yesCount === 1) return { status: "borderline", confidence: "medium" as const };
    return { status: "no_nexus", confidence: "high" as const };
  }, [activeClient, allAnswers, questions.length]);

  // Pre-check default filings the moment a client crosses into "established"
  // — but only once per client, so the user is free to deselect. Tracked by
  // a "primed" set: if the client's selection set is missing entirely, prime
  // it with the BE-flagged defaults.
  useEffect(() => {
    if (result.status !== "established" || !activeClient) return;
    if (allSelections[activeClient.id]) return;
    const defaults = filings
      .filter((f) => f.preCheckedOnEstablished)
      .map((f) => f.formCode);
    if (defaults.length === 0) return;
    setAllSelections((prev) => ({
      ...prev,
      [activeClient.id]: new Set(defaults),
    }));
  }, [result.status, activeClient, filings, allSelections]);

  if (!announcement) return null;

  const setAnswer = (qId: string, val: boolean) => {
    if (!activeClient) return;
    setAllAnswers((prev) => ({
      ...prev,
      [activeClient.id]: { ...(prev[activeClient.id] ?? {}), [qId]: val },
    }));
  };

  const toggleFiling = (formCode: string) => {
    if (!activeClient) return;
    setAllSelections((prev) => {
      const cur = new Set(prev[activeClient.id] ?? []);
      if (cur.has(formCode)) cur.delete(formCode);
      else cur.add(formCode);
      return { ...prev, [activeClient.id]: cur };
    });
  };

  const submitForActive = (notifyOnly: boolean) => {
    if (!activeClient) return;
    onConfirm({
      clientId: activeClient.id,
      answers: allAnswers[activeClient.id] ?? {},
      selectedFilings: Array.from(allSelections[activeClient.id] ?? []),
      notifyOnly,
    });
    if (activeIndex + 1 < recipients.length) {
      setActiveIndex(activeIndex + 1);
    } else {
      onClose();
    }
  };

  const isLoading = questionnaireQuery.isLoading;
  const loadError = questionnaireQuery.error?.message ?? null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-info-ink" aria-hidden />
            Run nexus check — client {activeIndex + 1} of {recipients.length}
          </DialogTitle>
          <DialogDescription>
            {activeClient ? (
              <>
                <span className="font-medium text-ink-900">{activeClient.name}</span>
                {activeClient.entityType || activeClient.primaryState ? (
                  <>
                    {" "}—{" "}
                    {[activeClient.entityType, activeClient.primaryState]
                      .filter(Boolean)
                      .join(" · ")}
                  </>
                ) : null}
              </>
            ) : (
              "All clients reviewed"
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 max-h-[28rem] overflow-y-auto">
          {/* Threshold context — explains *why* we're asking */}
          {questionnaire && (
            <div className="border border-info-border bg-info-bg/30 rounded-md px-3 py-2 text-xs text-info-ink">
              <p className="font-semibold uppercase tracking-wide text-2xs">
                {questionnaire.state} · {questionnaire.nexusKind} nexus threshold
              </p>
              <p className="mt-1 text-ink-700 leading-relaxed">
                {questionnaire.thresholdSummary}
              </p>
              <p className="mt-1 text-ink-500">
                Rule effective {new Date(questionnaire.ruleEffectiveDate).toLocaleDateString()}
              </p>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-ink-500">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              Loading {stateCode} questionnaire…
            </div>
          )}

          {loadError && (
            <div className="border border-warn-border bg-warn-bg/30 rounded-md px-3 py-2 text-sm text-warn-ink">
              Couldn't load questionnaire — {loadError}
            </div>
          )}

          {/* Questionnaire */}
          {!isLoading && !loadError && questions.length > 0 && (
            <div className="border border-line rounded-md bg-surface">
              <div className="px-3 py-2 border-b border-line">
                <p className="text-xs uppercase tracking-wide text-ink-500 font-semibold">
                  Activity questions
                </p>
              </div>
              <ul className="divide-y divide-line">
                {questions.map((q) => {
                  const ans = allAnswers[activeClient?.id ?? ""]?.[q.id];
                  return (
                    <li key={q.id} className="px-3 py-2.5 flex items-center gap-3">
                      <p className="flex-1 text-sm text-ink-800">{q.text}</p>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setAnswer(q.id, true)}
                          className={`px-2.5 py-1 text-xs rounded border ${
                            ans === true
                              ? "bg-info-bg text-info-ink border-info-border ring-2 ring-info-solid/30"
                              : "border-line hover:bg-sunken/30"
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnswer(q.id, false)}
                          className={`px-2.5 py-1 text-xs rounded border ${
                            ans === false
                              ? "bg-line text-ink-900 border-line-strong ring-2 ring-line-strong/30"
                              : "border-line hover:bg-sunken/30"
                          }`}
                        >
                          No
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Result chip */}
          {!isLoading && !loadError && questions.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded border border-line bg-sunken/30">
              <span className="text-xs uppercase tracking-wide text-ink-500 font-semibold">
                Result:
              </span>
              <span
                className={`text-sm px-2 py-0.5 rounded font-medium ${
                  result.status === "established"
                    ? "bg-warn-bg text-warn-ink"
                    : result.status === "borderline"
                      ? "bg-info-bg text-info-ink"
                      : result.status === "no_nexus"
                        ? "bg-ok-bg text-ok-ink"
                        : "bg-sunken text-ink-500"
                }`}
              >
                {result.status === "not_started" && "Answer questions to determine"}
                {result.status === "in_progress" && "Keep going…"}
                {result.status === "established" && "Nexus likely established"}
                {result.status === "borderline" && "Borderline — flag for follow-up"}
                {result.status === "no_nexus" && "No nexus — safe to skip"}
              </span>
              <span className="ml-auto text-xs text-ink-500">
                Confidence: {result.confidence}
              </span>
            </div>
          )}

          {/* Suggested filings (only when nexus established) */}
          {result.status === "established" && filings.length > 0 && (
            <div className="border border-warn-border rounded-md bg-warn-bg/20">
              <div className="px-3 py-2 border-b border-warn-border/50 flex items-baseline gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-warn-ink" aria-hidden />
                <p className="text-xs uppercase tracking-wide text-warn-ink font-semibold">
                  Suggested filings to add
                </p>
              </div>
              <ul className="divide-y divide-warn-border/30">
                {filings.map((f) => {
                  const checked =
                    allSelections[activeClient?.id ?? ""]?.has(f.formCode) ?? false;
                  return (
                    <li key={f.formCode} className="px-3 py-2 flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFiling(f.formCode)}
                        className="w-4 h-4 accent-warn-solid"
                      />
                      <div className="flex-1 text-sm">
                        <span className="font-mono text-ink-900">{f.formCode}</span>
                        <span className="text-ink-600 ml-2">{f.formName}</span>
                      </div>
                      {f.caveat && (
                        <span className="text-2xs text-warn-ink italic shrink-0">
                          [{f.caveat}]
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel all
          </Button>
          <Button
            variant="ghost"
            onClick={() => submitForActive(true)}
            disabled={isLoading}
          >
            Notify only, skip filings
          </Button>
          <Button
            onClick={() => submitForActive(false)}
            disabled={
              isLoading ||
              result.status !== "established" ||
              (allSelections[activeClient?.id ?? ""]?.size ?? 0) === 0
            }
          >
            {activeIndex + 1 < recipients.length
              ? "Save · Next client →"
              : "Save · Done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
