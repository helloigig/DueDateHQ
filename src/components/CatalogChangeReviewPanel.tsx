/**
 * CatalogChangeReviewPanel — form_change action surface (admin only).
 *
 * Renders the diff (current federal_forms row vs proposed change), with
 * Apply / Modify / Reject. Non-admin users see a different read-only
 * variant rendered inline by AnnouncementDetail.
 *
 * Spec: docs/specs/alert-detail-form-change.md
 *
 * This is an in-page panel, NOT a modal — admins are doing concentrated
 * review work and a modal would be too transient.
 */
import { useState } from "react";
import { Check, X, Edit3, FileText } from "lucide-react";
import type { Announcement } from "../types";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface DiffField {
  field: "notes" | "irs_url" | "due_date_rule" | "required_items" | "form_name";
  oldValue: string | null;
  newValue: string | null;
  confidence: "high" | "medium" | "low";
}

export interface CatalogChangeReviewPanelProps {
  announcement: Announcement | null;
  isAdmin: boolean;
  // Mock — production fetches from backend; structure matches spec.
  formNumber?: string;
  diff?: DiffField[];
  affectedClientCount?: number;
  onApply: (overrides?: Record<string, string>) => void;
  onReject: (reason: string) => void;
  onAcknowledge: () => void;
}

export function CatalogChangeReviewPanel({
  announcement,
  isAdmin,
  formNumber = "941",
  diff = [
    {
      field: "notes",
      oldValue: "Quarterly payroll deposit reconciliation.",
      newValue:
        "Quarterly payroll deposit reconciliation. Q1 deposits clarified — see updated instructions §3.2.",
      confidence: "high",
    },
  ],
  affectedClientCount = 0,
  onApply,
  onReject,
  onAcknowledge,
}: CatalogChangeReviewPanelProps) {
  const [editing, setEditing] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (!announcement) return null;

  // Non-admin variant: simple acknowledge banner, no diff.
  if (!isAdmin) {
    return (
      <section className="mt-5 bg-info-bg/30 border border-info-border rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FileText className="w-4 h-4 text-info-ink mt-0.5" aria-hidden />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-ink-900">
              📋 Pending admin review
            </h3>
            <p className="text-sm text-ink-700 mt-1">
              Your firm's admin will review and apply the catalog update for
              Form {formNumber}. No action needed from you.
            </p>
            {affectedClientCount > 0 && (
              <p className="text-xs text-ink-500 mt-2">
                {affectedClientCount} of your clients use Form {formNumber}.
                Their existing deadlines will not change.
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onAcknowledge}>
            Acknowledge
          </Button>
        </div>
      </section>
    );
  }

  // Admin variant: full diff panel.
  return (
    <>
      <section className="mt-5 bg-white border border-line rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-line bg-sunken/40">
          <h3 className="text-sm font-semibold text-ink-900">
            Review catalog change — Form {formNumber}
          </h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Apply, modify before applying, or reject. Existing deadlines are not modified.
          </p>
        </div>

        <div className="px-4 py-3 space-y-3">
          {diff.map((d) => (
            <div key={d.field} className="border border-line rounded bg-sunken/20 p-3">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-xs uppercase tracking-wide text-ink-500 font-semibold">
                  {d.field}
                </span>
                <span
                  className={`text-2xs px-1.5 py-0.5 rounded ${
                    d.confidence === "high"
                      ? "bg-ok-bg text-ok-ink"
                      : d.confidence === "medium"
                        ? "bg-sunken text-ink-700"
                        : "bg-warn-bg text-warn-ink"
                  }`}
                >
                  AI parse: {d.confidence}
                </span>
              </div>
              <pre className="text-xs text-danger-ink line-through font-mono whitespace-pre-wrap">
                - {d.oldValue ?? "(none)"}
              </pre>
              {editing ? (
                <textarea
                  value={overrides[d.field] ?? d.newValue ?? ""}
                  onChange={(e) =>
                    setOverrides((prev) => ({ ...prev, [d.field]: e.target.value }))
                  }
                  className="mt-1 w-full text-xs font-mono px-2 py-1.5 rounded border border-info-border bg-info-bg/30 focus:outline-none focus:ring-2 focus:ring-info-solid/30"
                  rows={3}
                />
              ) : (
                <pre className="mt-1 text-xs text-ok-ink font-mono whitespace-pre-wrap">
                  + {overrides[d.field] ?? d.newValue ?? "(none)"}
                </pre>
              )}
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-line bg-sunken/30 text-xs text-ink-600">
          <p className="font-medium">Downstream impact:</p>
          <ul className="mt-1 space-y-0.5 list-disc list-inside">
            <li>FilingsTab ({affectedClientCount} of your clients use Form {formNumber})</li>
            <li>AddDeadlineModal picker (form description)</li>
            <li>TaskDetail tooltip on Form {formNumber} deadlines</li>
          </ul>
          <p className="mt-2 text-ink-500">
            Existing Form {formNumber} deadlines: <span className="font-medium">NOT modified</span>.
          </p>
        </div>

        <div className="px-4 py-3 border-t border-line flex items-center gap-2 bg-white">
          <Button onClick={() => onApply(editing ? overrides : undefined)}>
            <Check className="w-4 h-4 mr-1" aria-hidden />
            {editing ? "Apply with modifications" : "Apply catalog change"}
          </Button>
          <Button variant="outline" onClick={() => setEditing((v) => !v)}>
            <Edit3 className="w-4 h-4 mr-1" aria-hidden />
            {editing ? "Cancel edits" : "Modify before applying"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setRejectOpen(true)}
            className="ml-auto text-danger-ink hover:bg-danger-bg/40"
          >
            <X className="w-4 h-4 mr-1" aria-hidden />
            Reject
          </Button>
        </div>
      </section>

      <Dialog open={rejectOpen} onOpenChange={(o) => { if (!o) setRejectOpen(false); }}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Reject this catalog change?</DialogTitle>
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
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onReject(rejectReason.trim() || "(no reason given)");
                setRejectOpen(false);
              }}
              disabled={rejectReason.trim().length === 0}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
