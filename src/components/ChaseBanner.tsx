import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Phone, Mail, ChevronRight } from "lucide-react";
import { useStore } from "../data/store";
import { hoursSince } from "../data/dateHelpers";
import {
  EmailDraftModal,
  type EmailDraftIntent,
} from "./EmailDraftModal";

// 14 days = the email-reminder cadence has had time to work and the client
// still hasn't responded. Earlier than that, calling is rude (clients are
// just slow in tax season — that's not a problem to solve, it's a fact to
// absorb). Past 14 days, automation has effectively given up and a human
// touch is the next move.
const QUIET_HOURS = 14 * 24;

// Cap visible rows. If somehow more than 5 clients have gone quiet, the
// extras link out to /inbox — we never let this banner grow into a wall.
const MAX_VISIBLE = 5;

/**
 * Quiet-clients banner. Pattern 2 (chase loop) representation on the
 * dashboard, intentionally NOT a volume indicator.
 *
 * The previous design surfaced aggregate counters ("84 docs · 84 stalled")
 * in warn colors. That violated the product's calm-framing principle —
 * tax season *naturally* produces big chase queues, and reflecting that
 * volume back at the CPA in red feels like shame, not help.
 *
 * Reframing: the reminder system is supposed to handle most of the queue
 * on its own. The only cases that deserve dashboard presence are ones
 * where automation has run out — clients who got a reminder 14+ days ago
 * and never responded. Those need a phone call, not another email.
 *
 * Calm presentation:
 *   • Hidden entirely when zero quiet clients (no "all on cadence" noise)
 *   • Neutral visual surface — no warn/danger colors
 *   • Header leads with reassurance, not failure count
 *   • Primary action is Call (the thing automation can't do)
 *   • Capped at 5 rows; the rest links into /inbox
 */
export function ChaseBanner() {
  const { checklistItems, tasks, clients } = useStore();
  const [emailIntent, setEmailIntent] = useState<EmailDraftIntent | null>(null);

  const taskById = useMemo(
    () => new Map(tasks.map((t) => [t.id, t])),
    [tasks]
  );
  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients]
  );

  // Quiet = requested_waiting + lastReminderAt was 14+ days ago.
  // Anything fresher than that is "the reminder system is working on it."
  const quiet = useMemo(
    () =>
      checklistItems
        .filter(
          (c) =>
            c.state === "requested_waiting" &&
            c.lastReminderAt &&
            hoursSince(c.lastReminderAt) >= QUIET_HOURS
        )
        .sort(
          (a, b) =>
            (a.lastReminderAt ?? "").localeCompare(b.lastReminderAt ?? "")
        ),
    [checklistItems]
  );

  // Hide entirely when calm. The dashboard doesn't need to announce "no
  // problems" — that's just another counter to absorb.
  if (quiet.length === 0) return null;

  // Group by client — multiple quiet items from the same client coalesce
  // into one row. CPA calls Acme Corp once, not three times.
  type Group = {
    clientId: string;
    clientName: string;
    items: typeof quiet;
    oldestDays: number;
  };
  const grouped: Group[] = [];
  const groupByClient = new Map<string, Group>();
  for (const c of quiet) {
    const task = taskById.get(c.taskId);
    const client = task ? clientById.get(task.clientId) : null;
    if (!task || !client) continue;
    const days = c.lastReminderAt
      ? Math.round(hoursSince(c.lastReminderAt) / 24)
      : 0;
    let g = groupByClient.get(client.id);
    if (!g) {
      g = {
        clientId: client.id,
        clientName: client.name,
        items: [],
        oldestDays: 0,
      };
      groupByClient.set(client.id, g);
      grouped.push(g);
    }
    g.items.push(c);
    g.oldestDays = Math.max(g.oldestDays, days);
  }
  // Most-quiet first — these are the ones least likely to crack via more email.
  grouped.sort((a, b) => b.oldestDays - a.oldestDays);

  const visible = grouped.slice(0, MAX_VISIBLE);
  const hiddenCount = Math.max(0, grouped.length - visible.length);

  const openEmail = (groupIdx: number) => {
    const g = visible[groupIdx];
    if (!g || g.items.length === 0) return;
    const item = g.items[0];
    const task = taskById.get(item.taskId);
    const client = task ? clientById.get(task.clientId) : null;
    if (!task || !client) return;
    setEmailIntent({ task, client, checklistItem: item });
  };

  return (
    <>
      <section
        className="bg-surface border border-line rounded-md overflow-hidden"
        aria-label="Quiet clients"
      >
        <header className="px-4 py-3 border-b border-line bg-sunken/30">
          <h2 className="text-sm font-semibold text-ink-900">
            {grouped.length === 1
              ? "One client has gone quiet"
              : `${grouped.length} clients have gone quiet`}
          </h2>
          <p className="text-2xs text-ink-500 mt-1 max-w-2xl leading-relaxed">
            Reminder system is on cadence for the rest of your queue. These{" "}
            {grouped.length === 1 ? "didn't respond" : "haven't responded"} after
            14+ days — a phone call usually unsticks this faster than another
            email.
          </p>
        </header>
        <ul className="divide-y divide-line">
          {visible.map((g, idx) => (
            <li
              key={g.clientId}
              className="px-4 py-2.5 flex items-center gap-3"
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0 bg-ink-400"
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <Link
                  to={`/clients/${g.clientId}`}
                  className="text-sm text-ink-900 hover:underline truncate inline-flex items-baseline gap-2 flex-wrap"
                >
                  <span className="font-medium">{g.clientName}</span>
                  <span className="text-2xs text-ink-500">
                    {g.items.length === 1
                      ? g.items[0].label
                      : `${g.items.length} documents`}
                  </span>
                </Link>
                <p className="text-2xs text-ink-500 mt-0.5">
                  Last reminder {g.oldestDays} days ago · no reply
                </p>
              </div>
              <button
                onClick={() => openEmail(idx)}
                className="text-xs text-ink-500 hover:text-ink-900 px-2 py-1 rounded hover:bg-sunken inline-flex items-center gap-1 shrink-0"
                title="Send a personal email"
              >
                <Mail className="w-3 h-3" aria-hidden />
                Email
              </button>
              <a
                href={`tel:`}
                onClick={(e) => {
                  // No real phone numbers in mock — open client detail
                  // where the CPA can grab the contact info.
                  e.preventDefault();
                  window.location.href = `/clients/${g.clientId}`;
                }}
                className="text-xs px-3 py-1.5 rounded border border-line bg-surface text-ink-900 hover:bg-sunken inline-flex items-center gap-1 shrink-0"
              >
                <Phone className="w-3 h-3" aria-hidden />
                Call
              </a>
            </li>
          ))}
          {hiddenCount > 0 && (
            <li>
              <Link
                to="/inbox"
                className="w-full px-4 py-2 text-2xs text-ink-500 hover:text-ink-900 hover:bg-sunken/30 inline-flex items-center gap-1.5"
              >
                <ChevronRight className="w-3 h-3" aria-hidden />
                {hiddenCount} more quiet client{hiddenCount === 1 ? "" : "s"}{" "}
                in the queue
              </Link>
            </li>
          )}
        </ul>
      </section>

      <EmailDraftModal
        open={!!emailIntent}
        intent={emailIntent}
        onClose={() => setEmailIntent(null)}
      />
    </>
  );
}
