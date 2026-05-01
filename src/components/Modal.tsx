import { useId } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  type DialogSize,
} from "./ui/dialog";

type Tone = "default" | "danger";

export function Modal({
  open,
  onClose,
  size = "md",
  closeOnBackdrop = true,
  ariaLabelledBy,
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  size?: DialogSize;
  closeOnBackdrop?: boolean;
  ariaLabelledBy?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        size={size}
        showClose={false}
        className={className}
        aria-labelledby={ariaLabelledBy}
        onPointerDownOutside={(e) => {
          if (!closeOnBackdrop) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (!closeOnBackdrop) e.preventDefault();
        }}
        onOpenAutoFocus={(e) => {
          const root = e.currentTarget as HTMLElement | null;
          const target = root?.querySelector<HTMLElement>("[data-autofocus]");
          if (target) {
            e.preventDefault();
            target.focus();
          }
        }}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

function Header({
  title,
  description,
  tone = "default",
  id,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  tone?: Tone;
  id?: string;
  children?: React.ReactNode;
}) {
  return (
    <DialogHeader tone={tone}>
      {children ?? (
        <>
          {title && (
            <DialogTitle id={id} tone={tone}>
              {title}
            </DialogTitle>
          )}
          {description && (
            <DialogDescription tone={tone}>{description}</DialogDescription>
          )}
        </>
      )}
    </DialogHeader>
  );
}

function Body({
  children,
  className = "",
  scroll = false,
}: {
  children: React.ReactNode;
  className?: string;
  scroll?: boolean;
}) {
  return (
    <DialogBody className={className} scroll={scroll}>
      {children}
    </DialogBody>
  );
}

function Footer({
  children,
  align = "end",
  tone = "default",
}: {
  children: React.ReactNode;
  align?: "start" | "between" | "end";
  tone?: "default" | "sunken";
}) {
  return (
    <DialogFooter align={align} tone={tone}>
      {children}
    </DialogFooter>
  );
}

Modal.Header = Header;
Modal.Body = Body;
Modal.Footer = Footer;

/**
 * Hook for generating a stable id to wire <Modal> + <Modal.Header id> +
 * the parent's `ariaLabelledBy` prop. Call once per modal.
 */
export function useModalLabelId() {
  return useId();
}
