import { useCallback } from "react";
import { toast } from "sonner";
import { exportData, ExportFormat } from "@/utils/export/exportData";
import type { ExportDataInput } from "@/utils/export/exportData";


export type UseSelectionExportArgs<T> = {
  selectionMode: boolean;
  selectedCount: number;
  visibleRows: T[];
  selectedRows: T[];
  filenameBase: string;
  mapRow: (row: T) => Record<string, unknown>;
};

export function useSelectionExport<T>(args: UseSelectionExportArgs<T>) {
  const handleExport = useCallback(
    async (formatType: ExportFormat) => {
      try {
        const shouldExportSelected =
          args.selectionMode && args.selectedCount > 0;

        const rowsToExport = shouldExportSelected
          ? args.selectedRows
          : args.visibleRows;

        const exportRows: ExportDataInput = rowsToExport.map(args.mapRow);
        const filename = shouldExportSelected
          ? `${args.filenameBase}_selected`
          : `${args.filenameBase}`;

        await exportData({
          format: formatType,
          data: exportRows,
          filename,
          singleMode: "asArray",
        });

        toast.success(
          shouldExportSelected
            ? "Exported selected records"
            : "Exported all records"
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : "Export failed";
        toast.error(message);
      }

    },
    [
      args.selectionMode,
      args.selectedCount,
      args.visibleRows,
      args.selectedRows,
      args.filenameBase,
      args.mapRow,
    ]

  );

  return { handleExport };
}

