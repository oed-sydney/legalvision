import type { CurrencyCode } from "../../domain/types";
import type { CampaignRow } from "@/components/tables/CampaignsTable";
import { fxRate } from "../../currency/fx";
import { META_ACCOUNTS, META_CAMPAIGNS, type MetaCurrency } from "./snapshot";

/**
 * Real-Meta read layer for the Social tab. Drives the Snapshot tiles and Campaigns table
 * directly from the real 30d pull (see snapshot.ts) — independent of the daily warehouse,
 * so reach/frequency stay account-level (non-additive) and the two lead types stay split.
 *
 * The data window is a rolling last-30-days snapshot; label it as such.
 */

export const META_WINDOW_LABEL = "Last 30 days";
export const META_PULLED_AT = "2026-08-18";

function toAud(v: number, cur: MetaCurrency): number {
  return cur === "AUD" ? v : v * fxRate("GBP", "AUD").rate;
}

export interface MetaSummary {
  currency: CurrencyCode;
  estimated: boolean; // true when markets with different currencies were combined via FX
  markets: number;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  linkClicks: number;
  lpv: number;
  ctr: number; // ratio (link clicks / impressions)
  cpc: number; // cost per link click
  cpm: number;
  smeLeads: number;
  smeCpl: number | null;
  bofuTrials: number;
  bofuCpl: number | null;
}

/** Aggregate the real Meta account snapshot for the current market/account filter. */
export function metaSummary(country: string, account: string): MetaSummary {
  const accts = META_ACCOUNTS.filter(
    (a) => (country === "all" || a.market === country) && (account === "all" || a.acct === account)
  );
  const combined = accts.length > 1;
  const currency: CurrencyCode = combined ? "AUD" : accts[0]?.currency ?? "AUD";
  const conv = (v: number, cur: MetaCurrency) => (combined ? toAud(v, cur) : v);

  let spend = 0, smeSpend = 0, bofuSpend = 0;
  let impressions = 0, reach = 0, linkClicks = 0, lpv = 0, smeLeads = 0, bofuTrials = 0;
  for (const a of accts) {
    spend += conv(a.spend, a.currency);
    smeSpend += conv(a.smeSpend, a.currency);
    bofuSpend += conv(a.bofuSpend, a.currency);
    impressions += a.impressions;
    reach += a.reach;
    linkClicks += a.linkClicks;
    lpv += a.lpv;
    smeLeads += a.smeLeads;
    bofuTrials += a.bofuTrials;
  }

  return {
    currency,
    estimated: combined,
    markets: accts.length,
    spend,
    impressions,
    reach,
    frequency: reach ? impressions / reach : 0,
    linkClicks,
    lpv,
    ctr: impressions ? linkClicks / impressions : 0,
    cpc: linkClicks ? spend / linkClicks : 0,
    cpm: impressions ? (spend / impressions) * 1000 : 0,
    smeLeads,
    smeCpl: smeLeads ? smeSpend / smeLeads : null,
    bofuTrials,
    bofuCpl: bofuTrials ? bofuSpend / bofuTrials : null,
  };
}

/** Real Meta campaigns → CampaignsTable rows for the current filter (each with its own numbers). */
export function metaCampaignRows(country: string, account: string): CampaignRow[] {
  return META_CAMPAIGNS.filter(
    (c) => (country === "all" || c.market === country) && (account === "all" || c.acct === account)
  )
    .sort((a, b) => b.spend - a.spend)
    .map((c) => {
      // The campaign's primary result: BOFU → trial signups, SME → form leads, Traffic → none.
      const result = c.funnel === "BOFU" ? c.trials : c.leads;
      return {
        campaignId: c.id,
        campaignName: c.name,
        campaignType: c.funnel,
        market: c.market,
        channel: "meta_ads",
        currency: c.currency as CurrencyCode,
        estimated: false,
        spend: c.spend,
        impressions: c.impressions,
        comparableClicks: c.linkClicks,
        leads: result,
        liveLeads: null,
        cpll: null,
        cvr: c.linkClicks ? result / c.linkClicks : null,
        ctr: c.impressions ? c.linkClicks / c.impressions : null,
        cpc: c.linkClicks ? c.spend / c.linkClicks : null,
      };
    });
}
