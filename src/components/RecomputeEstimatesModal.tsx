/**
 * RecomputeEstimatesModal — rate_change action surface.
 *
 * Lists Q-estimates affected by the rate change with old → new amounts.
 * Auto-pay clients get a flag — Sarah will need to update the bank
 * instruction manually after the recompute (TodoItem auto-created).
 *
 * Spec: docs/specs/alert-detail-rate-change.md
 *
 * BE handler stub: actual estimate calculator (estimate-calculator.ts) is
 * the heavy lift — it encodes federal + 50-state rate schedules. For the
 * design-stage modal we use mock deltas computed from the alert metadata.
 */
import { useMemo, useState } from "react";
import { Calculator, Mail, AlertCircle } from "lucide-react";
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

interface MockEstimate {
  id: string;
  period: string;
  dueDate: string;
  oldAmountCents: number;
  newAmountCents: number;
  excludeReason: "paid" | "below_threshold" | "auto_pay" | null;
  cascadeNote?: string;
}

export interface RecomputeEstimatesModalProps {
  open: boolean;
  announcement: Announcement | null;
  recipients: Client[];
  onClose: () => void;
  onConfirm: (input: {
    selections: Array<{ clientId: string; estimateIds: string[] }>;
    composeEmail: boolean;
  }) => void;
}

const MATERIAL_THRESHOLD_CENTS = 20000; // $200/year delta gate

const fmtCents = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

// Mock estimate generator — in production, BE returns these per-client.
function mockEstimatesFor(client: Client): MockEstimate[] {
  const baseAmount = client.entityType === "Individual" ? 1875000 : 4250000;
  const deltaPct = 0.031;
  const newAmt = Math.round(baseAmount * (1 + deltaPct));
  return [
    { id: `${client.id}-q1`, period: "Q1 2026", dueDate: "Apr 15", oldAmountCents: baseAmount, newAmountCents: baseAmount, excludeReason: "paid" },
    { id: `${client.id}-q2`, period: "Q2 2026", dueDate: "Jun 16", oldAmountCents: baseAmount, newAmountCents: newAmt, excludeReason: null },
    { id: `${client.id}-q3`, period: "Q3 2026", dueDate: "Sep 15", oldAmountCents: baseAmount, newAmountCents: newAmt, excludeReason: null },
    { id: `${client.id}-q4`, period: "Q4 2026", dueDate: "Jan 15", oldAmountCents: baseAmount, newAmountCents: newAmt, excludeReason: null },
  ];
}

export function RecomputeEstimatesModal({
  open,
  announcement,
  recipients,
  onClose,
  onConfirm,
}: RecomputeEstimatesModalProps) {
  const [composeEmail, setComposeEmail] = useState(true);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const clientEstimates = useMemo(() => {
    return recipients.map((client) => ({
      client,
      estimates: mockEstimatesFor(client),
      hasAutopay: client.id.charCodeAt(0) % 3 === 0, // mock: ~33% auto-pay
    }));
  }, [recipients]);

  // Pre-exclude paid + below-threshold estimates on first render.
  // We rebuild the set when recipients change.
  useMemo(() => {
    const next = new Set<string>();
    clientEstimates.forEach(({ estimates }) => {
      estimates.forEach((e) => {
        if (e.excludeReason === "paid") next.add(e.id);
        const annualDelta = (e.newAmountCents - e.oldAmountCents) * 4;
        if (Math.abs(annualDelta) < MATERIAL_THRESHOLD_CENTS) next.add(e.id);
      });
    });
    setExcluded(next);
  }, [clientEstimates.length]);

  const toggle = (id: string) => {
    setExcluded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const totals = useMemo(() => {
    let estimateCount = 0;
    let totalDeltaCents = 0;
    let bankUpdateCount = 0;
    clientEstimates.forEach(({ estimates, hasAutopay }) => {
      const includedAny = estimates.some(
        (e) => !excluded.has(e.id) && e.excludeReason !== "paid",
      );
      if (includedAny && hasAutopay) bankUpdateCount += 1;
      estimates.forEach((e) => {
        if (excluded.has(e.id)) return;
        if (e.excludeReason === "paid") return;
        estimateCount += 1;
        totalDeltaCents += e.newAmountCents - e.oldAmountCents;
      });
    });
    return { estimateCount, totalDeltaCents, bankUpdateCount };
  }, [clientEstimates, excluded]);

  if (!announcement) return null;

  const submit = () => {
    const selections = clientEstimates.map(({ client, estimates }) => ({
      clientId: client.id,
      estimateIds: estimates
        .filter((e) => !excluded.has(e.id) && e.excludeReason !== "paid")
        .map((e) => e.id),
    }));
    onConfirm({ selections, composeEmail });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-info-ink" aria-hidden />
            Recompute {totals.estimateCount} estimate{totals.estimateCount === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Total annual change across selected estimates: {" "}
            <span className={`font-medium ${totals.totalDeltaCents >= 0 ? "text-warn-ink" : "text-ok-ink"}`}>
              {totals.totalDeltaCents >= 0 ? "+" : "−"}
              {fmtCents(Math.abs(totals.totalDeltaCents))}
            </span>
            {totals.bankUpdateCount > 0 && (
              <>
                {" · "}
                <span className="text-warn-ink">
                  {totals.bankUpdateCount} client{totals.bankUpdateCount === 1 ? "" : "s"} on auto-pay — bank instructions queued
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3 max-h-[28rem] overflow-y-auto">
          {clientEstimates.map(({ client, estimates, hasAutopay }) => (
            <div key={client.id} className="border border-line rounded-md bg-surface">
              <div className="px-3 py-2 border-b border-line flex items-baseline gap-2">
                <span className="text-sm font-medium text-ink-900">{client.name}</span>
                <span className="text-xs text-ink-500">
                  {client.entityType} · {client.primaryState}
                </span>
                {hasAutopay && (
                  <span className="ml-auto text-2xs px-1.5 py-0.5 rounded bg-warn-bg text-warn-ink border border-warn-border inline-flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" aria-hidden />
                    Auto-pay
                  </span>
                )}
              </div>
              <ul className="divide-y divide-line">
                {estimates.map((e) => {
                  const included = !excluded.has(e.id);
                  const delta = e.newAmountCents - e.oldAmountCents;
                  const annualDelta = delta * 4;
                  const isPaid = e.excludeReason === "paid";
                  const belowThreshold =
                    Math.abs(annualDelta) < MATERIAL_THRESHOLD_CENTS && !isPaid;
                  return (
                    <li key={e.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={included && !isPaid}
                        onChange={() => !isPaid && toggle(e.id)}
                        disabled={isPaid}
                        className="w-4 h-4 accent-info-solid"
                      />
                      <span className="font-mono text-xs text-ink-700 w-20">
                        {e.period}
                      </span>
                      <span className="text-xs text-ink-500 w-16">
                        {e.dueDate}
                      </span>
                      <span className="flex-1 flex items-center gap-2">
                        {isPaid ? (
                          <>
                            <span className="text-ink-700">{fmtCents(e.oldAmountCents)}</span>
                            <span className="text-2xs px-1.5 py-0.5 rounded bg-slate-100 text-ink-500">
                              paid
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-ink-500 line-through">
                              {fmtCents(e.oldAmountCents)}
                            </span>
                            <span className="text-ink-400">→</span>
                            <span className="font-medium text-ink-900">
                              {fmtCents(e.newAmountCents)}
                            </span>
                            <span className={delta >= 0 ? "text-warn-ink text-xs" : "text-ok-ink text-xs"}>
                              ({delta >= 0 ? "+" : "−"}{fmtCents(Math.abs(delta))})
                            </span>
                            {belowThreshold && (
                              <span className="text-2xs px-1.5 py-0.5 rounded bg-slate-100 text-ink-500">
                                below threshold
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <label className="flex items-start gap-2 cursor-pointer p-3 rounded border border-line bg-sunken/30">
            <input
              type="checkbox"
              checked={composeEmail}
              onChange={(e) => setComposeEmail(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-info-solid"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-ink-900 inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" aria-hidden />
                Also draft notification emails
              </span>
              <p className="text-xs text-ink-500 mt-0.5">
                Per-client email with new amount + due date.
                {totals.bankUpdateCount > 0 && " Auto-pay clients get bank-update instructions."}
              </p>
            </div>
          </label>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={totals.estimateCount === 0}>
            Recompute {totals.estimateCount}
            {composeEmail && ` + draft ${recipients.length} email${recipients.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
