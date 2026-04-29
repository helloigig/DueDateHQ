import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStore } from "../data/store";
import { TODAY, parseDate, toIso } from "../data/dateHelpers";
import type { Task } from "../types";

/**
 * Calendar grid view — alternate to the TaskList. PRD §10.5 P2.
 *
 * Month view with task pills per day. CPAs who think calendar-first see
 * their workload distribution at a glance: which days are heavy, which are
 * empty, which weeks need staffing.
 *
 * Click a day → filters task list to that day. Click a pill → opens task.
 */
export function CalendarGrid() {
  const navigate = useNavigate();
  const { tasks, clients } = useStore();
  const [cursor, setCursor] = useState(() => {
    const d = new Date(TODAY);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients]
  );

  // Build a Map<YYYY-MM-DD, Task[]>
  const tasksByDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.status === "completed" || t.status === "filed_extension") continue;
      if (!m.has(t.officialDueDate)) m.set(t.officialDueDate, []);
      m.get(t.officialDueDate)!.push(t);
    }
    return m;
  }, [tasks]);

  // Build the grid: weeks of days for the cursor month, padded by surrounding days
  const weeks = useMemo(() => {
    const firstOfMonth = new Date(cursor);
    const lastOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const startWeekday = firstOfMonth.getDay(); // 0 = Sunday
    const start = new Date(firstOfMonth);
    start.setDate(firstOfMonth.getDate() - startWeekday);
    const end = new Date(lastOfMonth);
    end.setDate(lastOfMonth.getDate() + (6 - lastOfMonth.getDay()));
    const days: Date[] = [];
    for (
      let d = new Date(start);
      d <= end;
      d.setDate(d.getDate() + 1)
    ) {
      days.push(new Date(d));
    }
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }
    return rows;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const todayIso = toIso(TODAY);

  return (
    <section
      className="bg-surface border border-line rounded-md overflow-hidden"
      aria-label="Calendar view"
    >
      <header className="flex items-center px-4 py-2.5 border-b border-line bg-sunken/40 gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-700">
          Calendar
        </h2>
        <span className="text-2xs text-ink-500">{monthLabel}</span>
        <span className="ml-auto flex items-center gap-1">
          <button
            onClick={() => {
              const d = new Date(cursor);
              d.setMonth(d.getMonth() - 1);
              setCursor(d);
            }}
            className="p-1 rounded hover:bg-sunken text-ink-500"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
          </button>
          <button
            onClick={() => {
              const d = new Date(TODAY);
              setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
            className="text-2xs px-2 py-1 rounded border border-line text-ink-500 hover:bg-sunken"
          >
            Today
          </button>
          <button
            onClick={() => {
              const d = new Date(cursor);
              d.setMonth(d.getMonth() + 1);
              setCursor(d);
            }}
            className="p-1 rounded hover:bg-sunken text-ink-500"
            aria-label="Next month"
          >
            <ChevronRight className="w-3.5 h-3.5" aria-hidden />
          </button>
        </span>
      </header>

      <div className="grid grid-cols-7 border-b border-line">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="px-2 py-1.5 text-2xs uppercase tracking-wider text-ink-400 text-center"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((day) => {
          const iso = toIso(day);
          const inMonth = day.getMonth() === cursor.getMonth();
          const isToday = iso === todayIso;
          const isPast = iso < todayIso;
          const dayTasks = tasksByDay.get(iso) ?? [];
          return (
            <div
              key={iso}
              className={[
                "min-h-[88px] border-r border-b border-line p-1.5 last-of-row:border-r-0",
                inMonth ? "bg-surface" : "bg-sunken/40",
                isToday ? "ring-1 ring-inset ring-accent" : "",
              ].join(" ")}
            >
              <div className="flex items-baseline gap-1.5 mb-1">
                <span
                  className={`text-2xs tabular-nums ${
                    isToday
                      ? "text-accent font-semibold"
                      : inMonth
                      ? isPast
                        ? "text-ink-400"
                        : "text-ink-700"
                      : "text-ink-300"
                  }`}
                >
                  {day.getDate()}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-2xs text-ink-400 tabular-nums">
                    {dayTasks.length}
                  </span>
                )}
              </div>
              <ul className="space-y-0.5">
                {dayTasks.slice(0, 3).map((t) => {
                  const client = clientById.get(t.clientId);
                  if (!client) return null;
                  const overdue = parseDate(t.officialDueDate) < TODAY;
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() =>
                          navigate(`/clients/${client.id}/tasks/${t.id}`)
                        }
                        className={`block w-full text-left text-2xs px-1 py-0.5 rounded truncate hover:underline ${
                          overdue
                            ? "bg-danger-bg text-danger-ink"
                            : "bg-info-bg/60 text-info-ink"
                        }`}
                        title={`${client.name} · ${t.formType}`}
                      >
                        <span className="font-medium">{client.name.split(" ")[0]}</span>
                        <span className="text-ink-500"> · </span>
                        <span>{t.formType.split(" ")[0]}</span>
                      </button>
                    </li>
                  );
                })}
                {dayTasks.length > 3 && (
                  <li className="text-2xs text-ink-500 px-1">
                    +{dayTasks.length - 3} more
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
      <footer className="px-4 py-2 text-2xs text-ink-400 border-t border-line">
        Click a task to open. Click "Today" to recenter.
      </footer>
    </section>
  );
}
