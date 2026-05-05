/**
 * Period labels for forms that recur multiple times in a tax year.
 *
 * Three "941"s with no quarter label is the canonical complaint: the
 * filing list shows three identical rows and the CPA can't tell which
 * quarter is which. We label them Q1/Q2/Q3/Q4 from the official due
 * date — 941 is due the last day of the month following the quarter end
 * (Apr 30 / Jul 31 / Oct 31 / Jan 31), and the IRS rolls weekend dates
 * forward to the next business day, so we accept ±1 month of slack.
 *
 * Returns null for non-quarterly forms or unrecognised due-date months;
 * callers should treat null as "no period qualifier needed."
 */
export function quarterLabelForForm(
  form: string,
  officialDueDate: string,
): string | null {
  const bare = form
    .toUpperCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // 941 (Federal) Quarterly Federal Tax Return; also 1040-ES (estimated
  // payments due Apr 15 / Jun 15 / Sep 15 / Jan 15) — use the same map
  // approximation since 1040-ES due months don't overlap.
  const isQuarterly = /^941\b/.test(bare) || /^1040-?ES\b/.test(bare);
  if (!isQuarterly) return null;
  const month = parseInt(officialDueDate.slice(5, 7), 10);
  if (!Number.isFinite(month)) return null;
  // Wide month windows absorb weekend/holiday roll-forward to the next
  // business day (rare but visible — 941 Q3 2026 due date is Nov 2 because
  // Oct 31 is a Saturday).
  if (month === 4 || month === 5) return "Q1";
  if (month === 6 || month === 7 || month === 8) return "Q2";
  if (month === 9 || month === 10 || month === 11) return "Q3";
  if (month === 12 || month === 1 || month === 2) return "Q4";
  return null;
}

/**
 * Decorate a form code with its period label when one applies.
 * `decorateForm("941", "2026-07-31")` → `"941 Q2"`.
 * `decorateForm("1120", "2026-04-15")` → `"1120"`.
 */
export function decorateFormWithPeriod(
  form: string,
  officialDueDate: string,
): string {
  const q = quarterLabelForForm(form, officialDueDate);
  return q ? `${form} ${q}` : form;
}
