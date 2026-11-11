import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  META_ACCOUNT_MAP,
  metaConfigured,
  fetchMetaCampaignInsights,
  fetchCustomConversions,
  trialCountFromActions,
} from "../adapters/meta-rest";
import type { MetaAccountSnap, MetaCampaignSnap, MetaFunnel, AcctCode } from "./real/snapshot";
import { META_ACCOUNTS as SNAP_ACCOUNTS, META_CAMPAIGNS as SNAP_CAMPAIGNS } from "./real/snapshot";
import type { CampaignType } from "../domain/types";
import { kvGet, kvSet } from "./kv";

/**
 * Live Meta Social-tab data pulled straight from the Meta Marketing API (system-user token),
 * cached to Postgres (`meta-cache`) + a local fs copy. Produces the SAME shape as the baked
 * snapshot (real/snapshot.ts) so the Social tab reads live-or-snapshot transparently.
 *
 * Scope mirrors the dashboard's established Social view: the three core active funnels only
 * (BOFU conversions, SME-publication lead forms, TOFU traffic) — event/legacy campaigns are
 * intentionally excluded so the summary tiles and the campaign table stay aligned.
 */

const KV_KEY = "meta-cache";
const CACHE_PATH = path.join(process.cwd(), "data", "meta-cache.json");
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface MetaCache {
  builtAt: string;
  windowLabel: string;
  rangeDays: number;
  accounts: MetaAccountSnap[];
  campaigns: MetaCampaignSnap[];
}

/** Classify an active campaign into one of the three tracked funnels, or null to exclude it. */
export function classifyFunnel(name: string): { funnel: MetaFunnel; objective: CampaignType } | null {
  const n = name.toLowerCase();
  if (n.includes("bofu") && n.includes("conversion")) return { funnel: "BOFU", objective: "Sales" };
  if (n.includes("leads") && n.includes("publication")) return { funnel: "SME Publication", objective: "Leads" };
  if (n.includes("tofu") && n.includes("traffic")) return { funnel: "Traffic", objective: "Traffic" };
  return null;
}

function slugId(acct: AcctCode, name: string): string {
  return `${acct}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

/** Pull live Meta data for all three accounts and rebuild the Social-tab snapshot shape. */
export async function refreshMetaCache(datePreset = "last_30d"): Promise<{ accounts: number; campaigns: number }> {
  if (!metaConfigured()) throw new Error("META_SYSTEM_USER_TOKEN not set");

  const accounts: MetaAccountSnap[] = [];
  const campaigns: MetaCampaignSnap[] = [];

  for (const [numericId, meta] of Object.entries(META_ACCOUNT_MAP)) {
    let insights, convs;
    try {
      [insights, convs] = await Promise.all([
        fetchMetaCampaignInsights(numericId, datePreset),
        fetchCustomConversions(numericId).catch(() => ({} as Record<string, string>)),
      ]);
    } catch {
      continue; // an account that errors (no access / no active campaigns) is simply absent
    }
    const trialIds = new Set(
      Object.entries(convs)
        .filter(([, name]) => /30\s*day\s*trial/i.test(name))
        .map(([id]) => id)
    );

    const acct = meta.id as AcctCode;
    let aSpend = 0, aSmeSpend = 0, aBofuSpend = 0;
    let aImpr = 0, aReach = 0, aClicks = 0, aLink = 0, aLpv = 0, aSme = 0, aBofu = 0;

    for (const c of insights) {
      const cls = classifyFunnel(c.campaign_name);
      if (!cls) continue;
      const leads = cls.funnel === "SME Publication" ? c.leads : 0;
      const trials = cls.funnel === "BOFU" ? trialCountFromActions(c.actions, trialIds) : 0;

      campaigns.push({
        acct,
        market: meta.market,
        currency: meta.currency,
        id: slugId(acct, c.campaign_name),
        name: c.campaign_name,
        funnel: cls.funnel,
        objective: cls.objective,
        spend: round2(c.spend),
        impressions: c.impressions,
        reach: c.reach,
        frequency: c.frequency,
        clicks: c.clicks,
        ctr: c.impressions ? (c.linkClicks / c.impressions) * 100 : 0,
        cpc: c.linkClicks ? c.spend / c.linkClicks : 0,
        cpm: c.impressions ? (c.spend / c.impressions) * 1000 : 0,
        linkClicks: c.linkClicks,
        lpv: c.landingPageViews,
        leads,
        leadCpl: leads ? round2(c.spend / leads) : null,
        trials,
        trialCpl: trials ? round2(c.spend / trials) : null,
      });

      aSpend += c.spend;
      aImpr += c.impressions;
      aReach += c.reach; // funnel-level reach (cross-campaign dedup not available) — labelled as such
      aClicks += c.clicks;
      aLink += c.linkClicks;
      aLpv += c.landingPageViews;
      if (cls.funnel === "SME Publication") { aSme += leads; aSmeSpend += c.spend; }
      if (cls.funnel === "BOFU") { aBofu += trials; aBofuSpend += c.spend; }
    }

    // Only surface an account that actually has tracked funnel activity.
    if (campaigns.some((c) => c.acct === acct)) {
      accounts.push({
        acct,
        market: meta.market,
        currency: meta.currency,
        spend: round2(aSpend),
        impressions: aImpr,
        reach: aReach,
        frequency: aReach ? aImpr / aReach : 0,
        clicks: aClicks,
        ctr: aImpr ? (aLink / aImpr) * 100 : 0,
        cpc: aLink ? aSpend / aLink : 0,
        cpm: aImpr ? (aSpend / aImpr) * 1000 : 0,
        linkClicks: aLink,
        lpv: aLpv,
        smeLeads: aSme,
        smeSpend: round2(aSmeSpend),
        bofuTrials: aBofu,
        bofuSpend: round2(aBofuSpend),
      });
    }
  }

  const cache: MetaCache = {
    builtAt: new Date().toISOString(),
    windowLabel: "Last 30 days",
    rangeDays: 30,
    accounts,
    campaigns,
  };

  await kvSet(KV_KEY, cache);
  _memo = null;
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf8");
  } catch {
    // read-only fs (Vercel) — Postgres copy is source of truth
  }
  return { accounts: accounts.length, campaigns: campaigns.length };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---- readers -----------------------------------------------------------------

let _memo: { at: number; value: MetaCache | null } | null = null;

function readFsCache(): MetaCache | null {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) as MetaCache;
  } catch {
    return null;
  }
}

/** Live Meta cache (fs in dev, Postgres on serverless), memoised briefly; null when none. */
export async function metaCache(): Promise<MetaCache | null> {
  const fsCache = readFsCache();
  if (fsCache) return fsCache;
  if (_memo && Date.now() - _memo.at < CACHE_TTL_MS) return _memo.value;
  const value = await kvGet<MetaCache | null>(KV_KEY, null);
  _memo = { at: Date.now(), value };
  return value;
}

/**
 * The Meta accounts/campaigns the Social tab should render: the live pull when present,
 * otherwise the baked snapshot. `live` flags which one so the page can label the window.
 */
export async function resolveMeta(): Promise<{
  accounts: MetaAccountSnap[];
  campaigns: MetaCampaignSnap[];
  live: boolean;
  builtAt: string | null;
  windowLabel: string;
}> {
  const cache = await metaCache();
  if (cache && cache.accounts.length) {
    return { accounts: cache.accounts, campaigns: cache.campaigns, live: true, builtAt: cache.builtAt, windowLabel: cache.windowLabel };
  }
  return { accounts: SNAP_ACCOUNTS, campaigns: SNAP_CAMPAIGNS, live: false, builtAt: null, windowLabel: "Last 30 days" };
}
