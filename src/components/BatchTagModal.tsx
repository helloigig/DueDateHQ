/**
 * BatchTagModal — penalty_relief action surface.
 *
 * Tags selected clients for filing-time review. The tag is annotative:
 * it surfaces on Workspace + TaskDetail when the relevant filing is
 * approaching, reminding Sarah to claim the relief.
 *
 * Spec: docs/specs/alert-detail-penalty-relief.md
 */
import { useMemo, useState } from "react";
import { Tag, Mail } from "lucide-react";
import type { Announcement, Client } from "../types";
import { formatLongDate } from "../data/dateHelpers";
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

export interface BatchTagModalProps {
  open: boolean;
  announcement: Announcement | null;
  recipients: Client[];
  onClose: () => void;
  onConfirm: (input: {
    clientIds: string[];
    expiresAt: string | null;
    composeEmail: boolean;
  }) => void;
}

export function BatchTagModal({
  open,
  announcement,
  recipients,
  onClose,
  onConfirm,
}: BatchTagModalProps) {
  const [composeEmail, setComposeEmail] = useState(false);

  // Tag preview text — composed from alert + per-client context. Mirrors
  // the BE-side renderer used in tagPreview for the verdict UI.
  const previewFor = useMemo(() => {
    if (!announcement) return () => "";
    const noticeRef = announcement.authority;
    const expiry =
      announcement.effectiveDate
        ? `Expires ${formatLongDate(announcement.effectiveDate)}`
        : "Retroactive (no expiry)";
    return (client: Client) => {
      const filing =
        client.entityType === "Individual" ? "1040 filing" :
        client.entityType === "S-Corp" ? "1120-S filing" :
        client.entityType === "C-Corp" ? "1120 filing" :
        client.entityType === "Partnership" ? "1065 filing" :
        client.entityType === "Trust" ? "1041 filing" :
        "applicable filing"; // covers LLC + other entity types
      return `Penalty relief (${noticeRef}) — apply at next ${filing}. ${expiry}.`;
    };
  }, [announcement]);

  if (!announcement) return null;

  const submit = () => {
    onConfirm({
      clientIds: recipients.map((r) => r.id),
      expiresAt: announcement.effectiveDate ?? null,
      composeEmail,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-info-ink" aria-hidden />
            Tag {recipients.length} client{recipients.length === 1 ? "" : "s"} for review at filing
          </DialogTitle>
          <DialogDescription>
            Tags surface on Workspace tab + TaskDetail when the relevant filing
            is approaching. No deadline mutations, no immediate notifications.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3 max-h-96 overflow-y-auto">
          <ul className="divide-y divide-line border border-line rounded-md bg-surface">
            {recipients.map((c) => (
              <li key={c.id} className="px-3 py-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-ink-900">{c.name}</span>
                  <span className="text-xs text-ink-500">
                    {c.entityType} · {c.primaryState}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-600 italic">
                  Tag preview: <span className="not-italic">{previewFor(c)}</span>
                </p>
              </li>
            ))}
          </ul>

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
                Also draft reassurance emails ({recipients.length})
              </span>
              <p className="text-xs text-ink-500 mt-0.5">
                Each client gets an email letting them know they're covered.
                You can edit each draft before sending.
              </p>
            </div>
          </label>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={recipients.length === 0}>
            {composeEmail
              ? `Tag ${recipients.length} + draft ${recipients.length} emails`
              : `Tag ${recipients.length} client${recipients.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
