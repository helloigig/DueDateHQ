import { ChevronDown, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
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
  title: string;
  subtitle?: string;
  /**
   * Optional brand-line that lives below the content. Only shown when
   * passed in by the step page — the shell no longer ships a default
   * (the previous "We integrate, we don't replace…" copy was preachy
   * and crowded the funnel without earning its weight).
   */
  brandLine?: string;
  /**
   * When true, the page renders edge-to-edge (no max-width gutter on the
   * content column). Use sparingly — only for pages that need a wider area
   * like the import grid or the package-confirmation table.
   */
  wide?: boolean;
  /**
   * Path to navigate to when the user clicks the back arrow in the brand
   * bar. Defaults to browser back via `navigate(-1)` when omitted. Suppress
   * the back affordance entirely on step 1 by passing `false`.
   */
  back?: string | false;
  children: React.ReactNode;
}

/**
 * Wizard chrome for the /onboarding/* funnel — Mercury-aligned. Slim brand
 * bar with logo + user dropdown, thin indigo progress under the bar, then a
 * single centered content column. No surrounding card; the page itself is
 * the canvas. Footer is suppressed when no brand-line is provided.
 */
export function OnboardingShell({
  step,
  totalSteps,
  title,
  subtitle,
  brandLine,
  wide,
  back,
  children,
}: Props) {
  const session = useSession();
  const navigate = useNavigate();
  const progress = step / totalSteps;
  // Show back arrow on step 2+ unless explicitly suppressed.
  const showBack = back !== false && step > 1;

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
          <div className="flex items-center gap-3 text-2xs uppercase tracking-[0.18em] text-indigo font-semibold">
            {showBack && (
              <button
                type="button"
                onClick={() => {
                  if (typeof back === "string") navigate(back);
                  else navigate(-1);
                }}
                className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900 transition-colors normal-case tracking-normal font-medium"
                aria-label="Back to previous step"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
                <span>Back</span>
              </button>
            )}
            <span>
              Step {step} of {totalSteps}
            </span>
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
      {brandLine && (
        <footer className="border-t border-line">
          <div
            className={[
              "mx-auto px-6 py-4 text-2xs",
              wide ? "max-w-5xl" : "max-w-2xl",
            ].join(" ")}
          >
            <p className="text-ink-500 italic leading-snug">{brandLine}</p>
          </div>
        </footer>
      )}
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
