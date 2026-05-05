import { DotStack, type DotStackUrgency } from "@/components/ui/DotStack";
import { cn } from "@/lib/utils";

// TimelineDayRow — design spec docs/specs/today-page.md §5b.
// One row per day with deadlines. Day-of-week eyebrow + tabular date +
// DotStack visualizing client count + plain count label.

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export interface TimelineDayRowProps {
  date: string; // YYYY-MM-DD
  count: number;
  urgency: DotStackUrgency;
  /** Optional context label after the count, e.g. "Federal tax filing". */
  label?: string;
  onClick?: () => void;
  isLast?: boolean;
}

export function TimelineDayRow({
  date,
  count,
  urgency,
  label,
  onClick,
  isLast,
}: TimelineDayRowProps) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = DOW[dt.getDay()];
  const monthDay = `${MONTH_SHORT[dt.getMonth()]} ${dt.getDate()}`;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "flex items-center gap-4 py-3 px-1 transition-colors",
        onClick && "cursor-pointer hover:bg-sunken/40 focus-visible:bg-sunken/40 focus-visible:outline-none",
        !isLast && "border-b border-line",
      )}
    >
      <div className="w-10 text-[11px] font-semibold tracking-wider text-ink-400 shrink-0">
        {dow}
      </div>
      <div className="w-16 text-sm font-medium text-ink-700 tabular-nums shrink-0">
        {monthDay}
      </div>
      <div className="flex-1 min-w-0">
        <DotStack count={count} urgency={urgency} />
      </div>
      <div className="text-sm text-ink-500 tabular-nums shrink-0 text-right">
        <div>{count} {count === 1 ? "deadline" : "deadlines"}</div>
        {label && <div className="text-xs text-ink-400 mt-0.5 truncate max-w-[180px]">{label}</div>}
      </div>
    </div>
  );
}
