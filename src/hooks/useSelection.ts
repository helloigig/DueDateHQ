import { useCallback, useMemo, useState } from "react";

/**
 * Generic multi-select state hook.
 *
 * Built for the batch-action surfaces (Clients list batch-send, Filings
 * tab batch-select, Timeline batch-stage / batch-assign). Centralising
 * the selection model means each surface's "select-all / clear / toggle"
 * affordance behaves identically — Sarah trains on one mental model
 * across the three pages.
 *
 * Why not Set<string> directly: callers tended to hand-roll `new Set(s)`
 * + `s.add()` / `s.delete()` + force re-render dance per surface. Same
 * pattern x3 = drift. The hook also memoises `has` and `selectedIds`
 * so callers can pass them down without burning re-renders.
 *
 * Generic over T (the item type). The selectId function maps an item
 * to its stable id — typically `(item) => item.id`. Decoupling lets the
 * hook be used for anything: clients (id), filings (deadline.id), task
 * rows (taskId), checklist items (checklistItem.id), etc.
 *
 * Usage:
 *   const sel = useSelection(clients, (c) => c.id);
 *   sel.has(client.id)          // boolean
 *   sel.toggle(client.id)       // flip selection state for one item
 *   sel.set(client.id, true)    // explicit set
 *   sel.selectedIds             // string[]
 *   sel.selectedItems           // T[]
 *   sel.count                   // selectedIds.length
 *   sel.clear()                 // deselect all
 *   sel.selectAll()             // select every item in `items`
 *   sel.selectAllVisible(visible)  // select all currently filtered/visible items
 *   sel.isAllSelected           // every visible item selected? (for tri-state checkbox)
 *   sel.isPartiallySelected     // some-but-not-all selected? (for tri-state checkbox)
 *
 * Note: selection state survives filter changes — if you select clients
 * A+B, then filter the list to a smaller set that excludes B, B remains
 * in `selectedIds` but is hidden from the user. `selectAllVisible(filtered)`
 * is the correct affordance for "select everything I currently see".
 */
export interface UseSelectionResult<T> {
  /** Whether the given id is currently selected. */
  has: (id: string) => boolean;
  /** Flip selection state for one id. */
  toggle: (id: string) => void;
  /** Explicit set — `true` to select, `false` to deselect. */
  set: (id: string, selected: boolean) => void;
  /** Select all items in the source list. */
  selectAll: () => void;
  /** Select all items in `visible` (the currently filtered subset). */
  selectAllVisible: (visible: ReadonlyArray<T>) => void;
  /** Deselect all. */
  clear: () => void;
  /** Stable array of currently-selected ids. Memoised. */
  selectedIds: string[];
  /** Currently-selected items (resolved against `items`). Memoised. */
  selectedItems: T[];
  /** selectedIds.length, hoisted for ergonomics. */
  count: number;
  /**
   * Tri-state checkbox helper — returns true when every item in the
   * source list is selected. Use against the list passed into the
   * "select all" header checkbox so the indeterminate state resolves
   * correctly when filters are active. */
  isAllSelectedIn: (visible: ReadonlyArray<T>) => boolean;
  /** Tri-state checkbox helper — true when some but not all visible
   *  items are selected. */
  isPartiallySelectedIn: (visible: ReadonlyArray<T>) => boolean;
}

export function useSelection<T>(
  items: ReadonlyArray<T>,
  selectId: (item: T) => string,
): UseSelectionResult<T> {
  // Internal state — Set is the right primitive; we expose array views.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const has = useCallback(
    (id: string) => selected.has(id),
    [selected],
  );

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const set = useCallback((id: string, isSelected: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (isSelected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(items.map(selectId)));
  }, [items, selectId]);

  const selectAllVisible = useCallback(
    (visible: ReadonlyArray<T>) => {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const it of visible) next.add(selectId(it));
        return next;
      });
    },
    [selectId],
  );

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const selectedItems = useMemo(() => {
    if (selected.size === 0) return [];
    return items.filter((it) => selected.has(selectId(it)));
  }, [items, selected, selectId]);

  const isAllSelectedIn = useCallback(
    (visible: ReadonlyArray<T>) => {
      if (visible.length === 0) return false;
      for (const it of visible) {
        if (!selected.has(selectId(it))) return false;
      }
      return true;
    },
    [selected, selectId],
  );

  const isPartiallySelectedIn = useCallback(
    (visible: ReadonlyArray<T>) => {
      if (visible.length === 0) return false;
      let any = false;
      let all = true;
      for (const it of visible) {
        if (selected.has(selectId(it))) any = true;
        else all = false;
        if (any && !all) return true;
      }
      return any && !all;
    },
    [selected, selectId],
  );

  return {
    has,
    toggle,
    set,
    selectAll,
    selectAllVisible,
    clear,
    selectedIds,
    selectedItems,
    count: selected.size,
    isAllSelectedIn,
    isPartiallySelectedIn,
  };
}
