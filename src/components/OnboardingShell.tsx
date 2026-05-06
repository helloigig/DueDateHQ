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
  const pct = Math.round((step / totalSteps) * 100);
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="border-b border-line bg-surface/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link to="/" className="text-sm font-semibold text-ink-900 inline-flex items-center gap-2">
            <span
              aria-hidden
              className="w-7 h-7 rounded-md bg-foreground text-background inline-flex items-center justify-center font-bold text-xs shadow-[inset_0_-1px_0_rgba(0,0,0,0.15)]"
            >
              D
            </span>
            <span>DueDateHQ</span>
          </Link>
          {/* Step pip indicator — replaces the plain "Step N of M"
              text with three visible dots that grow + tint as the
              user advances. Reads as a tour at a glance. */}
          <div className="ml-auto flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => {
              const idx = i + 1;
              const isCurrent = idx === step;
              const isDone = idx < step;
              return (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    isCurrent
                      ? "w-8 bg-indigo"
                      : isDone
                        ? "w-1.5 bg-ink-700"
                        : "w-1.5 bg-ink-300"
                  }`}
                  aria-hidden
                />
              );
            })}
            <span className="ml-2 text-2xs text-ink-500 tabular-nums font-medium">
              Step {step} of {totalSteps}
            </span>
          </div>
        </div>
        {/* Edge progress bar — kept as a fine accent below the header
            so the "where am I" signal lives at two visual densities:
            pip dots for at-a-glance, edge bar for ambient progress. */}
        <div className="h-0.5 bg-sunken">
          <div
            className="h-0.5 bg-indigo transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>
      <main className="flex-1">
        <div className={`${innerWidth} mx-auto px-6 py-section`}>
          <h1 className="text-display font-semibold text-ink-900 leading-7 tracking-[-0.01em]">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-ink-500 mt-region leading-relaxed max-w-xl">
              {subtitle}
            </p>
          )}
          <div className="mt-card">{children}</div>
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
