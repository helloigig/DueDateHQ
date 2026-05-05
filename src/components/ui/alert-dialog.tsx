import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px]",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

type AlertDialogSize = "sm" | "md" | "lg" | "xl";

// max-width caps that ALSO never exceed the viewport minus a 1rem gutter
// on each side. Without the inner `min()`, a future caller of `size="xl"`
// on a 360px-wide screen would render the dialog edge-to-edge with no
// breathing room, which the dogfooding feedback (2026-05-04) flagged on
// the Import "Import N clients?" confirm.
const SIZE_CLASS: Record<AlertDialogSize, string> = {
  sm: "max-w-[min(100vw-2rem,24rem)]",
  md: "max-w-[min(100vw-2rem,28rem)]",
  lg: "max-w-[min(100vw-2rem,32rem)]",
  xl: "max-w-[min(100vw-2rem,42rem)]",
};

interface AlertDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> {
  size?: AlertDialogSize;
}

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  AlertDialogContentProps
>(({ className, size = "md", ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
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
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({
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
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({
  className,
  align = "end",
  tone = "sunken",
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
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title> & {
    tone?: "default" | "danger";
  }
>(({ className, tone = "default", ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-base font-semibold",
      tone === "danger" ? "text-danger-ink" : "text-ink-900",
      className,
    )}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description> & {
    tone?: "default" | "danger";
  }
>(({ className, tone = "default", ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn(
      "text-xs mt-1",
      tone === "danger" ? "text-danger-ink" : "text-ink-500",
      className,
    )}
    {...props}
  />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogBody = ({
  className,
  scroll = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { scroll?: boolean }) => (
  <div
    className={cn("px-5 py-4", scroll && "overflow-y-auto", className)}
    {...props}
  />
);
AlertDialogBody.displayName = "AlertDialogBody";

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> & {
    variant?: "default" | "destructive";
  }
>(({ className, variant = "default", ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(buttonVariants({ variant }), className)}
    {...props}
  />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: "outline" }), className)}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
export type { AlertDialogSize };
