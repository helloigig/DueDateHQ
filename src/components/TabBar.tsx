import { Briefcase, Megaphone, FileText, X, Layers } from "lucide-react";
import { useTabs, type Tab, type TabKind } from "@/lib/tabs/TabContext";
import { cn } from "@/lib/utils";

/**
 * TabBar — sticky workspace tab strip below the TopBar.
 *
 * Each tab represents an open document (client / alert / deadline).
 * Clicking switches; the small ✕ closes; status dot signals attention.
 * Hidden when no tabs are open so the bar isn't visual noise.
 *
 * Visual register: browser-style chrome (bg-canvas) with tabs that
 * "merge" into the page below when active (bg-surface, no bottom border).
 */

const KIND_ICON: Record<TabKind, typeof Briefcase> = {
  client: Briefcase,
  alert: Megaphone,
  deadline: FileText,
  other: Layers,
};

export function TabBar() {
  const { tabs, activeTabId, switchToTab, closeTab } = useTabs();

  // Don't render the bar when there are no tabs — saves 36px of canvas.
  if (tabs.length === 0) return null;

  return (
    <div
      className="bg-canvas border-b border-line px-4 md:px-6 lg:px-8 flex items-end gap-1 overflow-x-auto"
      role="tablist"
      aria-label="Workspace tabs"
    >
      {tabs.map((tab) => (
        <TabButton
          key={tab.id}
          tab={tab}
          active={tab.id === activeTabId}
          onClick={() => switchToTab(tab.id)}
          onClose={() => closeTab(tab.id)}
        />
      ))}
    </div>
  );
}

function TabButton({
  tab,
  active,
  onClick,
  onClose,
}: {
  tab: Tab;
  active: boolean;
  onClick: () => void;
  onClose: () => void;
}) {
  const Icon = KIND_ICON[tab.kind];
  return (
    <div
      role="tab"
      aria-selected={active}
      className={cn(
        // Tab shape: rounded top corners only — bottom merges into page
        "group flex items-center gap-2 h-9 max-w-[220px] min-w-[140px] px-3 cursor-pointer transition-colors shrink-0 rounded-t-md border border-b-0",
        active
          ? "bg-surface border-line text-ink-900 -mb-px relative z-10"
          : "bg-canvas border-transparent text-ink-500 hover:bg-sunken hover:text-ink-700",
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          onClose();
        }
      }}
      tabIndex={0}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />
      <span className="flex-1 text-xs font-medium truncate">{tab.label}</span>
      {tab.status && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-pill shrink-0",
            tab.status === "warn" && "bg-warn-solid",
            tab.status === "danger" && "bg-danger-solid",
            tab.status === "ok" && "bg-ok-solid",
          )}
          aria-hidden
        />
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="w-4 h-4 inline-flex items-center justify-center rounded text-ink-400 hover:bg-line hover:text-ink-700 opacity-60 group-hover:opacity-100 transition-opacity shrink-0"
        aria-label={`Close ${tab.label}`}
        title="Close tab (⌘W)"
      >
        <X className="w-3 h-3" aria-hidden />
      </button>
    </div>
  );
}

/**
 * OpenInTabButton — a small affordance to add anywhere a tab-able
 * entity is rendered (client row, alert card, deadline row).
 *
 * Renders as a hover-revealed icon button that calls openInTab(). Designed
 * to live in a row's right edge or a card's corner.
 */
export function OpenInTabButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={cn(
        "inline-flex items-center justify-center w-6 h-6 rounded text-ink-400 hover:bg-sunken hover:text-ink-700 transition-colors",
        className,
      )}
      title={`Open in tab — ${label}`}
      aria-label={`Open in tab — ${label}`}
    >
      <Layers className="w-3.5 h-3.5" aria-hidden />
    </button>
  );
}
