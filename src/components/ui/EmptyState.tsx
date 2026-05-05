import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// EmptyState — design-system §4.10.
// Centered, decorative-icon-only (--ink-300, NOT accent), 1 primary action.
// Voice rule: factual, never celebratory ("Nothing to do today." not "All caught up!")

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon: Icon, title, description, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center text-center py-16 px-4",
          className,
        )}
        {...props}
      >
        <Icon className="w-12 h-12 text-ink-300 mb-4" aria-hidden="true" strokeWidth={1.5} />
        <h3 className="text-lg font-medium text-ink-900 leading-snug">{title}</h3>
        {description && (
          <p className="text-sm text-ink-500 mt-1.5 max-w-[32ch] leading-relaxed">
            {description}
          </p>
        )}
        {action && <div className="mt-5">{action}</div>}
      </div>
    );
  },
);
EmptyState.displayName = "EmptyState";
