import * as React from "react";
import { cn } from "@/lib/utils";

// Avatar — initials block. The single source for all "person/firm/client
// avatar" rendering (ClientChip, TopBar user menu, ClientDetail header).
//
// Two shapes:
//   - "round" — pill (default for people)
//   - "square" — rounded-md (default for firms / state badges)
//
// Initials are computed from `name` (first letter of up to 2 words). Pass
// `initials` directly to override (e.g. "SM" for Sarah Mitchell pre-derived).

export type AvatarSize = "xs" | "sm" | "md" | "lg";
export type AvatarVariant = "round" | "square";

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Person/firm name; the initials fall out of this. */
  name?: string;
  /** Pre-derived initials. Wins over `name` when provided. */
  initials?: string;
  size?: AvatarSize;
  variant?: AvatarVariant;
  /** Background tone — neutral (default) for most cases, primary for the
   *  "selected workspace" mark. */
  tone?: "neutral" | "primary";
}

const sizeClass: Record<AvatarSize, string> = {
  xs: "w-4 h-4 text-[9px]",
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-[11px]",
  lg: "w-10 h-10 text-xs",
};

const radiusClass: Record<AvatarVariant, string> = {
  round: "rounded-pill",
  square: "rounded-md",
};

const toneClass: Record<NonNullable<AvatarProps["tone"]>, string> = {
  neutral: "bg-ink-700 text-surface",
  primary: "bg-ink-900 text-surface",
};

function deriveInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  (
    {
      className,
      name,
      initials,
      size = "sm",
      variant = "round",
      tone = "neutral",
      ...props
    },
    ref,
  ) => {
    const text = initials ?? (name ? deriveInitials(name) : "?");
    return (
      <span
        ref={ref}
        aria-hidden={!name && !initials}
        className={cn(
          "inline-flex items-center justify-center font-bold leading-none shrink-0",
          sizeClass[size],
          radiusClass[variant],
          toneClass[tone],
          className,
        )}
        {...props}
      >
        {text}
      </span>
    );
  },
);
Avatar.displayName = "Avatar";
