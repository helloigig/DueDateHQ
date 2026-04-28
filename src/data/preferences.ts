import { useEffect, useState } from "react";

export interface DashboardPreferences {
  collapsed_sections: Array<"overdue" | "this_month" | "later">;
  heatmap_visible: boolean;
  priority_dismissed_until?: string;
  alerts_snoozed_until?: string;
}

const DEFAULTS: DashboardPreferences = {
  // All calendar sections collapsed by default — the dashboard hero is now
  // the focus + roll-ups. Users expand the calendar context when they want
  // the wide view, not by default.
  collapsed_sections: ["overdue", "this_month", "later"],
  heatmap_visible: false,
};

const KEY = "duedatehq.dashboard_preferences.v1";

function read(): DashboardPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function write(next: DashboardPreferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota/denied — silent */
  }
}

export function useDashboardPreferences() {
  const [prefs, setPrefs] = useState<DashboardPreferences>(read);

  useEffect(() => {
    write(prefs);
  }, [prefs]);

  const update = (patch: Partial<DashboardPreferences>) =>
    setPrefs((p) => ({ ...p, ...patch }));

  const toggleCollapsed = (
    name: "overdue" | "this_month" | "later"
  ) =>
    setPrefs((p) => ({
      ...p,
      collapsed_sections: p.collapsed_sections.includes(name)
        ? p.collapsed_sections.filter((s) => s !== name)
        : [...p.collapsed_sections, name],
    }));

  return { prefs, update, toggleCollapsed };
}
