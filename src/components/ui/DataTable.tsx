"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ColMeta {
  align?: "left" | "right" | "center";
  numeric?: boolean;
  sticky?: boolean;
  /** value used for CSV export + global search (falls back to rendered accessor). */
  csv?: (row: unknown) => string | number;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  csvName?: string;
  initialSort?: SortingState;
  /** extra note rendered in the toolbar (e.g. coverage %, excludes-filter chip). */
  toolbarNote?: React.ReactNode;
  emptyMessage?: string;
  dense?: boolean;
  maxHeight?: number;
}

export function DataTable<T>({
  data,
  columns,
  searchable = true,
  searchPlaceholder = "Search…",
  csvName = "export",
  initialSort = [],
  toolbarNote,
  emptyMessage = "No results match these filters.",
  dense = false,
  maxHeight,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSort);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
  });

  const rows = table.getRowModel().rows;

  const exportCsv = () => {
    const cols = table.getVisibleFlatColumns();
    const header = cols.map((c) => csvSafe(headerText(c.columnDef.header, c.id)));
    const lines = [header.join(",")];
    for (const r of rows) {
      const line = cols.map((c) => {
        const meta = c.columnDef.meta as ColMeta | undefined;
        const raw = meta?.csv ? meta.csv(r.original) : r.getValue(c.id);
        return csvSafe(raw);
      });
      lines.push(line.join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `legalvision_${csvName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rowH = dense ? "h-8" : "h-10";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {searchable && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 w-56 rounded-md border border-[var(--lv-border)] bg-white pl-8 pr-2 text-[13px] outline-none focus:border-primary"
              />
            </div>
          )}
          {toolbarNote}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted tnum">{rows.length.toLocaleString()} rows</span>
          <button
            onClick={exportCsv}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--lv-border)] bg-white px-2.5 text-[13px] font-medium text-secondary hover:bg-canvas"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      <div
        className="lv-scroll overflow-auto rounded-[10px] border border-[var(--lv-border)]"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta as ColMeta | undefined;
                  const canSort = h.column.getCanSort();
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      className={cn(
                        "whitespace-nowrap border-b border-[var(--lv-border)] bg-canvas px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-secondary",
                        meta?.align === "right" ? "text-right" : "text-left",
                        meta?.sticky && "sticky left-0 z-20 bg-canvas"
                      )}
                    >
                      <button
                        className={cn(
                          "inline-flex items-center gap-1",
                          meta?.align === "right" && "flex-row-reverse",
                          canSort && "cursor-pointer hover:text-ink"
                        )}
                        onClick={h.column.getToggleSortingHandler()}
                        disabled={!canSort}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {canSort &&
                          (sorted === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 opacity-40" />
                          ))}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-[13px] text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className={cn("group hover:bg-rowhover", rowH)}>
                  {r.getVisibleCells().map((c) => {
                    const meta = c.column.columnDef.meta as ColMeta | undefined;
                    return (
                      <td
                        key={c.id}
                        className={cn(
                          "whitespace-nowrap border-b border-[var(--lv-border)] px-3",
                          meta?.numeric && "tnum",
                          meta?.align === "right" ? "text-right" : "text-left",
                          meta?.sticky && "sticky left-0 z-[1] bg-white group-hover:bg-rowhover"
                        )}
                      >
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function headerText(header: unknown, id: string): string {
  if (typeof header === "string") return header;
  return id;
}
function csvSafe(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
