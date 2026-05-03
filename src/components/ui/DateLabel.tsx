import * as React from "react";
import { cn } from "@/lib/utils";

// DateLabel — design-system §3 "Date typography."
// Dates only, never times (locked policy). Renders one of:
//   - "MMM D"        (default — table cells, lists)
//   - "MMM D, YYYY"  (when year matters)
//   - "Today" / "Tomorrow" / "Yesterday"
//   - "In Nd" / "Nd ago"  (relative — banner copy / chase subjects)

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parseISO(iso: string): Date {
  // Avoid timezone drift — parse as local date
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

export type DateFormat = "short" | "long" | "relative" | "auto";

export interface DateLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: string; // ISO date YYYY-MM-DD
  format?: DateFormat;
  /** Reference date for relative formats. Defaults to today. */
  now?: Date;
}

export const DateLabel = React.forwardRef<HTMLSpanElement, DateLabelProps>(
  ({ value, format = "auto", now, className, ...props }, ref) => {
    const date = parseISO(value);
    const today = startOfDay(now ?? new Date());
    const diff = daysBetween(today, date);

    let label: string;
    if (format === "relative") {
      label =
        diff === 0
          ? "Today"
          : diff === 1
          ? "Tomorrow"
          : diff === -1
          ? "Yesterday"
          : diff > 0
          ? `In ${diff}d`
          : `${Math.abs(diff)}d ago`;
    } else if (format === "long") {
      label = `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    } else if (format === "short") {
      label = `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
    } else {
      // auto — use friendly relative for ±1 day, short otherwise
      if (diff === 0) label = "Today";
      else if (diff === 1) label = "Tomorrow";
      else if (diff === -1) label = "Yesterday";
      else label = `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
    }

    return (
      <span
        ref={ref}
        className={cn("tabular-nums whitespace-nowrap", className)}
        {...props}
      >
        {label}
      </span>
    );
  },
);
DateLabel.displayName = "DateLabel";
