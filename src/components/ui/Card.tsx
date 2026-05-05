import * as React from "react";
import { cn } from "@/lib/utils";

// Card — DESIGN.md §Components > Cards.
// `border 1px line` + `bg-surface` + `rounded-md` (8px) + `padding-region`
// (16px). NO shadow on page-level cards (shadows reserved for floating
// layers per §Elevation). Multi-zone cards use <CardDivider> between
// zones; never nested borders, never inner shadows.

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Apply hover affordance (cursor + sunken bg on hover). */
  interactive?: boolean;
  /** Drop the default region padding (16px). For dense card variants. */
  flush?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, flush, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-surface border border-line rounded-md",
          !flush && "p-region",
          interactive &&
            "cursor-pointer transition-colors hover:bg-sunken/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-line-strong",
          className,
        )}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";

// CardDivider — DESIGN.md "use divide-y for sub-zones inside a card".
// 1px line, full-width inside the card.
export const CardDivider: React.FC<React.HTMLAttributes<HTMLHRElement>> = ({
  className,
  ...props
}) => (
  <hr className={cn("h-px bg-line border-0 -mx-region", className)} {...props} />
);

// CardZone — internal padded region, used between dividers in a multi-zone card.
export const CardZone: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn("p-region", className)} {...props} />;
