"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type ColMeta } from "@/components/ui/DataTable";
import { PacingStatusPill } from "@/components/ui/StatusPill";
import { PaceIndicator } from "@/components/ui/PaceIndicator";
import { formatMoney, formatPercent } from "@/lib/metrics/format";
import type { CurrencyCode } from "@/lib/domain/types";
import type { PacingResult } from "@/lib/pacing/engine";

export interface PacingTableRow {
  key: string;
  col1: string; // market or account label
  col2: string; // channel or campaign
  label: string; // account/campaign name
  currency: CurrencyCode;
  budgetSource?: "manual" | "derived" | "none";
  pacing: PacingResult;
}

function n(): { meta: ColMeta } {
  return { meta: { align: "right", numeric: true } };
}

export function PacingAccountTable({
  rows,
  firstColHeader = "Market",
  secondColHeader = "Channel",
  labelHeader = "Account",
  csvName = "pacing_accounts",
}: {
  rows: PacingTableRow[];
  firstColHeader?: string;
  secondColHeader?: string;
  labelHeader?: string;
  csvName?: string;
}) {
  const columns = useMemo<ColumnDef<PacingTableRow, unknown>[]>(() => {
    const m = (v: number | null, r: PacingTableRow) => formatMoney(v, r.currency);
    return [
      { id: "label", header: labelHeader, accessorKey: "label", meta: { sticky: true, csv: (r) => (r as PacingTableRow).label } as ColMeta, cell: (c) => (
        <div>
          <div className="font-medium text-ink">{c.row.original.label}</div>
          <div className="text-[11px] text-muted">{c.row.original.col1} · {c.row.original.col2}{c.row.original.budgetSource === "derived" ? " · derived budget" : ""}</div>
        </div>
      ) },
      { id: "budget", header: "Budget", accessorFn: (r) => r.pacing.budget ?? 0, cell: (c) => m(c.row.original.pacing.budget, c.row.original), ...n() },
      { id: "spend", header: "Spend", accessorFn: (r) => r.pacing.spend, cell: (c) => m(c.row.original.pacing.spend, c.row.original), ...n() },
      { id: "expected", header: "Expected", accessorFn: (r) => r.pacing.expectedSpend ?? 0, cell: (c) => m(c.row.original.pacing.expectedSpend, c.row.original), ...n() },
      {
        id: "variance",
        header: "Variance",
        accessorFn: (r) => r.pacing.pacingVariance ?? 0,
        cell: (c) => {
          const v = c.row.original.pacing.pacingVariance;
          if (v === null) return "—";
          return <span className={v > 0 ? "text-danger" : "text-success"}>{formatMoney(v, c.row.original.currency)}</span>;
        },
        ...n(),
      },
      {
        id: "used",
        header: "Used %",
        accessorFn: (r) => r.pacing.budgetUtilisation ?? 0,
        cell: (c) => {
          const p = c.row.original.pacing;
          if (p.budgetUtilisation === null) return "—";
          const used = p.budgetUtilisation;
          const elapsed = p.periodElapsedPct;
          const over = (used - elapsed) * 100;
          const tone = over > 10 ? "#B91C1C" : over > 5 ? "#B45309" : "#15803D";
          return (
            <div className="flex items-center justify-end gap-2">
              <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-canvas">
                <div className="h-full rounded-full" style={{ width: `${Math.min(used * 100, 100)}%`, background: tone }} />
              </div>
              <span className="tnum w-10 text-right">{formatPercent(used)}</span>
            </div>
          );
        },
        ...n(),
      },
      { id: "elapsed", header: "Elapsed %", accessorFn: (r) => r.pacing.periodElapsedPct, cell: (c) => formatPercent(c.row.original.pacing.periodElapsedPct), ...n() },
      {
        id: "pace",
        header: "Pace",
        accessorFn: (r) => r.pacing.pacingVariancePct ?? 0,
        cell: (c) => <PaceIndicator pct={c.row.original.pacing.pacingVariancePct} size="sm" />,
        meta: { align: "left" } as ColMeta,
      },
      { id: "dailyAvg", header: "Daily avg", accessorFn: (r) => r.pacing.dailyAvgSpend, cell: (c) => m(c.row.original.pacing.dailyAvgSpend, c.row.original), ...n() },
      {
        id: "reqDaily",
        header: "Required daily",
        accessorFn: (r) => r.pacing.requiredDailySpend ?? 0,
        cell: (c) => {
          const p = c.row.original.pacing;
          if (p.requiredDailySpend === null) return "—";
          const unrealistic = p.requiredDailySpend > 2 * p.dailyAvgSpend && p.dailyAvgSpend > 0;
          return <span className={unrealistic ? "font-semibold text-danger" : ""}>{formatMoney(p.requiredDailySpend, c.row.original.currency)}</span>;
        },
        ...n(),
      },
      { id: "projected", header: "Projected", accessorFn: (r) => r.pacing.projectedSpend ?? 0, cell: (c) => m(c.row.original.pacing.projectedSpend, c.row.original), ...n() },
      {
        id: "projVar",
        header: "Proj. variance",
        accessorFn: (r) => r.pacing.projectedVariance ?? 0,
        cell: (c) => {
          const v = c.row.original.pacing.projectedVariance;
          const pct = c.row.original.pacing.projectedVariancePct;
          if (v === null) return "—";
          const tone = pct === null ? "" : Math.abs(pct) > 0.1 || v > 0 ? (v > 0 ? "text-danger" : "text-warning") : "text-success";
          return <span className={tone}>{formatMoney(v, c.row.original.currency)}</span>;
        },
        ...n(),
      },
      { id: "daysLeft", header: "Days left", accessorFn: (r) => r.pacing.daysRemaining, cell: (c) => c.row.original.pacing.daysRemaining, ...n() },
      {
        id: "status",
        header: "Status",
        accessorFn: (r) => r.pacing.status,
        cell: (c) => <PacingStatusPill status={c.row.original.pacing.status} />,
        meta: { align: "left" } as ColMeta,
      },
    ];
  }, [labelHeader]);

  return <DataTable data={rows} columns={columns} csvName={csvName} searchPlaceholder="Search…" initialSort={[{ id: "spend", desc: true }]} />;
}
