import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  Users,
  Bell,
  Settings,
  Mail,
  Lightbulb,
  PanelLeftClose,
  GanttChartSquare,
  UserPlus,
  LogOut,
  Pin,
  PinOff,
  Check,
  ChevronDown,
} from "lucide-react";
import { useAnnouncements } from "../hooks/useAnnouncements";
import { useSession, signOut } from "../data/session";
import { useStore } from "../data/store";
import { useClients } from "../hooks/useClients";
import { useFeatureFlags } from "../hooks/useFeatureFlags";
import { usePinnedClients } from "../hooks/usePinnedClients";
import { env } from "../config";
import { CountBadge } from "./ui/CountBadge";
import { Avatar } from "./ui/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// Sidebar per IA v0.7 amendment §2 (Activity removed — audit feed lives
// inside individual task / client surfaces):
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
  const { checklistItems, clients: storeClients } = useStore();
  const liveClientsQuery = useClients();
  const liveClientsRaw = liveClientsQuery.data?.items ?? [];
  // Live (BE) clients in real mode, store-seeded mocks otherwise. Counts +
  // pin lookups need the same source so a pinned id always resolves.
  const sidebarClients = useMemo(
    () =>
      env.useMockData
        ? storeClients
        : liveClientsRaw.length > 0
          ? liveClientsRaw
          : storeClients,
    [liveClientsRaw, storeClients],
  );
  const todayIso = new Date().toISOString().slice(0, 10);
  // Alerts caption: count of unique CLIENTS affected by active (non-dismissed)
  // alerts — the actionable number ("how many of MY clients does this touch")
  // not the raw alert count. Matches the way Sarah scans the bell.
  const alertsAffectingCount = useMemo(() => {
    const set = new Set<string>();
    for (const a of announcements) {
      if (a.dismissed) continue;
      for (const id of a.affectedClientIds) set.add(id);
    }
    return set.size;
  }, [announcements]);
  // Clients caption: active roster size. Excludes archived/inactive/prospect.
  const activeClientsCount = useMemo(
    () =>
      sidebarClients.filter(
        (c) => (c as { status?: string }).status === "active",
      ).length,
    [sidebarClients],
  );
  const STALLED_HOURS = 14 * 24;
  const hoursSinceIso = (iso: string) =>
    (Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000);
  // Mail badge — narrowed 2026-05-06 from "all chase + review items" to
  // ONLY unreplied inbound (received_unreviewed, regardless of AI tier).
  // Old filter mixed chase-due reminders with received-from-client items
  // and inflated the count to "99+" on demo data. Chase-due items belong
  // on Today's Action Queue (the daily action surface) — surfacing them
  // again as a Mail badge double-counts and panics the eye. The Mail
  // surface itself is for inbound thread context; the badge should
  // reflect "what arrived and needs your attention" only.
  const inboxCount = checklistItems.filter(
    (c) => c.state === "received_unreviewed" && !c.flagReason,
  ).length;
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
        onToggleCollapse={() => setCollapsed((v) => !v)}
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
                {/* Alerts caption — # of CLIENTS the active announcements
                    touch (not raw alert count). Yuqi audit 2026-05-05: the
                    bare number "9+" was confusing — what does it count?
                    Title now spells it out so hover disambiguates. */}
                {!collapsed && to === "/alerts" && alertsAffectingCount > 0 && (
                  <CountBadge
                    count={alertsAffectingCount}
                    tone="neutral"
                    className="ml-auto"
                    title={`${alertsAffectingCount} ${
                      alertsAffectingCount === 1 ? "client" : "clients"
                    } affected by active alerts`}
                  />
                )}
                {collapsed && to === "/alerts" && alertsAffectingCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-warn-solid" />
                )}
                {/* Clients caption — active roster size (excludes archived /
                    inactive / prospect). */}
                {!collapsed && to === "/clients" && activeClientsCount > 0 && (
                  <CountBadge
                    count={activeClientsCount}
                    tone="neutral"
                    className="ml-auto"
                    title={`${activeClientsCount} active ${
                      activeClientsCount === 1 ? "client" : "clients"
                    } (archived not counted)`}
                  />
                )}
                {!collapsed && to === "/mail" && inboxCount > 0 && (
                  <CountBadge
                    count={inboxCount}
                    tone="neutral"
                    className="ml-auto"
                    title={`${inboxCount} ${
                      inboxCount === 1 ? "item" : "items"
                    } the client sent that you haven't reviewed yet`}
                  />
                )}
                {collapsed && to === "/mail" && inboxCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-info-solid" />
                )}
              </>
            )}
          </NavLink>
        ))}

        <PinnedClientsSection collapsed={collapsed} clients={sidebarClients} />
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
      </div>

      {/* Bottom-left footer cluster — Invite teammate + user account.
          Linear/Notion convention: invite affordance pinned next to the
          account chip so the social actions sit together at the
          easiest-to-reach corner. The collapse toggle moved to the
          workspace header (top), keeping the bottom for identity-only
          actions. */}
      <InviteTeammateCard collapsed={collapsed} />
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

  const initials = session?.userInitials || "SM";
  const name = session?.userName || "Sarah Mitchell";
  const email = session?.userEmail;

  return (
    <div className="px-2 py-2">
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
      <div className="px-2 py-2 border-t border-line">
        <Link
          to="/settings/team"
          title="Invite teammate"
          aria-label="Invite teammate"
          className="flex items-center justify-center py-2 rounded-md text-ink-500 hover:bg-sunken hover:text-ink-900 transition-colors"
        >
          <UserPlus className="w-4 h-4" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="px-2 py-2 border-t border-line">
      <Link
        to="/settings/team"
        className="group flex items-start gap-2 px-3 py-2 rounded-md border border-line bg-surface/40 hover:bg-sunken transition-colors"
      >
        <UserPlus className="w-3.5 h-3.5 text-ink-500 shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-ink-900">Invite teammate</div>
          <div className="text-2xs text-ink-500 leading-tight mt-0.5">
            Add a preparer or reviewer to your firm.
          </div>
        </div>
      </Link>
    </div>
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
  onToggleCollapse,
}: {
  collapsed: boolean;
  firmName: string;
  onToggleCollapse: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (collapsed) {
    return (
      <div className="h-14 flex items-center justify-center border-b border-line px-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expand sidebar"
          aria-label="Expand sidebar"
          className="rounded-md hover:bg-sunken p-1 -m-1 transition-colors"
        >
          <Avatar
            variant="square"
            size="md"
            tone="primary"
            name={firmName}
          />
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-14 flex items-center border-b border-line px-3 gap-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 flex-1 min-w-0 hover:bg-sunken rounded px-2 py-1.5 -mx-1 group"
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
        <ChevronDown
          className="w-4 h-4 shrink-0 text-ink-400 group-hover:text-ink-700"
          aria-hidden
        />
      </button>

      {/* Collapse toggle — top-right of the workspace header. Linear/
          Notion convention: chrome controls live with the workspace
          mark, not buried at the bottom of the nav. */}
      <button
        type="button"
        onClick={onToggleCollapse}
        title="Collapse sidebar"
        aria-label="Collapse sidebar"
        className="shrink-0 rounded-md text-ink-400 hover:bg-sunken hover:text-ink-700 p-1.5 transition-colors"
      >
        <PanelLeftClose className="w-4 h-4" aria-hidden />
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
              <Check className="w-3 h-3 text-ink-500" aria-hidden />
            </div>

            {/* "+ Add another firm…" entry intentionally omitted —
                multi-firm membership is a roadmap item (1 user = 1 firm
                today). The entry was a `window.alert(...)` stub which
                broke the "every button does something real" contract.
                When the multi-membership flow lands, restore the entry
                here and wire it to the membership picker. */}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Pinned-clients sidebar section. Surfaces a CPA-curated short list of
 * clients (max 8) directly under the primary nav so high-touch clients
 * are reachable in one click — avoiding the round trip through /clients.
 *
 * Pin/unpin is invoked from the client detail header (PinClientButton).
 * State persists in localStorage via usePinnedClients(); the section
 * hides itself when no pins exist so it doesn't take vertical space
 * before the user opts in.
 */
function PinnedClientsSection({
  collapsed,
  clients,
}: {
  collapsed: boolean;
  clients: ReadonlyArray<{ id: string; name: string }>;
}) {
  const { pinnedIds, unpin } = usePinnedClients();
  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients],
  );
  const items = useMemo(
    () =>
      pinnedIds
        .map((id) => clientById.get(id))
        .filter((c): c is { id: string; name: string } => Boolean(c)),
    [pinnedIds, clientById],
  );
  if (items.length === 0) return null;

  return (
    <div className={collapsed ? "mt-3 pt-3 border-t border-line" : "mt-4 pt-3 border-t border-line"}>
      {!collapsed && (
        <p className="text-2xs uppercase tracking-wider text-ink-400 px-3 pb-1.5 font-semibold">
          Pinned
        </p>
      )}
      <div className="space-y-0.5">
        {items.map((c) => (
          <NavLink
            key={c.id}
            to={`/clients/${c.id}`}
            title={collapsed ? c.name : undefined}
            className={({ isActive }) =>
              `group relative flex items-center rounded-md text-sm transition-colors ${
                collapsed ? "justify-center py-2" : "gap-2 pl-3 pr-2 py-1.5"
              } ${
                isActive
                  ? "bg-sunken text-ink-900 font-medium"
                  : "text-ink-500 hover:bg-sunken hover:text-ink-900"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && !collapsed && (
                  <span
                    className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-accent"
                    aria-hidden
                  />
                )}
                {collapsed ? (
                  <Avatar size="sm" tone="primary" name={c.name} />
                ) : (
                  <>
                    <Avatar size="sm" tone="primary" name={c.name} />
                    <span className="flex-1 truncate text-xs">{c.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        unpin(c.id);
                      }}
                      title={`Unpin ${c.name}`}
                      aria-label={`Unpin ${c.name}`}
                      className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-ink-900 p-0.5 rounded shrink-0"
                    >
                      <PinOff className="w-3 h-3" aria-hidden />
                    </button>
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

/**
 * Pin / unpin trigger — used in the ClientDetail header so a CPA can pin
 * the client they're viewing into the sidebar with one click. Lives here
 * (not in the page) so the icon, copy, and pin-state mapping stay aligned
 * with the rendered sidebar list.
 */
export function PinClientButton({ clientId }: { clientId: string }) {
  const { isPinned, toggle } = usePinnedClients();
  const pinned = isPinned(clientId);
  return (
    <button
      type="button"
      onClick={() => toggle(clientId)}
      title={pinned ? "Unpin from sidebar" : "Pin to sidebar"}
      aria-label={pinned ? "Unpin from sidebar" : "Pin to sidebar"}
      aria-pressed={pinned}
      // Icon-only — sits in the client-detail action cluster alongside
      // Export / Edit / Archive (text labels). Yuqi audit 2026-05-05: the
      // "Pin"/"Pinned" text was visual weight without information; the icon
      // + tooltip + aria-label carry the affordance just as well, and the
      // canonical CTA-vs-secondary hierarchy is clearer when secondary
      // tools collapse to glyphs.
      className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
        pinned
          ? "text-ink-900 bg-sunken hover:bg-sunken/70"
          : "text-ink-500 hover:text-ink-900 hover:bg-sunken"
      }`}
    >
      {pinned ? (
        <PinOff className="w-4 h-4" aria-hidden />
      ) : (
        <Pin className="w-4 h-4" aria-hidden />
      )}
    </button>
  );
}
