import "server-only";
import { fetchGoogleAuctionDaily, LV_GOOGLE_ACCOUNTS } from "../adapters/windsor-rest";
import { NAME_TO_ACCT } from "./real/build";
import { ACCOUNT_BY_ID } from "../domain/accounts";
import { kvGet, kvSet } from "./kv";

/**
 * Per-campaign "limited by budget" signal = search budget-lost impression share
 * (impression-weighted over the last 30 days), pulled from Windsor auction data and
 * cached in Postgres. Used by the Target CPA tab to only suggest new targets for
 * budget-limited campaigns.
 */

const KV_KEY = "budget-lost";

/** A campaign is treated as budget-limited when it loses >5% of eligible impressions to budget. */
export const BUDGET_LIMITED_THRESHOLD = 0.05;

/** `market|campaignName` → budget-lost impression share (0..1) over the last 30 days. */
export type BudgetLostMap = Record<string, number>;

export async function refreshBudgetLost(): Promise<{ campaigns: number }> {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const rows = await fetchGoogleAuctionDaily(from, to, LV_GOOGLE_ACCOUNTS);

  // Aggregate correctly: eligible impressions = impressions / impression_share;
  // budget-lost impressions = eligible × budget_lost_share. Share = Σlost / Σeligible.
  const agg = new Map<string, { elig: number; lost: number }>();
  for (const r of rows) {
    const acct = NAME_TO_ACCT[r.account_name];
    const market = acct ? ACCOUNT_BY_ID[acct]?.market : undefined;
    if (!market) continue;
    const impr = Number(r.impressions) || 0;
    const is = Number(r.search_impression_share) || 0;
    if (impr <= 0 || is <= 0) continue;
    const elig = impr / is;
    const lost = elig * (Number(r.search_budget_lost_impression_share) || 0);
    const key = `${market}|${r.campaign}`;
    const e = agg.get(key) ?? { elig: 0, lost: 0 };
    e.elig += elig;
    e.lost += lost;
    agg.set(key, e);
  }

  const out: BudgetLostMap = {};
  for (const [k, v] of agg) out[k] = v.elig > 0 ? v.lost / v.elig : 0;
  await kvSet(KV_KEY, out);
  return { campaigns: Object.keys(out).length };
}

export async function budgetLostMap(): Promise<BudgetLostMap> {
  return kvGet<BudgetLostMap>(KV_KEY, {});
}
