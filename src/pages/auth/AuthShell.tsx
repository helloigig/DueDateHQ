import { Link } from "react-router-dom";
import { LogIn } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-surface border border-line rounded-md overflow-hidden">
        <header className="px-5 py-4 border-b border-line">
          <Link
            to="/login"
            className="flex items-center gap-2 text-ink-900 no-underline"
          >
            <LogIn className="w-4 h-4" aria-hidden />
            <span className="text-sm font-semibold">DueDateHQ</span>
          </Link>
          <h1 className="text-base font-semibold text-ink-900 mt-2">{title}</h1>
          {subtitle && (
            <p className="text-xs text-ink-500 mt-1">{subtitle}</p>
          )}
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <footer className="px-5 py-3 border-t border-line bg-sunken text-2xs text-ink-500">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export function AuthField({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-700 mb-1 block">
        {label}
      </span>
      {children}
      {error && (
        <span className="text-2xs text-danger-ink mt-1 block">{error}</span>
      )}
    </label>
  );
}

export const authInputClass =
  "w-full px-2.5 py-1.5 rounded border border-line bg-surface text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-accent";
