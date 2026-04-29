import type { EmailDraft, ReminderTemplate } from "../types";

/**
 * Phase 2 auto-send eligibility detector. PRD §7.3 specifies three
 * conditions a template must meet before the system can fire reminders
 * without per-send CPA review:
 *
 *   1. Pattern Precedent — the CPA has approved this template's drafts
 *      ≥ 5 times for at least one client without modification. Translation:
 *      the CPA has demonstrated they trust the AI's output for this kind
 *      of nudge.
 *   2. Routine Item — the underlying checklist item is standard (not a
 *      one-off custom item the CPA hand-added).
 *   3. Timing within Precedent — the cadence is one the system has run
 *      before for this template (i.e. not "once" — once-only first
 *      requests are CPA-approved by definition).
 *
 * If the CPA flips the firm-wide kill switch, no template fires regardless
 * of per-template state. That kill switch is checked at the call site,
 * not here — this function reports template-level eligibility only.
 */

export interface PhaseEligibility {
  eligible: boolean;
  patternPrecedent: {
    met: boolean;
    /** Highest count of approved-no-edit sends to a single client. */
    bestStreak: number;
    /** Threshold (5 per PRD §7.3 condition 1). */
    threshold: number;
    /** Client whose history produced the best streak (UI-friendly). */
    bestClientId: string | null;
  };
  routineItem: boolean;
  timingWithinPrecedent: boolean;
}

const PATTERN_PRECEDENT_THRESHOLD = 5;

export function computeEligibility(
  template: ReminderTemplate,
  drafts: EmailDraft[]
): PhaseEligibility {
  // Filter to drafts that actually came from this template, were sent by
  // the CPA (not auto-fired), and ended up sent (not discarded). These
  // are the "trust signals" we count toward Pattern Precedent.
  const sentForThisTemplate = drafts.filter(
    (d) =>
      d.templateId === template.id &&
      d.status === "sent" &&
      d.sendMethod === "cpa_send"
  );

  const byClient = new Map<string, number>();
  for (const d of sentForThisTemplate) {
    byClient.set(d.clientId, (byClient.get(d.clientId) ?? 0) + 1);
  }

  let bestStreak = 0;
  let bestClientId: string | null = null;
  for (const [clientId, count] of byClient) {
    if (count > bestStreak) {
      bestStreak = count;
      bestClientId = clientId;
    }
  }

  const patternPrecedentMet = bestStreak >= PATTERN_PRECEDENT_THRESHOLD;

  // Routine item: the template targets a standard item type (not an
  // ad-hoc / custom one). We treat the system's seeded itemTypes
  // (wage_w2, 1099_*, k1, schedule_e_support, etc.) as routine.
  const routineItem = !!template.itemType && template.system === true;

  // Timing within precedent: cadence must be repeating. "Once" cadences
  // are first-touch reminders that always go through CPA review by
  // design — Phase 2 is only for follow-ups.
  const timingWithinPrecedent =
    !!template.cadence && template.cadence !== "once";

  return {
    eligible:
      patternPrecedentMet && routineItem && timingWithinPrecedent,
    patternPrecedent: {
      met: patternPrecedentMet,
      bestStreak,
      threshold: PATTERN_PRECEDENT_THRESHOLD,
      bestClientId,
    },
    routineItem,
    timingWithinPrecedent,
  };
}

/** Cosmetic — convert eligibility into a single human-readable status. */
export function eligibilityLabel(e: PhaseEligibility): string {
  if (e.eligible) return "Eligible";
  if (!e.patternPrecedent.met)
    return `Locked · ${e.patternPrecedent.bestStreak}/${e.patternPrecedent.threshold} approvals`;
  if (!e.routineItem) return "Locked · custom-item template";
  if (!e.timingWithinPrecedent) return "Locked · first-touch only";
  return "Locked";
}
