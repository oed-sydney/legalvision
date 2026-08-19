import type { CampaignDaily } from "../mock";
import type { CampaignType } from "../../domain/types";
import {
  GOOGLE_CAMPAIGNS,
  GOOGLE_CAMPAIGN_LIVE_LEADS,
  GOOGLE_DAILY,
  GOOGLE_LIVE_LEADS_DAILY,
  META_ACCOUNTS,
  META_CAMPAIGNS,
  SNAPSHOT_FROM,
  SNAPSHOT_TO,
  type AcctCode,
} from "./snapshot";
import { dateRangeList } from "../mock";

/**
 * Assemble warehouse CampaignDaily rows from Google + Meta inputs. Shared by the baked
 * static snapshot AND live Windsor pulls, so real-time refresh reuses the exact logic.
 * Google: real campaign 30d totals distributed across the account's real daily curve.
 * Live Leads use the account's real daily live-lead curve. Per §9.1, platform "Leads"
 * ships equal to Live Leads until the admin maps more lead actions; Conversions stays distinct.
 * Meta: real account 30d totals distributed across days + representative campaigns.
 */

export const MARKET: Record<AcctCode, "AU" | "NZ" | "UK"> = {
  "au-google": "AU", "nz-google": "NZ", "uk-google": "UK", "au-meta": "AU", "uk-meta": "UK",
};
export const CURRENCY: Record<AcctCode, "AUD" | "NZD" | "GBP"> = {
  "au-google": "AUD", "nz-google": "NZD", "uk-google": "GBP", "au-meta": "AUD", "uk-meta": "GBP",
};

/** Windsor returns account_name; map it to our internal account id. */
export const NAME_TO_ACCT: Record<string, AcctCode> = {
  LegalVision: "au-google",
  "LegalVision NZ": "nz-google",
  "LegalVision UK": "uk-google",
};

export interface GDaily { acct: AcctCode; date: string; spend: number; impressions: number; clicks: number; conversions: number }
export interface GLLDaily { acct: AcctCode; date: string; liveLeads: number }
export interface GCamp { acct: AcctCode; name: string; spend: number; impressions: number; clicks: number; conversions: number }
export interface GCampLL { acct: AcctCode; name: string; liveLeads: number }
export interface MAcct { acct: AcctCode; spend: number; impressions: number; clicks: number; linkClicks: number; lpv: number; leads: number }
/** Real per-campaign Meta metrics (30d) — carries its own numbers, no account-total splitting. */
export interface MCamp {
  acct: AcctCode; id: string; name: string; objective: string;
  spend: number; impressions: number; clicks: number; linkClicks: number; lpv: number; leads: number;
}

export interface AssembleInput {
  days: string[];
  googleDaily: GDaily[];
  googleLiveLeadsDaily: GLLDaily[];
  googleCampaigns: GCamp[];
  googleCampaignLiveLeads: GCampLL[];
  metaAccounts: MAcct[];
  metaCampaigns: MCamp[];
}

export function campaignType(name: string): CampaignType {
  return name.includes("Demand Gen") ? "Demand Gen" : "Search";
}
export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function assembleCampaignDaily(input: AssembleInput): CampaignDaily[] {
  const rows: CampaignDaily[] = [];
  const gAccts: AcctCode[] = ["au-google", "nz-google", "uk-google"];

  for (const acct of gAccts) {
    const daily = input.googleDaily.filter((r) => r.acct === acct);
    const totalSpend = daily.reduce((s, r) => s + r.spend, 0) || 1;
    const spendFrac = new Map<string, number>();
    for (const r of daily) spendFrac.set(r.date, r.spend / totalSpend);

    const ll = input.googleLiveLeadsDaily.filter((r) => r.acct === acct);
    const totalLL = ll.reduce((s, r) => s + r.liveLeads, 0) || 1;
    const llFrac = new Map<string, number>();
    for (const r of ll) llFrac.set(r.date, r.liveLeads / totalLL);

    const campaigns = input.googleCampaigns.filter((r) => r.acct === acct);
    const campLL = new Map<string, number>();
    for (const r of input.googleCampaignLiveLeads) if (r.acct === acct) campLL.set(r.name, r.liveLeads);

    for (const c of campaigns) {
      const type = campaignType(c.name);
      const cLL = campLL.get(c.name) ?? 0;
      for (const date of input.days) {
        const fs = spendFrac.get(date) ?? 0;
        if (fs === 0) continue;
        const fl = llFrac.get(date) ?? fs;
        const liveLeads = Math.round(cLL * fl * 10) / 10;
        rows.push({
          date,
          accountId: acct,
          campaignId: `${acct}-${slug(c.name)}`,
          campaignName: c.name,
          campaignType: type,
          market: MARKET[acct],
          channel: "google_ads",
          currency: CURRENCY[acct],
          spend: round2(c.spend * fs),
          impressions: Math.round(c.impressions * fs),
          clicks: Math.round(c.clicks * fs),
          linkClicks: 0,
          landingPageViews: 0,
          conversions: round2(c.conversions * fs),
          conversionValue: 0,
          leads: liveLeads,
          liveLeads,
          source: "windsor",
        });
      }
    }
  }

  // Meta totals are a 30-day snapshot → map them to the LAST 30 days of the window only
  // (spreading a 30-day figure across a 90-day window would undercount recent spend).
  const metaDays = input.days.slice(-30);
  const wshape = metaDays.map((d) => {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    return wd === 0 || wd === 6 ? 0.6 : 1;
  });
  const wsum = wshape.reduce((a, b) => a + b, 0) || 1;

  // Each Meta campaign carries its OWN real 30d totals, distributed across the last-30
  // days by the weekday shape. No account-total splitting → every campaign has its own
  // distinct numbers (the previous fake-weight approach made non-first campaigns identical).
  for (const c of input.metaCampaigns) {
    metaDays.forEach((date, di) => {
      const df = wshape[di] / wsum;
      rows.push({
        date,
        accountId: c.acct,
        campaignId: `${c.acct}-${slug(c.name)}`,
        campaignName: c.name,
        campaignType: (c.objective as CampaignType) ?? "Leads",
        market: MARKET[c.acct],
        channel: "meta_ads",
        currency: CURRENCY[c.acct],
        spend: round2(c.spend * df),
        impressions: Math.round(c.impressions * df),
        clicks: Math.round(c.clicks * df),
        linkClicks: Math.round(c.linkClicks * df),
        landingPageViews: Math.round(c.lpv * df),
        conversions: 0,
        conversionValue: 0,
        leads: Math.round(c.leads * df),
        liveLeads: null,
        source: "windsor",
      });
    });
  }

  return rows;
}

/** Meta inputs from the baked snapshot (Meta live needs a token; snapshot used meanwhile). */
export function metaSnapshotInputs(): { metaAccounts: MAcct[]; metaCampaigns: MCamp[] } {
  return {
    metaAccounts: META_ACCOUNTS.map((a) => ({
      acct: a.acct, spend: a.spend, impressions: a.impressions, clicks: a.clicks,
      linkClicks: a.linkClicks, lpv: a.lpv, leads: a.smeLeads + a.bofuTrials,
    })),
    // Per-campaign "leads" = its primary result (SME form leads OR BOFU trial conversions).
    metaCampaigns: META_CAMPAIGNS.map((c) => ({
      acct: c.acct, id: c.id, name: c.name, objective: c.objective,
      spend: c.spend, impressions: c.impressions, clicks: c.clicks,
      linkClicks: c.linkClicks, lpv: c.lpv, leads: c.leads + c.trials,
    })),
  };
}

/** Baked static snapshot → CampaignDaily (used when no live pull has run). */
export function buildRealCampaignDaily(): CampaignDaily[] {
  const meta = metaSnapshotInputs();
  return assembleCampaignDaily({
    days: dateRangeList(SNAPSHOT_FROM, SNAPSHOT_TO),
    googleDaily: GOOGLE_DAILY.map((r) => ({ acct: r[0], date: r[1], spend: r[2], impressions: r[3], clicks: r[4], conversions: r[5] })),
    googleLiveLeadsDaily: GOOGLE_LIVE_LEADS_DAILY.map((r) => ({ acct: r[0], date: r[1], liveLeads: r[2] })),
    googleCampaigns: GOOGLE_CAMPAIGNS.map((r) => ({ acct: r[0], name: r[1], spend: r[2], impressions: r[3], clicks: r[4], conversions: r[5] })),
    googleCampaignLiveLeads: GOOGLE_CAMPAIGN_LIVE_LEADS.map((r) => ({ acct: r[0], name: r[1], liveLeads: r[2] })),
    ...meta,
  });
}
