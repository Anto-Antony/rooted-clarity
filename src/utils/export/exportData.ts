import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { downloadBlob } from "./downloadBlob";

export type ExportFormat = "pdf" | "xlsx" | "csv" | "txt" | "json";

type PlainObject = Record<string, unknown>;

export type ExportDataInput = PlainObject | PlainObject[];

export type ExportDataOptions = {
  format: ExportFormat;
  data: ExportDataInput;
  filename?: string;
  // If the caller provides a single object, we export that shape to JSON.
  // For table formats (PDF/CSV/XLSX/TXT) we normalize to an array of rows.
  singleMode?: "preserve" | "asArray";
};

function getRows(data: ExportDataInput): PlainObject[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") return [data];
  return [];
}

function getFirstRowOrEmpty(data: ExportDataInput): PlainObject | null {
  const rows = getRows(data);
  return rows.length ? rows[0] : null;
}

function getHeaders(data: ExportDataInput): string[] {
  // Prefer stable headers from the first row. If the first row is empty,
  // fall back to union of keys across all rows.
  const first = getFirstRowOrEmpty(data);
  if (first) {
    const keys = Object.keys(first);
    if (keys.length) return keys;
  }

  const rows = getRows(data);
  const keySet = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row || {})) keySet.add(k);
  }
  return Array.from(keySet);
}

function escapeCSVCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  // Always quote; this simplifies correctness across commas, quotes and newlines.
  return `"${text.replace(/"/g, '""')}"`;
}

function toCSV(rows: PlainObject[]): string {
  if (!rows?.length) return "";

  const headers = getHeaders(rows);
  const headerLine = headers.map(escapeCSVCell).join(",");

  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCSVCell((row as PlainObject)?.[h])).join(",")
  );

  return [headerLine, ...dataLines].join("\n");
}

function toTXT(data: ExportDataInput): string {
  const rows = getRows(data);
  if (!rows.length) return "No data available.";

  const headers = getHeaders(rows);
  const lines: string[] = [];

  const isSingleObject = !Array.isArray(data);
  if (isSingleObject) {
    lines.push("Exported Data");
    lines.push("-".repeat("Exported Data".length));
    for (const h of headers) {
      lines.push(`${h}: ${rows[0]?.[h] == null ? "" : String(rows[0]?.[h])}`);
    }
    return lines.join("\n");
  }

  lines.push(`Exported Rows (count: ${rows.length})`);
  lines.push("-".repeat(`Exported Rows (count: ${rows.length})`.length));

  rows.forEach((row, idx) => {
    lines.push(`\nRow ${idx + 1}`);
    for (const h of headers) {
      lines.push(`${h}: ${row?.[h] == null ? "" : String(row?.[h])}`);
    }
  });

  return lines.join("\n");
}

function normalizeForTableFormats(data: ExportDataInput): PlainObject[] {
  const rows = getRows(data);
  return rows && rows.length ? rows : [];
}

function safeFilenameBase(filename: string | undefined): string {
  const base = (filename ?? "export").trim();
  return base.length ? base : "export";
}

export async function exportData({ format, data, filename, singleMode = "preserve" }: ExportDataOptions) {
  const base = safeFilenameBase(filename);

  try {
    switch (format) {
      case "json": {
        const payload =
          Array.isArray(data) || singleMode === "asArray" ? getRows(data) : data;
        const json = JSON.stringify(payload, null, 2);
        downloadBlob({ content: json, filename: `${base}.json`, mimeType: "application/json;charset=utf-8" });
        return;
      }

      case "txt": {
        const txt = toTXT(data);
        downloadBlob({ content: txt, filename: `${base}.txt`, mimeType: "text/plain;charset=utf-8" });
        return;
      }

      case "csv": {
        const rows = normalizeForTableFormats(data);
        if (!rows.length) {
          downloadBlob({ content: "", filename: `${base}.csv`, mimeType: "text/csv;charset=utf-8" });
          return;
        }
        const csv = toCSV(rows);
        downloadBlob({ content: csv, filename: `${base}.csv`, mimeType: "text/csv;charset=utf-8" });
        return;
      }

      case "xlsx": {
        const rows = normalizeForTableFormats(data);
        const headers = getHeaders(rows);

        const worksheet = XLSX.utils.json_to_sheet(
          rows.length ? rows : headers.length ? [{ ...Object.fromEntries(headers.map((h) => [h, ""])) }] : []
        );

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

        const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const blob = new Blob([arrayBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8",
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${base}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }

      case "pdf": {
        const rows = normalizeForTableFormats(data);
        const doc = new jsPDF();
        doc.setFontSize(12);

        const title = "Exported Data";
        doc.text(title, 14, 14);

        if (!rows.length) {
          doc.setFontSize(10);
          doc.text("No data available.", 14, 24);
          doc.save(`${base}.pdf`);
          return;
        }

        const headers = getHeaders(rows);

        autoTable(doc, {
          head: [headers],
          body: rows.map((row) => headers.map((h) => String(row?.[h] ?? ""))),
          startY: 22,
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [240, 240, 240] },
          theme: "grid",
        });

        doc.save(`${base}.pdf`);
        return;
      }

      default: {
        // Exhaustiveness guard for TS.
        const _exhaustive: never = format;
        throw new Error(`Unsupported format: ${_exhaustive}`);
      }
    }
  } catch (e) {
    // Keep it graceful: rethrow with context.
    const message = e instanceof Error ? e.message : "Unknown error";
    throw new Error(`Export failed: ${message}`);
  }
}

