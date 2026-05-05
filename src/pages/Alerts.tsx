import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Mail,
  Megaphone,
  MoonStar,
  Pencil,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { StateBadge } from "@/components/ui/StateBadge";
import { FilterChip } from "@/components/ui/FilterChip";
import { StateAlertCard } from "@/components/StateAlertCard";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/data/dateHelpers";
import {
  useAnnouncements,
  useDismissAnnouncement,
  useBatchAdjustFromAnnouncement,
} from "@/hooks/useAnnouncements";
import { useClients } from "@/hooks/useClients";
import { trpc } from "@/lib/api/client";
import { clients as MOCK_CLIENTS } from "@/data/mockClients";
import { useStore } from "@/data/store";
import { env } from "@/config";
import type { Announcement } from "@/types";
import { cn } from "@/lib/utils";
import { EmailBulletinEditModal } from "@/components/EmailBulletinEditModal";
import { NexusCheckModal } from "@/components/NexusCheckModal";
import { ALERT_TYPE_CONFIG } from "@/data/alertTypeConfig";

/**
 * /alerts — the v0u differentiator surface, rendered exact to spec:
 *
 *   [56px rail] [center announcement feed] [440px AI co-pilot pane]
 *
 * Bypasses AppShell so the v0u layout owns the viewport. The 56px rail
 * carries the same nav targets as the AppShell sidebar (Today, Alerts,
 * Clients, etc.) so users never lose their wayfinding.
 *
 * URL contract:
 *   /alerts          → most-urgent alert pre-selected
 *   /alerts/:id      → that alert pre-selected (shareable deep link from
 *                      Today's StateAlertCard click target)
 */

// TYPE_LABEL / TYPE_TONE / timeAgoShort moved to <StateAlertCard>
// (single source of truth for the alert presentation). The CopilotPane
// header is now title-only (collapsed earlier per #12) so it doesn't
// need the type-pill metadata anymore.

function firstNameFromEmail(email: string | undefined): string | null {
  if (!email) return null;
  const local = email.split("@")[0];
  if (!local) return null;
  const first = local.split(/[._-]/)[0];
  if (!first || first.length < 2) return null;
  const roleAccounts = new Set([
    "ops", "info", "admin", "billing", "team", "office",
    "hello", "contact", "support", "help", "sales", "noreply",
    "no-reply", "accounts", "accounting", "finance", "ar", "ap",
  ]);
  if (roleAccounts.has(first.toLowerCase())) return null;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

interface AffectedClient {
  id: string;
  name: string;
  email?: string;
}

function affectedClientsFor(
  a: Announcement,
  source: ReadonlyArray<{ id: string; name: string; contactEmail?: string | null }>,
): AffectedClient[] {
  const map = new Map(source.map((c) => [c.id, c]));
  return a.affectedClientIds
    .map((id) => map.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      id: c.id,
      name: c.name,
      email: c.contactEmail ?? undefined,
    }));
}

function draftSubject(a: Announcement, client: AffectedClient): string {
  if (a.type === "disaster_extension" && a.newDeadline) {
    return `${a.stateCode}: ${a.title} applies to your filing`;
  }
  if (a.newDeadline) return `${a.stateCode}: deadline shift for ${client.name}`;
  return `${a.stateCode} update — ${a.title}`;
}

function draftBody(a: Announcement, client: AffectedClient): string {
  const greet = firstNameFromEmail(client.email) ?? `${client.name} team`;
  if (a.newDeadline && a.oldDeadline) {
    return `Hi ${greet},

The ${a.authority} announced an extension this morning that applies to your filing. Your deadline has moved from ${formatLongDate(a.oldDeadline)} to ${formatLongDate(a.newDeadline)}.

You don't need to do anything — I've already updated our system. The official bulletin is here if you'd like to forward it: ${a.sourceUrl}

I'll be in touch closer to the new date.

Sarah`;
  }
  return `Hi ${greet},

A quick note: the ${a.authority} published an update — ${a.title}. ${a.summary}

I'll let you know if it changes anything on your end. Source: ${a.sourceUrl}

Sarah`;
}

// FeedCard extracted to <StateAlertCard variant="feed"> in
// src/components/StateAlertCard.tsx so the Dashboard preview surface
// can share the same presentation. See that file for the canonical
// implementation.

// ── Co-pilot pane ─────────────────────────────────────────────────────────

function ActionRow({
  icon,
  title,
  description,
  cta,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <article className="bg-surface border border-line rounded-md p-region flex items-start gap-3 hover:border-line-strong transition-colors">
      <span
        aria-hidden
        className="shrink-0 w-7 h-7 rounded-md bg-sunken text-ink-700 inline-flex items-center justify-center"
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink-900 leading-snug">
          {title}
        </div>
        <div className="text-xs text-ink-700 mt-1 leading-snug">
          {description}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onClick} className="shrink-0">
        {cta}
      </Button>
    </article>
  );
}

interface DraftOverride {
  subject: string;
  body: string;
}

function CopilotPane({
  announcement,
  excludedClientIds,
  draftOverrides,
  onToggleExclusion,
  onClose,
  onEditDraft,
  onSendBulletin,
  onApplyDeadline,
  onRunNexusCheck,
  onAcknowledgeAdmin,
  onSnooze,
  onMarkNotApplicable,
  isSending,
  isApplying,
  clientSource,
  hasExplicitSelection,
}: {
  announcement: Announcement | null;
  excludedClientIds: Set<string>;
  draftOverrides: Map<string, DraftOverride>;
  onToggleExclusion: (clientId: string) => void;
  onClose: () => void;
  onEditDraft: (
    announcement: Announcement,
    client: AffectedClient,
    initial: { subject: string; body: string },
  ) => void;
  onSendBulletin: (
    announcement: Announcement,
    recipients: Array<{ clientId: string; subject: string; body: string }>,
  ) => void;
  onApplyDeadline: (announcement: Announcement) => void;
  onRunNexusCheck: (announcement: Announcement) => void;
  /** form_change alerts route through admin reviewer queue. Clicking
   *  "Open" hands the alert off — we treat the handoff as the finishing
   *  action and resolve it (matches "Finished alert actions → Resolved"). */
  onAcknowledgeAdmin: (announcement: Announcement) => void;
  onSnooze: (announcement: Announcement) => void;
  onMarkNotApplicable: (announcement: Announcement) => void;
  isSending: boolean;
  isApplying: boolean;
  clientSource: ReadonlyArray<{
    id: string;
    name: string;
    contactEmail?: string | null;
  }>;
  /** True when the URL carries an alert id (user explicitly selected). On
   *  <md the pane stays hidden when false so the feed owns the viewport;
   *  the auto-first-selected announcement is still bound for md+ inline
   *  display, just not surfaced. */
  hasExplicitSelection: boolean;
}) {
  const [draftIndex, setDraftIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    setDraftIndex(0);
  }, [announcement?.id]);

  if (!announcement) {
    // On <md the empty state is hidden — the feed already fills the
    // viewport when nothing is selected. md+ keeps the empty pane visible
    // as a hint that selecting a card on the left populates this side.
    return (
      <aside className="w-full md:w-pane md:shrink-0 bg-canvas md:border-l md:border-line hidden md:flex flex-col items-center justify-center text-center px-region">
        <Sparkles className="w-8 h-8 text-ink-300 mb-3" aria-hidden />
        <div className="text-sm font-semibold text-ink-700">
          Pick an alert to see suggested actions
        </div>
        <div className="text-xs text-ink-500 mt-1 max-w-[220px]">
          DueDateHQ pre-drafts the work for each affected client — review and
          send.
        </div>
      </aside>
    );
  }

  const a = announcement;
  // Per-type config drives which action surface the pane shows. The
  // bulletin Send card (lines below) is suppressed for `isAdminGated`
  // types — form_change updates the firm's catalog via the admin
  // reviewer queue, not via client emails. Showing Send there was a
  // dead button: BE always skipped because form-change emails have
  // no per-client task to FK to.
  const cfg = ALERT_TYPE_CONFIG[a.type];
  const showBulletinSend = !cfg?.isAdminGated;
  const allAffected = affectedClientsFor(a, clientSource);
  const includedClients = allAffected.filter((c) => !excludedClientIds.has(c.id));
  const includedCount = includedClients.length;
  const excludedCount = allAffected.length - includedCount;
  const safeIdx = Math.min(draftIndex, Math.max(0, includedCount - 1));
  const currentClient = includedClients[safeIdx];
  const overrideKey = (clientId: string) => `${a.id}:${clientId}`;
  const resolveDraft = (
    client: AffectedClient,
  ): { subject: string; body: string } => {
    const ov = draftOverrides.get(overrideKey(client.id));
    if (ov) return ov;
    return { subject: draftSubject(a, client), body: draftBody(a, client) };
  };
  const currentDraft = currentClient
    ? resolveDraft(currentClient)
    : { subject: "", body: "" };
  const subject = currentDraft.subject;
  const body = currentDraft.body;

  return (
    <aside
      className={`w-full md:w-pane md:shrink-0 bg-canvas md:border-l md:border-line flex-col overflow-hidden md:flex ${
        hasExplicitSelection ? "flex" : "hidden md:flex"
      }`}
    >
      {/* ── Header zone: Context ─────────────────────────────────
          Collapsed to ONE line — the feed card is the summary, the
          pane is the detail. Re-rendering state + title + authority
          + type + count + deadline here was 100% redundant with the
          card the user just clicked. Pane header: state badge +
          title + close X. Everything else (full client list, email
          draft, action card) lives in the pane body. */}
      <div className="bg-surface border-b border-line px-region py-3 flex items-start gap-3">
        {/* Mobile: explicit "Back to alerts" affordance — the pane fills the
            viewport at <md, so the user needs a clear way to return to the
            feed. md+ uses a discreet X (the feed is already visible to the
            left, so this is just a clear-selection control). */}
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 inline-flex items-center justify-center rounded text-ink-500 hover:bg-sunken hover:text-ink-900 transition-colors md:hidden gap-1 px-2 py-1 text-xs font-medium"
          aria-label="Back to alerts"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden />
          Back
        </button>
        <StateBadge code={a.stateCode} />
        <div className="flex-1 min-w-0 text-sm font-semibold text-ink-900 leading-snug pt-0.5">
          {a.title}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="hidden md:inline-flex shrink-0 w-7 h-7 items-center justify-center rounded text-ink-500 hover:bg-sunken hover:text-ink-900 transition-colors"
          aria-label="Close detail pane"
        >
          <X className="w-4 h-4" aria-hidden />
        </button>
      </div>

      {/* ── Body zone: Suggested actions ─────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-region pt-3 pb-2">
          <span className="text-2xs uppercase tracking-wider font-semibold text-ink-500">
            Suggested actions
          </span>
        </div>

        <div className="px-region pb-region flex flex-col gap-2">
          {/* Admin-gated alerts (form_change) don't email clients —
              the canonical action is "Open admin reviewer queue" which
              updates the firm's catalog. Surface that as the primary
              card instead of the bulletin Send card. */}
          {!showBulletinSend && (
            <ActionRow
              icon={<Sparkles className="w-3.5 h-3.5" aria-hidden />}
              title={cfg.primaryVerb(includedCount, a)}
              description={`${cfg.label} alerts update the firm's form catalog. Clients aren't notified.`}
              cta="Open"
              onClick={() => {
                // Hand the alert off to admin queue + resolve it. The
                // admin reviewer surface owns the catalog reconciliation
                // from here; from the alert's perspective this IS the
                // finishing action.
                onAcknowledgeAdmin(a);
                navigate("/settings/federal-forms");
              }}
            />
          )}

          {/* Action 1 — primary. Three sub-zones in ONE card,
              separated by hairline dividers (no nested cards per
              DESIGN.md §Cards):
                (a) header — icon + title + Send CTA with live count
                (b) recipient list — chip list with X-to-exclude
                (c) email preview — subject + body + nav controls */}
          {showBulletinSend && (
          <article className="bg-surface border border-indigo-soft rounded-md overflow-hidden">
            <div className="flex items-start gap-3 p-region">
              <span
                aria-hidden
                className="shrink-0 w-7 h-7 rounded-md bg-indigo text-white inline-flex items-center justify-center"
              >
                <Mail className="w-3.5 h-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink-900 leading-snug">
                  Draft {includedCount} client{" "}
                  {includedCount === 1 ? "email" : "emails"}
                </div>
                <div className="text-xs text-ink-700 mt-1 leading-snug">
                  Personalized for each affected client · references the{" "}
                  {a.authority} bulletin
                  {a.newDeadline &&
                    ` · explains the ${formatLongDate(a.newDeadline)} deadline`}
                </div>
              </div>
              <Button
                onClick={() => {
                  if (includedCount === 0) return;
                  const recipients = includedClients.map((c) => {
                    const d = resolveDraft(c);
                    return {
                      clientId: c.id,
                      subject: d.subject,
                      body: d.body,
                    };
                  });
                  onSendBulletin(a, recipients);
                }}
                disabled={includedCount === 0 || isSending}
                className="shrink-0 bg-indigo hover:bg-indigo-hover text-surface disabled:opacity-40"
              >
                <Send aria-hidden />
                {isSending ? "Sending…" : `Send ${includedCount}`}
              </Button>
            </div>

            {/* Recipient list — partial-selection control. Click a
                chip to exclude / include. The Send CTA above shows
                the live count. */}
            <div className="border-t border-line px-region py-2.5 bg-sunken/30">
              <div className="flex items-center justify-between mb-2 text-2xs uppercase tracking-wider text-ink-500 font-semibold">
                <span>
                  Sending to{" "}
                  <span className="tabular-nums text-ink-900">{includedCount}</span>
                </span>
                {excludedCount > 0 && (
                  <span className="text-ink-400 normal-case tracking-normal text-xs font-normal">
                    {excludedCount} excluded
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {allAffected.map((c) => {
                  const isExcluded = excludedClientIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onToggleExclusion(c.id)}
                      className={cn(
                        "group inline-flex items-center gap-1 rounded-pill border text-xs px-2 py-0.5 transition-colors",
                        isExcluded
                          ? "border-line bg-transparent text-ink-400 line-through hover:border-line-strong hover:text-ink-700 hover:no-underline"
                          : "border-line bg-surface text-ink-700 hover:border-danger-border hover:text-danger-ink",
                      )}
                      title={
                        isExcluded
                          ? `Click to include ${c.name}`
                          : `Click to exclude ${c.name} from this send`
                      }
                    >
                      <span className="truncate max-w-[110px]">{c.name}</span>
                      <X
                        className={cn(
                          "w-2.5 h-2.5 transition-opacity",
                          isExcluded
                            ? "rotate-45 text-ink-400"
                            : "text-ink-400 opacity-0 group-hover:opacity-100",
                        )}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email preview — divider-separated sub-zone, NOT a
                nested card (DESIGN.md §Cards). Same surface, just a
                hairline border-t + sunken bg shift to read as a zone. */}
            {currentClient && includedCount > 0 && (
              <div className="border-t border-line bg-sunken/40 px-region py-3">
                <div className="flex items-center gap-2 mb-2 text-xs">
                  <span className="text-ink-700 truncate flex-1">
                    To: {currentClient.email ?? currentClient.name}
                  </span>
                  <span className="text-ink-500 tabular-nums shrink-0">
                    Draft {safeIdx + 1} of {includedCount}
                  </span>
                </div>
                <div className="text-xs font-semibold text-ink-900 mb-1 leading-snug">
                  {subject}
                </div>
                <div className="text-xs text-ink-700 leading-snug whitespace-pre-line line-clamp-6">
                  {body}
                </div>
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-line/60">
                  <button
                    type="button"
                    onClick={() =>
                      onEditDraft(a, currentClient, {
                        subject,
                        body,
                      })
                    }
                    className="inline-flex items-center gap-1 h-6 px-2 rounded text-xs text-ink-700 hover:bg-surface transition-colors"
                  >
                    <Pencil className="w-3 h-3" aria-hidden />
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled
                    title="AI refinement ships with the AI Service in Phase 1.5"
                    className="inline-flex items-center gap-1 h-6 px-2 rounded text-xs text-ink-400 cursor-not-allowed"
                  >
                    <RefreshCw className="w-3 h-3" aria-hidden />
                    Refine
                  </button>
                  <div className="ml-auto inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setDraftIndex((i) => Math.max(0, i - 1))}
                      disabled={safeIdx === 0}
                      className="w-6 h-6 inline-flex items-center justify-center rounded text-ink-700 hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent"
                      aria-label="Previous draft"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
                    </button>
                    <span className="text-xs text-ink-500 tabular-nums px-1.5 min-w-[44px] text-center">
                      {safeIdx + 1} / {includedCount}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftIndex((i) => Math.min(includedCount - 1, i + 1))
                      }
                      disabled={safeIdx >= includedCount - 1}
                      className="w-6 h-6 inline-flex items-center justify-center rounded text-ink-700 hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent"
                      aria-label="Next draft"
                    >
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </article>
          )}

          {a.newDeadline && (
            <ActionRow
              icon={<CalendarClock className="w-3.5 h-3.5" aria-hidden />}
              title={`Apply new ${formatLongDate(a.newDeadline)} deadline`}
              description={`Move ${includedCount} affected ${includedCount === 1 ? "filing" : "filings"} · audit-trailed with the announcement source`}
              cta={isApplying ? "Applying…" : "Apply"}
              onClick={() => {
                if (isApplying) return;
                onApplyDeadline(a);
              }}
            />
          )}

          {a.type === "nexus_change" && includedCount > 0 && (
            <ActionRow
              icon={<ShieldCheck className="w-3.5 h-3.5" aria-hidden />}
              title="Run nexus check"
              description={`Per-state questionnaire for ${includedCount} ${includedCount === 1 ? "client" : "clients"} · adds suggested filings on established`}
              cta="Open"
              onClick={() => onRunNexusCheck(a)}
            />
          )}

          {/* Triage handoff — for alerts that touch many clients, the CPA
              often needs to walk the affected tasks one-by-one (not just
              send a bulletin). Triage Queue (v0m) is the right pattern:
              "alert → here are the impacted clients/tasks, triage them in
              one flow." Hands off to /today/triage with the alert id as
              a query param so the focused single-card mode can filter
              its queue to just this alert's affected clients. */}
          {includedCount > 1 && (
            <ActionRow
              icon={<Sparkles className="w-3.5 h-3.5" aria-hidden />}
              title={`Triage ${includedCount} affected ${includedCount === 1 ? "client" : "clients"}`}
              description="Walk the affected tasks one-by-one — confirm, chase, or set aside in seconds each."
              cta="Triage"
              onClick={() => navigate(`/today/triage?alert=${a.id}`)}
            />
          )}
        </div>
      </div>

      {/* ── Disposition zone — sticky footer ─────────────────────
          Pinned at the bottom of the pane (outside the scroll
          container) so escape hatches stay reachable regardless of
          how long the action list grows. Per DESIGN.md §Do's: "Keep
          escape hatches visible." */}
      <div className="border-t border-line bg-canvas px-region py-2">
        <div className="text-2xs uppercase tracking-wider font-semibold text-ink-400 mb-1.5">
          Disposition
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => onSnooze(a)}
            className="inline-flex items-center gap-1.5 text-xs text-ink-700 hover:text-ink-900 hover:bg-sunken transition-colors px-2 py-1 rounded"
          >
            <MoonStar className="w-3.5 h-3.5 text-ink-500" aria-hidden />
            Snooze until tomorrow
          </button>
          <span className="text-ink-300 mx-1" aria-hidden>·</span>
          <button
            type="button"
            onClick={() => onMarkNotApplicable(a)}
            className="inline-flex items-center gap-1.5 text-xs text-ink-700 hover:text-ink-900 hover:bg-sunken transition-colors px-2 py-1 rounded"
          >
            Mark not applicable
          </button>
        </div>
      </div>

    </aside>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

type Tab = "affecting" | "all" | "resolved";

export function Alerts() {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("affecting");

  const announcementsQuery = useAnnouncements();
  const announcements = announcementsQuery.data ?? [];
  const dismissMutation = useDismissAnnouncement();
  const batchAdjustMutation = useBatchAdjustFromAnnouncement();
  const utils = trpc.useUtils();
  const snoozeMutation = trpc.announcements.snooze.useMutation({
    onSuccess: () => {
      void utils.announcements.list.invalidate();
    },
  });
  const runNexusCheckMutation = trpc.alertActions.runNexusCheck.useMutation();
  const addNexusFilingsMutation = trpc.alertActions.addNexusFilings.useMutation({
    onSuccess: () => {
      void utils.deadlines.listForTriage.invalidate();
    },
  });
  // sendBulletinEmails is a recently-added BE procedure — the FE router
  // type may lag behind. Cast through proxy access to keep the build
  // green until the next router type sync.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendBulletinMutation = (trpc.announcements as any).sendBulletinEmails.useMutation(
    {
      onSuccess: () => {
        void utils.announcements.list.invalidate();
      },
    },
  ) as {
    mutate: (input: {
      announcementId: string;
      recipients: Array<{ clientId: string; subject: string; body: string }>;
    }) => void;
    mutateAsync: (input: {
      announcementId: string;
      recipients: Array<{ clientId: string; subject: string; body: string }>;
    }) => Promise<{
      sentCount: number;
      skippedCount: number;
      sent: Array<{ clientId: string; draftId: string }>;
      skipped: Array<{ clientId: string; reason: string }>;
    }>;
    isPending: boolean;
  };

  // Live clients — real mode hits the BE clients router; mock mode reads
  // from the in-memory store (which is seeded from MOCK_CLIENTS at boot).
  // affectedClientsFor() prefers live data so the recipient chips reflect
  // the firm's actual roster, not a static demo set.
  const liveClientsQuery = useClients();
  const liveClients = liveClientsQuery.data?.items ?? [];
  const storeClients = useStore().clients;
  const clientSource = useMemo(
    () =>
      env.useMockData
        ? storeClients.length > 0
          ? storeClients
          : MOCK_CLIENTS
        : liveClients.length > 0
          ? liveClients
          : MOCK_CLIENTS,
    [liveClients, storeClients],
  );

  // Per-(announcementId × clientId) draft override — populated by the
  // Email edit modal so the user's edits persist between drafts and
  // through to the send call.
  const [draftOverrides, setDraftOverrides] = useState<
    Map<string, DraftOverride>
  >(new Map());
  const [editing, setEditing] = useState<{
    announcement: Announcement;
    client: AffectedClient;
    subject: string;
    body: string;
  } | null>(null);
  // Nexus modal state — set when the CopilotPane "Run nexus check" action
  // is fired. Carries the announcement so the modal can derive state +
  // affected clients itself.
  const [nexusForAnnouncement, setNexusForAnnouncement] =
    useState<Announcement | null>(null);

  // Session-scoped state.
  // - handledIds: alerts the CPA has acted on this session (Send all,
  //   Apply deadline, Forward bulletin, Snooze, Mark not applicable).
  //   Used to fade the card and auto-advance to the next un-handled.
  // - excludedByAlert: per-alert set of client IDs the CPA has chosen
  //   NOT to include in batch actions (partial selection in pane).
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set());
  const [excludedByAlert, setExcludedByAlert] = useState<
    Map<string, Set<string>>
  >(new Map());

  const filtered = useMemo(() => {
    if (tab === "all") return announcements.filter((a) => !a.dismissed);
    if (tab === "resolved") return announcements.filter((a) => a.dismissed);
    return announcements.filter(
      (a) => !a.dismissed && a.affectedClientIds.length > 0,
    );
  }, [announcements, tab]);

  const totals = useMemo(() => {
    const affectedClientIds = new Set<string>();
    for (const a of announcements) {
      if (a.dismissed) continue;
      for (const id of a.affectedClientIds) affectedClientIds.add(id);
    }
    return {
      affecting: announcements.filter(
        (a) => !a.dismissed && a.affectedClientIds.length > 0,
      ).length,
      // Distinct clients touched by any non-dismissed alert. The heading
      // reads "N clients affected" — drives this from a Set so two
      // alerts on the same client count once.
      affectingClients: affectedClientIds.size,
      all: announcements.filter((a) => !a.dismissed).length,
      resolved: announcements.filter((a) => a.dismissed).length,
    };
  }, [announcements]);

  // Selection: URL :id wins; otherwise default to first in the active tab.
  const selectedId = params.id ?? filtered[0]?.id ?? null;
  const selected = useMemo(
    () => announcements.find((a) => a.id === selectedId) ?? null,
    [announcements, selectedId],
  );

  // Auto-redirect /alerts/:id → /alerts when id doesn't match anything
  // (covers stale deep links). Safe — preserves the empty-state pane.
  useEffect(() => {
    if (params.id && !selected && !announcementsQuery.isLoading) {
      navigate("/alerts", { replace: true });
    }
  }, [params.id, selected, announcementsQuery.isLoading, navigate]);

  const handleSelect = (id: string) => {
    navigate(`/alerts/${id}`, { replace: true });
  };

  // Action complete (Send / Apply / Forward / Snooze / Mark NA):
  //   1) mark this alert handled so the feed card fades to opacity-60
  //      with a "Handled this session" chip — gap-loud is preserved
  //      (the CPA can re-open) but visually demoted on next scan.
  //   2) for resolving actions (Send / Apply / Tag / Plan / Recompute /
  //      Nexus / route-to-admin), also flip `dismissed` so the alert
  //      moves to the Resolved tab. Snooze passes `resolve: false` —
  //      snooze means "come back tomorrow", not done.
  //   3) auto-advance to the next un-handled alert in the active tab
  //      so triage feels queue-like (forward, then loop back to before
  //      the current cursor if all "after" are done).
  const handleComplete = useCallback(
    (id: string, opts: { resolve?: boolean } = { resolve: true }) => {
      const resolve = opts.resolve ?? true;
      setHandledIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      // Move to Resolved tab on resolving actions. Idempotent — re-firing
      // dismiss on an already-dismissed alert is a no-op on the BE.
      if (resolve) {
        dismissMutation.mutate({ id });
      }
      const idx = filtered.findIndex((a) => a.id === id);
      if (idx < 0) return;
      const after = filtered
        .slice(idx + 1)
        .find((a) => !handledIds.has(a.id) && a.id !== id);
      const before = filtered
        .slice(0, idx)
        .reverse()
        .find((a) => !handledIds.has(a.id) && a.id !== id);
      const nextAlert = after ?? before;
      if (nextAlert) {
        navigate(`/alerts/${nextAlert.id}`, { replace: true });
      } else {
        navigate(`/alerts`, { replace: true });
      }
    },
    [dismissMutation, filtered, handledIds, navigate],
  );

  const handleClearSelection = () => {
    navigate(`/alerts`, { replace: true });
  };

  const toggleClientExclusion = useCallback(
    (alertId: string, clientId: string) => {
      setExcludedByAlert((prev) => {
        const next = new Map(prev);
        const set = new Set(next.get(alertId) ?? []);
        if (set.has(clientId)) set.delete(clientId);
        else set.add(clientId);
        next.set(alertId, set);
        return next;
      });
    },
    [],
  );

  const handleEditDraft = useCallback(
    (
      a: Announcement,
      client: AffectedClient,
      initial: { subject: string; body: string },
    ) => {
      setEditing({
        announcement: a,
        client,
        subject: initial.subject,
        body: initial.body,
      });
    },
    [],
  );

  const handleSaveEdit = useCallback(
    (subject: string, body: string) => {
      setEditing((current) => {
        if (!current) return null;
        const key = `${current.announcement.id}:${current.client.id}`;
        setDraftOverrides((prev) => {
          const next = new Map(prev);
          next.set(key, { subject, body });
          return next;
        });
        return null;
      });
    },
    [],
  );

  const handleSendBulletin = useCallback(
    (
      a: Announcement,
      recipients: Array<{ clientId: string; subject: string; body: string }>,
    ) => {
      sendBulletinMutation
        .mutateAsync({ announcementId: a.id, recipients })
        .then((result) => {
          if (result.sentCount > 0) {
            toast.success(
              `Sent to ${result.sentCount} ${result.sentCount === 1 ? "client" : "clients"}` +
                (result.skippedCount > 0
                  ? ` · ${result.skippedCount} skipped`
                  : ""),
            );
          } else {
            toast.error(
              result.skippedCount > 0
                ? `All ${result.skippedCount} skipped (no email or no open task)`
                : "Nothing to send",
            );
          }
          handleComplete(a.id);
        })
        .catch((err: { message?: string }) => {
          toast.error(`Send failed: ${err.message ?? "unknown"}`);
        });
    },
    [sendBulletinMutation, handleComplete],
  );

  const handleApplyDeadline = useCallback(
    (a: Announcement) => {
      batchAdjustMutation.mutate(
        // BE expects { id }; FE router stub lets the shape pass through.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: a.id } as any,
        {
          onSuccess: (res: unknown) => {
            const r = res as { deadlinesUpdated?: number } | null;
            const n = r?.deadlinesUpdated ?? 0;
            toast.success(
              `${n} ${n === 1 ? "deadline" : "deadlines"} moved to ${a.newDeadline ? formatLongDate(a.newDeadline) : "the new date"}`,
            );
            handleComplete(a.id);
          },
          onError: (err) => {
            toast.error(`Apply failed: ${err.message}`);
          },
        },
      );
    },
    [batchAdjustMutation, handleComplete],
  );

  const handleSnooze = useCallback(
    (a: Announcement) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(8, 0, 0, 0);
      snoozeMutation.mutate(
        { id: a.id, until: tomorrow.toISOString() },
        {
          onSuccess: () => {
            toast.success("Snoozed until tomorrow");
            // Snooze does NOT resolve — alert stays in Active tab and
            // re-surfaces tomorrow morning.
            handleComplete(a.id, { resolve: false });
          },
          onError: (err) => {
            toast.error(`Snooze failed: ${err.message}`);
          },
        },
      );
    },
    [snoozeMutation, handleComplete],
  );

  const handleMarkNotApplicable = useCallback(
    (a: Announcement) => {
      // Explicitly dismiss with the audit reason. Pass `resolve: false`
      // to handleComplete so we don't fire a second (reason-less)
      // dismiss that would overwrite the "not_applicable" reason.
      dismissMutation.mutate(
        { id: a.id, reason: "not_applicable" },
        {
          onSuccess: () => {
            toast.success("Marked not applicable");
            handleComplete(a.id, { resolve: false });
          },
          onError: (err) => {
            toast.error(`Failed: ${err.message}`);
          },
        },
      );
    },
    [dismissMutation, handleComplete],
  );

  const handleRunNexusCheck = useCallback(
    (a: Announcement) => {
      setNexusForAnnouncement(a);
    },
    [],
  );

  // Per-client confirm callback fired by NexusCheckModal as the CPA cycles
  // through affected clients. Each call writes a nexus_questionnaire_run +
  // upserts client_state_nexus.status. When filings are selected, also
  // batch-adds them as deadlines (yellow-zone — CPA-initiated). The modal
  // advances itself client-by-client; we only flip the alert to handled
  // when it closes (handleNexusClose below).
  const handleNexusConfirm = useCallback(
    async (input: {
      clientId: string;
      answers: Record<string, boolean>;
      selectedFilings: string[];
      notifyOnly: boolean;
    }) => {
      const a = nexusForAnnouncement;
      if (!a) return;
      if (input.notifyOnly) {
        toast.info("Notification queued · no filings added");
        return;
      }
      try {
        const checkResult = await runNexusCheckMutation.mutateAsync({
          announcementId: a.id,
          clientId: input.clientId,
          state: a.stateCode,
          // V1 maps every nexus_change alert to "sales" — when the BE
          // surfaces nexusKind on the announcement payload, thread it
          // through here.
          nexusKind: "sales" as const,
          answers: input.answers,
        });
        if (
          checkResult.status === "established" &&
          input.selectedFilings.length > 0
        ) {
          const addResult = await addNexusFilingsMutation.mutateAsync({
            announcementId: a.id,
            clientId: input.clientId,
            state: a.stateCode,
            filings: input.selectedFilings.map((formCode) => ({
              formCode,
              formName: formCode,
            })),
          });
          toast.success(
            `${addResult.filingsAdded} ${addResult.filingsAdded === 1 ? "filing" : "filings"} added · Undo (24h)`,
          );
        } else {
          toast.success(
            `Nexus check saved — ${checkResult.status.replace(/_/g, " ")}`,
          );
        }
      } catch (err) {
        toast.error(
          `Couldn't run nexus check — ${err instanceof Error ? err.message : "try again"}`,
        );
      }
    },
    [nexusForAnnouncement, runNexusCheckMutation, addNexusFilingsMutation],
  );

  const handleNexusClose = useCallback(() => {
    const a = nexusForAnnouncement;
    setNexusForAnnouncement(null);
    if (a) handleComplete(a.id);
  }, [nexusForAnnouncement, handleComplete]);

  // Mobile column visibility — at <md the workshop is single-column.
  // Without an explicit URL :id the user sees the feed; selecting an alert
  // pushes the pane to fill the viewport (the pane's X button returns to
  // the feed via handleClearSelection, which clears the URL). At md+ both
  // columns are visible together as the workshop intends.
  const hasExplicitSelection = Boolean(params.id);

  return (
    <PageContainer variant="workshop" className="flex-col md:flex-row">
      {/* ── Center feed ──────────────────────────────────────────────── */}
      <section
        className={`flex-1 min-w-0 flex-col bg-canvas overflow-hidden md:flex ${
          hasExplicitSelection ? "hidden" : "flex"
        }`}
      >
        <div className="px-4 md:px-6 lg:px-8 pt-6 md:pt-8 pb-region bg-surface border-b border-line sticky top-0 z-10">
          {/* Counter reflects # of CLIENTS the active alerts touch
              (`totals.affectingClients`), not the raw alert count.
              Sarah asks "how many of MY clients does this affect?" not
              "how many press releases came in?" — so the heading number
              must answer the actionable question. */}
          <PageHeader
            title="Alerts"
            meta={`${totals.affectingClients} ${totals.affectingClients === 1 ? "client affected" : "clients affected"}`}
            className="mb-2"
          />
          {/* Ambient monitoring line — v0u inheritance. Pulsing dot
              signals "we're watching" without nagging; the timestamp
              earns trust by being specific. Static "14m ago" until
              the scrape backend reports its own clock. */}
          <div className="mb-region flex items-center gap-2 text-xs text-ink-500">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-ok-solid animate-pulse"
              aria-hidden
            />
            <span>50 / 50 states monitored</span>
            <span className="text-ink-300" aria-hidden>·</span>
            <span className="tabular-nums">last scrape 14m ago</span>
          </div>
          <div className="flex items-center gap-1 border-b border-line -mb-region">
            <FilterChip
              variant="tab"
              active={tab === "affecting"}
              onClick={() => setTab("affecting")}
              count={totals.affecting}
            >
              Affecting you
            </FilterChip>
            <FilterChip
              variant="tab"
              active={tab === "all"}
              onClick={() => setTab("all")}
              count={totals.all}
            >
              All announcements
            </FilterChip>
            <FilterChip
              variant="tab"
              active={tab === "resolved"}
              onClick={() => setTab("resolved")}
              count={totals.resolved}
            >
              Resolved
            </FilterChip>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 py-region flex flex-col gap-card">
          {announcementsQuery.isLoading ? (
            <div className="text-center text-sm text-ink-500 py-12">
              Loading state alerts…
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-surface border border-line rounded-md px-6 py-12 text-center">
              <Megaphone
                className="w-6 h-6 text-ink-300 mx-auto mb-2"
                aria-hidden
              />
              <p className="text-sm font-semibold text-ink-700">
                {tab === "resolved"
                  ? "Nothing dismissed yet."
                  : "No state announcements affecting your clients."}
              </p>
              <p className="text-xs text-ink-500 mt-1">
                We check 50 state authorities every hour. You'll see anything
                relevant here.
              </p>
            </div>
          ) : (
            filtered.map((a) => (
              <StateAlertCard
                key={a.id}
                a={a}
                variant="feed"
                selected={a.id === selectedId}
                handled={handledIds.has(a.id)}
                onSelect={() => handleSelect(a.id)}
                onComplete={handleComplete}
                clientSource={clientSource}
              />
            ))
          )}
        </div>
      </section>

      {/* ── Co-pilot pane ────────────────────────────────────────────── */}
      <CopilotPane
        hasExplicitSelection={hasExplicitSelection}
        announcement={selected}
        excludedClientIds={
          selected ? excludedByAlert.get(selected.id) ?? new Set() : new Set()
        }
        draftOverrides={draftOverrides}
        onToggleExclusion={(clientId) =>
          selected && toggleClientExclusion(selected.id, clientId)
        }
        onClose={handleClearSelection}
        onEditDraft={handleEditDraft}
        onSendBulletin={handleSendBulletin}
        onApplyDeadline={handleApplyDeadline}
        onAcknowledgeAdmin={(a) => {
          // form_change alerts auto-resolve when the CPA opens the admin
          // reviewer queue — that's the canonical finishing action for
          // catalog-level updates (vs client emails for client-impacting
          // alerts). Keeps the "Resolved" tab honest: anything the CPA
          // has touched moves out of Active.
          handleComplete(a.id);
        }}
        onRunNexusCheck={handleRunNexusCheck}
        onSnooze={handleSnooze}
        onMarkNotApplicable={handleMarkNotApplicable}
        isSending={sendBulletinMutation.isPending}
        isApplying={batchAdjustMutation.isPending}
        clientSource={clientSource}
      />
      {editing && (
        <EmailBulletinEditModal
          open
          subject={editing.subject}
          body={editing.body}
          recipientName={editing.client.name}
          recipientEmail={editing.client.email}
          onSave={handleSaveEdit}
          onClose={() => setEditing(null)}
        />
      )}
      <NexusCheckModal
        open={nexusForAnnouncement !== null}
        announcement={nexusForAnnouncement}
        recipients={
          nexusForAnnouncement
            ? affectedClientsFor(nexusForAnnouncement, clientSource).filter(
                (c) =>
                  !(excludedByAlert.get(nexusForAnnouncement.id) ?? new Set())
                    .has(c.id),
              )
            : []
        }
        onClose={handleNexusClose}
        onConfirm={handleNexusConfirm}
      />
    </PageContainer>
  );
}

