import { NavLink } from "react-router-dom";
import { Home, Users, Mail, Bell } from "lucide-react";
import { useAnnouncements } from "../hooks/useAnnouncements";

// Per IA v0.7 amendment §2.3: mobile collapses 7 sidebar to 4 most-frequent
// tab destinations. Timeline + Opportunities + Settings move to overflow.
const TABS = [
  { to: "/", label: "Today", Icon: Home, end: true },
  { to: "/clients", label: "Clients", Icon: Users, end: false },
  { to: "/mail", label: "Mail", Icon: Mail, end: false },
  { to: "/alerts", label: "Alerts", Icon: Bell, end: false },
];

export function BottomTabBar() {
  const announcementsQuery = useAnnouncements({ activeOnly: true });
  const announcements = announcementsQuery.data ?? [];
  const unread = announcements.filter((a) => !a.read).length;

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line flex items-stretch pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `relative flex-1 flex flex-col items-center justify-center gap-1 py-2 text-2xs ${
              isActive
                ? "text-ink-900"
                : "text-ink-500 hover:text-ink-900"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <Icon className="w-5 h-5" aria-hidden />
                {to === "/alerts" && unread > 0 && (
                  <span
                    aria-label={`${unread} unread`}
                    className="absolute -top-1 -right-2 bg-danger-solid text-white text-[10px] leading-none rounded-full min-w-[1rem] h-4 px-1 flex items-center justify-center tabular-nums"
                  >
                    {unread}
                  </span>
                )}
              </div>
              <span className={isActive ? "font-medium" : ""}>{label}</span>
              {isActive && (
                <span
                  aria-hidden
                  className="absolute top-0 inset-x-6 h-0.5 rounded-b bg-accent"
                />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
