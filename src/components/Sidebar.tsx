import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, Bell, Settings, Rocket } from "lucide-react";
import { useAnnouncements } from "../hooks/useAnnouncements";
import { useSession } from "../data/session";

const primary = [
  { to: "/", label: "Dashboard", Icon: LayoutDashboard, end: true },
  { to: "/clients", label: "Clients", Icon: Users, end: false },
  { to: "/alerts", label: "Alerts", Icon: Bell, end: false },
];

export function Sidebar() {
  const announcementsQuery = useAnnouncements({ activeOnly: true });
  const announcements = announcementsQuery.data ?? [];
  const session = useSession();
  const unread = announcements.filter((a) => !a.read).length;

  return (
    <aside className="w-56 shrink-0 bg-surface border-r border-line flex flex-col">
      <div className="h-14 px-5 flex flex-col justify-center border-b border-line">
        <span className="font-semibold text-ink-900 text-sm leading-tight">DueDateHQ</span>
        <span className="text-2xs text-ink-500 leading-tight truncate">
          {session?.firmName ?? "Your firm"}
        </span>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1">
        {primary.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 pl-3 pr-3 py-2 rounded-md text-sm ${
                isActive
                  ? "bg-sunken text-ink-900 font-medium"
                  : "text-ink-500 hover:bg-sunken hover:text-ink-900"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-accent" aria-hidden />
                )}
                <Icon className="w-4 h-4 shrink-0" aria-hidden />
                <span className="flex-1">{label}</span>
                {to === "/alerts" && unread > 0 && (
                  <span className="ml-auto bg-danger-solid text-white text-2xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center tabular-nums">
                    {unread}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-2 py-3 border-t border-line">
        <p className="text-2xs uppercase tracking-wider text-ink-400 px-3 pt-1 pb-2">Workspace</p>
        <NavLink
          to="/onboarding/layer-1"
          className={({ isActive }) =>
            `group relative flex items-center gap-3 pl-3 pr-3 py-2 rounded-md text-sm ${
              isActive
                ? "bg-sunken text-ink-900 font-medium"
                : "text-ink-500 hover:bg-sunken hover:text-ink-900"
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-accent" aria-hidden />
              )}
              <Rocket className="w-4 h-4 shrink-0" aria-hidden />
              <span>Setup</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/settings/firm"
          className={({ isActive }) =>
            `group relative flex items-center gap-3 pl-3 pr-3 py-2 rounded-md text-sm ${
              isActive
                ? "bg-sunken text-ink-900 font-medium"
                : "text-ink-500 hover:bg-sunken hover:text-ink-900"
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-accent" aria-hidden />
              )}
              <Settings className="w-4 h-4 shrink-0" aria-hidden />
              <span>Settings</span>
            </>
          )}
        </NavLink>
      </div>
    </aside>
  );
}
