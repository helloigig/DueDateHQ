/**
 * Render an HTML document via the browser's native print-to-PDF.
 * Uses an off-screen iframe so the host page's UI stays intact and we don't
 * have to ship a JS PDF library. The user picks "Save as PDF" in the system
 * print dialog — gets the browser's font rendering, vector text, accessibility
 * tagging, and the firm's printer if they want hard copy.
 *
 * This is the right fit for IRS-grade audit-trail packers (PRD §11.3, §15.4):
 * the output is a real PDF, structured well enough for legal review, and the
 * CPA controls the destination.
 */
export function printHtmlAsPdf(html: string, title: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 0.6in; }
  html, body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #0F172A; }
  body { font-size: 11pt; line-height: 1.45; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 0.2em; letter-spacing: -0.01em; }
  h2 { font-size: 13pt; margin: 1.2em 0 0.4em; color: #334155; }
  h3 { font-size: 11pt; margin: 1em 0 0.3em; color: #334155; }
  .meta { font-size: 9pt; color: #64748B; margin-bottom: 1em; }
  .chip { display: inline-block; font-size: 9pt; padding: 1px 6px; border: 1px solid #E2E8F0; border-radius: 4px; color: #334155; margin-right: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 0.5em 0 1em; }
  thead th { text-align: left; border-bottom: 1px solid #CBD5E1; padding: 6px 8px; color: #64748B; font-weight: 600; }
  tbody td { padding: 6px 8px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
  .subtle { color: #64748B; font-size: 9pt; }
  .timeline { list-style: none; padding: 0; margin: 0; }
  .timeline li { padding: 6px 0 6px 12px; border-left: 2px solid #E2E8F0; margin-left: 2px; }
  .timeline .ts { font-size: 9pt; color: #64748B; }
  .footer { margin-top: 2em; padding-top: 0.8em; border-top: 1px solid #E2E8F0; font-size: 9pt; color: #64748B; }
  @media print { .footer { position: running(footer); } }
</style></head><body>${html}</body></html>`);
  doc.close();

  const cleanup = () => {
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {
        /* already removed */
      }
    }, 500);
  };

  // Some browsers fire focus before content is ready; the timeout gives
  // CSS a moment to layout before the print dialog snapshots.
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        cleanup();
      }
    }, 50);
  };
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}

export function downloadJson(filename: string, payload: unknown): void {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
