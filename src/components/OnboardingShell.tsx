import { Link } from "react-router-dom";

interface Props {
  step: number; // 1-based
  totalSteps: number;
  /** Estimated time for this step, e.g. "30s", "60s". Shown next to the step counter. */
  estimate?: string;
  title: string;
  subtitle?: string;
  /** Single brand-line that lives below the content — what this product is. */
  brandLine?: string;
  children: React.ReactNode;
}

const DEFAULT_BRAND_LINE =
  "We integrate, we don't replace. Layer not platform. Useful Day 1 — no \"AI is learning\" copy here.";

/**
 * Wizard chrome for the /onboarding/* funnel. Outside the AppShell so the
 * user has no sidebar distractions during Layer 1.
 *
 * Each step shows its own time estimate + a single brand-line footer that
 * keeps the strategic posture present across the whole flow without
 * being preachy. PRD §1.3 / §1.6 / §1.7 / §6.6.
 */
export function OnboardingShell({
  step,
  totalSteps,
  estimate,
  title,
  subtitle,
  brandLine,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="border-b border-line bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center">
          <Link to="/" className="text-sm font-semibold text-ink-900">
            DueDateHQ
          </Link>
          <span className="ml-auto text-xs text-ink-500 flex items-center gap-2">
            <span>
              Step {step} of {totalSteps}
            </span>
            {estimate && (
              <>
                <span className="text-ink-300">·</span>
                <span>{estimate}</span>
              </>
            )}
            <span className="text-ink-300">·</span>
            <span>Layer 1 onboarding</span>
          </span>
        </div>
        <div className="h-1 bg-sunken">
          <div
            className="h-1 bg-accent transition-[width] duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <h1 className="text-2xl font-semibold text-ink-900">{title}</h1>
          {subtitle && (
            <p className="text-sm text-ink-500 mt-2 max-w-xl">{subtitle}</p>
          )}
          <div className="mt-6">{children}</div>
        </div>
      </main>
      <footer className="border-t border-line py-4">
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-between gap-4">
          <p className="text-2xs text-ink-500 italic">
            {brandLine ?? DEFAULT_BRAND_LINE}
          </p>
          <p className="text-2xs text-ink-400">
            Total target: ≤ 5 min — PRD §8.4
          </p>
        </div>
      </footer>
    </div>
  );
}
