import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";

// ClientChip — pill with avatar + truncated client name.
// Used in announcement cards, batch action lists, anywhere a client is
// referenced as a small inline tag (not a row). Hard truncation at
// max-width keeps multi-chip rows scannable.

export interface ClientChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  initials?: string;
}

export const ClientChip = React.forwardRef<HTMLSpanElement, ClientChipProps>(
  ({ className, name, initials, ...props }, ref) => {
    return (
      <span
        ref={ref}
        title={name}
        className={cn(
          "inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-pill bg-sunken text-ink-700 text-xs",
          className,
        )}
        {...props}
      >
        <Avatar name={name} initials={initials} size="xs" />
        <span className="truncate max-w-[140px]">{name}</span>
      </span>
    );
  },
);
ClientChip.displayName = "ClientChip";
