import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = (props: ToasterProps) => (
  <Sonner
    position="bottom-right"
    duration={5000}
    visibleToasts={5}
    closeButton
    toastOptions={{
      classNames: {
        toast:
          "!bg-ink-900 !text-canvas !border-0 !rounded-md !shadow-overlay !px-4 !py-3 !text-sm !min-w-[280px]",
        title: "!text-canvas !font-medium !text-sm",
        description: "!text-canvas/80 !text-xs",
        actionButton:
          "!bg-canvas/10 !text-canvas !text-2xs !uppercase !tracking-wide !font-medium !px-2 !py-1 !rounded hover:!bg-canvas/20",
        cancelButton:
          "!bg-transparent !text-canvas/60 hover:!text-canvas !text-xs",
        closeButton:
          "!bg-transparent !text-canvas/60 hover:!text-canvas !border-0",
      },
    }}
    {...props}
  />
);

export { Toaster };
