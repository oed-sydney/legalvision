import "server-only";
import { AD_ACCOUNTS, MARKETS, REPORTING_CURRENCY } from "../domain/accounts";
import type { CurrencyCode, MarketCode } from "../domain/types";
import { computePacing, type PacingResult, type PacingStatus } from "../pacing/engine";
import { convertAndSum, type Money } from "../currency/guard";
import { fxTable } from "../currency/fx";
import { APP_NOW, LATEST_COMPLETE_DAY, dateRangeList } from "./mock";
import { budgetFor } from "./budgets-store";
import { campaignMetas } from "./source";
import { queryCampaignDaily } from "./warehouse";
import type { FilterState } from "../filters/schema";

const PERIOD_START = "2026-07-01";
const PERIOD_END = "2026-07-31";

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

function spendJuly(accountId: string): { total: number; byDay: Map<string, number> } {
  const rows = queryCampaignDaily({ from: PERIOD_START, to: LATEST_COMPLETE_DAY, accountId });
  const byDay = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    total += r.spend;
    byDay.set(r.date, (byDay.get(r.date) ?? 0) + r.spend);
  }
  return { total, byDay };
}

function trailing7(byDay: Map<string, number>): number {
  const start = new Date(`${LATEST_COMPLETE_DAY}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  const days = dateRangeList(start.toISOString().slice(0, 10), LATEST_COMPLETE_DAY);
  const vals = days.map((d) => byDay.get(d) ?? 0);
  return vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1);
}

export function pacingAccounts(f: FilterState): PacingAccountRow[] {
  const rows: PacingAccountRow[] = [];
  for (const acct of AD_ACCOUNTS) {
    if (f.country !== "all" && acct.market !== f.country) continue;
    if (f.channel !== "all" && acct.channel !== f.channel) continue;
    const { total, byDay } = spendJuly(acct.id);
    const b = budgetFor(acct.id);
    const pacing = computePacing({
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      budget: b?.amount ?? null,
      spend: total,
      now: APP_NOW,
      timezone: acct.reportingTimezone,
      trailingAvg7: trailing7(byDay),
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
  const out: MarketRollup[] = [];
  for (const m of MARKETS) {
    const accts = rows.filter((r) => r.market === m.code);
    if (accts.length === 0) continue;
    const budget = accts.reduce((s, r) => s + (r.pacing.budget ?? 0), 0);
    const spend = accts.reduce((s, r) => s + r.pacing.spend, 0);
    const pacing = computePacing({
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      budget: budget || null,
      spend,
      now: APP_NOW,
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
  const multi = new Set(markets.map((m) => m.currency)).size > 1;
  const budget = convertAndSum(budgetMoney, REPORTING_CURRENCY, fxTable).amount;
  const spend = convertAndSum(spendMoney, REPORTING_CURRENCY, fxTable).amount;
  const projected = convertAndSum(projMoney, REPORTING_CURRENCY, fxTable).amount;
  const anyPacing = markets[0]?.pacing;
  return {
    budget,
    spend,
    projected,
    currency: REPORTING_CURRENCY,
    estimated: multi,
    elapsedPct: anyPacing?.periodElapsedPct ?? 0,
    daysRemaining: anyPacing?.daysRemaining ?? 0,
  };
}

/** Per-campaign pacing using derived budgets (platform daily budget × days, labelled). */
export function pacingCampaigns(f: FilterState): PacingCampaignRow[] {
  const out: PacingCampaignRow[] = [];
  for (const cm of campaignMetas()) {
    const acct = cm.account;
    if (f.country !== "all" && acct.market !== f.country) continue;
    if (f.channel !== "all" && acct.channel !== f.channel) continue;
    if (f.account !== "all" && acct.id !== f.account) continue;
    const rows = queryCampaignDaily({
      from: PERIOD_START,
      to: LATEST_COMPLETE_DAY,
      accountId: acct.id,
      campaignId: cm.id,
    });
    if (rows.length === 0) continue;
    const spend = rows.reduce((s, r) => s + r.spend, 0);
    const byDay = new Map<string, number>();
    for (const r of rows) byDay.set(r.date, (byDay.get(r.date) ?? 0) + r.spend);
    // derived budget: trailing daily run-rate × total days in period
    const dailyBudget = trailing7(byDay) * 1.15;
    const derivedBudget = Math.round((dailyBudget * 31) / 50) * 50;
    const pacing = computePacing({
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      budget: derivedBudget || null,
      spend,
      now: APP_NOW,
      timezone: acct.reportingTimezone,
      trailingAvg7: trailing7(byDay),
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
  const days = dateRangeList(PERIOD_START, PERIOD_END);
  const dComplete = days.filter((d) => d <= LATEST_COMPLETE_DAY).length;
  const dTotal = days.length;

  // daily converted spend across scope
  const dailyTotals = new Map<string, number>();
  for (const acct of accts) {
    const rows = queryCampaignDaily({ from: PERIOD_START, to: LATEST_COMPLETE_DAY, accountId: acct.id });
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
