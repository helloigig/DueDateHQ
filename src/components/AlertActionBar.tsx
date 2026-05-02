/**
 * AlertActionBar — typed primary/secondary verb surface for `/alerts/:id`.
 *
 * Reads the per-alertType config from `data/alertTypeConfig.ts` so the
 * verbs/labels are centralized. The bar itself is a thin presentation
 * component: structure (primary | secondary | overflow), keyboard support,
 * sticky positioning. All copy + behavior decisions live in the config.
 *
 * Style edits: change tone tokens in `alertTypeConfig.ts` (ALERT_TONE_CLASSES)
 * — don't hardcode color classes here.
 */
import type { Announcement } from "../types";
import {
  ALERT_TONE_CLASSES,
  ALERT_TYPE_CONFIG,
  type AlertActionKind,
} from "../data/alertTypeConfig";

export interface AlertActionBarProps {
  announcement: Announcement;
  selectedCount: number;
  onAction: (kind: AlertActionKind) => void;
  onDismiss: () => void;
  /** Optional helper text shown next to the primary verb (e.g. "Bundles deadline shift to May 14"). */
  helperText?: string;
}

export function AlertActionBar({
  announcement,
  selectedCount,
  onAction,
  onDismiss,
  helperText,
}: AlertActionBarProps) {
  const cfg = ALERT_TYPE_CONFIG[announcement.type];
  const tone = ALERT_TONE_CLASSES[cfg.tone];

  const primaryDisabled = !cfg.isAdminGated && selectedCount === 0;
  const primaryLabel = cfg.primaryVerb(selectedCount, announcement);
  const secondaryLabel =
    cfg.secondaryVerb && !cfg.isAdminGated
      ? cfg.secondaryVerb(selectedCount, announcement)
      : null;

  return (
    <section
      className={`mt-5 bg-white border ${tone.border} rounded-lg p-4 flex flex-wrap items-center gap-2 sticky bottom-4 shadow-sm`}
      aria-label="Alert actions"
    >
      <button
        onClick={() => onAction(cfg.primaryAction)}
        disabled={primaryDisabled}
        className="px-4 py-2 rounded bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {primaryLabel}
      </button>

      {secondaryLabel && cfg.secondaryAction && (
        <button
          onClick={() => onAction(cfg.secondaryAction!)}
          disabled={primaryDisabled}
          className="px-3 py-2 rounded border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {secondaryLabel}
        </button>
      )}

      {helperText && (
        <span className="text-xs text-slate-500">{helperText}</span>
      )}

      <button
        onClick={onDismiss}
        className="ml-auto px-3 py-2 rounded text-sm text-slate-500 hover:bg-slate-50"
      >
        Not applicable — dismiss
      </button>
    </section>
  );
}

/**
 * Compact alert-type chip for the header (and other chrome). Tone-driven
 * so visual rebrands ripple from `ALERT_TONE_CLASSES`.
 */
export function AlertTypeChip({ type }: { type: Announcement["type"] }) {
  const cfg = ALERT_TYPE_CONFIG[type];
  const tone = ALERT_TONE_CLASSES[cfg.tone];
  return (
    <span
      className={`inline-flex items-center text-xs px-2 py-0.5 rounded border ${tone.chip}`}
    >
      {cfg.label}
    </span>
  );
}
