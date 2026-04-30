import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  Users,
  Bell,
  Settings,
  Mail,
  Lightbulb,
  PanelLeftClose,
  PanelLeftOpen,
  GanttChartSquare,
} from "lucide-react";
import { useAnnouncements } from "../hooks/useAnnouncements";
import { useSession } from "../data/session";
import { useStore } from "../data/store";

// 7-item sidebar per IA v0.7 amendment §2:
//   Today / Timeline / Clients / Mail / Alerts / Opportunities / Settings
//
// "Today" is reactive — the action queue (per `feedback_gap_over_fill`).
// "Timeline" is forward-planning — cross-client mini-timeline stack.
// "Mail" is cross-client communication (per `feedback_unified_ai_surface`,
//   ships Day 1 even though Method B OAuth volume is initially low).
// "Opportunities" surfaces Mode E + Layer B/C signals (advisory / churn /
//   pricing / capacity).
const primary = [
  { to: "/", label: "Today", Icon: Home, end: true },
  { to: "/timeline", label: "Timeline", Icon: GanttChartSquare, end: false },
  { to: "/clients", label: "Clients", Icon: Users, end: false },
  { to: "/mail", label: "Mail", Icon: Mail, end: false },
  { to: "/alerts", label: "Alerts", Icon: Bell, end: false },
  { to: "/opportunities", label: "Opportunities", Icon: Lightbulb, end: false },
];

const COLLAPSED_KEY = "duedatehq.sidebar_collapsed.v1";

/**
 * Foldable sidebar. Collapsed state persists across sessions. When folded,
 * shows icon-only nav (44pt touch targets per accessibility) and a compact
 * firm-name badge. Expanded shows full labels + alerts unread count.
 */
export function Sidebar() {
  const announcementsQuery = useAnnouncements({ activeOnly: true });
  const announcements = announcementsQuery.data ?? [];
  const session = useSession();
  const { checklistItems } = useStore();
  const todayIso = new Date().toISOString().slice(0, 10);
  const unread = announcements.filter((a) => !a.read).length;
  const STALLED_HOURS = 14 * 24;
  const hoursSinceIso = (iso: string) =>
    (Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000);
  // Sidebar badge must match what /to-review actually shows. The cut:
  //   - Confirms: AI high/medium, not flagged
  //   - Chases:  due today, NOT stalled >14d (those are Quiet-Clients
  //              dashboard concerns — surfacing them here too would
  //              double-count and inflate the badge into a wall)
  const inboxCount = checklistItems.filter((c) => {
    if (
      c.state === "received_unreviewed" &&
      !c.flagReason &&
      (c.aiConfidence === "high" || c.aiConfidence === "medium")
    ) {
      return true;
    }
    if (
      c.state === "requested_waiting" &&
      c.nextReminderAt &&
      c.nextReminderAt <= todayIso &&
      (!c.lastReminderAt || hoursSinceIso(c.lastReminderAt) < STALLED_HOURS)
    ) {
      return true;
    }
    return false;
  }).length;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  return (
    <aside
      className={[
        "shrink-0 bg-surface border-r border-line flex flex-col transition-[width] duration-150",
        collapsed ? "w-14" : "w-56",
      ].join(" ")}
    >
      <WorkspaceHeader
        collapsed={collapsed}
        firmName={session?.firmName ?? "Your firm"}
      />

      <nav className="flex-1 py-4 px-2 space-y-1">
        {primary.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `group relative flex items-center rounded-md text-sm transition-colors ${
                collapsed ? "justify-center py-2" : "gap-3 pl-3 pr-3 py-2"
              } ${
                isActive
                  ? "bg-sunken text-ink-900 font-medium"
                  : "text-ink-500 hover:bg-sunken hover:text-ink-900"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-accent"
                    aria-hidden
                  />
                )}
                <Icon className="w-4 h-4 shrink-0" aria-hidden />
                {!collapsed && <span className="flex-1">{label}</span>}
                {!collapsed &&
                  to === "/alerts" &&
                  unread > 0 && (
                    <span className="ml-auto bg-danger-solid text-white text-2xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center tabular-nums">
                      {unread}
                    </span>
                  )}
                {collapsed &&
                  to === "/alerts" &&
                  unread > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger-solid" />
                  )}
                {!collapsed && to === "/mail" && inboxCount > 0 && (
                  <span className="ml-auto bg-sunken text-ink-700 text-2xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center tabular-nums border border-line">
                    {inboxCount}
                  </span>
                )}
                {collapsed && to === "/mail" && inboxCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-info-solid" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={collapsed ? "px-2 py-2 border-t border-line" : "px-2 py-3 border-t border-line"}>
        {!collapsed && (
          <p className="text-2xs uppercase tracking-wider text-ink-400 px-3 pt-1 pb-2">
            Workspace
          </p>
        )}
        <NavLink
          to="/settings"
          title={collapsed ? "Settings" : undefined}
          className={({ isActive }) =>
            `group relative flex items-center rounded-md text-sm transition-colors ${
              collapsed ? "justify-center py-2" : "gap-3 pl-3 pr-3 py-2"
            } ${
              isActive
                ? "bg-sunken text-ink-900 font-medium"
                : "text-ink-500 hover:bg-sunken hover:text-ink-900"
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span
                  className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-accent"
                  aria-hidden
                />
              )}
              <Settings className="w-4 h-4 shrink-0" aria-hidden />
              {!collapsed && <span>Settings</span>}
            </>
          )}
        </NavLink>

        {/* Toggle */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`mt-1 w-full flex items-center rounded-md text-sm text-ink-400 hover:bg-sunken hover:text-ink-700 ${
            collapsed ? "justify-center py-2" : "gap-3 pl-3 pr-3 py-2"
          }`}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4 shrink-0" aria-hidden />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4 shrink-0" aria-hidden />
              <span className="text-2xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

/**
 * Workspace header — firm name + chevron that opens a (currently single-firm)
 * picker. The picker UI is intentional: it makes the multi-firm affordance
 * discoverable now even though the BE doesn't support multiple firms per
 * user yet. When BE adds firm_memberships (P1), this dropdown lights up
 * with the user's other firms + an "Invite to a different firm" option.
 *
 * Until then it shows: current firm (checked) + a stub "Add another firm"
 * link that opens a not-yet-implemented modal explaining the roadmap.
 */
function WorkspaceHeader({
  collapsed,
  firmName,
}: {
  collapsed: boolean;
  firmName: string;
}) {
  const [open, setOpen] = useState(false);

  if (collapsed) {
    return (
      <div className="h-14 flex items-center justify-center border-b border-line px-3">
        <span
          className="w-7 h-7 rounded-md bg-accent text-canvas flex items-center justify-center text-2xs font-semibold"
          title={firmName}
        >
          {firmName.slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div className="relative h-14 flex items-center border-b border-line px-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full hover:bg-sunken rounded px-2 py-1.5 -mx-1 group"
        aria-expanded={open}
      >
        <span className="w-7 h-7 rounded-md bg-accent text-canvas flex items-center justify-center text-2xs font-semibold shrink-0">
          {firmName.slice(0, 2).toUpperCase()}
        </span>
        <div className="flex flex-col justify-center min-w-0 flex-1 text-left">
          <span className="font-semibold text-ink-900 text-sm leading-tight truncate">
            {firmName}
          </span>
          <span className="text-2xs text-ink-500 leading-tight">
            DueDateHQ
          </span>
        </div>
        <span className="text-ink-400 group-hover:text-ink-700 text-xs shrink-0">
          ⌄
        </span>
      </button>

      {open && (
        <>
          <span
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-2 right-2 top-full z-40 bg-surface border border-line rounded-md shadow-overlay py-1.5 mt-0.5">
            <p className="px-3 pt-1 pb-1.5 text-2xs uppercase tracking-wider text-ink-400 font-semibold">
              Current workspace
            </p>
            <div className="px-3 py-2 flex items-center gap-2 bg-sunken/40 mx-1 rounded">
              <span className="w-5 h-5 rounded bg-accent text-canvas flex items-center justify-center text-2xs font-semibold">
                {firmName.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-sm font-medium text-ink-900 truncate flex-1">
                {firmName}
              </span>
              <span className="text-2xs text-ink-500">✓</span>
            </div>

            <div className="border-t border-line my-1.5" />

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                alert(
                  "Multi-firm membership ships in P1 (next quarter). Today, one user = one firm. If you need to manage two firms, sign up with a different email per firm — we'll merge them when membership lands.",
                );
              }}
              className="w-full text-left px-3 py-2 text-xs text-ink-500 hover:bg-sunken hover:text-ink-900 flex items-center gap-2"
            >
              <span className="text-base leading-none">+</span>
              <span>Add another firm…</span>
              <span className="ml-auto text-2xs text-ink-400">P1</span>
            </button>

            <p className="px-3 pt-1 pb-1.5 text-2xs text-ink-400 leading-relaxed">
              Bookkeepers, fractional CFOs, and merged firms get
              firm-membership in the next quarter — see roadmap.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
