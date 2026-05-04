import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Focus ring is indigo (DESIGN.md §Element states + §Invisible correctness).
  // The body shell sets outline-none so the ring renders via ring-* utilities.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // T2 (next-action): indigo solid. Was legacy slate `accent` — promoted
        // to indigo to match Mercury inheritance + DESIGN.md §Element states.
        default: "bg-indigo text-white hover:bg-indigo-hover",
        destructive: "bg-danger-solid text-white hover:opacity-90",
        outline: "border border-line bg-surface text-ink-700 hover:bg-sunken",
        secondary: "bg-sunken text-ink-700 hover:bg-line",
        ghost: "text-ink-700 hover:bg-sunken",
        link: "text-ink-700 underline-offset-4 hover:underline hover:text-ink-900",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 px-2.5 text-xs",
        lg: "h-10 px-4",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
