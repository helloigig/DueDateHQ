import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Undo2,
  UserPlus,
  Check,
  type LucideIcon,
} from "lucide-react";
import type { Notification, NotificationKind } from "../types";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications as useNotificationList,
} from "../hooks/useNotifications";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CardHeader } from "./ui/CardHeader";

// Bell narrowed to NON-ALERT notifications (bounces · team invites ·
// extension approvals). State announcements own their own surface
// (sidebar Alerts badge → /alerts page); duplicating them in the
// bell created two badges with the same meaning. One signal, one
// home — see DESIGN.md §The four alert surfaces (bell vs banner vs
// blocking modal vs /alerts page).
type NonAlertKind = Exclude<NotificationKind, "alert">;
type FilterKind = "all" | NonAlertKind;

const NON_ALERT_KINDS: NonAlertKind[] = [
  "bounce",
  "team_invite",
  "extension_approved",
];

const ICONS: Record<NonAlertKind, LucideIcon> = {
  bounce: Undo2,
  team_invite: UserPlus,
  extension_approved: Check,
};

const ICON_TONE: Record<NonAlertKind, string> = {
  bounce: "text-warn-ink",
  team_invite: "text-ink-500",
  extension_approved: "text-ok-ink",
};

const FILTER_LABELS: Record<FilterKind, string> = {
  all: "All",
  bounce: "Bounces",
  team_invite: "Team",
  extension_approved: "Extensions",
};

export function BellDropdown() {
  const notificationsQuery = useNotificationList();
  const allNotifications = notificationsQuery.data ?? [];
  const markNotificationRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKind>("all");

  const notifications: Notification[] = useMemo(
    () =>
      allNotifications
        .filter((n) => n.kind !== "alert")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [allNotifications],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    return notifications.filter((n) => n.kind === filter);
  }, [notifications, filter]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const onItemClick = (n: Notification) => {
    markNotificationRead.mutate({ id: n.id });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative w-9 h-9 flex items-center justify-center rounded-md text-ink-500 hover:bg-sunken hover:text-ink-900"
          title="Notifications"
          aria-label={`Notifications${
            unreadCount > 0 ? ` (${unreadCount} unread)` : ""
          }`}
        >
          <Bell className="w-4 h-4" aria-hidden />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 bg-danger-solid text-white text-2xs rounded-full min-w-[1rem] h-4 px-1 flex items-center justify-center tabular-nums">
              {unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-96 p-0 overflow-hidden"
      >
        <div className="px-3 py-2 border-b border-line">
          <CardHeader
            className="mb-0"
            title="Notifications"
            meta={`${unreadCount} unread`}
            action={
              <button
                onClick={() => markAllRead.mutate()}
                disabled={unreadCount === 0}
                className="text-xs text-ink-500 hover:text-ink-900 disabled:opacity-40"
              >
                Mark all read
              </button>
            }
          />
          <p className="text-2xs text-ink-400 mt-0.5">
            bounces · team invites · extension approvals
          </p>
        </div>

        <div className="flex gap-1 px-3 py-2 border-b border-line overflow-x-auto">
          {(["all", ...NON_ALERT_KINDS] as FilterKind[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                filter === f
                  ? "bg-accent text-canvas"
                  : "bg-sunken text-ink-500 hover:bg-line"
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        <ul className="max-h-96 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-sm text-ink-500 text-center">
              Nothing here.
            </li>
          ) : (
            filtered.map((n) => (
              <NotificationItem
                key={n.id}
                notif={n}
                onClick={() => onItemClick(n)}
              />
            ))
          )}
        </ul>

        <div className="border-t border-line px-3 py-2 flex items-center justify-between">
          <Link
            to="/settings/notifications"
            onClick={() => setOpen(false)}
            className="text-xs text-ink-500 hover:text-ink-900"
          >
            Notification settings →
          </Link>
          <Link
            to="/alerts"
            onClick={() => setOpen(false)}
            className="text-xs text-ink-500 hover:text-ink-900"
            title="State announcements have their own surface"
          >
            State alerts →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationItem({
  notif,
  onClick,
}: {
  notif: Notification;
  onClick: () => void;
}) {
  const ts = new Date(notif.createdAt);
  // Bell never shows alert-kind items (filtered upstream); cast safe.
  const kind = notif.kind as NonAlertKind;
  const Icon = ICONS[kind];
  const tone = ICON_TONE[kind];
  return (
    <li>
      <Link
        to={notif.href}
        onClick={onClick}
        className={`flex items-start gap-3 px-3 py-2.5 border-b border-line last:border-b-0 hover:bg-sunken ${
          !notif.read ? "bg-info-bg/40" : ""
        }`}
      >
        <span className={`w-6 flex items-center justify-center shrink-0 pt-0.5 ${tone}`}>
          <Icon className="w-4 h-4" aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm truncate ${
              !notif.read ? "text-ink-900 font-medium" : "text-ink-700"
            }`}
          >
            {notif.title}
          </div>
          <div className="text-xs text-ink-500 truncate mt-0.5">
            {notif.detail}
          </div>
          <div className="text-2xs text-ink-400 mt-0.5">
            {ts.toLocaleString("en-US")}
          </div>
        </div>
        {!notif.read && (
          <span
            className="w-2 h-2 rounded-full bg-info-solid shrink-0 mt-2"
            aria-label="unread"
          />
        )}
      </Link>
    </li>
  );
}
