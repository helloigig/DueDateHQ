import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { signOut, useSession } from "../data/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { BrandBar, HelpButton } from "../pages/auth/AuthShell";

interface Props {
  step: number; // 1-based
  totalSteps: number;
  /** Estimated time for this step, e.g. "30s", "60s". Shown next to the step counter. */
  estimate?: string;
  title: string;
  subtitle?: string;
  /** Single brand-line that lives below the content — what this product is. */
  brandLine?: string;
  /**
   * When true, the page renders edge-to-edge (no max-width gutter on the
   * content column). Use sparingly — only for pages that need a wider area
   * like the import grid or the package-confirmation table.
   */
  wide?: boolean;
  children: React.ReactNode;
}

const DEFAULT_BRAND_LINE =
  'We integrate, we don\'t replace. Useful Day 1 — no "AI is learning" copy here.';

/**
 * Wizard chrome for the /onboarding/* funnel — Mercury-aligned. Slim brand
 * bar with logo + user dropdown, thin indigo progress under the bar, then a
 * single centered content column. No surrounding card; the page itself is
 * the canvas. Footer is a quiet brand-line + total-time line — kept because
 * the strategic posture matters during the most-vulnerable funnel step.
 */
export function OnboardingShell({
  step,
  totalSteps,
  estimate,
  title,
  subtitle,
  brandLine,
  wide,
  children,
}: Props) {
  const session = useSession();
  const progress = step / totalSteps;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <BrandBar
        progress={progress}
        topRight={<UserMenu name={session?.userName} email={session?.userEmail} />}
      />
      <main className="flex-1">
        <div
          className={[
            "mx-auto px-6 py-12",
            wide ? "max-w-5xl" : "max-w-2xl",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-indigo font-semibold">
            <span>
              Step {step} of {totalSteps}
            </span>
            {estimate && (
              <>
                <span className="text-ink-300">·</span>
                <span className="text-ink-500 font-medium">{estimate}</span>
              </>
            )}
          </div>
          <h1 className="text-display font-semibold text-ink-900 mt-3">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-ink-500 mt-2 leading-relaxed max-w-xl">
              {subtitle}
            </p>
          )}
          <div className="mt-8">{children}</div>
        </div>
      </main>
      <footer className="border-t border-line">
        <div
          className={[
            "mx-auto px-6 py-4 flex items-center justify-between gap-4 text-2xs",
            wide ? "max-w-5xl" : "max-w-2xl",
          ].join(" ")}
        >
          <p className="text-ink-500 italic leading-snug">
            {brandLine ?? DEFAULT_BRAND_LINE}
          </p>
          <p className="text-ink-400 shrink-0">Total: under 5 minutes</p>
        </div>
      </footer>
      <HelpButton />
    </div>
  );
}

function UserMenu({
  name,
  email,
}: {
  name?: string;
  email?: string;
}) {
  const display = name ?? email ?? "Account";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 text-sm text-ink-700 hover:text-ink-900 transition-colors"
          aria-label="Open account menu"
        >
          <span className="hidden sm:inline">{display}</span>
          <ChevronDown className="w-3.5 h-3.5 text-ink-400" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2 border-b border-line">
          <div className="text-sm font-medium text-ink-900 truncate">
            {name}
          </div>
          {email && (
            <div className="text-2xs text-ink-500 truncate">{email}</div>
          )}
        </div>
        <DropdownMenuItem asChild>
          <Link to="/login">Switch account</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
