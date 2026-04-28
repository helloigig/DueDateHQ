import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Megaphone,
  Undo2,
  UserPlus,
  Check,
  type LucideIcon,
} from "lucide-react";
import type { Announcement, Notification, NotificationKind } from "../types";
import { useAnnouncements, useMarkAnnouncementRead } from "../hooks/useAnnouncements";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications as useNotificationList,
} from "../hooks/useNotifications";

type FilterKind = "all" | NotificationKind;

const ICONS: Record<NotificationKind, LucideIcon> = {
  alert: Megaphone,
  bounce: Undo2,
  team_invite: UserPlus,
  extension_approved: Check,
};

const ICON_TONE: Record<NotificationKind, string> = {
  alert: "text-info-ink",
  bounce: "text-warn-ink",
  team_invite: "text-ink-500",
  extension_approved: "text-ok-ink",
};

const FILTER_LABELS: Record<FilterKind, string> = {
  all: "All",
  alert: "Alerts",
  bounce: "Bounces",
  team_invite: "Team",
  extension_approved: "Extensions",
};

function announcementAsNotification(a: Announcement): Notification {
  return {
    id: `ann-notif:${a.id}`,
    kind: "alert",
    createdAt: a.detectedAt,
    title: `${a.stateCode}: ${a.title}`,
    detail: `${a.affectedClientIds.length} client${
      a.affectedClientIds.length === 1 ? "" : "s"
    } affected · ${a.authority}`,
    href: `/alerts/${a.id}`,
    read: a.read,
    announcementId: a.id,
  };
}

export function BellDropdown() {
  const announcementsQuery = useAnnouncements({ activeOnly: true });
  const notificationsQuery = useNotificationList();
  const announcements = announcementsQuery.data ?? [];
  const notifications = notificationsQuery.data ?? [];
  const markAnnouncementRead = useMarkAnnouncementRead();
  const markNotificationRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKind>("all");
  const rootRef = useRef<HTMLDivElement>(null);

  const merged: Notification[] = useMemo(() => {
    const ids = new Set(
      notifications.filter((n) => n.announcementId).map((n) => n.announcementId)
    );
    const fromAnnouncements = announcements
      .filter((a) => !ids.has(a.id))
      .map(announcementAsNotification);
    return [...fromAnnouncements, ...notifications].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }, [announcements, notifications]);

  const filtered = useMemo(() => {
    if (filter === "all") return merged;
    return merged.filter((n) => n.kind === filter);
  }, [merged, filter]);

  const unreadCount = merged.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const onItemClick = (n: Notification) => {
    if (n.announcementId) markAnnouncementRead.mutate({ id: n.announcementId });
    else markNotificationRead.mutate({ id: n.id });
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
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

      {open && (
        <div className="absolute right-0 top-full mt-1 w-96 bg-surface border border-line rounded-md shadow-overlay z-40 overflow-hidden">
          <div className="flex items-center px-3 py-2 border-b border-line">
            <h3 className="text-sm font-semibold text-ink-900">Notifications</h3>
            <span className="ml-2 text-xs text-ink-500">{unreadCount} unread</span>
            <button
              onClick={() => markAllRead.mutate()}
              disabled={unreadCount === 0}
              className="ml-auto text-xs text-ink-500 hover:text-ink-900 disabled:opacity-40"
            >
              Mark all read
            </button>
          </div>

          <div className="flex gap-1 px-3 py-2 border-b border-line overflow-x-auto">
            {(
              [
                "all",
                "alert",
                "bounce",
                "team_invite",
                "extension_approved",
              ] as FilterKind[]
            ).map((f) => (
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

          <div className="border-t border-line px-3 py-2">
            <Link
              to="/alerts"
              onClick={() => setOpen(false)}
              className="text-xs text-ink-500 hover:text-ink-900"
            >
              View all alerts →
            </Link>
          </div>
        </div>
      )}
    </div>
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
  const Icon = ICONS[notif.kind];
  const tone = ICON_TONE[notif.kind];
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
