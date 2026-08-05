import "server-only";

/**
 * Real Windsor.ai REST client (account `zeemarketing`). Activates the live refresh path
 * when WINDSOR_API_KEY is set. Endpoint: https://connectors.windsor.ai/google_ads
 * VERIFIED quirk: never combine campaign_status with metric fields (stale-data bug) —
 * this helper pulls metrics only.
 */

const BASE = "https://connectors.windsor.ai";

export const LV_GOOGLE_ACCOUNTS = ["161-014-9859", "682-873-3592", "921-266-0072"];

export interface WindsorDailyRow {
  account_name: string;
  account_currency_code: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export function windsorConfigured(): boolean {
  return Boolean(process.env.WINDSOR_API_KEY);
}

/** Pull daily Google performance for the LegalVision accounts (last N days). */
export async function fetchGoogleDaily(datePreset = "last_30d"): Promise<WindsorDailyRow[]> {
  const key = process.env.WINDSOR_API_KEY;
  if (!key) throw new Error("WINDSOR_API_KEY not set");
  const params = new URLSearchParams({
    api_key: key,
    date_preset: datePreset,
    fields: "account_name,account_currency_code,date,spend,impressions,clicks,conversions",
    account: LV_GOOGLE_ACCOUNTS.join(","),
    _renderer: "json",
  });
  const res = await fetch(`${BASE}/google_ads?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Windsor REST ${res.status}`);
  const json = (await res.json()) as { data?: WindsorDailyRow[] };
  return json.data ?? [];
}

const LL_FILTER = JSON.stringify([["conversion_action_name", "contains", "Live Leads"]]);

async function pull<T>(fields: string, extra: Record<string, string> = {}): Promise<T[]> {
  const key = process.env.WINDSOR_API_KEY;
  if (!key) throw new Error("WINDSOR_API_KEY not set");
  const params = new URLSearchParams({
    api_key: key,
    fields,
    account: LV_GOOGLE_ACCOUNTS.join(","),
    _renderer: "json",
    ...extra,
  });
  const res = await fetch(`${BASE}/google_ads?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Windsor REST ${res.status}`);
  const json = (await res.json()) as { data?: T[] };
  return json.data ?? [];
}

/** Pull daily account rows for an explicit date range (used by the 90-day plan). */
export function fetchGoogleDailyRange(dateFrom: string, dateTo: string) {
  return pull<WindsorDailyRow>(
    "account_name,account_currency_code,date,spend,impressions,clicks,conversions",
    { date_from: dateFrom, date_to: dateTo }
  );
}

export interface WindsorAuctionRow {
  account_name: string;
  campaign: string;
  date: string;
  impressions: number;
  clicks: number;
  /** Ratios 0..1; null/absent on non-search campaigns. */
  search_impression_share: number | null;
  search_budget_lost_impression_share: number | null;
  search_click_share: number | null;
}

/**
 * Pull daily campaign-level auction metrics (impression share family + click
 * share) for the 90-day plan. Campaign grain matters: these are ratios that
 * only aggregate correctly when weighted per search campaign.
 */
export function fetchGoogleAuctionDaily(dateFrom: string, dateTo: string, accounts: string[]) {
  return pull<WindsorAuctionRow>(
    "account_name,campaign,date,impressions,clicks,search_impression_share,search_budget_lost_impression_share,search_click_share",
    { date_from: dateFrom, date_to: dateTo, account: accounts.join(",") }
  );
}

/** Pull daily Live Leads (mapped conversion action) per account. */
export function fetchGoogleLiveLeads(datePreset = "last_30d") {
  return pull<{ account_name: string; date: string; conversions: number }>(
    "account_name,date,conversions",
    { date_preset: datePreset, filter: LL_FILTER }
  );
}

/** Pull campaign 30d aggregates (spend > 0). */
export function fetchGoogleCampaigns(datePreset = "last_30d") {
  return pull<{ account_name: string; campaign: string; spend: number; impressions: number; clicks: number; conversions: number }>(
    "account_name,campaign,spend,impressions,clicks,conversions",
    { date_preset: datePreset, filter: JSON.stringify([["spend", "gt", 0]]) }
  );
}

/**
 * Pull per-campaign DAILY rows (true campaign × date grain — CPA varies by range).
 * Pass an explicit date_from/date_to to include TODAY (Windsor's date presets like
 * "last_90d" stop at yesterday; an explicit range returns today's partial too).
 */
export function fetchGoogleCampaignDaily(datePreset = "last_30d", dateFrom?: string, dateTo?: string) {
  const window: Record<string, string> = dateFrom && dateTo ? { date_from: dateFrom, date_to: dateTo } : { date_preset: datePreset };
  return pull<{ account_name: string; campaign: string; date: string; spend: number; impressions: number; clicks: number; conversions: number }>(
    "account_name,campaign,date,spend,impressions,clicks,conversions",
    { ...window, filter: JSON.stringify([["spend", "gt", 0]]) }
  );
}

/** Pull per-campaign daily Live Leads (mapped conversion action). */
export function fetchGoogleCampaignLiveLeadsDaily(datePreset = "last_30d", dateFrom?: string, dateTo?: string) {
  const window: Record<string, string> = dateFrom && dateTo ? { date_from: dateFrom, date_to: dateTo } : { date_preset: datePreset };
  return pull<{ account_name: string; campaign: string; date: string; conversions: number }>(
    "account_name,campaign,date,conversions",
    { ...window, filter: LL_FILTER }
  );
}

/** Pull per-campaign Live Leads. */
export function fetchGoogleCampaignLiveLeads(datePreset = "last_30d") {
  return pull<{ account_name: string; campaign: string; conversions: number }>(
    "account_name,campaign,conversions",
    { date_preset: datePreset, filter: LL_FILTER }
  );
}

// ---- search-term & keyword-quality pulls (30d aggregates) --------------------
// NOTE: Google's API cannot join keyword attributes (keyword_text) into the
// search-term report, so matched keyword is unavailable via Windsor.

export interface WindsorTermRow {
  account_name: string;
  campaign: string;
  ad_group_name: string;
  search_term: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

export function fetchGoogleSearchTerms(datePreset = "last_30d") {
  return pull<WindsorTermRow>(
    "account_name,campaign,ad_group_name,search_term,impressions,clicks,spend,conversions",
    { date_preset: datePreset }
  );
}

export function fetchGoogleSearchTermLiveLeads(datePreset = "last_30d") {
  return pull<{ account_name: string; search_term: string; conversions: number }>(
    "account_name,search_term,conversions",
    { date_preset: datePreset, filter: LL_FILTER }
  );
}

export interface WindsorKeywordRow {
  account_name: string;
  campaign: string;
  ad_group_name: string;
  keyword_text: string;
  keyword_match_type: string;
  quality_score: number | null;
  creative_quality_score: string | null; // ad relevance
  post_click_quality_score: string | null; // landing page experience
  search_predicted_ctr: string | null; // expected CTR
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

export function fetchGoogleKeywordsQs(datePreset = "last_30d") {
  return pull<WindsorKeywordRow>(
    "account_name,campaign,ad_group_name,keyword_text,keyword_match_type,quality_score,creative_quality_score,post_click_quality_score,search_predicted_ctr,impressions,clicks,spend,conversions",
    { date_preset: datePreset }
  );
}

export function fetchGoogleKeywordLiveLeads(datePreset = "last_30d") {
  return pull<{ account_name: string; campaign: string; keyword_text: string; conversions: number }>(
    "account_name,campaign,keyword_text,conversions",
    { date_preset: datePreset, filter: LL_FILTER }
  );
}
