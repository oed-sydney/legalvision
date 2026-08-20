import "server-only";
import { AD_ACCOUNTS, MARKETS, REPORTING_CURRENCY } from "../domain/accounts";
import type { CurrencyCode, MarketCode } from "../domain/types";
import { computePacing, type PacingResult, type PacingStatus } from "../pacing/engine";
import { convertAndSum, type Money } from "../currency/guard";
import { fxTable } from "../currency/fx";
import { nowDate, latestDataDay, dateRangeList } from "./mock";
import { budgetAmounts } from "./budgets-store";
import { campaignMetas } from "./source";
import { queryCampaignDaily } from "./warehouse";
import { currentPeriod } from "./period";
import type { FilterState } from "../filters/schema";

// Active pacing window = current calendar month; "today"/latest-complete-day are read
// per call (never frozen at module load) so a long-running process stays current.

export interface PacingAccountRow {
  accountId: string;
  market: MarketCode;
  channel: string;
  accountName: string;
  currency: CurrencyCode;
  pacing: PacingResult;
}

export interface PacingCampaignRow {
  campaignId: string;
  campaignName: string;
  market: MarketCode;
  channel: string;
  currency: CurrencyCode;
  budgetSource: "manual" | "derived" | "none";
  pacing: PacingResult;
}

export interface MarketRollup {
  market: MarketCode;
  currency: CurrencyCode;
  budget: number;
  spend: number;
  pacing: PacingResult;
  childStatuses: PacingStatus[];
}

function periodSpend(
  accountId: string,
  periodStart: string,
  lcd: string
): { total: number; byDay: Map<string, number> } {
  const rows = queryCampaignDaily({ from: periodStart, to: lcd, accountId });
  const byDay = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    total += r.spend;
    byDay.set(r.date, (byDay.get(r.date) ?? 0) + r.spend);
  }
  return { total, byDay };
}

function trailing7(byDay: Map<string, number>, lcd: string): number {
  const start = new Date(`${lcd}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  const days = dateRangeList(start.toISOString().slice(0, 10), lcd);
  const vals = days.map((d) => byDay.get(d) ?? 0);
  return vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1);
}

export async function pacingAccounts(f: FilterState): Promise<PacingAccountRow[]> {
  const amounts = await budgetAmounts();
  const period = currentPeriod();
  const lcd = latestDataDay();
  const now = nowDate();
  const rows: PacingAccountRow[] = [];
  for (const acct of AD_ACCOUNTS) {
    if (f.country !== "all" && acct.market !== f.country) continue;
    if (f.channel !== "all" && acct.channel !== f.channel) continue;
    const { total, byDay } = periodSpend(acct.id, period.start, lcd);
    const pacing = computePacing({
      periodStart: period.start,
      periodEnd: period.end,
      budget: amounts[acct.id] ?? null,
      spend: total,
      now,
      timezone: acct.reportingTimezone,
      trailingAvg7: trailing7(byDay, lcd),
    });
    rows.push({
      accountId: acct.id,
      market: acct.market,
      channel: acct.channel,
      accountName: `${acct.name} (${acct.channel === "google_ads" ? "Google" : "Meta"})`,
      currency: acct.currency,
      pacing,
    });
  }
  return rows;
}

export function pacingMarkets(rows: PacingAccountRow[]): MarketRollup[] {
  const period = currentPeriod();
  const now = nowDate();
  const out: MarketRollup[] = [];
  for (const m of MARKETS) {
    const accts = rows.filter((r) => r.market === m.code);
    if (accts.length === 0) continue;
    const budget = accts.reduce((s, r) => s + (r.pacing.budget ?? 0), 0);
    const spend = accts.reduce((s, r) => s + r.pacing.spend, 0);
    const pacing = computePacing({
      periodStart: period.start,
      periodEnd: period.end,
      budget: budget || null,
      spend,
      now,
      timezone: m.displayTimezone,
    });
    out.push({
      market: m.code,
      currency: m.currency,
      budget,
      spend,
      pacing,
      childStatuses: accts.map((a) => a.pacing.status),
    });
  }
  return out;
}

export interface OverallPacing {
  budget: number;
  spend: number;
  projected: number;
  currency: CurrencyCode;
  estimated: boolean;
  elapsedPct: number;
  daysRemaining: number;
}

export function pacingOverall(markets: MarketRollup[]): OverallPacing {
  const budgetMoney: Money[] = markets.map((m) => ({ amount: m.budget, currency: m.currency }));
  const spendMoney: Money[] = markets.map((m) => ({ amount: m.spend, currency: m.currency }));
  const projMoney: Money[] = markets.map((m) => ({
    amount: m.pacing.projectedSpend ?? m.spend,
    currency: m.currency,
  }));
  // Single market in scope → keep its native currency (exact). Convert to the reporting
  // currency only when combining markets of differing currencies ("All markets").
  const multi = new Set(markets.map((m) => m.currency)).size > 1;
  const overallCurrency: CurrencyCode = multi ? REPORTING_CURRENCY : markets[0]?.currency ?? REPORTING_CURRENCY;
  const sumNative = (arr: Money[]) => arr.reduce((s, x) => s + x.amount, 0);
  const budget = multi ? convertAndSum(budgetMoney, REPORTING_CURRENCY, fxTable).amount : sumNative(budgetMoney);
  const spend = multi ? convertAndSum(spendMoney, REPORTING_CURRENCY, fxTable).amount : sumNative(spendMoney);
  const projected = multi ? convertAndSum(projMoney, REPORTING_CURRENCY, fxTable).amount : sumNative(projMoney);
  const anyPacing = markets[0]?.pacing;
  return {
    budget,
    spend,
    projected,
    currency: overallCurrency,
    estimated: multi,
    elapsedPct: anyPacing?.periodElapsedPct ?? 0,
    daysRemaining: anyPacing?.daysRemaining ?? 0,
  };
}

/** Per-campaign pacing using derived budgets (platform daily budget × days, labelled). */
export function pacingCampaigns(f: FilterState): PacingCampaignRow[] {
  const period = currentPeriod();
  const lcd = latestDataDay();
  const now = nowDate();
  const daysInMonth = dateRangeList(period.start, period.end).length;
  const out: PacingCampaignRow[] = [];
  for (const cm of campaignMetas()) {
    const acct = cm.account;
    if (f.country !== "all" && acct.market !== f.country) continue;
    if (f.channel !== "all" && acct.channel !== f.channel) continue;
    if (f.account !== "all" && acct.id !== f.account) continue;
    const rows = queryCampaignDaily({
      from: period.start,
      to: lcd,
      accountId: acct.id,
      campaignId: cm.id,
    });
    if (rows.length === 0) continue;
    const spend = rows.reduce((s, r) => s + r.spend, 0);
    const byDay = new Map<string, number>();
    for (const r of rows) byDay.set(r.date, (byDay.get(r.date) ?? 0) + r.spend);
    // derived budget: trailing daily run-rate × total days in period
    const dailyBudget = trailing7(byDay, lcd) * 1.15;
    const derivedBudget = Math.round((dailyBudget * daysInMonth) / 50) * 50;
    const pacing = computePacing({
      periodStart: period.start,
      periodEnd: period.end,
      budget: derivedBudget || null,
      spend,
      now,
      timezone: acct.reportingTimezone,
      trailingAvg7: trailing7(byDay, lcd),
    });
    out.push({
      campaignId: cm.id,
      campaignName: cm.name,
      market: acct.market,
      channel: acct.channel,
      currency: acct.currency,
      budgetSource: "derived",
      pacing,
    });
  }
  return out.sort((a, b) => b.pacing.spend - a.pacing.spend);
}

/** Cumulative actual vs ideal-linear vs projected curve for in-scope spend. */
export function pacingCurve(f: FilterState, overall: OverallPacing) {
  const accts = AD_ACCOUNTS.filter(
    (a) =>
      (f.country === "all" || a.market === f.country) &&
      (f.channel === "all" || a.channel === f.channel)
  );
  const period = currentPeriod();
  const lcd = latestDataDay();
  const days = dateRangeList(period.start, period.end);
  const dComplete = days.filter((d) => d <= lcd).length;
  const dTotal = days.length;

  // daily converted spend across scope
  const dailyTotals = new Map<string, number>();
  for (const acct of accts) {
    const rows = queryCampaignDaily({ from: period.start, to: lcd, accountId: acct.id });
    const rate = fxTable(acct.currency, REPORTING_CURRENCY).rate;
    for (const r of rows) {
      dailyTotals.set(r.date, (dailyTotals.get(r.date) ?? 0) + r.spend * rate);
    }
  }

  let cum = 0;
  const actualByDay: number[] = [];
  for (let i = 0; i < dComplete; i++) {
    cum += dailyTotals.get(days[i]) ?? 0;
    actualByDay.push(cum);
  }
  const dailyAvg = dComplete ? cum / dComplete : 0;

  return {
    currency: overall.currency,
    estimated: overall.estimated,
    points: days.map((_, i) => {
      const day = i + 1;
      const ideal = (overall.budget * day) / dTotal;
      const actual = day <= dComplete ? actualByDay[i] : null;
      const projected = day >= dComplete ? cum + dailyAvg * (day - dComplete) : null;
      return { day, actual, ideal, projected };
    }),
    budget: overall.budget,
    dTotal,
  };
}
