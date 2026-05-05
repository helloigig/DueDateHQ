import { Link } from "react-router-dom";

interface Props {
  step: number; // 1-based
  totalSteps: number;
  title: string;
  subtitle?: string;
  /** Optional brand line under the content. Pages can opt out for a cleaner look. */
  brandLine?: string;
  /**
   * Inner column width:
   *   - "default" (~768px) — forms, choice tiles, summaries
   *   - "wide" (~1024px) — CSV preview tables that need horizontal room
   *
   * Header always uses the "wide" container so the logo / step indicator
   * sit at a stable position across all steps. Content width varies by
   * page so a 5-state form doesn't feel lost in a wide column.
   */
  width?: "default" | "wide";
  children: React.ReactNode;
}

const WIDTH_CLASS: Record<NonNullable<Props["width"]>, string> = {
  default: "max-w-3xl",
  wide: "max-w-5xl",
};

/**
 * Wizard chrome for the /onboarding/* funnel. Outside the AppShell so the
 * user has no sidebar distractions during setup.
 *
 * Header sits at "wide" so the brand + step counter line up with the
 * widest possible content region. Content is centered to a column that
 * matches the page's needs (default for forms, wide for tables).
 */
export function OnboardingShell({
  step,
  totalSteps,
  title,
  subtitle,
  brandLine,
  width = "default",
  children,
}: Props) {
  const innerWidth = WIDTH_CLASS[width];
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="border-b border-line bg-surface">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center">
          <Link to="/" className="text-sm font-semibold text-ink-900">
            DueDateHQ
          </Link>
          <span className="ml-auto text-xs text-ink-500 flex items-center gap-2">
            <span>
              Step {step} of {totalSteps}
            </span>
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
        <div className={`${innerWidth} mx-auto px-6 py-10`}>
          <h1 className="text-2xl font-semibold text-ink-900">{title}</h1>
          {subtitle && (
            <p className="text-sm text-ink-500 mt-2 leading-relaxed max-w-xl">
              {subtitle}
            </p>
          )}
          <div className="mt-8">{children}</div>
        </div>
      </main>
      {brandLine && (
        <footer className="border-t border-line py-4">
          <div className={`${innerWidth} mx-auto px-6`}>
            <p className="text-2xs text-ink-500 italic">{brandLine}</p>
          </div>
        </footer>
      )}
    </div>
  );
}
