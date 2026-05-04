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
  /** Optional time estimate, e.g. "60s". Most pages omit. */
  estimate?: string;
  title: string;
  subtitle?: string;
  /** Optional brand line under the content. Pages can opt out for a cleaner look. */
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
            {estimate && (
              <>
                <span className="text-ink-300">·</span>
                <span>{estimate}</span>
              </>
            )}
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
