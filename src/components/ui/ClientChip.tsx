import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";

// ClientChip — pill with avatar + truncated client name.
// Used in announcement cards, batch action lists, anywhere a client is
// referenced as a small inline tag (not a row). Hard truncation at
// max-width keeps multi-chip rows scannable.
//
// When `href` is set, the chip renders as a Link and behaves like a
// navigable token — Yuqi 2026-05-05: "clicking on the client should go
// to client page" — so anywhere we list affected clients, the names
// become real entry points instead of decorative text.

export interface ClientChipProps {
  name: string;
  initials?: string;
  /** Optional client-detail URL; chip renders as Link when set. */
  href?: string;
  className?: string;
}

export const ClientChip = React.forwardRef<HTMLElement, ClientChipProps>(
  ({ className, name, initials, href }, ref) => {
    const chipClass = cn(
      // Stronger visual frame — Yuqi 2026-05-05: the prior `bg-sunken`
      // chip on a `bg-sunken/40` parent disappeared into the background.
      // Add a real border + surface fill so the pill reads as a discrete
      // unit even on a tinted background.
      "inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-pill bg-surface border border-line text-ink-700 text-xs max-w-full",
      href && "hover:border-line-strong hover:bg-sunken/60 hover:text-ink-900 transition-colors cursor-pointer",
      className,
    );
    // Single-letter avatar — Yuqi 2026-05-05: chips are tiny and a
    // 2-letter mono block reads as visual noise next to the full
    // company name. Caller-supplied `initials` still wins (a firm
    // logo monogram override). Otherwise we use the first character
    // of the first word: "Coral Reef Designs" → "C".
    const singleLetter =
      initials ??
      name
        .trim()
        .split(/\s+/)[0]?.[0]
        ?.toUpperCase() ??
      "?";
    const inner = (
      <>
        <Avatar name={name} initials={singleLetter} size="xs" />
        <span className="truncate max-w-[140px]">{name}</span>
      </>
    );
    if (href) {
      return (
        <Link
          ref={ref as React.Ref<HTMLAnchorElement>}
          to={href}
          title={`Open ${name}`}
          className={chipClass}
          onClick={(e) => e.stopPropagation()}
        >
          {inner}
        </Link>
      );
    }
    return (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        title={name}
        className={chipClass}
      >
        {inner}
      </span>
    );
  },
);
ClientChip.displayName = "ClientChip";
