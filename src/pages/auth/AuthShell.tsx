import { Link } from "react-router-dom";
import { ArrowRight, HelpCircle } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/**
 * Auth chrome — Mercury-aligned. Full-bleed white canvas, slim brand bar at
 * the top, single centered content column with generous whitespace, optional
 * floating help affordance bottom-right. No surrounding card; the form is the
 * page. Primary actions are pill indigo buttons with a trailing arrow.
 *
 * The full Sign-up screen overrides the layout to add a right-rail value
 * proposition; everything else (sign-in, forgot, reset, invite, magic-link)
 * uses the centered single column.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  topRight,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Below the form — small print, alternate-action links. */
  footer?: ReactNode;
  /** Slot in the top-right corner of the brand bar. */
  topRight?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <BrandBar topRight={topRight} />
      <main className="flex-1 flex items-start justify-center px-6">
        <div className="w-full max-w-md pt-16 pb-24">
          <header>
            <h1 className="text-display font-semibold text-ink-900">{title}</h1>
            {subtitle && (
              <p className="text-sm text-ink-500 mt-2 leading-relaxed">
                {subtitle}
              </p>
            )}
          </header>
          <div className="mt-8">{children}</div>
          {footer && (
            <div className="mt-8 pt-6 border-t border-line text-xs text-ink-500 space-y-3">
              {footer}
            </div>
          )}
        </div>
      </main>
      <HelpButton />
    </div>
  );
}

/**
 * Brand bar — small wordmark + brand mark on the left, optional slot on the
 * right (e.g. user-name dropdown during onboarding). Lives at the very top of
 * every auth/onboarding page; intentionally quiet so the page heading carries
 * the visual weight.
 */
export function BrandBar({
  topRight,
  progress,
}: {
  topRight?: ReactNode;
  /** 0–1 — when set, renders a thin indigo progress bar across the bottom. */
  progress?: number;
}) {
  return (
    <header className="border-b border-line">
      <div className="px-6 py-4 flex items-center">
        <Link
          to="/login"
          className="flex items-center gap-2 text-ink-900 no-underline group"
          aria-label="DueDateHQ — back to sign in"
        >
          <BrandMark />
          <span className="text-xs font-semibold tracking-[0.18em] uppercase text-ink-900">
            DueDateHQ
          </span>
        </Link>
        {topRight && <div className="ml-auto">{topRight}</div>}
      </div>
      <div className="h-[3px] bg-line/60 relative overflow-hidden">
        {progress !== undefined && (
          <div
            className="absolute inset-y-0 left-0 bg-indigo transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
          />
        )}
      </div>
    </header>
  );
}

/**
 * Brand mark — mirrors `public/icon.svg`: ink-900 rounded square with three
 * canvas-tone list rows and a danger-red status dot. Inlined as SVG so the
 * entry page doesn't pay an extra image request. If `public/icon.svg` ever
 * changes, update this to match.
 */
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className="shrink-0"
      aria-hidden
    >
      <rect width="32" height="32" rx="6" fill="#0F172A" />
      <g
        fill="none"
        stroke="#FAFAF7"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 12h16" />
        <path d="M8 16h16" />
        <path d="M8 20h10" />
      </g>
      <circle cx="24" cy="20" r="2.5" fill="#EF4444" />
    </svg>
  );
}

export function HelpButton() {
  return (
    <a
      href="mailto:hello@duedatehq.space"
      className="fixed bottom-6 right-6 w-10 h-10 rounded-full bg-surface border border-line shadow-pop flex items-center justify-center text-ink-500 hover:text-indigo hover:border-indigo/40 transition-colors"
      aria-label="Get help"
      title="Email us if you're stuck"
    >
      <HelpCircle className="w-4 h-4" aria-hidden />
    </a>
  );
}

/**
 * Field — label that turns indigo when its child input is focused (the
 * Mercury micro-detail). Uses `focus-within` on the wrapping label so any
 * descendant input/select/textarea triggers the active state. Errors push the
 * label into the danger tone instead.
 */
export function AuthField({
  label,
  optional,
  hint,
  error,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block group">
      <span
        className={[
          "text-xs font-medium block mb-1.5 transition-colors",
          error
            ? "text-danger-ink"
            : "text-ink-500 group-focus-within:text-indigo",
        ].join(" ")}
      >
        {label}
        {optional && (
          <span className="text-ink-400 font-normal ml-1">(optional)</span>
        )}
      </span>
      {children}
      {error ? (
        <span className="text-2xs text-danger-ink mt-1.5 block">{error}</span>
      ) : (
        hint && (
          <span className="text-2xs text-ink-400 mt-1.5 block leading-relaxed">
            {hint}
          </span>
        )
      )}
    </label>
  );
}

/**
 * Tailwind class string for the Mercury-style input — soft fill, no visible
 * border at rest, indigo bottom-edge accent on focus. Exported as a constant
 * so step pages that build their own `<input>`/`<select>` get the same look.
 */
export const authInputClass =
  "w-full px-3 py-2.5 rounded-md bg-canvas border border-transparent text-sm text-ink-900 placeholder:text-ink-400 transition-colors hover:bg-sunken focus:outline-none focus:bg-surface focus:border-indigo focus:shadow-[inset_0_-2px_0_0_rgba(91,91,214,0.18)]";

/**
 * AuthInput — drop-in <input> with the Mercury fill. Uses authInputClass
 * under the hood; accepts any HTML input attributes. Use this when you don't
 * need a custom layout (e.g. select with a chevron); for selects you can
 * still apply `authInputClass` directly.
 */
export function AuthInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[authInputClass, props.className ?? ""].join(" ")}
    />
  );
}

/**
 * Pill primary button — indigo with white text, trailing arrow. The single
 * "next action" affordance on every auth/onboarding screen.
 */
export function PrimaryButton({
  children,
  trailing,
  loading,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Override the trailing icon. Pass `null` to suppress; default is →. */
  trailing?: ReactNode | null;
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-pill px-5 py-2.5 text-sm font-medium",
        "bg-indigo text-white shadow-[0_1px_2px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.18)]",
        "hover:bg-indigo-hover transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo",
        className,
      ].join(" ")}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      ) : (
        <span>{children}</span>
      )}
      {trailing === null ? null : trailing ?? <ArrowRight className="w-3.5 h-3.5" aria-hidden />}
    </button>
  );
}

/**
 * Quiet secondary button — pill outline, slate text. Used for "Cancel" /
 * "Back" / "Skip" — never the primary action.
 */
export function SecondaryButton({
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-pill px-4 py-2 text-sm font-medium",
        "bg-surface text-ink-700 border border-line hover:bg-sunken hover:text-ink-900 transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/**
 * Form-level error banner — soft red fill, shown above the submit button when
 * the request itself fails (auth rejected, network error). Field-level
 * validation belongs on the AuthField via `error`.
 */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="text-xs text-danger-ink bg-danger-bg/60 border border-danger-border/60 rounded-md px-3 py-2.5">
      {children}
    </div>
  );
}

/**
 * Inline informational hint chip — light-blue background with a leading
 * lightbulb icon (matching the Mercury "Need help describing your
 * business?" pattern). For inline guidance below an input.
 */
export function InfoHint({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="text-xs text-info-ink bg-info-bg/60 border border-info-border/40 rounded-md px-3 py-2.5 flex gap-2 items-start">
      {icon !== null && (
        <span className="text-info-ink mt-0.5 shrink-0">
          {icon ?? <HelpCircle className="w-3.5 h-3.5" aria-hidden />}
        </span>
      )}
      <div className="flex-1 leading-relaxed">{children}</div>
    </div>
  );
}
