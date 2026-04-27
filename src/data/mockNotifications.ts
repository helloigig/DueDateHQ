import type { Notification } from "../types";

// Anchor: same 2026-04-23T11:00:00Z "now"
export const extraNotifications: Notification[] = [
  {
    id: "notif-bounce-1",
    kind: "bounce",
    createdAt: "2026-04-23T06:42:00Z",
    title: "Email bounced: Ana Gutierrez",
    detail: "Reminder couldn't be delivered — 3 consecutive bounces. Check address.",
    href: "/clients/c-fl-07",
    read: false,
    clientId: "c-fl-07",
  },
  {
    id: "notif-team-1",
    kind: "team_invite",
    createdAt: "2026-04-22T21:15:00Z",
    title: "Jordan Lee joined your firm",
    detail: "Assigned as Member; can be given clients now.",
    href: "/settings/team",
    read: false,
  },
  {
    id: "notif-ext-1",
    kind: "extension_approved",
    createdAt: "2026-04-22T09:05:00Z",
    title: "Extension approved · Mark Sullivan 1040",
    detail: "IRS confirmed Form 4868. New deadline Oct 15, 2026.",
    href: "/clients/c-ca-03",
    read: true,
    clientId: "c-ca-03",
  },
];
