"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type ColMeta } from "@/components/ui/DataTable";
import { ComponentIcon } from "@/components/ui/ComponentIcon";
import { formatInt, formatMoney, formatPercent, isLowVolume } from "@/lib/metrics/format";
import type { ComponentRating, CurrencyCode } from "@/lib/domain/types";

export interface KeywordRow {
  id: string;
  text: string;
  matchType: string;
  campaignName: string;
  adGroupName: string;
  qualityScore: number | null;
  qs30dAgo: number | null;
  expectedCtr: ComponentRating;
  adRelevance: ComponentRating;
  lpExperience: ComponentRating;
  impressions: number;
  clicks: number;
  spend: number;
  liveLeads: number;
  currency: CurrencyCode;
}

function n(): { meta: ColMeta } {
  return { meta: { align: "right", numeric: true } };
}

export function KeywordsTable({ rows }: { rows: KeywordRow[] }) {
  const columns = useMemo<ColumnDef<KeywordRow, unknown>[]>(
    () => [
      {
        id: "text",
        header: "Keyword",
        accessorKey: "text",
        meta: { sticky: true, csv: (r) => (r as KeywordRow).text } as ColMeta,
        cell: (c) => (
          <div>
            <div className="font-medium text-ink">{c.row.original.text}</div>
            <div className="text-[11px] text-muted">{c.row.original.matchType} · {c.row.original.adGroupName}</div>
          </div>
        ),
      },
      {
        id: "qs",
        header: "QS",
        accessorFn: (r) => r.qualityScore ?? -1,
        cell: (c) => {
          const qs = c.row.original.qualityScore;
          if (qs === null) return <span className="text-muted" title="No Quality Score">—</span>;
          const tone = qs <= 3 ? "#B91C1C" : qs <= 6 ? "#B45309" : "#15803D";
          return <span className="font-semibold tnum" style={{ color: tone }}>{qs}</span>;
        },
        ...n(),
      },
      {
        id: "expectedCtr",
        header: "Exp. CTR",
        accessorFn: (r) => r.expectedCtr ?? "",
        cell: (c) => <ComponentIcon rating={c.row.original.expectedCtr} />,
        meta: { align: "left" } as ColMeta,
      },
      {
        id: "adRelevance",
        header: "Ad rel.",
        accessorFn: (r) => r.adRelevance ?? "",
        cell: (c) => <ComponentIcon rating={c.row.original.adRelevance} />,
        meta: { align: "left" } as ColMeta,
      },
      {
        id: "lpExperience",
        header: "LP exp.",
        accessorFn: (r) => r.lpExperience ?? "",
        cell: (c) => <ComponentIcon rating={c.row.original.lpExperience} />,
        meta: { align: "left" } as ColMeta,
      },
      { id: "impr", header: "Impr", accessorKey: "impressions", cell: (c) => formatInt(c.row.original.impressions), ...n() },
      { id: "clicks", header: "Clicks", accessorKey: "clicks", cell: (c) => formatInt(c.row.original.clicks), ...n() },
      {
        id: "ctr",
        header: "CTR",
        accessorFn: (r) => (r.impressions ? r.clicks / r.impressions : 0),
        cell: (c) => {
          const r = c.row.original;
          const low = isLowVolume(r.impressions, r.clicks);
          return <span className={low ? "text-muted" : ""} title={low ? "Low volume" : undefined}>{formatPercent(r.impressions ? r.clicks / r.impressions : null)}</span>;
        },
        ...n(),
      },
      { id: "spend", header: "Spend", accessorKey: "spend", cell: (c) => formatMoney(c.row.original.spend, c.row.original.currency), ...n() },
      { id: "liveLeads", header: "Live leads", accessorKey: "liveLeads", cell: (c) => formatInt(c.row.original.liveLeads), ...n() },
      {
        id: "cpll",
        header: "CPLL",
        accessorFn: (r) => (r.liveLeads ? r.spend / r.liveLeads : Number.MAX_SAFE_INTEGER),
        cell: (c) => (c.row.original.liveLeads ? formatMoney(c.row.original.spend / c.row.original.liveLeads, c.row.original.currency) : "—"),
        ...n(),
      },
    ],
    []
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      csvName="keywords"
      searchPlaceholder="Search keywords…"
      initialSort={[{ id: "spend", desc: true }]}
      maxHeight={560}
    />
  );
}
