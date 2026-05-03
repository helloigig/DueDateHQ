import { useEffect, useMemo, useState } from "react";
import {
  Mail,
  CalendarClock,
  Forward,
  MoonStar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Send,
  Pencil,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatLongDate } from "@/data/dateHelpers";
import type { Announcement } from "@/types";
import type { AffectedClient } from "./StateAlertCard";
import { cn } from "@/lib/utils";

/**
 * SuggestedActionsSheet — the v0.7 §differentiator drilldown.
 *
 * v0u's "AI co-pilot" right pane, rendered as a right-anchored Sheet so the
 * single-column DESIGN.md max-w-840 page rule isn't broken. Opens on click
 * of a StateAlertCard.
 *
 * Sections, top → bottom:
 *   1. Header — state + announcement title (closeable via Sheet's X)
 *   2. Context strip — selected announcement summary + impact
 *   3. Suggested actions — 4 action cards. The primary (Draft N emails)
 *      expands inline with an email preview that cycles through clients.
 *   4. Composer — free-form prompt + hint chips (mocked toast for now)
 *
 * Buttons follow T2/T3: indigo accent on the primary "Send all", everything
 * else is a slate ghost. No status colors as paint anywhere.
 */

const TYPE_LABEL: Record<Announcement["type"], string> = {
  disaster_extension: "Disaster ext.",
  penalty_relief: "Penalty relief",
  pte_change: "PTE change",
  form_change: "Form change",
  rate_change: "Rate change",
  nexus_change: "Nexus change",
};

function firstNameFromEmail(email: string | undefined): string | null {
  if (!email) return null;
  const local = email.split("@")[0];
  if (!local) return null;
  const first = local.split(/[._-]/)[0];
  if (!first || first.length < 2) return null;
  // Skip obvious role accounts — they read worse than no name at all
  // ("Hi Hello," from hello@example.com is a common shipped-bug source).
  const roleAccounts = new Set([
    "ops", "info", "admin", "billing", "team", "office",
    "hello", "contact", "support", "help", "sales", "noreply",
    "no-reply", "accounts", "accounting", "finance", "ar", "ap",
  ]);
  if (roleAccounts.has(first.toLowerCase())) {
    return null;
  }
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function draftSubject(a: Announcement, client: AffectedClient): string {
  if (a.type === "disaster_extension" && a.newDeadline) {
    return `${a.stateCode}: ${a.title} applies to your filing`;
  }
  if (a.newDeadline) {
    return `${a.stateCode}: deadline shift for ${client.name}`;
  }
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

export interface SuggestedActionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement: Announcement | null;
  affectedClients: AffectedClient[];
}

export function SuggestedActionsSheet({
  open,
  onOpenChange,
  announcement,
  affectedClients,
}: SuggestedActionsSheetProps) {
  const [draftIndex, setDraftIndex] = useState(0);
  const [composerValue, setComposerValue] = useState("");

  // Reset cycle + composer when a new announcement is opened
  useEffect(() => {
    setDraftIndex(0);
    setComposerValue("");
  }, [announcement?.id]);

  const clientCount = affectedClients.length;
  const currentClient = affectedClients[draftIndex];
  const subject = useMemo(
    () =>
      announcement && currentClient
        ? draftSubject(announcement, currentClient)
        : "",
    [announcement, currentClient],
  );
  const body = useMemo(
    () =>
      announcement && currentClient
        ? draftBody(announcement, currentClient)
        : "",
    [announcement, currentClient],
  );

  if (!announcement) return null;
  const a = announcement;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-[560px] w-[560px] flex flex-col p-0"
      >
        {/* Header — state + title */}
        <SheetHeader className="flex items-start gap-3 px-region py-3 border-b border-line">
          <span
            className="shrink-0 w-9 h-9 rounded-md bg-sunken text-ink-900 inline-flex items-center justify-center text-xs font-bold tracking-wide"
            aria-hidden
          >
            {a.stateCode}
          </span>
          <div className="flex-1 min-w-0 pr-8">
            <SheetTitle className="text-sm font-semibold text-ink-900 leading-snug">
              {a.title}
            </SheetTitle>
            <SheetDescription className="text-xs text-ink-500 mt-0.5">
              {a.authority}
            </SheetDescription>
          </div>
        </SheetHeader>

        {/* Context strip — recap of the announcement + impact + source link */}
        <section className="px-region py-3 bg-sunken/30 border-b border-line">
          <div className="flex items-center gap-2 mb-2">
            <StatusPill variant="warn" size="xs">
              {TYPE_LABEL[a.type]}
            </StatusPill>
            <span className="text-xs text-ink-700 font-medium tabular-nums">
              {clientCount} {clientCount === 1 ? "client" : "clients"} affected
            </span>
            {a.newDeadline && (
              <>
                <span className="text-ink-300 text-xs">·</span>
                <span className="text-xs text-ink-700">
                  new deadline{" "}
                  <span className="font-semibold text-ink-900">
                    {formatLongDate(a.newDeadline)}
                  </span>
                </span>
              </>
            )}
          </div>
          <p className="text-xs text-ink-700 leading-snug line-clamp-3">
            {a.summary}
          </p>
          <a
            href={a.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-900 mt-1.5 underline underline-offset-[3px] decoration-[1.5px]"
          >
            View official bulletin
            <ExternalLink className="w-3 h-3" aria-hidden />
          </a>
        </section>

        {/* Suggested actions — the differentiator block */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-region py-3 flex items-center gap-2">
            <span className="text-2xs uppercase tracking-wider font-semibold text-indigo-ink inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" aria-hidden />
              AI suggested actions
            </span>
            <span className="text-xs text-ink-500 ml-auto">
              {a.newDeadline ? "4" : "3"} ready
            </span>
          </div>

          <div className="px-region pb-region flex flex-col gap-2">
            {/* Action 1: draft emails — expanded with preview */}
            <article className="bg-surface border border-indigo-soft rounded-md overflow-hidden">
              <div className="flex items-start gap-3 p-region">
                <span
                  className="shrink-0 w-7 h-7 rounded-md bg-indigo text-white inline-flex items-center justify-center"
                  aria-hidden
                >
                  <Mail className="w-3.5 h-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-900 leading-snug">
                    Draft {clientCount} client{" "}
                    {clientCount === 1 ? "email" : "emails"}
                  </div>
                  <div className="text-xs text-ink-700 mt-1 leading-snug">
                    Personalized for each affected client · references the{" "}
                    {a.authority} bulletin
                    {a.newDeadline && ` · explains the ${formatLongDate(a.newDeadline)} deadline`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    toast.success(
                      `Sent draft to ${clientCount} ${clientCount === 1 ? "client" : "clients"}`,
                    );
                    onOpenChange(false);
                  }}
                  className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-pill text-xs font-semibold bg-indigo text-white hover:bg-indigo-hover transition-colors"
                >
                  <Send className="w-3 h-3" aria-hidden />
                  Send all
                </button>
              </div>

              {/* Email preview — the v0u "Edit / Refine / cycle" pattern */}
              {currentClient && (
                <div className="mx-region mb-region bg-sunken/50 border border-line rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2 text-2xs uppercase tracking-wider font-semibold text-ink-500">
                    <span className="bg-indigo-soft text-indigo-ink px-1.5 py-0.5 rounded text-[10px] font-bold">
                      Preview {draftIndex + 1} of {clientCount}
                    </span>
                    <span className="text-ink-500 normal-case tracking-normal text-xs font-normal truncate">
                      To: {currentClient.email ?? currentClient.name}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-ink-900 mb-1 leading-snug">
                    {subject}
                  </div>
                  <div className="text-xs text-ink-700 leading-snug whitespace-pre-line line-clamp-6">
                    {body}
                  </div>
                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-line">
                    <button
                      type="button"
                      onClick={() =>
                        toast.info(`Open editor for ${currentClient.name}`)
                      }
                      className="inline-flex items-center gap-1 h-6 px-2 rounded text-xs text-ink-700 hover:bg-surface transition-colors"
                    >
                      <Pencil className="w-3 h-3" aria-hidden />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.info("AI is refining the draft…")}
                      className="inline-flex items-center gap-1 h-6 px-2 rounded text-xs text-ink-700 hover:bg-surface transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" aria-hidden />
                      Refine
                    </button>
                    <div className="ml-auto inline-flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          setDraftIndex((i) => Math.max(0, i - 1))
                        }
                        disabled={draftIndex === 0}
                        className="w-6 h-6 inline-flex items-center justify-center rounded text-ink-700 hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent"
                        aria-label="Previous draft"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
                      </button>
                      <span className="text-xs text-ink-500 tabular-nums px-1.5 min-w-[44px] text-center">
                        {draftIndex + 1} / {clientCount}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftIndex((i) => Math.min(clientCount - 1, i + 1))
                        }
                        disabled={draftIndex === clientCount - 1}
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

            {/* Action 2: batch-extend deadlines (if newDeadline) */}
            {a.newDeadline && (
              <ActionRow
                icon={<CalendarClock className="w-3.5 h-3.5" aria-hidden />}
                title={`Apply new ${formatLongDate(a.newDeadline)} deadline`}
                description={`Move ${clientCount} affected ${clientCount === 1 ? "filing" : "filings"} · audit-trailed with the announcement source`}
                cta="Preview"
                onClick={() =>
                  toast.success(
                    `${clientCount} deadlines moved to ${formatLongDate(a.newDeadline!)}`,
                  )
                }
              />
            )}

            {/* Action 3: forward bulletin */}
            <ActionRow
              icon={<Forward className="w-3.5 h-3.5" aria-hidden />}
              title={`Forward ${a.authority} bulletin`}
              description={`Attaches the official URL · short cover note · ${clientCount} recipients`}
              cta="Preview"
              onClick={() =>
                toast.info(`Bulletin forward staged for ${clientCount} clients`)
              }
            />

            {/* Action 4: snooze (per DESIGN.md — no Dismiss) */}
            <ActionRow
              icon={<MoonStar className="w-3.5 h-3.5" aria-hidden />}
              title="Snooze until tomorrow"
              description="Reminders pause; alert reappears on next page load if unresolved"
              cta="Snooze"
              onClick={() => {
                toast.success("Snoozed until tomorrow");
                onOpenChange(false);
              }}
            />
          </div>
        </div>

        {/* Composer — free-form refinement (mocked) */}
        <div className="border-t border-line bg-sunken/30 p-region">
          <div className="bg-surface border border-line-strong rounded-md p-2.5 focus-within:border-indigo focus-within:ring-2 focus-within:ring-indigo-soft transition-colors">
            <div className="flex items-end gap-2">
              <textarea
                rows={1}
                value={composerValue}
                onChange={(e) => setComposerValue(e.target.value)}
                placeholder="Ask about this announcement, or refine an action…"
                className="flex-1 resize-none bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none min-h-[22px] max-h-[100px]"
              />
              <button
                type="button"
                onClick={() => {
                  if (!composerValue.trim()) return;
                  toast.success("AI is thinking…");
                  setComposerValue("");
                }}
                disabled={!composerValue.trim()}
                className={cn(
                  "shrink-0 w-7 h-7 inline-flex items-center justify-center rounded text-white transition-colors",
                  composerValue.trim()
                    ? "bg-indigo hover:bg-indigo-hover"
                    : "bg-ink-300 cursor-not-allowed",
                )}
                aria-label="Send refinement"
              >
                <Send className="w-3.5 h-3.5" aria-hidden />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {(a.type === "disaster_extension"
              ? ["Which counties qualify?", "Make emails warmer", "What if a client opts out?"]
              : ["Make emails warmer", "Suggest follow-up cadence", "Skip non-applicable clients"]
            ).map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => setComposerValue(hint)}
                className="text-xs text-ink-700 bg-surface border border-line hover:border-line-strong hover:bg-sunken px-2.5 py-1 rounded-pill transition-colors"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

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
        className="shrink-0 w-7 h-7 rounded-md bg-sunken text-ink-700 inline-flex items-center justify-center"
        aria-hidden
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
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 inline-flex items-center h-7 px-3 rounded-pill text-xs font-medium bg-surface border border-line text-ink-700 hover:bg-sunken hover:border-line-strong transition-colors"
      >
        {cta}
      </button>
    </article>
  );
}
