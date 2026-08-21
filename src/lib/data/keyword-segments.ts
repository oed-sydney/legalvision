import type { CurrencyCode, Keyword } from "../domain/types";
import { tcpaTargets } from "./real/tcpa";
import { AD_ACCOUNTS } from "../domain/accounts";

/** Google Ads customer id (digits only) per internal account id, for deep links. */
const GOOGLE_CID: Record<string, string> = Object.fromEntries(
  AD_ACCOUNTS.filter((a) => a.channel === "google_ads").map((a) => [a.id, a.platformAccountId.replace(/\D/g, "")])
);

/**
 * Obfuscated customer id (`ocid`) per Google account — this is how the Google Ads UI selects
 * an account, so linking with it opens straight into the right account (no sign-in / account
 * chooser). Supplied by the client from each account's URL; not derivable from the customer id.
 */
const GOOGLE_OCID: Record<string, string> = {
  "au-google": "80099916",
  "uk-google": "844818473",
  "nz-google": "624968089",
};

/** Deep link to the account's keyword table in Google Ads (opens with that account selected). */
function googleAdsKeywordsUrl(accountId: string): string | null {
  const ocid = GOOGLE_OCID[accountId];
  const cid = GOOGLE_CID[accountId];
  if (!ocid) return cid ? `https://ads.google.com/aw/keywords?__c=${cid}` : null;
  const c = cid ? `&__c=${cid}` : "";
  return `https://ads.google.com/aw/keywords?ocid=${ocid}${c}`;
}

/**
 * Keyword performance segments for the Quality Score → Keywords sub-tabs.
 * All thresholds are evaluated over the current 30-day keyword pull, in each keyword's
 * native currency. "Conversions" uses platform conversions (the same basis the Target CPA
 * review uses: actual CPA = spend ÷ conversions).
 */

export const POOR_SPEND_MIN = 300; // native currency
export const HIGH_CPC_MULTIPLE = 1.2; // 20% above the account average CPC
export const LOW_IS_MIN_CONV = 10; // strictly more than 10 conversions
export const LOW_IS_CPA_TOLERANCE = 0.1; // cost/conv at or within +10% of target CPA

export interface SegmentRow {
  id: string;
  text: string;
  matchType: string;
  campaignName: string;
  adGroupName: string;
  market: string;
  currency: CurrencyCode;
  qualityScore: number | null;
  spend: number;
  clicks: number;
  cpc: number | null;
  conversions: number;
  liveLeads: number;
  costPerConv: number | null;
  targetCpa: number | null;
  accountAvgCpc: number;
  vsAvgCpcPct: number | null; // (cpc − acctAvg) / acctAvg
  vsTargetPct: number | null; // (costPerConv − targetCpa) / targetCpa
  googleAdsUrl: string | null; // deep link to the account's keywords in Google Ads
}

export interface KeywordSegments {
  poor: SegmentRow[];
  highCpc: SegmentRow[];
  lowIs: SegmentRow[];
}

/** Account-level average CPC (Σ spend ÷ Σ clicks) across the scoped keywords. */
function accountAvgCpcMap(kws: Keyword[]): Map<string, number> {
  const agg = new Map<string, { spend: number; clicks: number }>();
  for (const k of kws) {
    const a = agg.get(k.accountId) ?? { spend: 0, clicks: 0 };
    a.spend += k.spend;
    a.clicks += k.clicks;
    agg.set(k.accountId, a);
  }
  const out = new Map<string, number>();
  for (const [id, v] of agg) out.set(id, v.clicks > 0 ? v.spend / v.clicks : 0);
  return out;
}

export function keywordSegments(kws: Keyword[]): KeywordSegments {
  const avgCpc = accountAvgCpcMap(kws);
  const targets = tcpaTargets();

  const rows: SegmentRow[] = kws.map((k) => {
    const cpc = k.clicks > 0 ? k.spend / k.clicks : null;
    const costPerConv = k.conversions > 0 ? k.spend / k.conversions : null;
    const acctAvg = avgCpc.get(k.accountId) ?? 0;
    const target = targets.get(`${k.market}|${k.campaignName}`)?.targetCpa ?? null;
    return {
      id: k.id,
      text: k.text,
      matchType: k.matchType,
      campaignName: k.campaignName,
      adGroupName: k.adGroupName,
      market: k.market,
      currency: k.currency,
      qualityScore: k.qualityScore,
      spend: k.spend,
      clicks: k.clicks,
      cpc,
      conversions: k.conversions,
      liveLeads: k.liveLeads,
      costPerConv,
      targetCpa: target,
      accountAvgCpc: acctAvg,
      vsAvgCpcPct: cpc != null && acctAvg > 0 ? (cpc - acctAvg) / acctAvg : null,
      vsTargetPct: costPerConv != null && target ? (costPerConv - target) / target : null,
      googleAdsUrl: googleAdsKeywordsUrl(k.accountId),
    };
  });

  // 1) Poor performers: material spend, nothing converted (neither platform conv nor live lead).
  const poor = rows
    .filter((r) => r.spend > POOR_SPEND_MIN && r.conversions === 0 && r.liveLeads === 0)
    .sort((a, b) => b.spend - a.spend);

  // 2) High CPC: CPC more than 20% above the keyword's own account average.
  const highCpc = rows
    .filter((r) => r.cpc != null && r.accountAvgCpc > 0 && r.cpc > r.accountAvgCpc * HIGH_CPC_MULTIPLE)
    .sort((a, b) => (b.cpc ?? 0) - (a.cpc ?? 0));

  // 3) Low IS candidates: proven, efficient keywords worth scaling — >10 conversions and
  //    cost/conv at or within 10% of the campaign's target CPA (needs a target set).
  const lowIs = rows
    .filter(
      (r) =>
        r.conversions > LOW_IS_MIN_CONV &&
        r.targetCpa != null &&
        r.costPerConv != null &&
        r.costPerConv <= r.targetCpa * (1 + LOW_IS_CPA_TOLERANCE)
    )
    .sort((a, b) => b.conversions - a.conversions);

  return { poor, highCpc, lowIs };
}
