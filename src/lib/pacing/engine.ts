import { formatInTimeZone } from "date-fns-tz";

/**
 * Budget pacing engine — Framework §8.
 *
 * All math runs PER ACCOUNT in that account's reporting timezone. `now` is injected
 * (a UTC instant) so the engine is deterministic and testable. The timezone is used
 * ONLY to decide which local calendar date/hour it is; all day counting is pure
 * calendar arithmetic, which keeps three-timezone month boundaries exact.
 */

export type PacingBasis = "completed" | "partial";

export type PacingStatus =
  | "not_started"
  | "on_track"
  | "watch"
  | "at_risk"
  | "over_budget"
  | "budget_not_set";

export interface PacingInput {
  /** Account-local calendar dates, inclusive (YYYY-MM-DD). */
  periodStart: string;
  periodEnd: string;
  /** Allocated budget for the period, native currency. null/0 = not set. */
  budget: number | null;
  /** Spend from period start through the latest complete synced day, native. */
  spend: number;
  /** UTC instant "now". */
  now: Date;
  timezone: string;
  basis?: PacingBasis;
  /** Avg spend of the last 7 complete days — drives the secondary projection. */
  trailingAvg7?: number;
}

export interface PacingResult {
  status: PacingStatus;
  dTotal: number;
  dComplete: number;
  daysRemaining: number;
  fToday: number;
  periodElapsedPct: number;
  budget: number | null;
  spend: number;
  budgetUtilisation: number | null;
  expectedSpend: number | null;
  pacingVariance: number | null;
  pacingVariancePct: number | null;
  pacingIndex: number | null;
  dailyAvgSpend: number;
  requiredDailySpend: number | null;
  projectedSpend: number | null;
  projectedSpendTrailing: number | null;
  projectedVariance: number | null;
  projectedVariancePct: number | null;
  remainingBudget: number;
  overspend: number;
  budgetExhausted: boolean;
}

const MS_PER_DAY = 86_400_000;

/** Pure calendar-day difference between two YYYY-MM-DD strings (a − b). */
function diffCalendarDays(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  return Math.round((da - db) / MS_PER_DAY);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function computePacing(input: PacingInput): PacingResult {
  const { periodStart, periodEnd, spend, now, timezone } = input;
  const basis = input.basis ?? "completed";

  const dTotal = diffCalendarDays(periodEnd, periodStart) + 1;

  // Which local calendar date + hour is it in this account's timezone right now?
  const todayStr = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const localHour = Number(formatInTimeZone(now, timezone, "H"));
  const localMin = Number(formatInTimeZone(now, timezone, "m"));
  const fToday = clamp((localHour + localMin / 60) / 24, 0, 1);

  // Completed days = whole local days strictly before "today", bounded to the period.
  const dComplete = clamp(diffCalendarDays(todayStr, periodStart), 0, dTotal);
  const daysRemaining = dTotal - dComplete;

  // today outside the period → no partial fraction contributes
  const todayInPeriod = todayStr >= periodStart && todayStr <= periodEnd;
  const basisDays =
    basis === "partial" && todayInPeriod ? dComplete + fToday : dComplete;

  const budget = input.budget && input.budget > 0 ? input.budget : null;

  // ---- Budget-not-set / not-started short circuits -------------------------
  if (budget === null) {
    return baseResult({
      status: "budget_not_set",
      dTotal,
      dComplete,
      daysRemaining,
      fToday,
      periodElapsedPct: basisDays / dTotal,
      budget: null,
      spend,
    });
  }

  const periodElapsedPct = basisDays / dTotal;
  const budgetUtilisation = spend / budget;
  const dailyAvgSpend = spend / Math.max(basisDays, 1);
  const trailingAvg7 = input.trailingAvg7 ?? dailyAvgSpend;

  const remainingBudget = Math.max(budget - spend, 0);
  const overspend = Math.max(spend - budget, 0);
  const requiredDailySpend =
    daysRemaining <= 0 ? null : Math.max((budget - spend) / daysRemaining, 0);
  const budgetExhausted = budget - spend < 0;

  // Day 1 of the period (nothing completed): show budget, no variance/status.
  if (basisDays === 0) {
    return {
      ...baseResult({
        status: "not_started",
        dTotal,
        dComplete,
        daysRemaining,
        fToday,
        periodElapsedPct: 0,
        budget,
        spend,
      }),
      budgetUtilisation,
      dailyAvgSpend: 0,
      requiredDailySpend,
      remainingBudget,
      overspend,
      budgetExhausted,
    };
  }

  const expectedSpend = budget * periodElapsedPct;
  const pacingVariance = spend - expectedSpend;
  const pacingVariancePct = expectedSpend === 0 ? null : pacingVariance / expectedSpend;
  const pacingIndex = expectedSpend === 0 ? null : spend / expectedSpend;

  // Projection uses whole days remaining (spec §8 table), completed-days run rate.
  const projRemaining = basis === "partial" ? dTotal - basisDays : daysRemaining;
  const projectedSpend = spend + dailyAvgSpend * projRemaining;
  const projectedSpendTrailing = spend + trailingAvg7 * projRemaining;
  const projectedVariance = projectedSpend - budget;
  const projectedVariancePct = projectedVariance / budget;

  const status = resolveStatus({
    spend,
    budget,
    projectedSpend,
    pacingIndex,
  });

  return {
    status,
    dTotal,
    dComplete,
    daysRemaining,
    fToday,
    periodElapsedPct,
    budget,
    spend,
    budgetUtilisation,
    expectedSpend,
    pacingVariance,
    pacingVariancePct,
    pacingIndex,
    dailyAvgSpend,
    requiredDailySpend,
    projectedSpend,
    projectedSpendTrailing,
    projectedVariance,
    projectedVariancePct,
    remainingBudget,
    overspend,
    budgetExhausted,
  };
}

function resolveStatus(a: {
  spend: number;
  budget: number;
  projectedSpend: number;
  pacingIndex: number | null;
}): PacingStatus {
  if (a.spend >= a.budget) return "over_budget";
  if (a.projectedSpend > a.budget * 1.1) return "over_budget";
  const idx = a.pacingIndex;
  if (idx === null) return "not_started";
  if (idx >= 0.95 && idx <= 1.05) return "on_track";
  if ((idx >= 0.85 && idx < 0.95) || (idx > 1.05 && idx <= 1.15)) return "watch";
  return "at_risk";
}

function baseResult(p: {
  status: PacingStatus;
  dTotal: number;
  dComplete: number;
  daysRemaining: number;
  fToday: number;
  periodElapsedPct: number;
  budget: number | null;
  spend: number;
}): PacingResult {
  return {
    status: p.status,
    dTotal: p.dTotal,
    dComplete: p.dComplete,
    daysRemaining: p.daysRemaining,
    fToday: p.fToday,
    periodElapsedPct: p.periodElapsedPct,
    budget: p.budget,
    spend: p.spend,
    budgetUtilisation: p.budget ? p.spend / p.budget : null,
    expectedSpend: null,
    pacingVariance: null,
    pacingVariancePct: null,
    pacingIndex: null,
    dailyAvgSpend: 0,
    requiredDailySpend: null,
    projectedSpend: null,
    projectedSpendTrailing: null,
    projectedVariance: null,
    projectedVariancePct: null,
    remainingBudget: p.budget ? Math.max(p.budget - p.spend, 0) : 0,
    overspend: p.budget ? Math.max(p.spend - p.budget, 0) : 0,
    budgetExhausted: false,
  };
}

export const PACING_STATUS_LABEL: Record<PacingStatus, string> = {
  not_started: "Period just started",
  on_track: "On track",
  watch: "Watch",
  at_risk: "At risk",
  over_budget: "Over budget",
  budget_not_set: "Budget not set",
};
