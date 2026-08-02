import "server-only";
import { REPORTING_CURRENCY } from "../domain/accounts";
import type { CurrencyCode, DataSource } from "../domain/types";
import { convertAndSum, sumNativeMoney, type Money } from "../currency/guard";
import { fxTable } from "../currency/fx";
import { type CampaignDaily, LATEST_COMPLETE_DAY } from "./mock";
import { campaignDaily } from "./source";

/**
 * The application reads ONLY this layer (never platform APIs in request paths).
 * Source isolation: production-path reads structurally exclude source='mock'.
 * In dev/mock mode (MOCK_MODE !== 'false') mock rows are intentionally included.
 */
const MOCK_MODE = process.env.MOCK_MODE !== "false";

function prodFilter<T extends { source: DataSource }>(rows: T[]): T[] {
  if (MOCK_MODE) return rows;
  return rows.filter((r) => r.source !== "mock");
}

export interface FactQuery {
  from: string;
  to: string;
  market?: string; // 'all' | AU|UK|NZ
  channel?: string; // 'all' | google_ads|meta_ads
  accountId?: string;
  campaignId?: string;
  campaignType?: string;
}

export function queryCampaignDaily(q: FactQuery): CampaignDaily[] {
  const rows = prodFilter(campaignDaily());
  return rows.filter((r) => {
    if (r.date < q.from || r.date > q.to) return false;
    if (q.market && q.market !== "all" && r.market !== q.market) return false;
    if (q.channel && q.channel !== "all" && r.channel !== q.channel) return false;
    if (q.accountId && q.accountId !== "all" && r.accountId !== q.accountId) return false;
    if (q.campaignId && q.campaignId !== "all" && r.campaignId !== q.campaignId) return false;
    if (q.campaignType && q.campaignType !== "all" && r.campaignType !== q.campaignType)
      return false;
    return true;
  });
}

// ---- Aggregation with the currency guard ------------------------------------

export interface Totals {
  spend: number;
  currency: CurrencyCode;
  /** true when spend was converted across currencies (renders "≈"). */
  estimated: boolean;
  fxStale: boolean;
  impressions: number;
  googleClicks: number;
  metaLinkClicks: number;
  /** Comparable clicks = Google clicks + Meta link clicks (the summable pair). */
  comparableClicks: number;
  landingPageViews: number;
  conversions: number;
  leads: number;
  /** null only when every contributing row is Meta (pending live-lead source). */
  liveLeads: number | null;
  metaPending: boolean;
  conversionValue: number;
  // derived
  cpll: number | null;
  cpl: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cvr: number | null;
  liveLeadRate: number | null;
}

export function computeTotals(rows: CampaignDaily[]): Totals {
  const money: Money[] = rows.map((r) => ({ amount: r.spend, currency: r.currency }));
  const currencies = Array.from(new Set(rows.map((r) => r.currency)));

  let spend = 0;
  let currency: CurrencyCode = (currencies[0] as CurrencyCode) ?? REPORTING_CURRENCY;
  let estimated = false;
  let fxStale = false;
  if (currencies.length <= 1) {
    const m = sumNativeMoney(money); // exact, single-currency (guard-enforced)
    spend = m.amount;
    currency = m.currency;
  } else {
    const m = convertAndSum(money, REPORTING_CURRENCY, fxTable); // the only cross-currency path
    spend = m.amount;
    currency = m.currency;
    estimated = true;
    fxStale = m.fxStale;
  }

  let impressions = 0,
    googleClicks = 0,
    metaLinkClicks = 0,
    comparableClicks = 0,
    landingPageViews = 0,
    conversions = 0,
    leads = 0,
    conversionValue = 0,
    liveLeadsSum = 0,
    anyGoogle = false,
    anyMetaPending = false;

  for (const r of rows) {
    impressions += r.impressions;
    landingPageViews += r.landingPageViews;
    conversions += r.conversions;
    leads += r.leads;
    conversionValue += r.conversionValue;
    if (r.channel === "google_ads") {
      googleClicks += r.clicks;
      comparableClicks += r.clicks;
      anyGoogle = true;
      liveLeadsSum += r.liveLeads ?? 0;
    } else {
      metaLinkClicks += r.linkClicks;
      comparableClicks += r.linkClicks;
      if (r.liveLeads === null) anyMetaPending = true;
    }
  }

  const liveLeads = anyGoogle ? liveLeadsSum : null; // pure-Meta scope → "—"
  const safe = (n: number, d: number) => (d ? n / d : null);

  return {
    spend,
    currency,
    estimated,
    fxStale,
    impressions,
    googleClicks,
    metaLinkClicks,
    comparableClicks,
    landingPageViews,
    conversions,
    leads,
    liveLeads,
    metaPending: anyMetaPending,
    conversionValue,
    cpll: liveLeads ? safe(spend, liveLeads) : null,
    cpl: safe(spend, leads),
    ctr: safe(comparableClicks, impressions),
    cpc: safe(spend, comparableClicks),
    cpm: impressions ? (spend / impressions) * 1000 : null,
    cvr: safe(leads, comparableClicks),
    liveLeadRate: liveLeads !== null ? safe(liveLeads, leads) : null,
  };
}

// ---- Trend series (server-downsampled friendly) -----------------------------

export interface TrendPoint {
  date: string;
  spend: number;
  liveLeads: number;
  leads: number;
}

export function spendLiveLeadTrend(
  rows: CampaignDaily[],
  opts: { convert?: boolean } = {}
): { points: TrendPoint[]; estimated: boolean; currency: CurrencyCode } {
  const currencies = Array.from(new Set(rows.map((r) => r.currency)));
  const convert = opts.convert ?? currencies.length > 1;
  const byDate = new Map<string, TrendPoint>();
  for (const r of rows) {
    const p = byDate.get(r.date) ?? { date: r.date, spend: 0, liveLeads: 0, leads: 0 };
    const spend = convert
      ? r.spend * fxTable(r.currency, REPORTING_CURRENCY).rate
      : r.spend;
    p.spend += spend;
    p.liveLeads += r.liveLeads ?? 0;
    p.leads += r.leads;
    byDate.set(r.date, p);
  }
  const points = Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({ ...p, spend: Math.round(p.spend * 100) / 100 }));
  return {
    points,
    estimated: convert,
    currency: convert ? REPORTING_CURRENCY : (currencies[0] as CurrencyCode) ?? REPORTING_CURRENCY,
  };
}

/** Group rows by campaign and total them (for campaign tables / top-10). */
export interface CampaignTotals extends Totals {
  campaignId: string;
  campaignName: string;
  campaignType: string;
  market: string;
  channel: string;
  status: string;
}

export function campaignTotals(rows: CampaignDaily[]): CampaignTotals[] {
  const groups = new Map<string, CampaignDaily[]>();
  for (const r of rows) {
    const arr = groups.get(r.campaignId) ?? [];
    arr.push(r);
    groups.set(r.campaignId, arr);
  }
  const out: CampaignTotals[] = [];
  for (const [campaignId, grp] of groups) {
    const first = grp[0];
    out.push({
      ...computeTotals(grp),
      campaignId,
      campaignName: first.campaignName,
      campaignType: first.campaignType,
      market: first.market,
      channel: first.channel,
      status: "enabled",
    });
  }
  return out;
}

/** Per-account totals for the current-period pacing table & Overview splits. */
export function accountTotals(rows: CampaignDaily[]) {
  const groups = new Map<string, CampaignDaily[]>();
  for (const r of rows) {
    const arr = groups.get(r.accountId) ?? [];
    arr.push(r);
    groups.set(r.accountId, arr);
  }
  return groups;
}

export { LATEST_COMPLETE_DAY };
