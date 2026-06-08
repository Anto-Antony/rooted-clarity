import { useCallback, useMemo, useState } from "react";

export type UseRowSelectionOptions<T> = {
  getRowId: (row: T) => string;
  getVisibleRows: () => T[];
  initialSelectedIds?: Iterable<string>;
  onSelectionModeExit?: () => void;
  /** When true, exiting selection mode clears selection. Default: true */
  clearSelectionOnExit?: boolean;
};

export type UseRowSelectionReturn<T> = {
  selectionMode: boolean;
  selectedIds: Set<string>;
  selectedCount: number;
  visibleIds: string[];
  selectedAllVisible: boolean;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
  toggleRow: (id: string) => void;
  toggleSelectAllVisible: () => void;
  getSelectedRows: (visibleRows: T[]) => T[];
};

export function useRowSelection<T>(options: UseRowSelectionOptions<T>): UseRowSelectionReturn<T> {
  const {
    getRowId,
    getVisibleRows,
    initialSelectedIds,
    onSelectionModeExit,
    clearSelectionOnExit = true,
  } = options;

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSelectedIds ?? [])
  );

  const visibleRows = useMemo(() => getVisibleRows(), [getVisibleRows]);
  const visibleIds = useMemo(() => visibleRows.map(getRowId).filter(Boolean), [visibleRows, getRowId]);

  const selectedCount = selectedIds.size;

  const selectedAllVisible = useMemo(() => {
    if (!visibleIds.length) return false;
    for (const id of visibleIds) {
      if (!selectedIds.has(id)) return false;
    }
    return true;
  }, [visibleIds, selectedIds]);

  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    onSelectionModeExit?.();
    if (clearSelectionOnExit) setSelectedIds(new Set());
  }, [onSelectionModeExit, clearSelectionOnExit]);

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = visibleIds.length ? visibleIds.every((id) => next.has(id)) : false;
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [visibleIds]);

  const getSelectedRows = useCallback(
    (rows: T[]) => {
      if (!selectedIds.size) return [];
      return rows.filter((r) => selectedIds.has(getRowId(r)));
    },
    [getRowId, selectedIds]
  );

  return {
    selectionMode,
    selectedIds,
    selectedCount,
    visibleIds,
    selectedAllVisible,
    enterSelectionMode,
    exitSelectionMode,
    toggleRow,
    toggleSelectAllVisible,
    getSelectedRows,
  };
}

