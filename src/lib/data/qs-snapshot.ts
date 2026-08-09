import "server-only";
import { kvGet, kvSet, kvDelete } from "./kv";
import type { Keyword } from "../domain/types";

/**
 * Daily Quality Score history. Captured on every refresh (idempotent per day):
 *  - `qs-kw-<date>`   : { date, qs: { [keywordId]: qualityScore } } — powers qs30dAgo
 *    (per-keyword movements/decliners) once ~30 days have accrued.
 *  - `qs-history`     : [{ date, markets: { AU|UK|NZ: { weightedQs, atQs1to4, kw } } }]
 *    — per-market weighted-QS trend (small; kept ~180 days).
 * Per-keyword daily snapshots are pruned after ~46 days.
 */

const HISTORY_KEY = "qs-history";
const KEEP_KW_DAYS = 46;
const kwKey = (date: string) => `qs-kw-${date}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000));

/**
 * Stable keyword identity across pulls (the numeric `id` is assigned per-pull and drifts).
 * Used to line up a keyword's QS today with its QS ~30 days ago.
 */
export function stableKwKey(k: {
  accountId: string;
  campaignName: string;
  adGroupName: string;
  text: string;
  matchType: string;
}): string {
  return [k.accountId, k.campaignName, k.adGroupName, k.text, k.matchType].join("::").toLowerCase();
}

export interface QsMarketAgg {
  weightedQs: number | null;
  atQs1to4: number;
  kw: number;
}
export interface QsHistoryPoint {
  date: string;
  markets: Record<string, QsMarketAgg>;
}

/** Save today's snapshot (per-keyword QS map + per-market aggregate). Overwrites same-day. */
export async function captureQsSnapshot(keywords: Keyword[]): Promise<void> {
  const date = iso(new Date());

  const map: Record<string, number> = {};
  for (const k of keywords) if (k.qualityScore != null) map[stableKwKey(k)] = k.qualityScore;
  await kvSet(kwKey(date), { date, qs: map });

  const markets: Record<string, QsMarketAgg> = {};
  for (const m of ["AU", "UK", "NZ"] as const) {
    const mk = keywords.filter((k) => k.market === m && k.qualityScore != null);
    const den = mk.reduce((s, k) => s + k.impressions, 0);
    const num = mk.reduce((s, k) => s + k.qualityScore! * k.impressions, 0);
    markets[m] = { weightedQs: den ? num / den : null, atQs1to4: mk.filter((k) => k.qualityScore! <= 4).length, kw: mk.length };
  }
  const hist = await kvGet<QsHistoryPoint[]>(HISTORY_KEY, []);
  const next = hist.filter((h) => h.date !== date);
  next.push({ date, markets });
  next.sort((a, b) => (a.date < b.date ? -1 : 1));
  await kvSet(HISTORY_KEY, next.slice(-180));

  // Roll off an old per-keyword snapshot to bound storage.
  await kvDelete(kwKey(daysAgo(KEEP_KW_DAYS)));
}

/** Per-keyword QS from ~`days` ago (nearest available snapshot within a 10-day window). */
export async function keywordQsDaysAgo(days = 30): Promise<Record<string, number>> {
  for (let d = days; d <= days + 10; d++) {
    const snap = await kvGet<{ date: string; qs: Record<string, number> } | null>(kwKey(daysAgo(d)), null);
    if (snap?.qs && Object.keys(snap.qs).length) return snap.qs;
  }
  return {};
}

export async function qsHistory(): Promise<QsHistoryPoint[]> {
  return kvGet<QsHistoryPoint[]>(HISTORY_KEY, []);
}
