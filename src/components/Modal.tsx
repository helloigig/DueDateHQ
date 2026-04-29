import { useEffect, useId } from "react";
import { useModalDialog } from "../hooks/useModalDialog";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<Size, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

type Tone = "default" | "danger";

const TONE_HEADER_CLASS: Record<Tone, string> = {
  default: "bg-surface border-line",
  danger: "bg-danger-bg border-danger-border",
};

const TONE_HEADER_INK: Record<Tone, string> = {
  default: "text-ink-900",
  danger: "text-danger-ink",
};

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
  size?: Size;
  closeOnBackdrop?: boolean;
  ariaLabelledBy?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const dialogRef = useModalDialog(open, onClose);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        onClick={(e) => e.stopPropagation()}
        className={[
          "bg-surface rounded-lg shadow-overlay border border-line w-full outline-none flex flex-col max-h-[90vh]",
          SIZE_CLASS[size],
          className,
        ].join(" ")}
      >
        {children}
      </div>
    </div>
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
    <div
      className={`px-5 py-4 border-b rounded-t-lg ${TONE_HEADER_CLASS[tone]}`}
    >
      {children ?? (
        <>
          {title && (
            <h2
              id={id}
              className={`text-base font-semibold ${TONE_HEADER_INK[tone]}`}
            >
              {title}
            </h2>
          )}
          {description && (
            <p
              className={`text-xs mt-1 ${
                tone === "danger" ? "text-danger-ink" : "text-ink-500"
              }`}
            >
              {description}
            </p>
          )}
        </>
      )}
    </div>
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
    <div
      className={`px-5 py-4 ${
        scroll ? "overflow-y-auto" : ""
      } ${className}`}
    >
      {children}
    </div>
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
  const justify =
    align === "between"
      ? "justify-between"
      : align === "start"
      ? "justify-start"
      : "justify-end";
  const bg = tone === "sunken" ? "bg-sunken" : "bg-surface";
  return (
    <div
      className={`px-5 py-3 border-t border-line rounded-b-lg flex items-center gap-2 ${justify} ${bg}`}
    >
      {children}
    </div>
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
