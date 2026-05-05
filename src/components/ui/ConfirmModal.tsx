import * as React from "react";
import { Button } from "./button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

/**
 * ConfirmModal — the canonical confirm-before-commit primitive.
 *
 * Implements DESIGN.md §Confirm modal discipline + §Modals visual
 * contract: shadcn Dialog shell, max-w-md (~448px), `bg-surface` +
 * `border-line` + `rounded-lg` + `shadow-overlay`, ink-900/40
 * backdrop with `backdrop-blur-[2px]`, focus restored to opener,
 * Esc + outside-click close, Cancel always sits LEFT of commit.
 *
 * Use whenever an action passes the §Confirm modal discipline filter
 * (8 listed surfaces). Don't reach for a custom div+button cluster —
 * this primitive enforces shape, alignment, button order, escape
 * affordance, and aria semantics in one place.
 *
 * Variants:
 *   - Default — non-destructive (e.g. "Apply changes", "Send batch")
 *     uses the default indigo CTA via the design-system Button.
 *   - destructive — sets the commit button to `variant="destructive"`
 *     (red bg) per DESIGN.md §Confirm modal discipline #5.
 *
 * Optional `headsUp` slot renders a warn-tinted callout above the
 * default body (e.g. "8 items still marked waiting" on a stage
 * advance). Body slot for arbitrary content (signed-diff lists,
 * migration previews, etc.).
 */

export interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Title — keep terse, factual, sentence case. Always required. */
  title: string;
  /** One-line context — the impact, reach, or "why this prompt." */
  description?: string;
  /** Optional warn-tinted callout above the body slot. */
  headsUp?: React.ReactNode;
  /** Body content — signed diff, recipient list, custom layout. */
  body?: React.ReactNode;
  /** Commit button label. Required. */
  commitLabel: string;
  /** Cancel button label. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Fired on commit click. */
  onConfirm: () => void;
  /** Fired on cancel click. Defaults to closing the dialog. */
  onCancel?: () => void;
  /** When true, commit uses `variant="destructive"` + red bg. */
  destructive?: boolean;
  /** When true, the commit button is disabled (e.g., recipient list empty). */
  disabled?: boolean;
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  headsUp,
  body,
  commitLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
  disabled = false,
}: ConfirmModalProps) {
  const handleCancel = () => {
    if (onCancel) onCancel();
    else onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader tone={destructive ? "danger" : "default"}>
          <DialogTitle tone={destructive ? "danger" : "default"}>
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        {(headsUp || body) && (
          <DialogBody>
            {headsUp && (
              <div className="text-xs text-warn-ink bg-warn-bg border border-warn-border rounded p-2 mb-3">
                {headsUp}
              </div>
            )}
            {body}
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleCancel}>
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={disabled}
            variant={destructive ? "destructive" : "default"}
            className={
              destructive
                ? undefined
                : "bg-indigo hover:bg-indigo-hover text-white"
            }
          >
            {commitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
