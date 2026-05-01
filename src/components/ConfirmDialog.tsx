import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  requireAcknowledge,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** If provided, the confirm button is disabled until the user ticks an acknowledgement. */
  requireAcknowledge?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [acked, setAcked] = useState(false);
  const disabled = !!requireAcknowledge && !acked;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setAcked(false);
          onCancel();
        }
      }}
    >
      <AlertDialogContent size="md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            {typeof body === "string" ? body : title}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogBody className="text-sm text-ink-700 space-y-3">
          <div>{body}</div>
          {requireAcknowledge && (
            <label className="flex items-start gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={acked}
                onChange={(e) => setAcked(e.target.checked)}
              />
              <span>{requireAcknowledge}</span>
            </label>
          )}
        </AlertDialogBody>

        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              setAcked(false);
              onCancel();
            }}
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={disabled}
            onClick={() => {
              setAcked(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
