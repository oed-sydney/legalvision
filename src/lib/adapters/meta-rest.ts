import "server-only";

/**
 * Real Meta Marketing API client (system-user token). Activates the live Meta refresh
 * and the budget-pacing writes when META_SYSTEM_USER_TOKEN is set.
 *
 * Scopes on the token: ads_read (insights/budgets) + ads_management (budget writes).
 *
 * UNIT NOTE — the Graph API splits money two ways and mixing them is the classic bug:
 *   • insights `spend` / `cpc` / `cpm`  → MAJOR units (dollars) as strings.
 *   • `daily_budget` / `lifetime_budget` → MINOR units (cents) as strings.
 * This module keeps everything in MAJOR units at its boundary: reads divide budgets by
 * 100, writes multiply by 100. Callers never see cents.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

/** LegalVision Meta ad accounts (numeric id → our internal account id + market/currency). */
export const META_ACCOUNT_MAP: Record<string, { id: string; market: "AU" | "UK" | "NZ"; currency: "AUD" | "GBP" | "NZD" }> = {
  "572916339475556": { id: "au-meta", market: "AU", currency: "AUD" },
  "3250766361819452": { id: "uk-meta", market: "UK", currency: "GBP" },
  "175621377645284": { id: "nz-meta", market: "NZ", currency: "NZD" },
};

export function metaConfigured(): boolean {
  return Boolean(process.env.META_SYSTEM_USER_TOKEN);
}

function token(): string {
  const t = process.env.META_SYSTEM_USER_TOKEN;
  if (!t) throw new Error("META_SYSTEM_USER_TOKEN not set");
  return t;
}

/** Thin GET with the token appended, surfacing Graph API errors with their message. */
async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const q = new URLSearchParams({ ...params, access_token: token() });
  const res = await fetch(`${GRAPH}/${path}?${q.toString()}`, { cache: "no-store" });
  const json = (await res.json()) as T & { error?: { message?: string; code?: number } };
  if (!res.ok || json.error) {
    throw new Error(`Meta API ${res.status}: ${json.error?.message ?? "request failed"}`);
  }
  return json;
}

/** Follow Graph cursor pagination, collecting every `data` page (capped for safety). */
async function graphGetAll<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  for (let i = 0; i < 20; i++) {
    const page = await graphGet<{ data?: T[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      path,
      after ? { ...params, after } : params
    );
    out.push(...(page.data ?? []));
    const next = page.paging?.next ? page.paging?.cursors?.after : undefined;
    if (!next) break;
    after = next;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Insights (reads)
// ---------------------------------------------------------------------------

export interface MetaAction {
  action_type: string;
  value: string;
}

export interface MetaCampaignInsight {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  linkClicks: number;
  landingPageViews: number;
  leads: number; // Meta lead-form submissions (`lead` action)
  actions: MetaAction[];
}

const INSIGHT_FIELDS =
  "campaign_id,campaign_name,spend,impressions,reach,frequency,clicks,inline_link_clicks,actions";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sumActions(actions: MetaAction[] | undefined, types: string[]): number {
  if (!actions) return 0;
  const set = new Set(types);
  return actions.reduce((s, a) => (set.has(a.action_type) ? s + num(a.value) : s), 0);
}

/** Active-campaign insights for one ad account over a date preset (default month-to-date). */
export async function fetchMetaCampaignInsights(
  accountNumericId: string,
  datePreset = "last_30d"
): Promise<MetaCampaignInsight[]> {
  const rows = await graphGetAll<{
    campaign_id: string;
    campaign_name: string;
    spend?: string;
    impressions?: string;
    reach?: string;
    frequency?: string;
    clicks?: string;
    inline_link_clicks?: string;
    actions?: MetaAction[];
  }>(`act_${accountNumericId}/insights`, {
    level: "campaign",
    fields: INSIGHT_FIELDS,
    date_preset: datePreset,
    limit: "200",
    filtering: JSON.stringify([{ field: "campaign.effective_status", operator: "IN", value: ["ACTIVE"] }]),
  });

  return rows.map((r) => ({
    campaign_id: r.campaign_id,
    campaign_name: r.campaign_name,
    spend: num(r.spend),
    impressions: num(r.impressions),
    reach: num(r.reach),
    frequency: num(r.frequency),
    clicks: num(r.clicks),
    linkClicks: num(r.inline_link_clicks),
    landingPageViews: sumActions(r.actions, ["landing_page_view", "omni_landing_page_view"]),
    leads: sumActions(r.actions, ["lead", "onsite_conversion.lead_grouped"]),
    actions: r.actions ?? [],
  }));
}

/** Custom-conversion id → name for an account (used to find the "30 Day Trial" conversions). */
export async function fetchCustomConversions(accountNumericId: string): Promise<Record<string, string>> {
  const rows = await graphGetAll<{ id: string; name?: string }>(`act_${accountNumericId}/customconversions`, {
    fields: "id,name",
    limit: "200",
  });
  const out: Record<string, string> = {};
  for (const r of rows) out[r.id] = r.name ?? "";
  return out;
}

/**
 * BOFU "30 Day Trial" result for a campaign: sums the custom-conversion actions whose
 * conversion name matches /30 day trial/i (resolved per account, so AU/UK/NZ each use
 * their own conversion id without hardcoding).
 */
export function trialCountFromActions(actions: MetaAction[], trialConversionIds: Set<string>): number {
  return actions.reduce((s, a) => {
    const m = a.action_type.match(/^offsite_conversion\.custom\.(\d+)$/);
    return m && trialConversionIds.has(m[1]) ? s + num(a.value) : s;
  }, 0);
}

// ---------------------------------------------------------------------------
// Budgets (reads + writes — the auto-pacing surface)
// ---------------------------------------------------------------------------

export interface MetaCampaignBudget {
  id: string;
  name: string;
  status: string; // ACTIVE | PAUSED | …
  objective: string;
  /** Daily budget in MAJOR units (dollars), or null when the campaign uses a lifetime/ad-set budget. */
  dailyBudget: number | null;
  /** Lifetime budget in MAJOR units, or null. */
  lifetimeBudget: number | null;
  bidStrategy: string | null;
}

/** All campaigns for an account with their budgets, normalised to MAJOR units. */
export async function fetchMetaCampaignBudgets(accountNumericId: string): Promise<MetaCampaignBudget[]> {
  const rows = await graphGetAll<{
    id: string;
    name: string;
    status: string;
    objective: string;
    daily_budget?: string;
    lifetime_budget?: string;
    bid_strategy?: string;
  }>(`act_${accountNumericId}/campaigns`, {
    fields: "name,status,objective,daily_budget,lifetime_budget,bid_strategy",
    limit: "200",
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    objective: r.objective,
    dailyBudget: r.daily_budget != null ? num(r.daily_budget) / 100 : null,
    lifetimeBudget: r.lifetime_budget != null ? num(r.lifetime_budget) / 100 : null,
    bidStrategy: r.bid_strategy ?? null,
  }));
}

/**
 * Set a campaign's daily budget (MAJOR units → sent as cents). Requires ads_management.
 * This is the ONLY write in the codebase — callers gate it behind the auto-pacing config
 * and an explicit apply. Returns the campaign id on success; throws with the Graph message.
 */
export async function setMetaCampaignDailyBudget(campaignId: string, dailyBudgetMajor: number): Promise<string> {
  const cents = Math.round(dailyBudgetMajor * 100);
  if (!Number.isFinite(cents) || cents <= 0) throw new Error("Daily budget must be a positive amount.");
  const body = new URLSearchParams({ daily_budget: String(cents), access_token: token() });
  const res = await fetch(`${GRAPH}/${campaignId}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });
  const json = (await res.json()) as { success?: boolean; error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(`Meta budget write failed: ${json.error?.message ?? res.status}`);
  return campaignId;
}

/**
 * Pause or re-enable a campaign (AutoProtect). Requires ads_management. Returns the id on
 * success; throws with the Graph message. `status` is "PAUSED" or "ACTIVE".
 */
export async function setMetaCampaignStatus(campaignId: string, status: "PAUSED" | "ACTIVE"): Promise<string> {
  const body = new URLSearchParams({ status, access_token: token() });
  const res = await fetch(`${GRAPH}/${campaignId}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });
  const json = (await res.json()) as { success?: boolean; error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(`Meta status write failed: ${json.error?.message ?? res.status}`);
  return campaignId;
}
