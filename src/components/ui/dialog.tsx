import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-[2px]",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: DialogSize;
  showClose?: boolean;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, size = "md", showClose = true, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%]",
        "bg-surface rounded-lg shadow-overlay border border-line",
        "max-h-[90vh] overflow-hidden flex flex-col",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        SIZE_CLASS[size],
        className,
      )}
      {...props}
    >
      {children}
      {showClose && (
        <DialogPrimitive.Close
          className="absolute right-3 top-3 rounded-sm text-ink-500 hover:text-ink-900 transition-colors disabled:pointer-events-none"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: "default" | "danger" }) => (
  <div
    className={cn(
      "px-5 py-4 border-b rounded-t-lg",
      tone === "danger"
        ? "bg-danger-bg border-danger-border"
        : "bg-surface border-line",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  align = "end",
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "between" | "end";
  tone?: "default" | "sunken";
}) => (
  <div
    className={cn(
      "px-5 py-3 border-t border-line rounded-b-lg flex items-center gap-2",
      align === "between"
        ? "justify-between"
        : align === "start"
          ? "justify-start"
          : "justify-end",
      tone === "sunken" ? "bg-sunken" : "bg-surface",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & {
    tone?: "default" | "danger";
  }
>(({ className, tone = "default", ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-base font-semibold",
      tone === "danger" ? "text-danger-ink" : "text-ink-900",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> & {
    tone?: "default" | "danger";
  }
>(({ className, tone = "default", ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(
      "text-xs mt-1",
      tone === "danger" ? "text-danger-ink" : "text-ink-500",
      className,
    )}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

const DialogBody = ({
  className,
  scroll = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { scroll?: boolean }) => (
  <div
    className={cn("px-5 py-4", scroll && "overflow-y-auto", className)}
    {...props}
  />
);
DialogBody.displayName = "DialogBody";

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
export type { DialogSize };
