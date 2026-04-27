import { useMemo } from "react";
import { TODAY, addDays, toIso, formatLongDate } from "../data/dateHelpers";
import type { Deadline } from "../types";

interface Cell {
  date: string;
  deadline_count: number;
  has_overdue: boolean;
  is_today: boolean;
}

const WEEKS = 8;
const DAYS = WEEKS * 7;

function colorClass(c: Cell): string {
  if (c.deadline_count === 0) return "bg-sunken";
  if (c.is_today && c.deadline_count > 3) return "bg-danger-solid";
  if (c.has_overdue) return "bg-danger-solid";
  const n = c.deadline_count;
  if (n === 1) return "bg-warn-bg";
  if (n === 2) return "bg-warn-border";
  if (n === 3) return "bg-warn-solid/60";
  if (n === 4) return "bg-warn-solid/80";
  return "bg-warn-solid";
}

export function HeatmapStrip({
  deadlines,
  onDayClick,
  onHide,
  selectedDate,
}: {
  deadlines: Deadline[];
  onDayClick: (iso: string) => void;
  onHide: () => void;
  selectedDate?: string;
}) {
  const cells: Cell[] = useMemo(() => {
    const counts = new Map<string, { n: number; overdue: boolean }>();
    for (const d of deadlines) {
      const rec = counts.get(d.officialDueDate) ?? { n: 0, overdue: false };
      rec.n += 1;
      if (d.status === "overdue") rec.overdue = true;
      counts.set(d.officialDueDate, rec);
    }
    const out: Cell[] = [];
    for (let i = 0; i < DAYS; i++) {
      const d = addDays(TODAY, i);
      const iso = toIso(d);
      const rec = counts.get(iso) ?? { n: 0, overdue: false };
      out.push({
        date: iso,
        deadline_count: rec.n,
        has_overdue: rec.overdue,
        is_today: i === 0,
      });
    }
    return out;
  }, [deadlines]);

  const columns = useMemo(() => {
    const cols: Cell[][] = [];
    for (let w = 0; w < WEEKS; w++) {
      cols.push(cells.slice(w * 7, (w + 1) * 7));
    }
    return cols;
  }, [cells]);

  return (
    <div className="bg-surface border border-line rounded-md px-4 py-3">
      <div className="flex items-center mb-2">
        <h3 className="text-2xs font-semibold uppercase tracking-wider text-ink-700">
          Next 8 weeks
        </h3>
        <span className="ml-2 text-xs text-ink-400">
          deadline density · click a day to filter
        </span>
        <button
          onClick={onHide}
          className="ml-auto text-xs text-ink-500 hover:text-ink-900"
          title="Hide heatmap"
        >
          Hide
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-[3px]">
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              {col.map((cell) => {
                const selected = selectedDate === cell.date;
                return (
                  <button
                    key={cell.date}
                    onClick={() => onDayClick(cell.date)}
                    title={`${formatLongDate(cell.date)}: ${
                      cell.deadline_count
                    } deadline${cell.deadline_count === 1 ? "" : "s"}`}
                    className={`w-2.5 h-2.5 rounded-sm ${colorClass(cell)} ${
                      cell.is_today ? "ring-2 ring-accent ring-offset-1" : ""
                    } ${
                      selected ? "ring-2 ring-info-solid ring-offset-1" : ""
                    } hover:brightness-90`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 text-2xs text-ink-400">
          <span>less</span>
          <span className="w-2 h-2 rounded-sm bg-sunken" />
          <span className="w-2 h-2 rounded-sm bg-warn-bg" />
          <span className="w-2 h-2 rounded-sm bg-warn-border" />
          <span className="w-2 h-2 rounded-sm bg-warn-solid/60" />
          <span className="w-2 h-2 rounded-sm bg-warn-solid" />
          <span className="w-2 h-2 rounded-sm bg-danger-solid" />
          <span>more</span>
        </div>
      </div>
    </div>
  );
}
