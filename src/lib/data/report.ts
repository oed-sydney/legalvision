import "server-only";
import {
  resolveComparison,
  resolveRange,
  type FilterState,
} from "../filters/schema";
import {
  campaignTotals,
  computeTotals,
  queryCampaignDaily,
  spendLiveLeadTrend,
  type CampaignTotals,
  type Totals,
} from "./warehouse";
import type { CampaignDaily } from "./mock";

function toQuery(f: FilterState, from: string, to: string) {
  return {
    from,
    to,
    market: f.country,
    channel: f.channel,
    accountId: f.account,
    campaignId: f.campaign,
    campaignType: f.ctype,
  };
}

export interface Report {
  range: { from: string; to: string; label: string };
  compareLabel: string | null;
  rows: CampaignDaily[];
  totals: Totals;
  prevTotals: Totals | null;
  trend: ReturnType<typeof spendLiveLeadTrend>;
  campaigns: CampaignTotals[];
}

export function buildReport(f: FilterState): Report {
  const range = resolveRange(f);
  const cmp = resolveComparison(f, range);
  const rows = queryCampaignDaily(toQuery(f, range.from, range.to));
  const totals = computeTotals(rows);
  let prevTotals: Totals | null = null;
  if (cmp) {
    const prevRows = queryCampaignDaily(toQuery(f, cmp.from, cmp.to));
    prevTotals = computeTotals(prevRows);
  }
  return {
    range,
    compareLabel: cmp?.label ?? null,
    rows,
    totals,
    prevTotals,
    trend: spendLiveLeadTrend(rows),
    campaigns: campaignTotals(rows).sort((a, b) => b.spend - a.spend),
  };
}
