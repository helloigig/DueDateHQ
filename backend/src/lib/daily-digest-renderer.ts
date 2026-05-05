/**
 * Daily AM digest — email renderer.
 *
 * Produces (subject, plain-text body, html body) for one digest payload.
 * Plain-text is the primary surface (Apple Mail dark mode, Gmail
 * mobile preview, accessibility); HTML is a minimal styled wrapper
 * around the same content so desktop Gmail/Outlook isn't ugly.
 *
 * No marketing copy. No "AI is learning." No emoji unless the user's
 * own client name has one. The voice is "calm partner walking you
 * through the day" — short sentences, concrete numbers, deep links.
 */

import type { DigestPayload } from "./daily-digest.js";

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function renderDailyDigest(
  payload: DigestPayload,
  baseUrl: string,
): RenderedEmail {
  return {
    subject: composeSubject(payload),
    text: composeText(payload, baseUrl),
    html: composeHtml(payload, baseUrl),
  };
}

// ---------- Subject ----------

/**
 * Subject heuristic: lead with the most meaningful count; pack the
 * other primary sections as comma-separated phrases. ~50 chars to
 * fit Gmail/Apple Mail truncation. Always prefixed with brand so it's
 * recognizable in a busy inbox.
 *
 * Examples:
 *   "DueDateHQ — 3 urgent today, 2 alerts"
 *   "DueDateHQ — 1 urgent today, 1 reply"
 *   "DueDateHQ — 2 alerts, 1 reply"  (when nothing's overdue)
 */
function composeSubject(p: DigestPayload): string {
  const parts: string[] = [];
  if (p.urgent.length > 0) {
    parts.push(`${p.urgent.length} urgent today`);
  }
  if (p.alerts.length > 0) {
    parts.push(`${p.alerts.length} alert${p.alerts.length === 1 ? "" : "s"}`);
  }
  if (p.replies.length > 0) {
    parts.push(`${p.replies.length} repl${p.replies.length === 1 ? "y" : "ies"}`);
  }
  return `DueDateHQ — ${parts.join(", ")}`;
}

// ---------- Plain text ----------

function composeText(p: DigestPayload, baseUrl: string): string {
  const lines: string[] = [];
  const greeting = p.displayName ? `Good morning, ${p.displayName}.` : "Good morning.";
  lines.push(greeting);
  lines.push("");

  if (p.urgent.length > 0) {
    lines.push(`URGENT TODAY  ${p.urgent.length}`);
    for (const u of p.urgent) {
      lines.push(`  → ${u.clientName} · ${u.formType} · ${describeDue(u.daysFromToday)}`);
    }
    lines.push(`  [Open action queue → ${baseUrl}/today]`);
    lines.push("");
  }

  if (p.alerts.length > 0) {
    lines.push(`NEW STATE ALERTS  ${p.alerts.length}`);
    for (const a of p.alerts) {
      const clientPhrase =
        a.affectedClientCount === 1
          ? "1 of your clients"
          : `${a.affectedClientCount} of your clients`;
      lines.push(`  → ${a.authority}: ${a.title} (${clientPhrase})`);
    }
    lines.push(`  [Open alerts → ${baseUrl}/alerts]`);
    lines.push("");
  }

  if (p.replies.length > 0) {
    lines.push(`CLIENT REPLIES  ${p.replies.length}`);
    for (const r of p.replies) {
      const who = r.clientName ?? localPartOf(r.fromAddress);
      const what = r.subject ?? "replied";
      lines.push(`  → ${who} · ${truncate(what, 60)}`);
    }
    lines.push(`  [Open inbox → ${baseUrl}/mail]`);
    lines.push("");
  }

  // Wrap section — only when at least one primary section fired AND
  // there's something positive to say.
  if (hasWrapContent(p)) {
    lines.push("YESTERDAY WRAP");
    const stats: string[] = [];
    if (p.wrap.tasksClosed > 0) {
      stats.push(`${p.wrap.tasksClosed} task${p.wrap.tasksClosed === 1 ? "" : "s"} closed`);
    }
    if (p.wrap.chasesSent > 0) {
      stats.push(`${p.wrap.chasesSent} chase${p.wrap.chasesSent === 1 ? "" : "s"} sent`);
    }
    if (p.wrap.docsReceived > 0) {
      stats.push(`${p.wrap.docsReceived} doc${p.wrap.docsReceived === 1 ? "" : "s"} received`);
    }
    lines.push(`  ${stats.join(" · ")}`);
    lines.push("");
  }

  lines.push("—");
  lines.push(
    `You're receiving this because you opted in to the daily digest. Manage at ${baseUrl}/settings/notifications.`,
  );
  return lines.join("\n");
}

// ---------- HTML ----------

/**
 * Minimal styled HTML — table-based layout for Outlook compatibility,
 * inline styles only (no <style> tag), system font stack so we don't
 * pay a remote font request.
 */
function composeHtml(p: DigestPayload, baseUrl: string): string {
  const greeting = p.displayName ? `Good morning, ${escapeHtml(p.displayName)}.` : "Good morning.";

  const sections: string[] = [];

  if (p.urgent.length > 0) {
    sections.push(
      sectionHtml({
        label: `URGENT TODAY · ${p.urgent.length}`,
        rows: p.urgent.map(
          (u) =>
            `<strong>${escapeHtml(u.clientName)}</strong> · ${escapeHtml(u.formType)} · ${escapeHtml(describeDue(u.daysFromToday))}`,
        ),
        ctaLabel: "Open action queue →",
        ctaHref: `${baseUrl}/today`,
      }),
    );
  }
  if (p.alerts.length > 0) {
    sections.push(
      sectionHtml({
        label: `NEW STATE ALERTS · ${p.alerts.length}`,
        rows: p.alerts.map((a) => {
          const phrase =
            a.affectedClientCount === 1
              ? "1 of your clients"
              : `${a.affectedClientCount} of your clients`;
          return `<strong>${escapeHtml(a.authority)}</strong>: ${escapeHtml(a.title)} <span style="color:#6b7280">(${phrase})</span>`;
        }),
        ctaLabel: "Open alerts →",
        ctaHref: `${baseUrl}/alerts`,
      }),
    );
  }
  if (p.replies.length > 0) {
    sections.push(
      sectionHtml({
        label: `CLIENT REPLIES · ${p.replies.length}`,
        rows: p.replies.map((r) => {
          const who = r.clientName ?? localPartOf(r.fromAddress);
          const what = r.subject ?? "replied";
          return `<strong>${escapeHtml(who)}</strong> · ${escapeHtml(truncate(what, 60))}`;
        }),
        ctaLabel: "Open inbox →",
        ctaHref: `${baseUrl}/mail`,
      }),
    );
  }
  if (hasWrapContent(p)) {
    const stats: string[] = [];
    if (p.wrap.tasksClosed > 0) {
      stats.push(`${p.wrap.tasksClosed} task${p.wrap.tasksClosed === 1 ? "" : "s"} closed`);
    }
    if (p.wrap.chasesSent > 0) {
      stats.push(`${p.wrap.chasesSent} chase${p.wrap.chasesSent === 1 ? "" : "s"} sent`);
    }
    if (p.wrap.docsReceived > 0) {
      stats.push(`${p.wrap.docsReceived} doc${p.wrap.docsReceived === 1 ? "" : "s"} received`);
    }
    sections.push(`
      <p style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;margin:24px 0 8px 0;font-weight:600">
        Yesterday wrap
      </p>
      <p style="font-size:14px;color:#374151;margin:0">${stats.join(" · ")}</p>
    `);
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(composeSubject(p))}</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f9fafb">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px">
          <tr>
            <td style="padding:24px 28px">
              <p style="font-size:15px;color:#0f172a;margin:0 0 20px 0">${greeting}</p>
              ${sections.join("\n")}
              <p style="font-size:12px;color:#9ca3af;margin:32px 0 0 0;border-top:1px solid #e5e7eb;padding-top:16px">
                Manage at <a href="${baseUrl}/settings/notifications" style="color:#5b5bd6;text-decoration:none">Settings → Notifications</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body></html>`;
}

function sectionHtml(args: {
  label: string;
  rows: string[];
  ctaLabel: string;
  ctaHref: string;
}): string {
  const rows = args.rows
    .map(
      (r) =>
        `<li style="font-size:14px;color:#374151;line-height:1.55;padding:2px 0">${r}</li>`,
    )
    .join("");
  return `
    <p style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#5b5bd6;margin:24px 0 8px 0;font-weight:600">
      ${escapeHtml(args.label)}
    </p>
    <ul style="margin:0 0 8px 0;padding:0;list-style:none">${rows}</ul>
    <p style="margin:0">
      <a href="${args.ctaHref}" style="font-size:13px;color:#5b5bd6;text-decoration:none">${escapeHtml(args.ctaLabel)}</a>
    </p>
  `;
}

// ---------- Helpers ----------

function describeDue(daysFromToday: number): string {
  if (daysFromToday < 0) {
    const d = Math.abs(daysFromToday);
    return d === 1 ? "overdue 1d" : `overdue ${d}d`;
  }
  if (daysFromToday === 0) return "due today";
  // Future deadlines shouldn't make it into the urgent section, but
  // be defensive about copy if they do.
  return `due in ${daysFromToday}d`;
}

function localPartOf(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function hasWrapContent(p: DigestPayload): boolean {
  return p.wrap.chasesSent + p.wrap.docsReceived + p.wrap.tasksClosed > 0;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
