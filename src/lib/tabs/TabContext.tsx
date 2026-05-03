import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

/**
 * Workspace tabs — Chrome-style document tabs above the main content area.
 *
 * The CPA can pin Wilkins Plumbing's CIFT-620 detail in a tab, jump to
 * another client via the sidebar, then click the tab to come back without
 * re-navigating through the list. Multiple tasks open at once during
 * filing-season triage.
 *
 * Architecture:
 *   - State: { tabs[], activeTabId } — held in this context, persisted to
 *     sessionStorage so a refresh restores the workspace.
 *   - Activation: clicking a tab navigates to its href; the route match
 *     (location.pathname === tab.href) is the source of truth for which
 *     tab is "active." Sidebar nav clicks deactivate all tabs but keep
 *     them pinned.
 *   - Deduplication: opening the same href twice switches to the existing
 *     tab instead of opening a duplicate.
 *   - Capacity: hard limit of 5 tabs to keep the bar scannable.
 *
 * What can live in a tab:
 *   - Client detail (`/clients/:id`)
 *   - Alert detail (`/alerts/:id`)
 *   - Deadline detail (`/clients/:id/tasks/:taskId`)
 *   - Anything else that needs deep-link persistence; see openInTab().
 *
 * What CANNOT live in a tab:
 *   - Top-level pages (Today / Timeline / Clients list / Mail / etc.).
 *   - These are always sidebar-driven.
 */

export type TabKind = "client" | "alert" | "deadline" | "other";
export type TabStatus = "ok" | "warn" | "danger";

export interface Tab {
  /** Unique key — typically derived from href so reopening dedupes. */
  id: string;
  kind: TabKind;
  /** Display label — truncated to ~22 chars in the bar. */
  label: string;
  /** Route to navigate to when the tab is activated. */
  href: string;
  /** Optional status dot color (warn = needs attention). */
  status?: TabStatus;
}

const MAX_TABS = 5;
const STORAGE_KEY = "duedatehq.workspace_tabs.v1";

interface TabsState {
  tabs: Tab[];
  /** Last-active tab id — used as a fallback when route doesn't match any
      tab (e.g., the user opened a tab, then sidebar-navigated away). */
  lastActiveId: string | null;
}

type TabsAction =
  | { type: "open"; tab: Tab }
  | { type: "close"; id: string }
  | { type: "set_active"; id: string | null }
  | { type: "hydrate"; state: TabsState };

function tabsReducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case "open": {
      const existing = state.tabs.find((t) => t.id === action.tab.id);
      if (existing) {
        return { ...state, lastActiveId: existing.id };
      }
      if (state.tabs.length >= MAX_TABS) {
        toast.error(
          `Tab limit reached — close one of the ${MAX_TABS} open tabs first.`,
        );
        return state;
      }
      return {
        tabs: [...state.tabs, action.tab],
        lastActiveId: action.tab.id,
      };
    }
    case "close": {
      const idx = state.tabs.findIndex((t) => t.id === action.id);
      const next = state.tabs.filter((t) => t.id !== action.id);
      let nextActive = state.lastActiveId;
      if (state.lastActiveId === action.id) {
        // Closed the active one — pick the neighbor (left preferred).
        nextActive = next[Math.max(0, idx - 1)]?.id ?? null;
      }
      return { tabs: next, lastActiveId: nextActive };
    }
    case "set_active":
      return { ...state, lastActiveId: action.id };
    case "hydrate":
      return action.state;
  }
}

interface TabsContextValue extends TabsState {
  activeTabId: string | null;
  openInTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  switchToTab: (id: string) => void;
  closeAll: () => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function loadState(): TabsState {
  if (typeof window === "undefined") return { tabs: [], lastActiveId: null };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { tabs: [], lastActiveId: null };
    const parsed = JSON.parse(raw) as TabsState;
    return {
      tabs: Array.isArray(parsed.tabs) ? parsed.tabs.slice(0, MAX_TABS) : [],
      lastActiveId: parsed.lastActiveId ?? null,
    };
  } catch {
    return { tabs: [], lastActiveId: null };
  }
}

export function TabsProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, dispatch] = useReducer(tabsReducer, null, loadState);

  // Persist on every change. SessionStorage so it survives refresh but
  // not new tab / window — that's the right scope for "workspace."
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota exceeded — silently degrade */
    }
  }, [state]);

  // Active tab = the one whose href matches the current pathname.
  // (Tabs persist across sidebar navigations; only matching pathname
  //  marks one as visually active.)
  const activeTabId = useMemo(() => {
    const match = state.tabs.find(
      (t) =>
        t.href === location.pathname ||
        // Loose match — alert tab href is /alerts/:id, route may be /alerts/:id
        // or /alerts (when ID isn't bound). Strict equality is fine for now.
        t.href === `${location.pathname}${location.search}`,
    );
    return match?.id ?? null;
  }, [state.tabs, location.pathname, location.search]);

  const openInTab = useCallback(
    (tab: Tab) => {
      dispatch({ type: "open", tab });
      navigate(tab.href);
    },
    [navigate],
  );

  const closeTab = useCallback(
    (id: string) => {
      const wasActive = activeTabId === id;
      dispatch({ type: "close", id });
      if (wasActive) {
        // Find the neighbor to navigate to. Reducer doesn't navigate.
        const idx = state.tabs.findIndex((t) => t.id === id);
        const next = state.tabs.filter((t) => t.id !== id);
        const neighbor = next[Math.max(0, idx - 1)];
        if (neighbor) {
          navigate(neighbor.href);
        } else {
          navigate("/");
        }
      }
    },
    [activeTabId, navigate, state.tabs],
  );

  const switchToTab = useCallback(
    (id: string) => {
      const tab = state.tabs.find((t) => t.id === id);
      if (!tab) return;
      navigate(tab.href);
    },
    [navigate, state.tabs],
  );

  const closeAll = useCallback(() => {
    dispatch({ type: "hydrate", state: { tabs: [], lastActiveId: null } });
    navigate("/");
  }, [navigate]);

  // Keyboard shortcuts — Cmd+W closes active, Cmd+1..5 switches by index.
  // Cmd+T deliberately omitted — there's no "new blank tab" surface; tabs
  // open from entity affordances only.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "w" && activeTabId) {
        e.preventDefault();
        closeTab(activeTabId);
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= MAX_TABS) {
        const target = state.tabs[num - 1];
        if (target) {
          e.preventDefault();
          switchToTab(target.id);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTabId, closeTab, switchToTab, state.tabs]);

  const value: TabsContextValue = {
    ...state,
    activeTabId,
    openInTab,
    closeTab,
    switchToTab,
    closeAll,
  };

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>;
}

export function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error("useTabs must be used within <TabsProvider>");
  }
  return ctx;
}

/**
 * Helper: build a stable Tab from a known entity. Use this from
 * components that have a "Open in tab" button.
 */
export function makeTab(
  kind: TabKind,
  payload: { id: string; label: string; href: string; status?: TabStatus },
): Tab {
  return {
    id: `${kind}:${payload.id}`,
    kind,
    label: payload.label,
    href: payload.href,
    status: payload.status,
  };
}
