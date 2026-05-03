/**
 * NexusCheckModal — nexus_change action surface.
 *
 * Two modes:
 *   - "expansion" (most common): per-client questionnaire → suggested filings
 *     → batch add deadlines
 *   - "contraction": list filings that may be removable, per-row "no longer
 *     required" or "keep protective"
 *
 * Spec: docs/specs/alert-detail-nexus-change.md
 *
 * The questionnaire is intentionally minimal here. Production version reads
 * per-state question banks from backend/src/lib/nexus-rules.ts (P1 work).
 */
import { useMemo, useState } from "react";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import type { Announcement, Client } from "../types";
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

// Mock per-state question bank. Production reads from backend.
const PA_SALES_NEXUS_QUESTIONS = [
  { id: "pa1", text: "Did the client deliver tangible goods to PA addresses in 2025?" },
  { id: "pa2", text: "Did the client provide services to PA-based customers?" },
  { id: "pa3", text: "Did the client use a marketplace facilitator (Amazon, Etsy) for PA sales?" },
  { id: "pa4", text: "Does the client already have a PA sales tax license?" },
];

interface SuggestedFiling {
  formCode: string;
  formName: string;
  caveat?: string;
}

const PA_SALES_FILINGS: SuggestedFiling[] = [
  { formCode: "PA REV-72", formName: "Sales tax registration" },
  { formCode: "PA-3", formName: "Quarterly sales tax remittance" },
  { formCode: "PA Corp", formName: "Corporate income tax", caveat: "verify income nexus" },
];

export interface NexusCheckModalProps {
  open: boolean;
  announcement: Announcement | null;
  recipients: Client[];
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
  onClose,
  onConfirm,
}: NexusCheckModalProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [allAnswers, setAllAnswers] = useState<Record<string, Record<string, boolean>>>({});
  const [allSelections, setAllSelections] = useState<Record<string, Set<string>>>({});

  const activeClient = recipients[activeIndex] ?? null;

  // Result derivation: simple mock — at least 2 yes-answers means established.
  const result = useMemo(() => {
    if (!activeClient) return { status: "not_started", confidence: "low" as const };
    const ans = allAnswers[activeClient.id] ?? {};
    const yesCount = Object.values(ans).filter(Boolean).length;
    const totalAnswered = Object.keys(ans).length;
    if (totalAnswered === 0) return { status: "not_started", confidence: "low" as const };
    if (totalAnswered < PA_SALES_NEXUS_QUESTIONS.length)
      return { status: "in_progress", confidence: "low" as const };
    if (yesCount >= 2) return { status: "established", confidence: "high" as const };
    if (yesCount === 1) return { status: "borderline", confidence: "medium" as const };
    return { status: "no_nexus", confidence: "high" as const };
  }, [activeClient, allAnswers]);

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
                <span className="font-medium text-ink-900">{activeClient.name}</span> —{" "}
                {activeClient.entityType} · {activeClient.primaryState}
              </>
            ) : (
              "All clients reviewed"
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 max-h-[28rem] overflow-y-auto">
          {/* Questionnaire */}
          <div className="border border-line rounded-md bg-surface">
            <div className="px-3 py-2 border-b border-line">
              <p className="text-xs uppercase tracking-wide text-ink-500 font-semibold">
                Activity questions
              </p>
            </div>
            <ul className="divide-y divide-line">
              {PA_SALES_NEXUS_QUESTIONS.map((q) => {
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

          {/* Result chip */}
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

          {/* Suggested filings (only when nexus established) */}
          {result.status === "established" && (
            <div className="border border-warn-border rounded-md bg-warn-bg/20">
              <div className="px-3 py-2 border-b border-warn-border/50 flex items-baseline gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-warn-ink" aria-hidden />
                <p className="text-xs uppercase tracking-wide text-warn-ink font-semibold">
                  Suggested filings to add
                </p>
              </div>
              <ul className="divide-y divide-warn-border/30">
                {PA_SALES_FILINGS.map((f) => {
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
          >
            Notify only · Skip filings
          </Button>
          <Button
            onClick={() => submitForActive(false)}
            disabled={
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
