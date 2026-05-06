/**
 * Period suffix for quarterly federal forms.
 *
 * 941 (employer's quarterly federal tax return) and 720 (quarterly
 * federal excise tax) have the same form number on every filing for a
 * given client — only the due date distinguishes Q1/Q2/Q3/Q4. Without
 * a period suffix, three 941s for one client read as
 * "941 / 941 / 941" with only a small due-date column to tell them
 * apart.
 *
 * Yuqi audit 2026-05-06 (round 3 — Task surface): the suffix logic
 * lived inline in FilingsTab.tsx but TaskHeader (and any future
 * single-task surface) had no way to share it. Hoisted here so every
 * surface that names a quarterly form can read the same period.
 */
export function periodSuffix(form: string, dueDate: string): string | null {
  const formNumber = form.replace(/\s*\(.*\)\s*$/, "").trim().toUpperCase();
  const month = parseInt(dueDate.slice(5, 7), 10);
  // Form 941 (quarterly): due Apr / Jul / Oct / Jan-of-next-year
  // covering Q1 / Q2 / Q3 / Q4 respectively. Same schedule for 720.
  if (formNumber === "941" || formNumber === "720") {
    if (month === 4) return "Q1";
    if (month === 7) return "Q2";
    if (month === 10) return "Q3";
    if (month === 1) return "Q4";
  }
  return null;
}
