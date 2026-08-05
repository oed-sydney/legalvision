import { AD_ACCOUNTS } from "../domain/accounts";
import { hashSeed, mulberry32 } from "../utils";
import type {
  AdAccount,
  Alert,
  AppUser,
  Budget,
  Campaign,
  CampaignType,
  ComponentRating,
  ConversionAction,
  Creative,
  DataSource,
  Keyword,
  SearchTerm,
  SyncRun,
  Target,
} from "../domain/types";

/**
 * Deterministic mock warehouse (source='mock'). This is the ONLY place mock data is
 * born; every row is tagged source:'mock' so the prod-path view layer can exclude it.
 * Real adapters replace this module's output without touching reporting code.
 */

/**
 * Static anchor used ONLY to synthesize the mock warehouse below (frozen is fine —
 * mock rows are generated once at module load). The REAL reporting path must NOT use
 * these frozen constants; it uses nowDate()/latestCompleteDay() so "today" advances
 * on a long-running server or a warm serverless instance.
 */
export const APP_NOW = new Date();
/** Latest complete synced day (yesterday) — platforms rarely have reliable "today" rows. */
export const LATEST_COMPLETE_DAY = new Date(APP_NOW.getTime() - 86_400_000)
  .toISOString()
  .slice(0, 10);

/** Current instant, recomputed per call (real reporting path). */
export function nowDate(): Date {
  return new Date();
}
/** Latest complete day (yesterday, UTC), recomputed per call. */
export function latestCompleteDay(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

const HISTORY_DAYS = 120;

// ---- date helpers -----------------------------------------------------------
function isoAddDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function weekdayUTC(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 Sun .. 6 Sat
}
export function dateRangeList(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = isoAddDays(cur, 1);
  }
  return out;
}

const DATES = dateRangeList(isoAddDays(LATEST_COMPLETE_DAY, -(HISTORY_DAYS - 1)), LATEST_COMPLETE_DAY);

const PRACTICE_AREAS = [
  "Business Structuring",
  "Employment Law",
  "Trade Marks",
  "Commercial Contracts",
  "Franchising",
  "Leasing & Property",
  "Startups & Capital Raising",
  "Disputes & Litigation",
];

// Per-account tuning: base daily spend (native) + live-lead economics.
const ACCOUNT_TUNING: Record<
  string,
  { baseSpend: number; cpll: number; campaigns: number }
> = {
  "au-google": { baseSpend: 1050, cpll: 165, campaigns: 6 },
  "nz-google": { baseSpend: 430, cpll: 190, campaigns: 4 },
  "uk-google": { baseSpend: 820, cpll: 145, campaigns: 5 },
  "au-meta": { baseSpend: 610, cpll: 240, campaigns: 4 },
  "uk-meta": { baseSpend: 500, cpll: 215, campaigns: 4 },
  "nz-meta": { baseSpend: 300, cpll: 260, campaigns: 3 },
};

const GOOGLE_TYPES: CampaignType[] = ["Search", "Search", "Performance Max", "Display", "Video", "Demand Gen"];
const META_OBJECTIVES: CampaignType[] = ["Leads", "Leads", "Traffic", "Awareness"];

export interface CampaignDaily {
  date: string;
  accountId: string;
  campaignId: string;
  campaignName: string;
  campaignType: CampaignType;
  market: AdAccount["market"];
  channel: AdAccount["channel"];
  currency: AdAccount["currency"];
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  landingPageViews: number;
  conversions: number;
  conversionValue: number;
  leads: number;
  liveLeads: number | null;
  source: DataSource;
}

interface CampaignMeta {
  id: string;
  name: string;
  type: CampaignType;
  account: AdAccount;
  weight: number; // share of account spend
  status: "enabled" | "paused";
}

function buildCampaignMetas(): CampaignMeta[] {
  const metas: CampaignMeta[] = [];
  for (const acct of AD_ACCOUNTS) {
    const tune = ACCOUNT_TUNING[acct.id];
    const isGoogle = acct.channel === "google_ads";
    const rnd = mulberry32(hashSeed(acct.id + "campaigns"));
    const weights: number[] = [];
    for (let i = 0; i < tune.campaigns; i++) weights.push(0.4 + rnd());
    const wsum = weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < tune.campaigns; i++) {
      const area = PRACTICE_AREAS[i % PRACTICE_AREAS.length];
      const type = isGoogle ? GOOGLE_TYPES[i % GOOGLE_TYPES.length] : META_OBJECTIVES[i % META_OBJECTIVES.length];
      metas.push({
        id: `${acct.id}-c${i + 1}`,
        name: `${acct.market} · ${area} — ${type}`,
        type,
        account: acct,
        weight: weights[i] / wsum,
        status: i === tune.campaigns - 1 && rnd() > 0.6 ? "paused" : "enabled",
      });
    }
  }
  return metas;
}

const CAMPAIGN_METAS = buildCampaignMetas();

function buildCampaignDaily(): CampaignDaily[] {
  const rows: CampaignDaily[] = [];
  for (const cm of CAMPAIGN_METAS) {
    const acct = cm.account;
    const tune = ACCOUNT_TUNING[acct.id];
    const isGoogle = acct.channel === "google_ads";
    const isPMax = cm.type === "Performance Max";
    for (let di = 0; di < DATES.length; di++) {
      const date = DATES[di];
      const rnd = mulberry32(hashSeed(cm.id + date));
      const wd = weekdayUTC(date);
      const weekendDamp = wd === 0 || wd === 6 ? 0.72 : 1;
      // gentle upward trend + weekly seasonality + noise
      const trend = 0.85 + (di / DATES.length) * 0.4;
      const noise = 0.8 + rnd() * 0.4;
      if (cm.status === "paused" && di > DATES.length - 20) continue; // recently paused → no recent rows
      const spend = tune.baseSpend * cm.weight * weekendDamp * trend * noise;
      const cpc = (isGoogle ? 3.4 : 1.9) * (0.85 + rnd() * 0.3);
      const clicksAll = Math.max(1, Math.round(spend / cpc));
      const linkClicks = isGoogle ? 0 : Math.round(clicksAll * (0.82 + rnd() * 0.1));
      const ctr = 0.03 + rnd() * 0.03;
      const impressions = Math.round((isGoogle ? clicksAll : linkClicks) / ctr);
      const landingPageViews = isGoogle ? 0 : Math.round(linkClicks * (0.7 + rnd() * 0.2));
      // live leads: driven by target CPLL with noise; Meta live leads pending (null)
      const cpllEff = tune.cpll * (0.8 + rnd() * 0.5);
      const liveLeadsRaw = spend / cpllEff;
      const liveLeads = isGoogle ? Math.max(0, Math.round(liveLeadsRaw)) : null;
      // platform leads: a superset of live leads (some leads aren't "live")
      const leads = isGoogle
        ? Math.max(liveLeads ?? 0, Math.round((liveLeads ?? 0) * (1.25 + rnd() * 0.5)))
        : Math.max(0, Math.round((isGoogle ? 0 : linkClicks) * (0.02 + rnd() * 0.02)));
      // Google total conversions ≥ leads (includes non-lead actions)
      const conversions = isGoogle ? Math.round(leads * (1.4 + rnd() * 0.6)) : 0;
      const conversionValue = conversions * (120 + rnd() * 80);
      rows.push({
        date,
        accountId: acct.id,
        campaignId: cm.id,
        campaignName: cm.name,
        campaignType: cm.type,
        market: acct.market,
        channel: acct.channel,
        currency: acct.currency,
        spend: round2(spend),
        impressions,
        clicks: isGoogle ? clicksAll : clicksAll,
        linkClicks,
        landingPageViews,
        conversions,
        conversionValue: round2(conversionValue),
        leads,
        liveLeads: isPMax ? (isGoogle ? Math.round((liveLeads ?? 0) * 0.9) : null) : liveLeads,
        source: "mock",
      });
    }
  }
  return rows;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

let _campaignDaily: CampaignDaily[] | null = null;
export function campaignDaily(): CampaignDaily[] {
  if (!_campaignDaily) _campaignDaily = buildCampaignDaily();
  return _campaignDaily;
}

export function campaignMetas() {
  return CAMPAIGN_METAS;
}

// ---- Conversion actions (incl. the mapped "Live Leads" action, A1) ----------
export function conversionActions(): ConversionAction[] {
  const out: ConversionAction[] = [];
  const google = AD_ACCOUNTS.filter((a) => a.channel === "google_ads");
  for (const acct of google) {
    const rows = campaignDaily().filter((r) => r.accountId === acct.id);
    const liveLeads = rows.reduce((a, r) => a + (r.liveLeads ?? 0), 0);
    const leads = rows.reduce((a, r) => a + r.leads, 0);
    const conv = rows.reduce((a, r) => a + r.conversions, 0);
    const val = rows.reduce((a, r) => a + r.conversionValue, 0);
    out.push(
      {
        id: `${acct.id}-ca-live`,
        accountId: acct.id,
        market: acct.market,
        name: "Live Leads",
        category: "lead",
        logicalMetric: "live_leads",
        conversions: liveLeads,
        conversionValue: round2(val * 0.5),
        source: "mock",
      },
      {
        id: `${acct.id}-ca-form`,
        accountId: acct.id,
        market: acct.market,
        name: "Contact Form Submission",
        category: "lead",
        logicalMetric: "leads",
        conversions: Math.max(0, leads - liveLeads),
        conversionValue: round2(val * 0.2),
        source: "mock",
      },
      {
        id: `${acct.id}-ca-call`,
        accountId: acct.id,
        market: acct.market,
        name: "Phone Call (60s+)",
        category: "lead",
        logicalMetric: "leads",
        conversions: Math.round(leads * 0.4),
        conversionValue: round2(val * 0.15),
        source: "mock",
      },
      {
        id: `${acct.id}-ca-guide`,
        accountId: acct.id,
        market: acct.market,
        name: "Guide Download",
        category: "other",
        logicalMetric: "other",
        conversions: Math.max(0, conv - leads),
        conversionValue: round2(val * 0.15),
        source: "mock",
      }
    );
  }
  return out;
}

// ---- Keywords + Quality Score ----------------------------------------------
const COMPONENTS: ComponentRating[] = ["below", "average", "above"];
function pickComponent(rnd: () => number, bias: number): ComponentRating {
  const r = rnd() + bias;
  if (r < 0.33) return "below";
  if (r < 0.7) return "average";
  return "above";
}

export function keywords(): Keyword[] {
  const out: Keyword[] = [];
  const google = AD_ACCOUNTS.filter((a) => a.channel === "google_ads");
  for (const acct of google) {
    const campaigns = CAMPAIGN_METAS.filter(
      (c) => c.account.id === acct.id && c.type === "Search"
    );
    let idx = 0;
    for (const cm of campaigns) {
      const nKw = 14 + (hashSeed(cm.id) % 8);
      for (let i = 0; i < nKw; i++) {
        const rnd = mulberry32(hashSeed(cm.id + "kw" + i));
        const area = cm.name.split("·")[1]?.split("—")[0]?.trim() ?? "legal";
        const text = `${area.toLowerCase()} ${["lawyer", "solicitor", "advice", "cost", "near me", "firm"][i % 6]}`;
        const hasQs = rnd() > 0.12;
        const qs = hasQs ? 1 + Math.floor(rnd() * 10) : null;
        const impressions = Math.round(200 + rnd() * 6000);
        const clicks = Math.round(impressions * (0.02 + rnd() * 0.05));
        const cpc = 3 + rnd() * 4;
        const spend = round2(clicks * cpc);
        const liveLeads = Math.max(0, Math.round(clicks * (0.03 + rnd() * 0.04)));
        const qs30 = qs === null ? null : Math.max(1, Math.min(10, qs + (rnd() > 0.6 ? -1 : rnd() > 0.5 ? 1 : 0)));
        out.push({
          id: `${cm.id}-kw${i}`,
          accountId: acct.id,
          market: acct.market,
          campaignId: cm.id,
          campaignName: cm.name,
          adGroupName: `${area} — Ad group ${1 + (i % 3)}`,
          text,
          matchType: (["exact", "phrase", "broad"] as const)[i % 3],
          status: rnd() > 0.9 ? "paused" : "enabled",
          qualityScore: qs,
          expectedCtr: qs === null ? null : pickComponent(rnd, qs / 20 - 0.25),
          adRelevance: qs === null ? null : pickComponent(rnd, qs / 20 - 0.2),
          lpExperience: qs === null ? null : pickComponent(rnd, qs / 20 - 0.35),
          impressions,
          clicks,
          spend,
          conversions: Math.round(liveLeads * 1.5),
          liveLeads,
          currency: acct.currency,
          qs30dAgo: qs30,
          source: "mock",
        });
        idx++;
      }
    }
  }
  return out;
}

export function searchTerms(): SearchTerm[] {
  const out: SearchTerm[] = [];
  const google = AD_ACCOUNTS.filter((a) => a.channel === "google_ads");
  const prefixes = ["best", "cheap", "how much", "free", "top", "local", "online", "urgent"];
  for (const acct of google) {
    const campaigns = CAMPAIGN_METAS.filter((c) => c.account.id === acct.id && c.type === "Search");
    for (const cm of campaigns) {
      const n = 18 + (hashSeed(cm.id + "st") % 10);
      for (let i = 0; i < n; i++) {
        const rnd = mulberry32(hashSeed(cm.id + "st" + i));
        const area = cm.name.split("·")[1]?.split("—")[0]?.trim() ?? "legal";
        const term = `${prefixes[i % prefixes.length]} ${area.toLowerCase()} ${i % 2 ? "advice" : "lawyer"}`;
        const impressions = Math.round(30 + rnd() * 1500);
        const clicks = Math.round(impressions * (0.02 + rnd() * 0.06));
        const cpc = 3 + rnd() * 4;
        const spend = round2(clicks * cpc);
        const liveLeads = rnd() > 0.7 ? Math.round(rnd() * 3) : 0;
        out.push({
          id: `${cm.id}-st${i}`,
          accountId: acct.id,
          market: acct.market,
          campaignName: cm.name,
          adGroupName: `${area} — Ad group ${1 + (i % 3)}`,
          term,
          matchedKeyword: `${area.toLowerCase()} lawyer`,
          matchType: (["exact", "phrase", "broad"] as const)[i % 3],
          impressions,
          clicks,
          spend,
          conversions: Math.round(liveLeads * 1.4),
          liveLeads,
          currency: acct.currency,
          isAddedKeyword: rnd() > 0.7,
          source: "mock",
        });
      }
    }
  }
  return out;
}

export function creatives(): Creative[] {
  const out: Creative[] = [];
  const meta = AD_ACCOUNTS.filter((a) => a.channel === "meta_ads");
  const formats: Creative["format"][] = ["Image", "Video", "Carousel"];
  for (const acct of meta) {
    const campaigns = CAMPAIGN_METAS.filter((c) => c.account.id === acct.id);
    let n = 0;
    for (const cm of campaigns) {
      const perCampaign = 3 + (hashSeed(cm.id) % 3);
      for (let i = 0; i < perCampaign; i++) {
        const rnd = mulberry32(hashSeed(cm.id + "cr" + i));
        const area = cm.name.split("·")[1]?.split("—")[0]?.trim() ?? "Legal";
        const impressions = Math.round(3000 + rnd() * 40000);
        const reach = Math.round(impressions / (1.4 + rnd() * 2.2));
        const frequency = round2(impressions / reach);
        const linkClicks = Math.round(impressions * (0.008 + rnd() * 0.02));
        const spend = round2(linkClicks * (1.6 + rnd() * 1.5));
        const leads = Math.round(linkClicks * (0.03 + rnd() * 0.03));
        const fatigue = frequency >= 3 && rnd() > 0.5;
        out.push({
          id: `${cm.id}-cr${i}`,
          accountId: acct.id,
          market: acct.market,
          campaignName: cm.name,
          adSetName: `${area} — ${["Broad", "Lookalike 2%", "Interest: SMB", "Retargeting"][i % 4]}`,
          adName: `${area} ${["Hero", "Testimonial", "Explainer", "Offer"][i % 4]} v${1 + (i % 3)}`,
          format: formats[i % formats.length],
          primaryText: `Need help with ${area.toLowerCase()}? LegalVision's expert lawyers make it fast, fixed-fee and stress-free. Book a free consult today.`,
          headline: `${area} — Fixed-Fee Legal Advice`,
          spend,
          impressions,
          reach,
          frequency,
          linkClicks,
          leads,
          liveLeads: null, // pending A2 lead-source join
          currency: acct.currency,
          thumbnailPath: null, // pending Meta creative cache (renders format-icon fallback)
          fatigue,
          source: "mock",
        });
        n++;
      }
    }
  }
  return out;
}

// ---- Budgets (current month, account-local) ---------------------------------
export function budgets(): Budget[] {
  return AD_ACCOUNTS.map((acct) => {
    const tune = ACCOUNT_TUNING[acct.id];
    // ~ base daily spend × 31, rounded to a tidy monthly figure
    const monthly = Math.round((tune.baseSpend * 31) / 500) * 500;
    return {
      id: `${acct.id}-2026-07`,
      scopeType: "account" as const,
      scopeId: acct.id,
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      amount: monthly,
      currency: acct.currency,
      source: "manual" as const,
    };
  });
}

// ---- Targets (a couple seeded; most unset to exercise "No target") ----------
export function targets(): Target[] {
  return [
    { id: "t1", scopeType: "global", scopeId: null, metric: "cpll", value: 200 },
    { id: "t2", scopeType: "market", scopeId: "AU", metric: "cpll", value: 170 },
    { id: "t3", scopeType: "market", scopeId: "UK", metric: "cpll", value: 150 },
    { id: "t4", scopeType: "global", scopeId: null, metric: "min_qs", value: 6 },
    { id: "t5", scopeType: "global", scopeId: null, metric: "max_frequency", value: 3 },
  ];
}

export function budgetFor(accountId: string): Budget | undefined {
  return budgets().find((b) => b.scopeId === accountId);
}
