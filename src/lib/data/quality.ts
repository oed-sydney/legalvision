import "server-only";
import { keywords } from "./mock";
import type { Keyword } from "../domain/types";
import type { FilterState } from "../filters/schema";

export function scopedKeywords(f: FilterState): Keyword[] {
  return keywords().filter((k) => {
    if (f.country !== "all" && k.market !== f.country) return false;
    if (f.account !== "all" && k.accountId !== f.account) return false;
    if (f.campaign !== "all" && k.campaignId !== f.campaign) return false;
    return true;
  });
}

export interface QsSummary {
  weightedQs: number | null;
  weightedQs30dAgo: number | null;
  coverage: number; // share of impressions from QS-bearing keywords
  noQsCount: number;
  totalKeywords: number;
  buckets: { label: string; imprShare: number; count: number }[];
  distribution: { qs: number; count: number; impressions: number }[];
}

export function qsSummary(kws: Keyword[]): QsSummary {
  const withQs = kws.filter((k) => k.qualityScore !== null);
  const totalImpr = kws.reduce((s, k) => s + k.impressions, 0);
  const qsImpr = withQs.reduce((s, k) => s + k.impressions, 0);

  const weighted = (sel: (k: Keyword) => number | null) => {
    let num = 0;
    let den = 0;
    for (const k of kws) {
      const v = sel(k);
      if (v === null) continue;
      num += v * k.impressions;
      den += k.impressions;
    }
    return den ? num / den : null;
  };

  const bucketShare = (lo: number, hi: number) => {
    const impr = withQs
      .filter((k) => k.qualityScore! >= lo && k.qualityScore! <= hi)
      .reduce((s, k) => s + k.impressions, 0);
    const count = withQs.filter((k) => k.qualityScore! >= lo && k.qualityScore! <= hi).length;
    return { imprShare: qsImpr ? impr / qsImpr : 0, count };
  };

  const distribution = Array.from({ length: 10 }, (_, i) => {
    const qs = i + 1;
    const rows = withQs.filter((k) => k.qualityScore === qs);
    return { qs, count: rows.length, impressions: rows.reduce((s, k) => s + k.impressions, 0) };
  });

  return {
    weightedQs: weighted((k) => k.qualityScore),
    weightedQs30dAgo: weighted((k) => k.qs30dAgo),
    coverage: totalImpr ? qsImpr / totalImpr : 0,
    noQsCount: kws.length - withQs.length,
    totalKeywords: kws.length,
    buckets: [
      { label: "QS 1–3", ...bucketShare(1, 3) },
      { label: "QS 4–6", ...bucketShare(4, 6) },
      { label: "QS 7–10", ...bucketShare(7, 10) },
    ],
    distribution,
  };
}

export function qsDecliners(kws: Keyword[]): Keyword[] {
  return kws
    .filter((k) => k.qualityScore !== null && k.qs30dAgo !== null && k.qs30dAgo - k.qualityScore >= 1)
    .sort((a, b) => b.spend - a.spend);
}

export function qsHighSpendLow(kws: Keyword[]): Keyword[] {
  return kws
    .filter((k) => k.qualityScore !== null && k.qualityScore <= 5)
    .sort((a, b) => b.spend - a.spend);
}

export function qsNoScoreWithSpend(kws: Keyword[]): Keyword[] {
  return kws.filter((k) => k.qualityScore === null && k.spend > 0).sort((a, b) => b.spend - a.spend);
}

/** "Primary drag" = worst component of a keyword. */
export function primaryDrag(k: Keyword): string | null {
  const order = { below: 0, average: 1, above: 2, null: 3 } as const;
  const comps: [string, Keyword["expectedCtr"]][] = [
    ["Expected CTR", k.expectedCtr],
    ["Ad relevance", k.adRelevance],
    ["Landing page exp.", k.lpExperience],
  ];
  let worst: string | null = null;
  let worstRank = 3;
  for (const [name, val] of comps) {
    const rank = order[(val ?? "null") as keyof typeof order];
    if (rank < worstRank) {
      worstRank = rank;
      worst = name;
    }
  }
  return worstRank <= 1 ? worst : null;
}
