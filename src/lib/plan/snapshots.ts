import "server-only";
import { termsCache } from "../data/live-terms";
import { queryCampaignDaily } from "../data/warehouse";
import { latestDataDay } from "../data/mock";
import type { MarketCode } from "../domain/types";

/**
 * Current-state ("as of now") plan KPIs that come from keyword / campaign detail rather
 * than the monthly account time series — quality-score mix, landing-page-experience spend,
 * and the spend concentrated in efficient campaigns. Computed from the live keyword pull
 * (termsCache) + the warehouse over the latest 30 days, so no manual entry is needed.
 */

export interface MarketSnapshot {
  kwBelowQs5: number | null; // % of active, scored keywords below QS 5
  spendWeakLp: number | null; // % of keyword spend on below-average landing page experience
  spendBeatCpll: number | null; // % of spend in campaigns beating the account-avg cost/live-lead
}

function rangeStart(to: string, days: number): string {
  const d = new Date(`${to}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

export async function planSnapshots(): Promise<Record<MarketCode, MarketSnapshot>> {
  const live = await termsCache();
  const kws = live?.keywords ?? [];
  const to = latestDataDay();
  const from = rangeStart(to, 30);
  const markets: MarketCode[] = ["AU", "UK", "NZ"];
  const out = {} as Record<MarketCode, MarketSnapshot>;

  for (const m of markets) {
    const mk = kws.filter((k) => k.market === m && k.status !== "paused");

    // Quality score: share of scored keywords below QS 5.
    const scored = mk.filter((k) => k.qualityScore != null);
    const kwBelowQs5 = scored.length
      ? (scored.filter((k) => (k.qualityScore as number) < 5).length / scored.length) * 100
      : null;

    // Landing page experience: share of keyword spend rated "below".
    const rated = mk.filter((k) => k.lpExperience != null);
    const ratedSpend = rated.reduce((s, k) => s + k.spend, 0);
    const weakSpend = rated.filter((k) => k.lpExperience === "below").reduce((s, k) => s + k.spend, 0);
    const spendWeakLp = ratedSpend > 0 ? (weakSpend / ratedSpend) * 100 : null;

    // Spend in campaigns beating the account-average cost per live lead (last 30 days).
    const rows = queryCampaignDaily({ from, to, market: m, channel: "google_ads" });
    const byCamp = new Map<string, { spend: number; ll: number }>();
    let totSpend = 0;
    let totLl = 0;
    for (const r of rows) {
      const c = byCamp.get(r.campaignName) ?? { spend: 0, ll: 0 };
      c.spend += r.spend;
      c.ll += r.liveLeads ?? 0;
      byCamp.set(r.campaignName, c);
      totSpend += r.spend;
      totLl += r.liveLeads ?? 0;
    }
    const avgCpll = totLl > 0 ? totSpend / totLl : null;
    let beatSpend = 0;
    if (avgCpll != null) {
      for (const c of byCamp.values()) {
        const cpll = c.ll > 0 ? c.spend / c.ll : Infinity; // no leads → worse than average
        if (cpll < avgCpll) beatSpend += c.spend;
      }
    }
    const spendBeatCpll = avgCpll != null && totSpend > 0 ? (beatSpend / totSpend) * 100 : null;

    out[m] = { kwBelowQs5, spendWeakLp, spendBeatCpll };
  }
  return out;
}
