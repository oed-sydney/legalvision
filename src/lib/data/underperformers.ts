import "server-only";
import type { ComponentRating, CurrencyCode, Keyword, MarketCode } from "../domain/types";
import { termsCache, type AdGroupAd } from "./live-terms";
import { tcpaTargets } from "./real/tcpa";
import { crmLeadsForKeyword } from "./real/crm-leads";

/**
 * "Under-performing keywords" for the Google area: keywords that have spent at least
 * SPEND_MULTIPLE × their campaign's target CPA, surfaced with the three triage dimensions —
 * visibility (top IS + IS lost to rank), the ad-group's top spending search terms, and ad
 * relevance — plus the ad being served and CRM leads attributed to the keyword. Only keywords
 * whose campaign has a target CPA set can qualify (that's the yardstick).
 */

export const SPEND_MULTIPLE = 2;
const LOW_TOP_IS = 0.5; // top-of-page IS below this = barely serving at the top
const HIGH_RANK_LOST = 0.25; // IS lost to rank above this = Ad Rank holding it back

/** ocid per market for Google Ads deep links (supplied by the client). */
const GOOGLE_OCID: Record<string, string> = { AU: "80099916", UK: "844818473", NZ: "624968089" };

export interface UnderPerformerTerm {
  term: string;
  spend: number;
  conversions: number;
  currency: CurrencyCode;
}

export interface UnderPerformerRow {
  id: string;
  market: MarketCode;
  text: string;
  matchType: string;
  campaignName: string;
  adGroupName: string;
  currency: CurrencyCode;
  spend: number;
  conversions: number;
  liveLeads: number;
  actualCpa: number | null;
  targetCpa: number;
  spendVsTarget: number; // spend ÷ target CPA
  qualityScore: number | null;
  adRelevance: ComponentRating;
  impressionShare: number | null;
  topImpressionShare: number | null;
  rankLostImpressionShare: number | null;
  visibilityConcern: boolean;
  ad: { adStrength: string | null; adType: string | null; adId: string } | null;
  adGroupKeywordCount: number;
  topSearchTerms: UnderPerformerTerm[];
  crmLeads: number;
  googleAdsUrl: string | null;
}

export interface UnderPerformers {
  rows: UnderPerformerRow[];
  usingLive: boolean;
  totalSpend: number;
}

export async function underPerformers(country: string, account: string): Promise<UnderPerformers> {
  const cache = await termsCache();
  const targets = tcpaTargets();
  const allKws = cache?.keywords ?? [];
  const terms = cache?.searchTerms ?? [];
  const ads = cache?.ads ?? [];

  const inScope = (k: { market: string; accountId: string }) =>
    (country === "all" || k.market === country) && (account === "all" || k.accountId === account);

  // ad-group → top-spend ad; and how many keywords live in each ad group (exact vs ad-group terms)
  const adByGroup = new Map<string, AdGroupAd>();
  for (const a of ads) adByGroup.set(`${a.accountId}|${a.campaignName}|${a.adGroupName}`, a);
  const kwPerGroup = new Map<string, number>();
  for (const k of allKws) {
    const g = `${k.accountId}|${k.campaignName}|${k.adGroupName}`;
    kwPerGroup.set(g, (kwPerGroup.get(g) ?? 0) + 1);
  }

  const topTermsFor = (k: Keyword): UnderPerformerTerm[] =>
    terms
      .filter((t) => t.accountId === k.accountId && t.campaignName === k.campaignName && t.adGroupName === k.adGroupName)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5)
      .map((t) => ({ term: t.term, spend: t.spend, conversions: t.conversions, currency: t.currency }));

  const rows: UnderPerformerRow[] = [];
  for (const k of allKws) {
    if (!inScope(k)) continue;
    const target = targets.get(`${k.market}|${k.campaignName}`)?.targetCpa;
    if (!target || target <= 0) continue; // no yardstick → can't judge
    if (k.spend < SPEND_MULTIPLE * target) continue; // the gate

    const group = `${k.accountId}|${k.campaignName}|${k.adGroupName}`;
    const topIS = k.searchTopImpressionShare ?? null;
    const rankLost = k.searchRankLostImpressionShare ?? null;
    const ad = adByGroup.get(group);

    rows.push({
      id: k.id,
      market: k.market,
      text: k.text,
      matchType: k.matchType,
      campaignName: k.campaignName,
      adGroupName: k.adGroupName,
      currency: k.currency,
      spend: k.spend,
      conversions: k.conversions,
      liveLeads: k.liveLeads,
      actualCpa: k.conversions > 0 ? k.spend / k.conversions : null,
      targetCpa: target,
      spendVsTarget: k.spend / target,
      qualityScore: k.qualityScore,
      adRelevance: k.adRelevance,
      impressionShare: k.searchImpressionShare ?? null,
      topImpressionShare: topIS,
      rankLostImpressionShare: rankLost,
      visibilityConcern: (topIS != null && topIS < LOW_TOP_IS) || (rankLost != null && rankLost > HIGH_RANK_LOST),
      ad: ad ? { adStrength: ad.adStrength, adType: ad.adType, adId: ad.adId } : null,
      adGroupKeywordCount: kwPerGroup.get(group) ?? 1,
      topSearchTerms: topTermsFor(k),
      crmLeads: crmLeadsForKeyword(k.market, k.text),
      googleAdsUrl: GOOGLE_OCID[k.market] ? `https://ads.google.com/aw/keywords?ocid=${GOOGLE_OCID[k.market]}` : null,
    });
  }

  rows.sort((a, b) => b.spend - a.spend);
  return { rows, usingLive: allKws.length > 0, totalSpend: rows.reduce((s, r) => s + r.spend, 0) };
}
