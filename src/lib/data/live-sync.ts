import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { CampaignDaily } from "./mock";
import {
  assembleCampaignDaily,
  campaignType,
  CURRENCY,
  MARKET,
  metaSnapshotInputs,
  NAME_TO_ACCT,
  slug,
} from "./real/build";
import {
  fetchGoogleCampaignDaily,
  fetchGoogleCampaignLiveLeadsDaily,
} from "../adapters/windsor-rest";
import { kvSet } from "./kv";

/**
 * Live refresh: pull fresh Google data from Windsor REST at TRUE campaign × date grain
 * (spend, conversions and Live Leads per campaign per day — so CPA/CPLL genuinely vary
 * with the selected date range), rebuild the CampaignDaily fact rows, and cache them.
 * Meta stays on the baked snapshot until META_SYSTEM_USER_TOKEN is supplied.
 */

const CACHE_PATH = path.join(process.cwd(), "data", "live-cache.json");

export interface LiveCache {
  builtAt: string;
  rows: CampaignDaily[];
}

export async function syncGoogleLive(datePreset = "last_90d"): Promise<{ rows: number; days: number }> {
  const [campDaily, campLLDaily] = await Promise.all([
    fetchGoogleCampaignDaily(datePreset),
    fetchGoogleCampaignLiveLeadsDaily(datePreset),
  ]);

  // Live Leads per (account, campaign, date) — joined onto the daily performance rows.
  const ll = new Map<string, number>();
  for (const r of campLLDaily) {
    const acct = NAME_TO_ACCT[r.account_name];
    if (!acct) continue;
    const key = `${acct}|${r.campaign}|${r.date}`;
    ll.set(key, (ll.get(key) ?? 0) + (Number(r.conversions) || 0));
  }

  const rows: CampaignDaily[] = [];
  const daySet = new Set<string>();
  for (const r of campDaily) {
    const acct = NAME_TO_ACCT[r.account_name];
    if (!acct) continue;
    daySet.add(r.date);
    const liveLeads = Math.round((ll.get(`${acct}|${r.campaign}|${r.date}`) ?? 0) * 10) / 10;
    rows.push({
      date: r.date,
      accountId: acct,
      campaignId: `${acct}-${slug(r.campaign)}`,
      campaignName: r.campaign,
      campaignType: campaignType(r.campaign),
      market: MARKET[acct],
      channel: "google_ads",
      currency: CURRENCY[acct],
      spend: Math.round((Number(r.spend) || 0) * 100) / 100,
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
      linkClicks: 0,
      landingPageViews: 0,
      conversions: Math.round((Number(r.conversions) || 0) * 100) / 100,
      conversionValue: 0,
      leads: liveLeads, // §9.1: Leads = Live Leads until more lead actions are mapped
      liveLeads,
      source: "windsor",
    });
  }

  const days = Array.from(daySet).sort();

  // Meta: baked snapshot distributed over the window (unchanged until Meta token lands).
  const metaRows = assembleCampaignDaily({
    days,
    googleDaily: [],
    googleLiveLeadsDaily: [],
    googleCampaigns: [],
    googleCampaignLiveLeads: [],
    ...metaSnapshotInputs(),
  });
  rows.push(...metaRows);

  const cache: LiveCache = { builtAt: new Date().toISOString(), rows };
  // Durable store (works on serverless) — the app reads this via hydrateLiveData().
  await kvSet("live-cache", cache);
  // Local filesystem cache too (fast path for dev); ignore on read-only hosts.
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf8");
  } catch {
    // read-only filesystem (e.g. Vercel) — Postgres copy above is the source of truth
  }
  return { rows: rows.length, days: days.length };
}

export function readLiveCache(): LiveCache | null {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) as LiveCache;
  } catch {
    return null;
  }
}

/** Cheap freshness key (mtime) so readers reload only when the cache changes. */
export function liveCacheStamp(): number | null {
  try {
    return fs.statSync(CACHE_PATH).mtimeMs;
  } catch {
    return null;
  }
}
