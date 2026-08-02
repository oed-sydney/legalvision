"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type ColMeta } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatInt, formatMoney } from "@/lib/metrics/format";
import type { CurrencyCode } from "@/lib/domain/types";

export interface SearchTermRow {
  id: string;
  term: string;
  matchedKeyword: string;
  matchType: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  liveLeads: number;
  currency: CurrencyCode;
  isAddedKeyword: boolean;
}

function n(): { meta: ColMeta } {
  return { meta: { align: "right", numeric: true } };
}

/** Rule-based review flags (§9.2): consider-negative / consider-adding. */
function reviewFlag(r: SearchTermRow): { tone: "danger" | "success"; label: string } | null {
  if (r.spend > 60 && r.conversions === 0) return { tone: "danger", label: "Consider negative" };
  if (r.liveLeads >= 2 && !r.isAddedKeyword) return { tone: "success", label: "Consider adding" };
  return null;
}

export function SearchTermsTable({ rows }: { rows: SearchTermRow[] }) {
  const columns = useMemo<ColumnDef<SearchTermRow, unknown>[]>(
    () => [
      {
        id: "term",
        header: "Search term",
        accessorKey: "term",
        meta: { sticky: true, csv: (r) => (r as SearchTermRow).term } as ColMeta,
        cell: (c) => (
          <div>
            <div className="font-medium text-ink">{c.row.original.term}</div>
            <div className="text-[11px] text-muted">→ {c.row.original.matchedKeyword} ({c.row.original.matchType})</div>
          </div>
        ),
      },
      { id: "impr", header: "Impr", accessorKey: "impressions", cell: (c) => formatInt(c.row.original.impressions), ...n() },
      { id: "clicks", header: "Clicks", accessorKey: "clicks", cell: (c) => formatInt(c.row.original.clicks), ...n() },
      { id: "spend", header: "Spend", accessorKey: "spend", cell: (c) => formatMoney(c.row.original.spend, c.row.original.currency), ...n() },
      { id: "conv", header: "Conv", accessorKey: "conversions", cell: (c) => formatInt(c.row.original.conversions), ...n() },
      { id: "liveLeads", header: "Live leads", accessorKey: "liveLeads", cell: (c) => formatInt(c.row.original.liveLeads), ...n() },
      {
        id: "flag",
        header: "Review flag",
        accessorFn: (r) => reviewFlag(r)?.label ?? "",
        cell: (c) => {
          const flag = reviewFlag(c.row.original);
          return flag ? <StatusPill tone={flag.tone} dot={false}>{flag.label}</StatusPill> : <span className="text-muted">—</span>;
        },
        meta: { align: "left" } as ColMeta,
      },
    ],
    []
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      csvName="search_terms"
      searchPlaceholder="Search terms…"
      initialSort={[{ id: "spend", desc: true }]}
      maxHeight={560}
    />
  );
}
