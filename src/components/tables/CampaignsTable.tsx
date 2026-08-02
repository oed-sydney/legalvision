"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type ColMeta } from "@/components/ui/DataTable";
import { formatMoney, formatInt, formatPercent, formatImpressionShare } from "@/lib/metrics/format";
import type { CurrencyCode } from "@/lib/domain/types";
import { hashSeed, mulberry32 } from "@/lib/utils";

export interface CampaignRow {
  campaignId: string;
  campaignName: string;
  campaignType: string;
  market: string;
  channel: string;
  currency: CurrencyCode;
  estimated: boolean;
  spend: number;
  impressions: number;
  comparableClicks: number;
  leads: number;
  liveLeads: number | null;
  cpll: number | null;
  cvr: number | null;
  ctr: number | null;
  cpc: number | null;
}

const MARKET_DOT: Record<string, string> = { AU: "#23306B", UK: "#7C3AED", NZ: "#0D9488" };

function num(align: "right" = "right", extra?: Partial<ColMeta>): { meta: ColMeta } {
  return { meta: { align, numeric: true, ...extra } };
}

/** Synthesized Search IS family for Google Search campaigns (mock only). */
function searchIS(id: string) {
  const r = mulberry32(hashSeed(id + "is"));
  const is = 0.45 + r() * 0.5;
  const lostBudget = r() * 0.25;
  const lostRank = Math.max(0, 1 - is - lostBudget);
  return { is, lostBudget, lostRank };
}

export function CampaignsTable({
  rows,
  variant,
  csvName = "campaigns",
}: {
  rows: CampaignRow[];
  variant: "overview" | "google" | "meta";
  csvName?: string;
}) {
  const columns = useMemo<ColumnDef<CampaignRow, unknown>[]>(() => {
    const money = (v: number | null, r: CampaignRow) =>
      formatMoney(v, r.currency, { estimated: r.estimated });

    const base: ColumnDef<CampaignRow, unknown>[] = [
      {
        id: "campaign",
        header: "Campaign",
        accessorKey: "campaignName",
        meta: { sticky: true, csv: (r) => (r as CampaignRow).campaignName } as ColMeta,
        cell: (c) => (
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: MARKET_DOT[c.row.original.market] }}
            />
            <span className="max-w-[280px] truncate font-medium text-ink" title={c.row.original.campaignName}>
              {c.row.original.campaignName}
            </span>
          </div>
        ),
      },
    ];

    if (variant === "overview") {
      base.push(
        { id: "market", header: "Market", accessorKey: "market", cell: (c) => c.row.original.market, meta: { align: "left" } as ColMeta },
        {
          id: "channel",
          header: "Channel",
          accessorFn: (r) => (r.channel === "google_ads" ? "Google" : "Meta"),
          cell: (c) => (c.row.original.channel === "google_ads" ? "Google" : "Meta"),
          meta: { align: "left" } as ColMeta,
        }
      );
    }

    base.push(
      { id: "spend", header: "Spend", accessorKey: "spend", cell: (c) => money(c.row.original.spend, c.row.original), ...num() },
      { id: "impr", header: "Impr", accessorKey: "impressions", cell: (c) => formatInt(c.row.original.impressions), ...num() },
      {
        id: "clicks",
        header: variant === "meta" ? "Link clicks" : "Clicks",
        accessorKey: "comparableClicks",
        cell: (c) => formatInt(c.row.original.comparableClicks),
        ...num(),
      },
      { id: "ctr", header: "CTR", accessorKey: "ctr", cell: (c) => formatPercent(c.row.original.ctr), ...num() },
      { id: "cpc", header: "CPC", accessorKey: "cpc", cell: (c) => money(c.row.original.cpc, c.row.original), ...num() }
    );

    if (variant === "google") {
      base.push(
        {
          id: "is",
          header: "Search IS",
          accessorFn: (r) => (r.campaignType === "Search" ? searchIS(r.campaignId).is : null),
          cell: (c) =>
            c.row.original.campaignType === "Search"
              ? formatImpressionShare(searchIS(c.row.original.campaignId).is)
              : "—",
          ...num(),
        },
        {
          id: "lostBudget",
          header: "Lost IS (budget)",
          accessorFn: (r) => (r.campaignType === "Search" ? searchIS(r.campaignId).lostBudget : null),
          cell: (c) =>
            c.row.original.campaignType === "Search"
              ? formatPercent(searchIS(c.row.original.campaignId).lostBudget)
              : "—",
          ...num(),
        }
      );
    }

    if (variant === "meta") {
      // Meta uses platform Leads (no live leads); no CPLL.
      base.push(
        { id: "leads", header: "Leads", accessorKey: "leads", cell: (c) => formatInt(c.row.original.leads), ...num() },
        { id: "cvr", header: "CvR", accessorKey: "cvr", cell: (c) => formatPercent(c.row.original.cvr), ...num() }
      );
    } else {
      base.push(
        {
          id: "liveLeads",
          header: "Live leads",
          accessorFn: (r) => r.liveLeads ?? -1,
          cell: (c) => <span className="font-medium">{formatInt(c.row.original.liveLeads ?? 0)}</span>,
          ...num(),
        },
        {
          id: "cpll",
          header: "CPLL",
          accessorFn: (r) => r.cpll ?? Number.MAX_SAFE_INTEGER,
          cell: (c) => money(c.row.original.cpll, c.row.original),
          ...num(),
        },
        { id: "cvr", header: "CvR", accessorKey: "cvr", cell: (c) => formatPercent(c.row.original.cvr), ...num() }
      );
    }

    return base;
  }, [variant]);

  return (
    <DataTable
      data={rows}
      columns={columns}
      csvName={csvName}
      searchPlaceholder="Search campaigns…"
      initialSort={[{ id: "spend", desc: true }]}
    />
  );
}
