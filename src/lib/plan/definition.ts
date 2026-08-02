import type { CurrencyCode } from "../domain/types";

/**
 * LegalVision 90-Day Paid Search Strategy (May – July 2026), transcribed from
 * "LV - 90 Day Strategy (May to July 26).pdf". Definitions are code-owned;
 * task statuses + manually-tracked KPI values persist to data/plan-state.json.
 *
 * NOTE on "live leads" here vs the rest of the app: the strategy's baseline
 * (1,785/mo) counts ALL AU conversion actions (Live Leads Enhanced + GA4 web /
 * phone leads + calls) — verified against May 2026 actuals (≈1,622). The plan
 * KPIs therefore use total platform conversions, unlike the dashboard's
 * stricter "Live Leads" metric (the mapped action only).
 */

export const PLAN = {
  name: "LegalVision 90-Day Paid Search Strategy",
  startDate: "2026-05-01",
  endDate: "2026-07-31",
} as const;

export type PlanMarket = "AU" | "UK" | "NZ" | "TESTS";
export type KpiUnit = "count" | "currency" | "percent";
/**
 * Computed from monthly account aggregates (click_share / is_lost_budget are
 * weighted across SEARCH campaigns from daily auction rows), or manual.
 */
export type KpiMetric =
  | "conversions"
  | "cpa"
  | "spend"
  | "ctr"
  | "click_share"
  | "is_lost_budget"
  | "manual";

export interface PlanKpiDef {
  id: string;
  market: PlanMarket;
  name: string;
  description: string;
  unit: KpiUnit;
  currency?: CurrencyCode;
  /** 1 = higher is better, -1 = lower is better. */
  direction: 1 | -1;
  baseline: number;
  target: number;
  metric: KpiMetric;
  /** LV account id ("au-google" …) the computed metric reads from. */
  accountId?: string;
}

export interface PlanTaskDef {
  id: string;
  market: PlanMarket;
  title: string;
  /** Newline-separated bullets. */
  details: string;
}

export const MARKET_SECTIONS: { market: PlanMarket; heading: string }[] = [
  { market: "AU", heading: "Australia — Scale" },
  { market: "UK", heading: "United Kingdom — Efficiency" },
  { market: "NZ", heading: "New Zealand — Stabilise" },
  { market: "TESTS", heading: "Testing plan" },
];

export const PLAN_KPIS: PlanKpiDef[] = [
  // ---- AU: scale ----
  {
    id: "au-lead-volume",
    market: "AU",
    name: "Live lead volume / month",
    description: "All lead conversion actions — the plan baseline's counting basis.",
    unit: "count",
    direction: 1,
    baseline: 1785,
    target: 2053,
    metric: "conversions",
    accountId: "au-google",
  },
  {
    id: "au-cpll",
    market: "AU",
    name: "Cost per live lead (CPLL)",
    description: "Spend ÷ all lead conversions.",
    unit: "currency",
    currency: "AUD",
    direction: -1,
    baseline: 112,
    target: 112,
    metric: "cpa",
    accountId: "au-google",
  },
  {
    id: "au-click-share",
    market: "AU",
    name: "Click share",
    description: "Search campaigns, weighted monthly (clicks ÷ eligible clicks).",
    unit: "percent",
    direction: 1,
    baseline: 30,
    target: 33,
    metric: "click_share",
    accountId: "au-google",
  },
  {
    id: "au-is-lost-budget",
    market: "AU",
    name: "IS lost to budget",
    description: "Search campaigns, weighted by eligible impressions.",
    unit: "percent",
    direction: -1,
    baseline: 23.5,
    target: 18.8,
    metric: "is_lost_budget",
    accountId: "au-google",
  },
  // ---- UK: efficiency ----
  {
    id: "uk-spend",
    market: "UK",
    name: "Monthly spend",
    description: "Cut spend while protecting lead volume.",
    unit: "currency",
    currency: "GBP",
    direction: -1,
    baseline: 80000,
    target: 60000,
    metric: "spend",
    accountId: "uk-google",
  },
  {
    id: "uk-lead-volume",
    market: "UK",
    name: "Lead volume / month",
    description: "Platform-reported conversions; floor is −5% of baseline.",
    unit: "count",
    direction: 1,
    baseline: 1200,
    target: 1140,
    metric: "conversions",
    accountId: "uk-google",
  },
  {
    id: "uk-cpa",
    market: "UK",
    name: "CPA on search",
    description: "Spend ÷ conversions.",
    unit: "currency",
    currency: "GBP",
    direction: -1,
    baseline: 100,
    target: 90,
    metric: "cpa",
    accountId: "uk-google",
  },
  // ---- NZ: stabilise ----
  {
    id: "nz-ctr",
    market: "NZ",
    name: "CTR on search",
    description: "Clicks ÷ impressions.",
    unit: "percent",
    direction: 1,
    baseline: 3.5,
    target: 4.2,
    metric: "ctr",
    accountId: "nz-google",
  },
  {
    id: "nz-low-qs",
    market: "NZ",
    name: "Keywords below QS 4",
    description: "Count from the Google Ads keyword report (QS isn't in the connector's history).",
    unit: "count",
    direction: -1,
    baseline: 103,
    target: 82,
    metric: "manual",
  },
  {
    id: "nz-cpa",
    market: "NZ",
    name: "CPA on search",
    description: "Spend ÷ conversions.",
    unit: "currency",
    currency: "NZD",
    direction: -1,
    baseline: 104,
    target: 94,
    metric: "cpa",
    accountId: "nz-google",
  },
];

export const PLAN_TASKS: PlanTaskDef[] = [
  // ---- AU workstreams ----
  {
    id: "au-keyword-efficiency",
    market: "AU",
    title: "Keyword efficiency — prune the keyword portfolio",
    details:
      "Pause high-spend terms below campaign avg. conv. rate\nFocus cuts on broad/phrase match in non-brand campaigns\nReallocate budget to exact match, high-intent queries",
  },
  {
    id: "au-landing-experience",
    market: "AU",
    title: "Landing experience — act on MS Clarity data",
    details:
      "Review scroll depth on top 5 paid landing pages\nFlag pages where >40% drop before the CTA\nPrioritise headline and CTA placement fixes first",
  },
  {
    id: "au-ad-copy",
    market: "AU",
    title: "Ad copy & creative — replace low-CTR RSA variants",
    details:
      "Retire headlines with <10% impression share + below-avg CTR\nLead with the problem, not the brand ('Need a Contract?')\nPin top variants on Trademarks to reduce weak combinations",
  },
  {
    id: "au-asset-coverage",
    market: "AU",
    title: "Asset coverage — close ad group asset gaps",
    details:
      "4+ service-specific sitelinks per ad group (no generic links)\nMinimum 2 image assets per ad group\nStructured snippets matched to each legal vertical",
  },
  // ---- UK workstreams ----
  {
    id: "uk-spend-reduction",
    market: "UK",
    title: "Spend reduction — cut inefficient segments (target £10k/mo)",
    details:
      "Negate terms with >£200 spend and 0 conversions (90 days)\nPause any ad group with <0.5% conv. rate\nReduce Contracts and Franchise daily budgets by 20–30%",
  },
  {
    id: "uk-volume-protection",
    market: "UK",
    title: "Volume protection — re-weight budget toward proven converters",
    details:
      "Reallocate cuts to Business and high-converter campaigns\nIncrease coverage on terms already converting at target CPLL\nReview lead volume weekly — hold adjustments for 4 weeks",
  },
  {
    id: "uk-account-hygiene",
    market: "UK",
    title: "Account hygiene — remove duplicate keywords",
    details:
      "Identify keywords active in more than one campaign\nPause in the lower QS / lower conv. rate campaign\nPrioritise Business and high converters — highest CPC impact",
  },
  {
    id: "uk-ad-copy",
    market: "UK",
    title: "Ad copy — refresh creative on priority campaigns",
    details:
      "Problem-led headlines on Business and Employment\nPin top RSA variants on Trademarks and Legal Docs\nRetire any headline with below-avg CTR for 30+ days",
  },
  // ---- NZ workstreams ----
  {
    id: "nz-qs-framework",
    market: "NZ",
    title: "QS improvement framework — fix in order",
    details:
      "1. Ad relevance: move keywords into tighter ad groups so copy matches query intent\n2. Expected CTR: pause low-CTR headlines; replace using actual search-term language\n3. Landing page experience: send keywords to the most relevant service page",
  },
  {
    id: "nz-budget-allocation",
    market: "NZ",
    title: "Budget allocation — shift spend to live lead drivers",
    details:
      "Increase budget on the 2–3 campaigns with best CPLL\nReduce spend where conversions are soft leads or form fills\nGoal is a better quality mix, not just lower volume",
  },
  {
    id: "nz-asset-performance",
    market: "NZ",
    title: "Asset performance — audit and refresh",
    details:
      "Pause headlines rated 'Low' or >30% below avg CTR\nReplace using language from top-performing search terms\nSwap generic sitelinks for service-specific ones",
  },
  // ---- Testing plan ----
  {
    id: "test-live-leads-bidding",
    market: "TESTS",
    title: "Test: Live-leads-only bidding (AU + UK) — target −15% CPLL",
    details:
      "Business & Contracts campaigns\nHypothesis: removing soft-lead signals from Smart Bidding concentrates spend on qualified live-lead queries\nSetup: duplicate conversion action scoped to live leads only; apply to Business and Contracts; min. 6-week run before evaluating",
  },
  {
    id: "test-tcpa-cpc-cap",
    market: "TESTS",
    title: "Test: tCPA + max CPC cap (UK) — reduce CPA on higher-funnel terms",
    details:
      "Hypothesis: a CPC ceiling on top of tCPA prevents runaway auction costs while keeping conversion optimisation intact\nSetup: max CPC at 1.5× current avg CPC per term; review IS and conv. rate weekly for 4 weeks",
  },
  {
    id: "test-rsa-pinning",
    market: "TESTS",
    title: "Test: RSA headline pinning (AU + UK) — target +10% click share",
    details:
      "Trademarks & Legal Docs campaigns\nHypothesis: pinning top variants stops Google serving weak headline combinations\nSetup: pin P1 brand/service, P2 value prop, P3 dynamic; evaluate after 30 days vs control",
  },
];

/** Standing reporting commitments — statements of cadence, not trackable tasks. */
export const REPORTING_CADENCE: { id: string; title: string; cadence: string; details: string }[] = [
  {
    id: "rep-keyword-review",
    title: "Keyword performance report review",
    cadence: "Every Monday",
    details:
      "Top wasted-spend terms, keyword QS changes, new search-term opportunities, impression share movement, anomalies vs prior week — delivered via ClickUp with Claude-generated summary",
  },
  {
    id: "rep-meeting-prep",
    title: "Client meeting prep + AI notes auto-send",
    cadence: "Weekly",
    details: "",
  },
  {
    id: "rep-customer-lists",
    title: "Customer list upload — converted leads",
    cadence: "1st of month",
    details: "",
  },
  {
    id: "rep-bidding-review",
    title: "Monthly bidding performance review",
    cadence: "End of month",
    details:
      "Smart Bidding target vs actual, bid modifier analysis by device/location/audience, budget pacing and allocation efficiency, recommended adjustments",
  },
  {
    id: "rep-asset-audit",
    title: "Ad copy & asset audit across all accounts",
    cadence: "Quarterly",
    details:
      "Full RSA headline and description analysis; low performers, creative fatigue signals, recommended replacements",
  },
];

export const KPI_BY_ID = Object.fromEntries(PLAN_KPIS.map((k) => [k.id, k]));
export const TASK_BY_ID = Object.fromEntries(PLAN_TASKS.map((t) => [t.id, t]));
