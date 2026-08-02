import "server-only";
import { fetchGoogleAuctionDaily, fetchGoogleDailyRange, windsorConfigured } from "../adapters/windsor-rest";
import { kvGet, kvSet } from "../data/kv";
import { NAME_TO_ACCT } from "../data/real/build";
import { ACCOUNT_BY_ID } from "../domain/accounts";
import { PLAN, PLAN_KPIS, type PlanKpiDef } from "./definition";
import { readPlanState } from "./store";
import { safeRatio } from "../metrics/format";

/**
 * Monthly KPI values for the 90-day plan, computed from account-level Windsor
 * daily rows (plan start → today) and cached to data/plan-cache.json. The
 * cache refreshes on the top-bar Refresh (POST /api/sync) and lazily when
 * older than MAX_AGE. Without WINDSOR_API_KEY the last cache keeps serving.
 */

const CACHE_KEY = "plan-cache";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

interface MonthAgg {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  /** Weighted auction parts (search campaigns only; absent pre-auction-fetch). */
  eligImpr?: number;
  lostBudgetImpr?: number;
  csClicks?: number;
  eligClicks?: number;
}

interface PlanCache {
  builtAt: string;
  /** accountId → month ("2026-05") → aggregates. */
  months: Record<string, Record<string, MonthAgg>>;
}

/** Accounts whose KPIs need daily campaign-level auction rows. */
const AUCTION_ACCOUNT_IDS = Array.from(
  new Set(
    PLAN_KPIS.filter((k) => k.metric === "click_share" || k.metric === "is_lost_budget")
      .map((k) => k.accountId)
      .filter((id): id is string => Boolean(id))
  )
);

export async function refreshPlanCache(): Promise<{ months: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const to = today < PLAN.endDate ? today : PLAN.endDate;
  const auctionExternalIds = AUCTION_ACCOUNT_IDS.map((id) => ACCOUNT_BY_ID[id].platformAccountId);
  const [rows, auctionRows] = await Promise.all([
    fetchGoogleDailyRange(PLAN.startDate, to),
    auctionExternalIds.length
      ? fetchGoogleAuctionDaily(PLAN.startDate, to, auctionExternalIds)
      : Promise.resolve([]),
  ]);

  const months: PlanCache["months"] = {};
  for (const r of rows) {
    const acct = NAME_TO_ACCT[r.account_name];
    if (!acct || !r.date) continue;
    const month = r.date.slice(0, 7);
    const byMonth = (months[acct] ??= {});
    const agg = (byMonth[month] ??= { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
    agg.spend += Number(r.spend) || 0;
    agg.impressions += Number(r.impressions) || 0;
    agg.clicks += Number(r.clicks) || 0;
    agg.conversions += Number(r.conversions) || 0;
  }

  // Auction ratios only aggregate correctly via their denominators: eligible
  // impressions = impressions / IS, eligible clicks = clicks / click share.
  for (const r of auctionRows) {
    const acct = NAME_TO_ACCT[r.account_name];
    if (!acct || !r.date) continue;
    const agg = months[acct]?.[r.date.slice(0, 7)];
    if (!agg) continue;
    const impr = Number(r.impressions) || 0;
    const clicks = Number(r.clicks) || 0;
    const is = Number(r.search_impression_share) || 0;
    const cs = Number(r.search_click_share) || 0;
    if (is > 0 && impr > 0) {
      const eligible = impr / is;
      agg.eligImpr = (agg.eligImpr ?? 0) + eligible;
      agg.lostBudgetImpr =
        (agg.lostBudgetImpr ?? 0) + eligible * (Number(r.search_budget_lost_impression_share) || 0);
    }
    if (cs > 0 && clicks > 0) {
      agg.csClicks = (agg.csClicks ?? 0) + clicks;
      agg.eligClicks = (agg.eligClicks ?? 0) + clicks / cs;
    }
  }

  const cache: PlanCache = { builtAt: new Date().toISOString(), months };
  await kvSet(CACHE_KEY, cache);
  return { months: Object.values(months).reduce((n, m) => n + Object.keys(m).length, 0) };
}

async function readCache(): Promise<PlanCache | null> {
  return kvGet<PlanCache | null>(CACHE_KEY, null);
}

async function cachedMonths(): Promise<PlanCache | null> {
  const cache = await readCache();
  const fresh = cache && Date.now() - Date.parse(cache.builtAt) < MAX_AGE_MS;
  if (fresh) return cache;
  if (windsorConfigured()) {
    try {
      await refreshPlanCache();
      return await readCache();
    } catch {
      return cache; // stale beats nothing if Windsor is unreachable
    }
  }
  return cache;
}

// ---------- computed report ----------

export type KpiStatus = "on_track" | "at_risk" | "off_track" | "no_data";

export interface PlanMonth {
  month: string; // "2026-05"
  label: string; // "May"
  partial: boolean;
}

export interface KpiRow {
  def: PlanKpiDef;
  /** aligned with planMonths(); null = no data. */
  values: (number | null)[];
  status: KpiStatus;
  /** How far the judged month sits from target, e.g. "22% short of target (June)". */
  gapText: string | null;
}

export interface PlanReport {
  months: PlanMonth[];
  kpis: KpiRow[];
  builtAt: string | null;
  dayOfPlan: number;
  totalDays: number;
  elapsedPct: number;
}

export function planMonths(now = new Date()): PlanMonth[] {
  const today = now.toISOString().slice(0, 10);
  const current = today.slice(0, 7);
  const out: PlanMonth[] = [];
  const start = new Date(`${PLAN.startDate.slice(0, 7)}-01T00:00:00Z`);
  for (let d = start; ; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const month = d.toISOString().slice(0, 7);
    if (month > PLAN.endDate.slice(0, 7) || month > current) break;
    const label = d.toLocaleDateString("en-AU", { month: "short", timeZone: "UTC" });
    const partial = month === current && today < PLAN.endDate;
    out.push({ month, label: partial ? `${label} (to date)` : label, partial });
  }
  return out;
}

function computeValue(def: PlanKpiDef, agg: MonthAgg | undefined): number | null {
  if (!agg) return null;
  switch (def.metric) {
    case "conversions":
      return agg.conversions;
    case "spend":
      return agg.spend;
    case "cpa":
      return safeRatio(agg.spend, agg.conversions);
    case "ctr": {
      const r = safeRatio(agg.clicks, agg.impressions);
      return r === null ? null : r * 100; // percent KPIs are in points
    }
    case "click_share": {
      const r = safeRatio(agg.csClicks ?? 0, agg.eligClicks ?? 0);
      return r === null ? null : r * 100;
    }
    case "is_lost_budget": {
      const r = safeRatio(agg.lostBudgetImpr ?? 0, agg.eligImpr ?? 0);
      return r === null ? null : r * 100;
    }
    default:
      return null;
  }
}

/** Judge on the last COMPLETE month (a partial month can't fail a monthly target). */
function judge(
  def: PlanKpiDef,
  months: PlanMonth[],
  values: (number | null)[]
): { status: KpiStatus; gapText: string | null } {
  let latest: number | null = null;
  let judgedLabel = "";
  for (let i = months.length - 1; i >= 0; i--) {
    if (!months[i].partial && values[i] !== null) {
      latest = values[i];
      judgedLabel = months[i].label;
      break;
    }
  }
  if (latest === null) return { status: "no_data", gapText: null };

  const pct = Math.abs((latest - def.target) / Math.abs(def.target)) * 100;
  const pctStr = pct >= 10 ? pct.toFixed(0) : pct.toFixed(1);
  const good = def.direction === 1 ? latest >= def.target : latest <= def.target;
  const gapText = good
    ? def.direction === 1
      ? `${pctStr}% above target (${judgedLabel})`
      : `${pctStr}% under target (${judgedLabel})`
    : def.direction === 1
      ? `${pctStr}% short of target (${judgedLabel})`
      : `${pctStr}% over target (${judgedLabel})`;

  if (good) return { status: "on_track", gapText };
  const nearBand = Math.abs(def.target) * 0.07;
  const status = Math.abs(latest - def.target) <= nearBand ? "at_risk" : "off_track";
  return { status, gapText };
}

export async function planReport(now = new Date()): Promise<PlanReport> {
  const months = planMonths(now);
  const cache = await cachedMonths();
  const state = await readPlanState();

  const kpis: KpiRow[] = PLAN_KPIS.map((def) => {
    const values = months.map((m) => {
      if (def.metric === "manual") return state.manualValues[def.id]?.[m.month] ?? null;
      const agg = def.accountId ? cache?.months[def.accountId]?.[m.month] : undefined;
      return computeValue(def, agg);
    });
    const { status, gapText } = judge(def, months, values);
    return { def, values, status, gapText };
  });

  const dayMs = 86_400_000;
  const start = Date.parse(`${PLAN.startDate}T00:00:00Z`);
  const end = Date.parse(`${PLAN.endDate}T00:00:00Z`);
  const totalDays = Math.round((end - start) / dayMs) + 1;
  const dayOfPlan = Math.min(totalDays, Math.max(1, Math.floor((now.getTime() - start) / dayMs) + 1));

  return {
    months,
    kpis,
    builtAt: cache?.builtAt ?? null,
    dayOfPlan,
    totalDays,
    elapsedPct: dayOfPlan / totalDays,
  };
}
