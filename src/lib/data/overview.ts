import "server-only";
import { AD_ACCOUNTS, MARKETS, REPORTING_CURRENCY } from "../domain/accounts";
import type { CurrencyCode, MarketCode } from "../domain/types";
import { computePacing, type PacingResult } from "../pacing/engine";
import { fxTable } from "../currency/fx";
import { convertAndSum, type Money } from "../currency/guard";
import { nowDate, latestCompleteDay } from "./mock";
import { budgetAmounts } from "./budgets-store";
import { computeTotals, queryCampaignDaily, type Totals } from "./warehouse";
import { currentPeriod } from "./period";
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
export async function marketPacing(f: FilterState): Promise<{
  markets: MarketPacing[];
  overall: {
    budget: number;
    spend: number;
    projected: number;
    utilisation: number;
    estimated: boolean;
    currency: CurrencyCode;
  };
}> {
  const amounts = await budgetAmounts();
  const period = currentPeriod();
  const lcd = latestCompleteDay();
  const now = nowDate();
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
      const acctBudget = amounts[acct.id] ?? null;
      const rows = queryCampaignDaily({
        from: period.start,
        to: lcd,
        accountId: acct.id,
      });
      const acctSpend = rows.reduce((s, r) => s + r.spend, 0);
      const pac = computePacing({
        periodStart: period.start,
        periodEnd: period.end,
        budget: acctBudget,
        spend: acctSpend,
        now,
        timezone: acct.reportingTimezone,
      });
      budget += acctBudget ?? 0;
      spend += acctSpend;
      projected += pac.projectedSpend ?? acctSpend;
    }
    // market-level pacing recomputed on market totals (single currency — exact)
    const pac = computePacing({
      periodStart: period.start,
      periodEnd: period.end,
      budget: budget || null,
      spend,
      now,
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
