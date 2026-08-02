"use client";

import { Download } from "lucide-react";

export type CsvCell = string | number | null;

/**
 * One-click CSV download (client-side). Follows the export spec (§25): UTF-8 BOM,
 * ISO dates, plain numbers with a separate currency column (no symbols), filename
 * legalvision_{table}_{from}_{to}.csv. Rows arrive pre-serialised from the server
 * component so the export always equals the on-screen filtered view.
 */
export function ExportCsvButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: CsvCell[][];
}) {
  const exportCsv = () => {
    const lines = [headers.map(csvSafe).join(",")];
    for (const row of rows) lines.push(row.map(csvSafe).join(","));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={exportCsv}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--lv-border)] bg-white px-2.5 text-[13px] font-medium text-secondary hover:bg-canvas"
    >
      <Download className="h-3.5 w-3.5" /> CSV
    </button>
  );
}

function csvSafe(v: CsvCell): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
