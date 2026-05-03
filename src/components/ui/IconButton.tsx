import * as React from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";
import { CountBadge, type CountBadgeTone } from "./CountBadge";

// IconButton — composes shadcn <Button variant="ghost" size="icon"> with a
// required aria-label and an optional count badge. Single source for
// top-bar / page-header / sheet-header icon affordances. shadcn Button
// owns hover/focus/disabled states; IconButton just adds the badge slot
// and the a11y guarantee.

export interface IconButtonProps
  extends Omit<ButtonProps, "size" | "variant" | "aria-label"> {
  /** Required — what the button does (drives aria-label + tooltip). */
  label: string;
  /** Tile size — sm = 28px, md = 32px (shadcn icon default). */
  size?: "sm" | "md";
  /** Visual variant. Defaults to ghost (transparent → sunken hover). */
  variant?: "ghost" | "outline";
  /** Optional count badge on the top-right (e.g. unread notifications). */
  badge?: number;
  badgeTone?: CountBadgeTone;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      label,
      size = "md",
      variant = "ghost",
      badge,
      badgeTone = "danger",
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <Button
        ref={ref}
        type="button"
        variant={variant}
        size="icon"
        title={label}
        aria-label={label}
        className={cn(
          "relative",
          size === "sm" && "h-7 w-7",
          className,
        )}
        {...props}
      >
        {children}
        {badge !== undefined && badge > 0 && (
          <CountBadge
            count={badge}
            tone={badgeTone}
            className="absolute -top-1 -right-1 border border-surface"
          />
        )}
      </Button>
    );
  },
);
IconButton.displayName = "IconButton";
