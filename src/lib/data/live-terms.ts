import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Keyword, SearchTerm, ComponentRating, CurrencyCode, MarketCode } from "../domain/types";
import { ACCOUNT_BY_ID } from "../domain/accounts";
import { NAME_TO_ACCT } from "./real/build";
import {
  fetchGoogleSearchTerms,
  fetchGoogleSearchTermLiveLeads,
  fetchGoogleKeywordsQs,
  fetchGoogleKeywordLiveLeads,
} from "../adapters/windsor-rest";
import { kvGet, kvSet } from "./kv";
import { captureQsSnapshot, keywordQsDaysAgo, stableKwKey } from "./qs-snapshot";

// Keep the Postgres copy lean (serverless reads it per instance): all keywords are
// needed for Quality Score, but only the highest-spend search terms are actionable
// (display caps at 500; negatives target high-spend/no-conversion terms).
const KV_KEY = "terms-cache";
const KV_TERM_CAP = 3000;

/**
 * Real search-term and keyword-quality data (last 30 days) pulled from Windsor
 * and cached to data/terms-cache.json. Replaces the illustrative mock rows in
 * the Google area when available. Refreshed lazily (12h) and by POST /api/sync.
 */

const CACHE_PATH = path.join(process.cwd(), "data", "terms-cache.json");

export interface TermsCache {
  builtAt: string;
  rangeDays: number;
  searchTerms: SearchTerm[];
  keywords: Keyword[];
}

function rating(v: string | null | undefined): ComponentRating {
  const s = (v ?? "").toUpperCase();
  if (s.includes("ABOVE")) return "above";
  if (s.includes("BELOW")) return "below";
  if (s.includes("AVERAGE")) return "average";
  return null;
}

function matchType(v: string | null | undefined): "exact" | "phrase" | "broad" {
  const s = (v ?? "").toUpperCase();
  if (s.includes("EXACT")) return "exact";
  if (s.includes("PHRASE")) return "phrase";
  return "broad";
}

export async function refreshTermsCache(): Promise<{ searchTerms: number; keywords: number }> {
  const [terms, termLL, kws, kwLL] = await Promise.all([
    fetchGoogleSearchTerms("last_30d"),
    fetchGoogleSearchTermLiveLeads("last_30d"),
    fetchGoogleKeywordsQs("last_30d"),
    fetchGoogleKeywordLiveLeads("last_30d").catch(() => []),
  ]);

  const llByTerm = new Map<string, number>();
  for (const r of termLL) {
    const acct = NAME_TO_ACCT[r.account_name];
    if (!acct) continue;
    const key = `${acct}|${r.search_term}`;
    llByTerm.set(key, (llByTerm.get(key) ?? 0) + (Number(r.conversions) || 0));
  }
  const llByKw = new Map<string, number>();
  for (const r of kwLL) {
    const acct = NAME_TO_ACCT[r.account_name];
    if (!acct) continue;
    const key = `${acct}|${r.campaign}|${r.keyword_text}`;
    llByKw.set(key, (llByKw.get(key) ?? 0) + (Number(r.conversions) || 0));
  }

  const searchTerms: SearchTerm[] = [];
  let sid = 0;
  for (const r of terms) {
    const acctId = NAME_TO_ACCT[r.account_name];
    if (!acctId || !r.search_term) continue;
    const acct = ACCOUNT_BY_ID[acctId];
    searchTerms.push({
      id: `st-${++sid}`,
      accountId: acctId,
      market: acct.market as MarketCode,
      campaignName: r.campaign ?? "",
      adGroupName: r.ad_group_name ?? "",
      term: r.search_term,
      matchedKeyword: "", // not joinable via the API (see windsor-rest note)
      matchType: "broad",
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
      spend: Number(r.spend) || 0,
      conversions: Number(r.conversions) || 0,
      liveLeads: llByTerm.get(`${acctId}|${r.search_term}`) ?? 0,
      currency: acct.currency as CurrencyCode,
      isAddedKeyword: false,
      source: "windsor",
    });
  }

  const keywords: Keyword[] = [];
  let kid = 0;
  for (const r of kws) {
    const acctId = NAME_TO_ACCT[r.account_name];
    if (!acctId || !r.keyword_text) continue;
    // keep the keyword universe meaningful: active search keywords with any
    // impressions, plus anything carrying a quality score
    if ((Number(r.impressions) || 0) === 0 && r.quality_score == null) continue;
    const acct = ACCOUNT_BY_ID[acctId];
    keywords.push({
      id: `kw-${++kid}`,
      accountId: acctId,
      market: acct.market as MarketCode,
      campaignId: "all",
      campaignName: r.campaign ?? "",
      adGroupName: r.ad_group_name ?? "",
      text: r.keyword_text,
      matchType: matchType(r.keyword_match_type),
      status: "enabled",
      qualityScore: r.quality_score == null ? null : Number(r.quality_score),
      expectedCtr: rating(r.search_predicted_ctr),
      adRelevance: rating(r.creative_quality_score),
      lpExperience: rating(r.post_click_quality_score),
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
      spend: Number(r.spend) || 0,
      conversions: Number(r.conversions) || 0,
      liveLeads: llByKw.get(`${acctId}|${r.campaign}|${r.keyword_text}`) ?? 0,
      currency: acct.currency as CurrencyCode,
      qs30dAgo: null, // no QS history in the 30d snapshot
      source: "windsor",
    });
  }

  // Fill qs30dAgo from the QS snapshot ~30 days ago (populates once history accrues),
  // then capture today's snapshot so the history keeps building.
  try {
    const prior = await keywordQsDaysAgo(30);
    if (Object.keys(prior).length) {
      for (const k of keywords) {
        const was = prior[stableKwKey(k)];
        if (was != null) k.qs30dAgo = was;
      }
    }
    await captureQsSnapshot(keywords);
  } catch {
    // snapshot is best-effort — never fail the refresh over history capture
  }

  const cache: TermsCache = {
    builtAt: new Date().toISOString(),
    rangeDays: 30,
    searchTerms,
    keywords,
  };

  // Durable, serverless-safe copy in Postgres (trimmed): all keywords + top search
  // terms by spend. This is what production reads (the full fs cache below is dev-only).
  const topTerms = [...searchTerms].sort((a, b) => b.spend - a.spend).slice(0, KV_TERM_CAP);
  await kvSet(KV_KEY, { builtAt: cache.builtAt, rangeDays: 30, searchTerms: topTerms, keywords });
  _kvMemo = null; // invalidate the in-process KV memo so the next read sees fresh data

  // Full local filesystem cache (fast path for dev); ignore on read-only hosts.
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf8");
  } catch {
    // read-only filesystem (e.g. Vercel) — the Postgres copy above is the source of truth
  }
  return { searchTerms: searchTerms.length, keywords: keywords.length };
}

// Parse the 9.7MB terms cache at most once per file change (keyed by mtime), not once
// per request — this is the dominant cost on the Google page.
let _parsed: { mtimeMs: number; value: TermsCache } | null = null;
function readCache(): TermsCache | null {
  try {
    const mtimeMs = fs.statSync(CACHE_PATH).mtimeMs;
    if (_parsed && _parsed.mtimeMs === mtimeMs) return _parsed.value;
    const value = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) as TermsCache;
    _parsed = { mtimeMs, value };
    return value;
  } catch {
    return null;
  }
}

// Postgres copy, memoised per instance (it's ~2MB — don't refetch every request).
let _kvMemo: { at: number; value: TermsCache | null } | null = null;
const KV_TTL_MS = 5 * 60 * 1000;
async function readKvTerms(): Promise<TermsCache | null> {
  if (_kvMemo && Date.now() - _kvMemo.at < KV_TTL_MS) return _kvMemo.value;
  const value = await kvGet<TermsCache | null>(KV_KEY, null);
  _kvMemo = { at: Date.now(), value };
  return value;
}

/**
 * Real search-term + keyword-QS rows for the Google area. Reads the local filesystem
 * cache in dev, else the Postgres copy (serverless). Never triggers a Windsor pull on
 * render — refreshes happen via POST /api/sync (the Refresh button / scheduled job).
 */
export async function termsCache(): Promise<TermsCache | null> {
  const fsCache = readCache();
  if (fsCache) return fsCache;
  return readKvTerms();
}
