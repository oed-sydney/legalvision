import type { ComponentRating, CurrencyCode } from "../../domain/types";

/**
 * Quality Score impact tracking — correlates QS-related work (ClickUp change log,
 * LV - PPC list) with actual keyword QS movements (Windsor current vs historical QS).
 * All data below is REAL (pulled 2026-07-14). Live-refreshes via the ClickUp adapter
 * when CLICKUP_API_TOKEN is set; keyword movements refresh with the Windsor QS pull.
 */

export interface QsActionItem {
  name: string;
  status: "complete" | "in_progress";
  date: string; // ISO — completion date, or created date if in progress
  targets: "Expected CTR" | "Ad relevance" | "Landing page experience" | "All components";
  market: "AU" | "UK" | "Global";
  url: string;
}

export interface QsKeywordMovement {
  keyword: string;
  campaign: string;
  market: "AU" | "UK";
  qsBefore: number;
  qsAfter: number;
  /** Which component drove the change. */
  component: "Expected CTR" | "Ad relevance" | "Landing page experience";
  ratingFrom: ComponentRating;
  ratingTo: ComponentRating;
  impressions: number;
  spend: number;
  currency: CurrencyCode;
}

export interface QsBaseline {
  auAvg: number;
  ukAvg: number;
  keywordsAtQs1to4: number;
  auAtQs1to4: number;
  ukAtQs1to4: number;
  auditedAt: string;
}

// ---- Real QS-related change log (LV - PPC list, last 90 days) ----------------
export const QS_ACTION_ITEMS: QsActionItem[] = [
  {
    name: "[AU] Quality Score Analysis (audit → prioritised remediation queue)",
    status: "in_progress",
    date: "2026-05-22",
    targets: "All components",
    market: "AU",
    url: "https://app.clickup.com/t/86d32ycpz",
  },
  {
    name: "[AU] QS Top 10 Recommendations",
    status: "in_progress",
    date: "2026-05-29",
    targets: "All components",
    market: "AU",
    url: "https://app.clickup.com/t/86d35fu3h",
  },
  {
    name: "[AU] Landing Page Recommendations",
    status: "complete",
    date: "2026-06-02",
    targets: "Landing page experience",
    market: "AU",
    url: "https://app.clickup.com/t/86d35ftfa",
  },
  {
    name: "Claude Keyword Performance Review",
    status: "complete",
    date: "2026-05-13",
    targets: "Expected CTR",
    market: "Global",
    url: "https://app.clickup.com/t/86d2jhq07",
  },
  {
    name: "Ad headline review (RSA relevance)",
    status: "complete",
    date: "2026-04-21",
    targets: "Ad relevance",
    market: "AU",
    url: "https://app.clickup.com/t/86d2qzwt5",
  },
];

// ---- Real keyword QS movements (Windsor current vs historical QS) -------------
export const QS_KEYWORD_MOVEMENTS: QsKeywordMovement[] = [
  {
    keyword: "commercial leasing lawyers",
    campaign: "AU-SC - Leasing",
    market: "AU",
    qsBefore: 3,
    qsAfter: 5,
    component: "Landing page experience",
    ratingFrom: "below",
    ratingTo: "average",
    impressions: 1606,
    spend: 3256.77,
    currency: "AUD",
  },
  {
    keyword: "business lawyer near me",
    campaign: "AU-SC - Business",
    market: "AU",
    qsBefore: 5,
    qsAfter: 7,
    component: "Expected CTR",
    ratingFrom: "below",
    ratingTo: "average",
    impressions: 302,
    spend: 1065.93,
    currency: "AUD",
  },
  {
    keyword: "business lawyers Toowoomba",
    campaign: "AU-SC - Local",
    market: "AU",
    qsBefore: 5,
    qsAfter: 7,
    component: "Expected CTR",
    ratingFrom: "below",
    ratingTo: "average",
    impressions: 253,
    spend: 170.62,
    currency: "AUD",
  },
  {
    keyword: "legal advice business",
    campaign: "AU-SC - Business",
    market: "AU",
    qsBefore: 7,
    qsAfter: 8,
    component: "Expected CTR",
    ratingFrom: "average",
    ratingTo: "above",
    impressions: 1331,
    spend: 1917.72,
    currency: "AUD",
  },
  {
    keyword: "company contract lawyer",
    campaign: "AU-SC - Legal Documents",
    market: "AU",
    qsBefore: 4,
    qsAfter: 5,
    component: "Ad relevance",
    ratingFrom: "average",
    ratingTo: "above",
    impressions: 439,
    spend: 866.43,
    currency: "AUD",
  },
];

/** Group movements by QS component (Expected CTR / Ad relevance / Landing page experience). */
export interface ComponentMovement {
  component: "Expected CTR" | "Ad relevance" | "Landing page experience";
  count: number;
  keywords: QsKeywordMovement[];
}

export function componentMovements(movements = QS_KEYWORD_MOVEMENTS): ComponentMovement[] {
  const order: ComponentMovement["component"][] = ["Expected CTR", "Ad relevance", "Landing page experience"];
  return order.map((component) => {
    const keywords = movements.filter((m) => m.component === component);
    return { component, count: keywords.length, keywords };
  });
}

export const QS_BASELINE: QsBaseline = {
  auAvg: 3.91,
  ukAvg: 3.6,
  keywordsAtQs1to4: 892,
  auAtQs1to4: 477,
  ukAtQs1to4: 415,
  auditedAt: "2026-05-22",
};

export interface QsImpact {
  actionItems: QsActionItem[];
  movements: QsKeywordMovement[];
  components: ComponentMovement[];
  baseline: QsBaseline;
  windowDays: 90;
}

/** Market-aware: pass "AU" | "UK" | "NZ" to scope the change log + movements. */
export function qsImpact(market: string = "all"): QsImpact {
  const actionItems =
    market === "all"
      ? QS_ACTION_ITEMS
      : QS_ACTION_ITEMS.filter((a) => a.market === market || a.market === "Global");
  const movements =
    market === "all" ? QS_KEYWORD_MOVEMENTS : QS_KEYWORD_MOVEMENTS.filter((m) => m.market === market);
  return {
    actionItems,
    movements,
    components: componentMovements(movements),
    baseline: QS_BASELINE,
    windowDays: 90,
  };
}
