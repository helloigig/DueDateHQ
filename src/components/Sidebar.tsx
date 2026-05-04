import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
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
  UserPlus,
  LogOut,
  History,
} from "lucide-react";
import { useAnnouncements } from "../hooks/useAnnouncements";
import { useSession, signOut } from "../data/session";
import { useStore } from "../data/store";
import { useFeatureFlags } from "../hooks/useFeatureFlags";
import { CountBadge } from "./ui/CountBadge";
import { Avatar } from "./ui/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// 7-item sidebar per IA v0.7 amendment §2:
//   Today / Alerts / Timeline / Clients / Mail / Opportunities / Settings
//
// Alerts sits second so the state-notification + suggested-action surface
// (the product's differentiator) is one keystroke from "Today" — the
// signal lives next to the inbox of work it generates.
const primary = [
  { to: "/", label: "Today", Icon: Home, end: true },
  { to: "/alerts", label: "Alerts", Icon: Bell, end: false },
  { to: "/timeline", label: "Timeline", Icon: GanttChartSquare, end: false },
  { to: "/clients", label: "Clients", Icon: Users, end: false },
  { to: "/mail", label: "Mail", Icon: Mail, end: false },
  { to: "/opportunities", label: "Opportunities", Icon: Lightbulb, end: false },
  { to: "/activity", label: "Activity", Icon: History, end: false },
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
        // Sidebar shell — two visual modes.
        //   Expanded (`w-56`): floating card — Mac OS / Mercury
        //     aesthetic. `my-3 ml-3` offset + `rounded-lg shadow-pop`,
        //     no right border. Reads as a tool, not a rail.
        //   Collapsed (`w-14`): flush rail. Drop the margin + shadow,
        //     restore the right hairline border. A 56px floating card
        //     is decoration; flush gives the user maximum canvas back
        //     when they've actively chosen to tuck the menu away.
        // Flush shell — single hairline right border, both modes.
        // We tried a floating card (`my-3 ml-3 rounded-lg shadow-pop`)
        // but it leaked canvas behind the sidebar AND created a seam
        // where the rounded top-right corner met the topbar's straight
        // left edge. Mercury references all flush their sidebars; we
        // align with that. The visual lift comes from the topbar's
        // border-b instead of from sidebar elevation.
        "shrink-0 bg-surface flex flex-col border-r border-line transition-[width] duration-150",
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
                    className={`absolute top-1 bottom-1 rounded-r bg-accent ${
                      collapsed ? "-left-2 w-[3px]" : "left-0 w-0.5"
                    }`}
                    aria-hidden
                  />
                )}
                <Icon className="w-4 h-4 shrink-0" aria-hidden />
                {!collapsed && <span className="flex-1">{label}</span>}
                {!collapsed && to === "/alerts" && unread > 0 && (
                  <CountBadge count={unread} tone="danger" className="ml-auto" />
                )}
                {collapsed && to === "/alerts" && unread > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger-solid" />
                )}
                {!collapsed && to === "/mail" && inboxCount > 0 && (
                  <CountBadge count={inboxCount} tone="neutral" className="ml-auto" />
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

        <InviteTeammateCard collapsed={collapsed} />

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

      {/* User account — bottom-left, Linear/Notion convention.
          Replaces the user dropdown that used to live in the TopBar so
          there's a single account entrance. */}
      <UserAccountTrigger collapsed={collapsed} />
    </aside>
  );
}

/**
 * Bottom-of-sidebar account trigger — avatar + name + chevron, opens a
 * dropdown with Settings and Sign out. Mirrors Linear's pattern (account
 * entrance pinned bottom-left, separated by a hairline) so it's always
 * one click away regardless of which page the user is on.
 *
 * Collapsed mode: just the avatar; same dropdown.
 */
function UserAccountTrigger({ collapsed }: { collapsed: boolean }) {
  const session = useSession();
  const navigate = useNavigate();

  const initials = session?.userInitials || "SC";
  const name = session?.userName || "Sarah Chen";
  const email = session?.userEmail;

  return (
    <div className="border-t border-line px-2 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`w-full flex items-center rounded-md text-sm text-ink-700 hover:bg-sunken transition-colors ${
              collapsed ? "justify-center py-2" : "gap-2 px-2 py-1.5"
            }`}
            aria-label="Open account menu"
            title={collapsed ? name : undefined}
          >
            <Avatar
              size="md"
              tone="primary"
              initials={initials}
              name={name}
            />
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium text-ink-900 truncate leading-tight">
                    {name}
                  </div>
                  {email && (
                    <div className="text-2xs text-ink-500 truncate leading-tight">
                      {email}
                    </div>
                  )}
                </div>
                <span className="text-ink-400 text-xs shrink-0" aria-hidden>
                  ⌄
                </span>
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56">
          <div className="px-3 py-2 border-b border-line">
            <div className="text-sm font-medium text-ink-900 truncate">
              {name}
            </div>
            {email && (
              <div className="text-2xs text-ink-500 truncate">{email}</div>
            )}
          </div>
          <DropdownMenuItem onSelect={() => navigate("/settings")}>
            <Settings className="w-3.5 h-3.5 text-ink-500" aria-hidden />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              // signOut() handles Supabase clear + hard reload to /login.
              // Don't navigate() here — that would render /login mid-flight
              // with stale state and crash before the reload fires.
              void signOut();
            }}
          >
            <LogOut className="w-3.5 h-3.5 text-ink-500" aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Bottom-of-sidebar invite affordance. Surfaces what's already wired in
 * Settings → Team but at zero clicks of depth, matching Linear/Notion
 * convention ("Invite people" CTA pinned bottom-left).
 *
 * Hidden on solo tier — solo CPAs can't invite (gated by canInviteTeammates
 * feature flag), and showing a disabled / upgrade CTA would just be noise
 * on the surface they look at most.
 *
 * Collapsed mode: icon-only button matching the rest of the sidebar.
 */
function InviteTeammateCard({ collapsed }: { collapsed: boolean }) {
  const flags = useFeatureFlags();
  if (!flags.canInviteTeammates) return null;

  if (collapsed) {
    return (
      <Link
        to="/settings/team"
        title="Invite teammate"
        aria-label="Invite teammate"
        className="flex items-center justify-center py-2 rounded-md text-ink-500 hover:bg-sunken hover:text-ink-900 transition-colors"
      >
        <UserPlus className="w-4 h-4" aria-hidden />
      </Link>
    );
  }

  return (
    <Link
      to="/settings/team"
      className="group flex items-start gap-2 px-3 py-2 mb-1 rounded-md border border-line bg-surface/40 hover:bg-sunken transition-colors"
    >
      <UserPlus className="w-3.5 h-3.5 text-ink-500 shrink-0 mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-ink-900">Invite teammate</div>
        <div className="text-2xs text-ink-500 leading-tight mt-0.5">
          Add a preparer or reviewer to your firm.
        </div>
      </div>
    </Link>
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
        <Avatar
          variant="square"
          size="md"
          tone="primary"
          name={firmName}
          title={firmName}
        />
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
        <Avatar variant="square" size="md" tone="primary" name={firmName} />
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
              <Avatar variant="square" size="sm" tone="primary" name={firmName} />
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
