import { Link } from "react-router-dom";

interface Props {
  step: number; // 1-based
  totalSteps: number;
  title: string;
  subtitle?: string;
  /** Optional brand line under the content. Pages can opt out for a cleaner look. */
  brandLine?: string;
  children: React.ReactNode;
}

/**
 * Wizard chrome for the /onboarding/* funnel. Outside the AppShell so the
 * user has no sidebar distractions during setup.
 *
 * Inner column widens to max-w-5xl so wizard pages with tables (CSV import
 * preview) have breathing room. Header keeps a tight max-w-5xl too.
 */
export function OnboardingShell({
  step,
  totalSteps,
  title,
  subtitle,
  brandLine,
  children,
}: Props) {
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
        <div className="max-w-5xl mx-auto px-6 py-10">
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
          <div className="max-w-5xl mx-auto px-6">
            <p className="text-2xs text-ink-500 italic">{brandLine}</p>
          </div>
        </footer>
      )}
    </div>
  );
}

