import type { CurrencyCode } from "../domain/types";

/**
 * LegalVision 90-Day Paid Search Strategy — Sprint Two (August – October 2026),
 * transcribed from "LV - 90 Day Strategy (August to October 26).pptx" (revised
 * objectives slide is authoritative). Definitions are code-owned; task statuses +
 * manually-tracked KPI values persist to the plan store.
 *
 * "Live leads" here means the STRICT mapped Live Leads action (same basis as the rest
 * of the dashboard) — Sprint Two's KPIs are stated on that basis, unlike Sprint One which
 * counted all conversion actions. `cpll` = spend ÷ live leads and `live_leads` = the live
 * leads count, both computed per account/month from the Live Leads feed. Volume targets
 * are shown as a monthly figure (the sprint total ÷ 3) so the monthly engine can judge pace.
 * Quality-score %, landing-page-experience % and spend-mix % are current-state snapshots
 * computed from the keyword / campaign detail (see snapshots.ts) — no manual entry needed.
 */

export const PLAN = {
  name: "LegalVision 90-Day Paid Search Strategy — Sprint Two",
  startDate: "2026-08-01",
  endDate: "2026-10-31",
} as const;

export type PlanMarket = "AU" | "UK" | "NZ" | "TESTS";
export type KpiUnit = "count" | "currency" | "percent";
/**
 * Computed from monthly account aggregates, or manual. `cpll`/`live_leads` read the strict
 * Live Leads action; `click_share`/`is_lost_budget` are weighted across SEARCH campaigns.
 */
export type KpiMetric =
  | "conversions"
  | "live_leads"
  | "cpa"
  | "cpll"
  | "spend"
  | "ctr"
  | "click_share"
  | "is_lost_budget"
  // Current-state snapshots computed from keyword / campaign detail (see snapshots.ts):
  | "kw_below_qs5"
  | "spend_weak_lp"
  | "spend_beat_cpll"
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
  { market: "UK", heading: "United Kingdom — Primary focus" },
  { market: "AU", heading: "Australia — Maintain & optimise" },
  { market: "NZ", heading: "New Zealand — Cost efficiency" },
  { market: "TESTS", heading: "Testing plan — Q3 2026" },
];

export const PLAN_KPIS: PlanKpiDef[] = [
  // ---- UK: primary focus (efficiency) ----
  {
    id: "uk-cpll",
    market: "UK",
    name: "Cost per live lead",
    description: "Spend ÷ live leads. Baseline £254 (sprint-one avg; July £249). Live-leads bidding is the new lever — target −10%.",
    unit: "currency",
    currency: "GBP",
    direction: -1,
    baseline: 254,
    target: 229,
    metric: "cpll",
    accountId: "uk-google",
  },
  {
    id: "uk-live-leads",
    market: "UK",
    name: "Live leads / month",
    description: "Live-leads action. Hold sprint-one's level: sprint target ≥1,150 (≈383/mo); same period last year 1,066.",
    unit: "count",
    direction: 1,
    baseline: 355,
    target: 383,
    metric: "live_leads",
    accountId: "uk-google",
  },
  {
    id: "uk-low-qs",
    market: "UK",
    name: "Active keywords below QS 5",
    description: "Share of active, scored keywords below quality score 5 (52% at 17 Aug). Computed live from the keyword pull.",
    unit: "percent",
    direction: -1,
    baseline: 52,
    target: 40,
    metric: "kw_below_qs5",
    accountId: "uk-google",
  },
  {
    id: "uk-lp-experience",
    market: "UK",
    name: "Spend on weak landing pages",
    description: "Share of keyword spend on below-average landing page experience (baseline 29%). Computed live from the keyword pull.",
    unit: "percent",
    direction: -1,
    baseline: 29,
    target: 15,
    metric: "spend_weak_lp",
    accountId: "uk-google",
  },
  // ---- AU: maintain & optimise ----
  {
    id: "au-live-leads",
    market: "AU",
    name: "Live leads / month",
    description: "Live-leads action. Sprint target ~2,060 (+5%; ≈687/mo); last sprint 1,965; same period last year 1,688 (~+22% YoY).",
    unit: "count",
    direction: 1,
    baseline: 655,
    target: 687,
    metric: "live_leads",
    accountId: "au-google",
  },
  {
    id: "au-cpll",
    market: "AU",
    name: "Cost per live lead",
    description: "Spend ÷ live leads, held at July's level. Baselines: sprint one $316; July $294; Aug 1–16 running at $323.",
    unit: "currency",
    currency: "AUD",
    direction: -1,
    baseline: 316,
    target: 295,
    metric: "cpll",
    accountId: "au-google",
  },
  {
    id: "au-low-qs",
    market: "AU",
    name: "Active keywords below QS 5",
    description: "Share of active, scored keywords below quality score 5 (57% at 17 Aug). Computed live from the keyword pull.",
    unit: "percent",
    direction: -1,
    baseline: 57,
    target: 45,
    metric: "kw_below_qs5",
    accountId: "au-google",
  },
  // ---- NZ: cost efficiency ----
  {
    id: "nz-cpll",
    market: "NZ",
    name: "Cost per live lead",
    description: "Spend ÷ live leads. Baselines: July $279; sprint-one avg $274. Target $250 (−10%).",
    unit: "currency",
    currency: "NZD",
    direction: -1,
    baseline: 274,
    target: 250,
    metric: "cpll",
    accountId: "nz-google",
  },
  {
    id: "nz-spend-quality",
    market: "NZ",
    name: "Spend beating account-avg CPLL",
    description: "Share of spend in campaigns beating the account-average cost per live lead (44% in July). Computed live from campaign spend + live leads.",
    unit: "percent",
    direction: 1,
    baseline: 44,
    target: 55,
    metric: "spend_beat_cpll",
    accountId: "nz-google",
  },
];

export const PLAN_TASKS: PlanTaskDef[] = [
  // ---- UK workstreams (primary focus) ----
  {
    id: "uk-live-leads-bidding",
    market: "UK",
    title: "Bidding — move UK campaigns to live-leads bidding",
    details:
      "Bid to live leads only, not all conversions\nBAU optimisation: shift budget from traffic that doesn't convert to the segments that do\nStart with Business, where most spend sits",
  },
  {
    id: "uk-quality-score",
    market: "UK",
    title: "Quality Score — lift every keyword above 5",
    details:
      "Dashboard flags anything under QS 5, reviewed fortnightly\nStart with the Business keywords (most of the spend)\nWork the components in order: ad relevance → expected CTR → landing page",
  },
  {
    id: "uk-tcpa",
    market: "UK",
    title: "tCPA change (17 Aug) — small UK exposure, tidied early",
    details:
      "Two campaigns affected; targets updated before the change lands\nOpen question with Google on exactly which campaigns qualify",
  },
  {
    id: "uk-google-growth-plan",
    market: "UK",
    title: "Google growth plan — use what's useful",
    details:
      "Review Google's UK plan for ideas that fit the cost goal\nFix conversion double-counting before any further bidding changes",
  },
  // ---- AU workstreams (maintain & optimise) ----
  {
    id: "au-tcpa",
    market: "AU",
    title: "tCPA change (17 Aug) — the main job this month",
    details:
      "Most AU campaigns are limited by budget, so targets are updated before the change\nDaily checks for the first week, then the dashboard takes over",
  },
  {
    id: "au-aimax-retest",
    market: "AU",
    title: "AI Max retest — second try, tighter setup",
    details:
      "Small experiment split on one campaign (High Converters)\nImmigration pages, brand and competitor terms excluded this time\nLead quality checked weekly",
  },
  {
    id: "au-quality-score",
    market: "AU",
    title: "Quality Score — set the baseline",
    details:
      "Account-average quality score baselined and tracked in the dashboard\nImprovement targets set once the baseline is in",
  },
  {
    id: "au-keep-what-worked",
    market: "AU",
    title: "Keep what worked — same routine as sprint one",
    details:
      "Keyword, ad copy and asset work continues on the same rhythm\nLead quality stays on watch with the sales team",
  },
  // ---- NZ workstreams (cost efficiency) ----
  {
    id: "nz-budget-mix",
    market: "NZ",
    title: "Budget mix — fund the best campaigns",
    details:
      "Budget moves to the campaigns with the best cost per live lead\nLess spend where leads skew to form fills",
  },
  {
    id: "nz-quality-score",
    market: "NZ",
    title: "Quality Score — finish the job",
    details:
      "Low quality score keywords down from 91 to the low 80s\nSame fix order as sprint one",
  },
  {
    id: "nz-ctr",
    market: "NZ",
    title: "Click-through rate — keep the win",
    details:
      "Hold at 4.2% or better\nAd refresh routine continues",
  },
  // ---- Testing plan (Q3 2026) ----
  {
    id: "test-au-aimax",
    market: "TESTS",
    title: "AI Max retest (AU) — High Converters campaign",
    details:
      "Success: extra conversions at or under campaign CPA\nThinking: with the right exclusions, AI Max can find extra demand without July's poor-quality leads\nRuns: small experiment split with page + brand exclusions; lead quality checked weekly; decision after 4–6 weeks",
  },
  {
    id: "test-tcpa-transition",
    market: "TESTS",
    title: "tCPA transition (all markets) — budget-limited campaigns",
    details:
      "Success: CPA steady through the 17 Aug change\nThinking: updating targets before the change stops Google inflating CPAs on budget-limited campaigns\nRuns: targets updated in the days before; daily checks the first week, then dashboard alerts",
  },
  {
    id: "test-uk-segment-narrowing",
    market: "TESTS",
    title: "Segment narrowing (UK) — low-quality traffic segments",
    details:
      "Success: cost per lead down without losing volume\nThinking: moving spend out of segments that don't convert and into ones that do brings cost per lead down\nRuns: segments ranked by cost per lead; bottom tier cut, budget reallocated; reviewed weekly",
  },
];

/** Standing reporting commitments — statements of cadence, not trackable tasks. */
export const REPORTING_CADENCE: { id: string; title: string; cadence: string; details: string }[] = [
  {
    id: "rep-live-tracking",
    title: "Sprint goals tracked live in the dashboard",
    cadence: "Live",
    details:
      "KPIs load at go-live and update in real time (no manual pushes); alerts limited to sprint KPIs + budget pacing so every alert matters; go-live on the One Egg domain before the next WIP, with logins for both teams; the CRM lead-quality feed is parked until end of sprint",
  },
  {
    id: "rep-weekly-wip",
    title: "Weekly WIP with pre-filled agenda",
    cadence: "Weekly",
    details: "Agenda pre-filled and meeting notes saved automatically",
  },
  {
    id: "rep-budget-updates",
    title: "Budget updates on demand",
    cadence: "On demand",
    details: "Available any time, with a projected end-of-week position",
  },
  {
    id: "rep-bidding-review",
    title: "Monthly bidding review against targets",
    cadence: "Monthly",
    details: "Smart Bidding target vs actual and recommended adjustments",
  },
  {
    id: "rep-sprint-review",
    title: "Full sprint review",
    cadence: "End of October",
    details: "Sprint-two outcomes vs KPIs; set sprint three",
  },
];

export const KPI_BY_ID = Object.fromEntries(PLAN_KPIS.map((k) => [k.id, k]));
export const TASK_BY_ID = Object.fromEntries(PLAN_TASKS.map((t) => [t.id, t]));
