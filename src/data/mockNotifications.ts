import type { Notification } from "../types";

// Anchor: today is 2026-05-05T11:00:00Z. Range covers fresh + recent +
// older read items so the bell shows realistic decay.
//
// Coverage matrix (NotificationKind = "alert" | "bounce" | "team_invite" |
// "extension_approved"):
//   alert × 2              (blockbuster CA storm + LA hurricane)
//   bounce × 2             (one fresh, one older)
//   team_invite × 1
//   extension_approved × 2 (one approved, one still pending — silence
//                           on the second is itself a signal)

export const extraNotifications: Notification[] = [
  // ── Fresh (today) ────────────────────────────────────────────────
  {
    id: "notif-alert-ca-storm",
    kind: "alert",
    createdAt: "2026-05-05T08:02:00Z",
    title: "CA storm relief — 18 of your clients affected",
    detail: "FTB extended NorCal counties to Aug 17. Apply batch update or review individually.",
    href: "/alerts/ann-ca-2026-storm-relief",
    read: false,
    announcementId: "ann-ca-2026-storm-relief",
  },
  {
    id: "notif-bounce-johnson",
    kind: "bounce",
    createdAt: "2026-05-05T05:42:00Z",
    title: "Email bounced: Johnson Family",
    detail: "Q1 estimate reminder couldn't be delivered — 3 consecutive bounces. Check address.",
    href: "/clients/c-fl-07",
    read: false,
    clientId: "c-fl-07",
  },

  // ── Yesterday ────────────────────────────────────────────────────
  {
    id: "notif-alert-la-hurricane",
    kind: "alert",
    createdAt: "2026-05-04T13:05:00Z",
    title: "LA Hurricane Delta extension — 6 clients affected",
    detail: "Orleans, Jefferson, St. Bernard parishes. Oct 15 returns postponed to Feb 15.",
    href: "/alerts/ann-la-2026-hurricane-delta",
    read: false,
    announcementId: "ann-la-2026-hurricane-delta",
  },
  {
    id: "notif-team-maya",
    kind: "team_invite",
    createdAt: "2026-05-04T19:15:00Z",
    title: "Maya Patel joined your firm",
    detail: "Assigned as Member; can be given clients now.",
    href: "/settings/team",
    read: false,
  },

  // ── 2-3 days back ────────────────────────────────────────────────
  {
    id: "notif-ext-mark",
    kind: "extension_approved",
    createdAt: "2026-04-15T14:30:00Z",
    title: "Extension approved · Mark Sullivan 1040",
    detail: "IRS confirmed Form 4868. New deadline Oct 15, 2026.",
    href: "/clients/c-ca-03",
    read: true,
    clientId: "c-ca-03",
  },
  {
    id: "notif-ext-empire-pending",
    kind: "extension_approved",
    createdAt: "2026-03-14T09:05:00Z",
    title: "Extension submitted · Empire Advisory 1120-S",
    detail: "Awaiting IRS confirmation — 52 days pending. Worth checking the e-file portal.",
    href: "/clients/c-ny-04",
    read: true,
    clientId: "c-ny-04",
  },
  {
    id: "notif-bounce-tribeca-old",
    kind: "bounce",
    createdAt: "2026-04-29T10:18:00Z",
    title: "Email bounced: Tribeca Atelier LLC",
    detail: "Address on file is invalid. Client is archived — confirm before re-engaging.",
    href: "/clients/c-ny-09",
    read: true,
    clientId: "c-ny-09",
  },
];
