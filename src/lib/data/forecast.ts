import "server-only";
import { AD_ACCOUNTS, MARKETS } from "../domain/accounts";
import type { CurrencyCode, MarketCode } from "../domain/types";
import { computePacing, type PacingStatus } from "../pacing/engine";
import { nowDate, latestDataDay } from "./mock";
import { budgetAmounts } from "./budgets-store";
import { queryCampaignDaily } from "./warehouse";
import { currentPeriod } from "./period";
import type { FilterState } from "../filters/schema";

/**
 * Forecasted month-end spend per jurisdiction for Google Ads. Each market's projection is
 * its month-to-date spend extrapolated over the calendar month by the pacing engine (which
 * respects the account's reporting timezone). Native currency per market — never blended.
 */
export interface MarketForecast {
  market: MarketCode;
  currency: CurrencyCode;
  mtdSpend: number;
  projected: number;
  budget: number;
  status: PacingStatus;
  variancePct: number | null; // projected vs budget
}

export async function googleMonthEndForecast(f: FilterState): Promise<MarketForecast[]> {
  const amounts = await budgetAmounts();
  const period = currentPeriod();
  const lcd = latestDataDay();
  const now = nowDate();
  const out: MarketForecast[] = [];

  for (const m of MARKETS) {
    if (f.country !== "all" && f.country !== m.code) continue;
    const acct = AD_ACCOUNTS.find((a) => a.market === m.code && a.channel === "google_ads");
    if (!acct) continue;
    if (f.account !== "all" && f.account !== acct.id) continue;

    const rows = queryCampaignDaily({ from: period.start, to: lcd, accountId: acct.id });
    const mtdSpend = rows.reduce((s, r) => s + r.spend, 0);
    const budget = amounts[acct.id] ?? 0;
    const pac = computePacing({
      periodStart: period.start,
      periodEnd: period.end,
      budget: budget || null,
      spend: mtdSpend,
      now,
      timezone: acct.reportingTimezone,
    });
    const projected = pac.projectedSpend ?? mtdSpend;
    out.push({
      market: m.code,
      currency: acct.currency,
      mtdSpend,
      projected,
      budget,
      status: pac.status,
      variancePct: budget ? (projected - budget) / budget : null,
    });
  }
  return out;
}
