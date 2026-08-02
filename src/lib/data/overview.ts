import "server-only";
import { AD_ACCOUNTS, MARKETS, REPORTING_CURRENCY } from "../domain/accounts";
import type { CurrencyCode, MarketCode } from "../domain/types";
import { computePacing, type PacingResult } from "../pacing/engine";
import { fxTable } from "../currency/fx";
import { convertAndSum, type Money } from "../currency/guard";
import { APP_NOW, LATEST_COMPLETE_DAY } from "./mock";
import { budgetFor } from "./budgets-store";
import { computeTotals, queryCampaignDaily, type Totals } from "./warehouse";
import type { FilterState } from "../filters/schema";

/** Per-(market) and per-(channel) totals for Overview splits + comparison tables. */
export function marketTotals(f: FilterState, from: string, to: string) {
  const out: { market: MarketCode; currency: CurrencyCode; totals: Totals }[] = [];
  for (const m of MARKETS) {
    if (f.country !== "all" && f.country !== m.code) continue;
    const rows = queryCampaignDaily({
      from,
      to,
      market: m.code,
      channel: f.channel,
      campaignType: f.ctype,
    });
    if (rows.length === 0) continue;
    out.push({ market: m.code, currency: m.currency, totals: computeTotals(rows) });
  }
  return out;
}

export interface HeatCell {
  market: MarketCode;
  channel: "google_ads" | "meta_ads";
  cpll: number | null;
  currency: CurrencyCode;
  metaPending: boolean;
}

/** CPLL heat matrix (3 markets × 2 channels) — native currency per market. */
export function cpllMatrix(f: FilterState, from: string, to: string): HeatCell[] {
  const cells: HeatCell[] = [];
  for (const m of MARKETS) {
    if (f.country !== "all" && f.country !== m.code) continue;
    for (const ch of ["google_ads", "meta_ads"] as const) {
      if (f.channel !== "all" && f.channel !== ch) continue;
      const rows = queryCampaignDaily({ from, to, market: m.code, channel: ch });
      const t = computeTotals(rows);
      cells.push({
        market: m.code,
        channel: ch,
        cpll: t.cpll,
        currency: m.currency,
        metaPending: ch === "meta_ads",
      });
    }
  }
  return cells;
}

export interface MarketPacing {
  market: MarketCode;
  currency: CurrencyCode;
  budget: number;
  spend: number;
  pacing: PacingResult;
}

/** Budget pacing per market for July (native, single currency per market). */
export function marketPacing(f: FilterState): {
  markets: MarketPacing[];
  overall: {
    budget: number;
    spend: number;
    projected: number;
    utilisation: number;
    estimated: boolean;
    currency: CurrencyCode;
  };
} {
  const markets: MarketPacing[] = [];
  const budgetMoney: Money[] = [];
  const spendMoney: Money[] = [];
  const projMoney: Money[] = [];

  for (const m of MARKETS) {
    if (f.country !== "all" && f.country !== m.code) continue;
    const accts = AD_ACCOUNTS.filter(
      (a) => a.market === m.code && (f.channel === "all" || a.channel === f.channel)
    );
    let budget = 0;
    let spend = 0;
    let projected = 0;
    for (const acct of accts) {
      const b = budgetFor(acct.id);
      const rows = queryCampaignDaily({
        from: "2026-07-01",
        to: LATEST_COMPLETE_DAY,
        accountId: acct.id,
      });
      const acctSpend = rows.reduce((s, r) => s + r.spend, 0);
      const pac = computePacing({
        periodStart: "2026-07-01",
        periodEnd: "2026-07-31",
        budget: b?.amount ?? null,
        spend: acctSpend,
        now: APP_NOW,
        timezone: acct.reportingTimezone,
      });
      budget += b?.amount ?? 0;
      spend += acctSpend;
      projected += pac.projectedSpend ?? acctSpend;
    }
    // market-level pacing recomputed on market totals (single currency — exact)
    const pac = computePacing({
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      budget: budget || null,
      spend,
      now: APP_NOW,
      timezone: MARKETS.find((x) => x.code === m.code)!.displayTimezone,
    });
    markets.push({ market: m.code, currency: m.currency, budget, spend, pacing: pac });
    budgetMoney.push({ amount: budget, currency: m.currency });
    spendMoney.push({ amount: spend, currency: m.currency });
    projMoney.push({ amount: projected, currency: m.currency });
  }

  const multi = new Set(markets.map((m) => m.currency)).size > 1;
  const budget = convertAndSum(budgetMoney, REPORTING_CURRENCY, fxTable).amount;
  const spend = convertAndSum(spendMoney, REPORTING_CURRENCY, fxTable).amount;
  const projected = convertAndSum(projMoney, REPORTING_CURRENCY, fxTable).amount;

  return {
    markets,
    overall: {
      budget,
      spend,
      projected,
      utilisation: budget ? spend / budget : 0,
      estimated: multi,
      currency: REPORTING_CURRENCY,
    },
  };
}
