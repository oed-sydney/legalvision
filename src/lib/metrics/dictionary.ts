/**
 * Metric dictionary — SINGLE SOURCE OF TRUTH (Framework §14).
 * Drives every metric tooltip (definition + formula + source + notes) and the
 * direction-of-good used to colour comparison deltas (CPLL down = green).
 */

export type MetricKey =
  | "spend"
  | "budget"
  | "budget_utilisation"
  | "expected_spend"
  | "pacing_variance"
  | "projected_spend"
  | "impressions"
  | "reach"
  | "clicks"
  | "link_clicks"
  | "landing_page_views"
  | "ctr"
  | "cpc"
  | "cpm"
  | "conversions"
  | "leads"
  | "live_leads"
  | "live_lead_rate"
  | "cpl"
  | "cpll"
  | "cvr"
  | "search_is"
  | "search_is_lost_budget"
  | "search_is_lost_rank"
  | "quality_score"
  | "weighted_qs"
  | "frequency";

/** direction-of-good: 'up' = higher better, 'down' = lower better, 'neutral'. */
export type Direction = "up" | "down" | "neutral";

export type ValueFormat =
  | "currency"
  | "integer"
  | "percent"
  | "ratio1" // one decimal (QS)
  | "ratio2" // two decimals (frequency)
  | "currency2"; // always 2dp currency

export interface MetricDef {
  key: MetricKey;
  label: string;
  short?: string;
  definition: string;
  formula: string;
  source: string;
  channels: "google" | "meta" | "both";
  direction: Direction;
  format: ValueFormat;
  notes?: string;
}

export const METRICS: Record<MetricKey, MetricDef> = {
  spend: {
    key: "spend",
    label: "Spend",
    definition: "Cost charged by the platform for the period.",
    formula: "Σ daily cost",
    source: "Google cost_micros / Meta spend",
    channels: "both",
    direction: "neutral",
    format: "currency",
    notes: "Stored native currency; cross-market rollups converted at daily ECB rates (≈).",
  },
  budget: {
    key: "budget",
    label: "Budget",
    definition: "Allocated budget for the pacing period.",
    formula: "admin-entered (or platform daily × days, labelled derived)",
    source: "App DB",
    channels: "both",
    direction: "neutral",
    format: "currency",
    notes: "Entered and derived budgets are never mixed silently.",
  },
  budget_utilisation: {
    key: "budget_utilisation",
    label: "Budget utilisation",
    short: "Budget used",
    definition: "Share of allocated budget spent so far.",
    formula: "spend / budget",
    source: "Derived",
    channels: "both",
    direction: "neutral",
    format: "percent",
    notes: '"—" if budget unset.',
  },
  expected_spend: {
    key: "expected_spend",
    label: "Expected spend",
    definition: "Budget that should have been spent given elapsed period.",
    formula: "budget × (D_complete / D_total)",
    source: "Derived",
    channels: "both",
    direction: "neutral",
    format: "currency",
    notes: "Completed-days basis by default (§8).",
  },
  pacing_variance: {
    key: "pacing_variance",
    label: "Pacing variance",
    definition: "Difference between actual spend and expected spend.",
    formula: "spend − expected_spend",
    source: "Derived",
    channels: "both",
    direction: "neutral",
    format: "currency",
    notes: '"—" on day 1 of the period.',
  },
  projected_spend: {
    key: "projected_spend",
    label: "Projected spend",
    definition: "Forecast end-of-period spend at the current run rate.",
    formula: "spend + dailyAvg × D_remaining",
    source: "Derived",
    channels: "both",
    direction: "neutral",
    format: "currency",
    notes: "Trailing-7d variant shown as secondary.",
  },
  impressions: {
    key: "impressions",
    label: "Impressions",
    short: "Impr",
    definition: "Number of times ads were shown.",
    formula: "Σ impressions",
    source: "Google / Meta native",
    channels: "both",
    direction: "neutral",
    format: "integer",
  },
  reach: {
    key: "reach",
    label: "Reach",
    definition: "Unique people who saw ads in the period.",
    formula: "period-level query (non-additive)",
    source: "Meta reach",
    channels: "meta",
    direction: "neutral",
    format: "integer",
    notes: "NON-ADDITIVE across time/entities — never summed. Meta only.",
  },
  clicks: {
    key: "clicks",
    label: "Clicks",
    definition: "Google: all clicks. Combined views: Google clicks + Meta link clicks.",
    formula: "Σ clicks (G) [+ link clicks (M), labelled]",
    source: "Google clicks",
    channels: "both",
    direction: "up",
    format: "integer",
    notes: "Meta all-clicks is never mixed in.",
  },
  link_clicks: {
    key: "link_clicks",
    label: "Link clicks",
    definition: "Clicks on ad links to the destination.",
    formula: "Σ inline_link_clicks",
    source: "Meta inline_link_clicks",
    channels: "meta",
    direction: "up",
    format: "integer",
    notes: "Meta's comparable to Google clicks.",
  },
  landing_page_views: {
    key: "landing_page_views",
    label: "Landing page views",
    short: "LPV",
    definition: "Destination page loads after a link click.",
    formula: "Σ landing_page_view actions",
    source: "Meta (pixel)",
    channels: "meta",
    direction: "up",
    format: "integer",
    notes: 'Requires pixel; gaps render "—".',
  },
  ctr: {
    key: "ctr",
    label: "CTR",
    definition: "Google: clicks/impr. Meta: link clicks/impr (CTR link).",
    formula: "clicks / impressions",
    source: "Derived",
    channels: "both",
    direction: "up",
    format: "percent",
    notes: "Low-volume guard applies. Blended cross-channel is labelled.",
  },
  cpc: {
    key: "cpc",
    label: "Avg CPC",
    definition: "Average cost per click (Meta: per link click).",
    formula: "spend / clicks",
    source: "Derived",
    channels: "both",
    direction: "down",
    format: "currency2",
    notes: '"—" if 0 clicks.',
  },
  cpm: {
    key: "cpm",
    label: "CPM",
    definition: "Cost per thousand impressions.",
    formula: "spend / impressions × 1000",
    source: "Derived",
    channels: "meta",
    direction: "down",
    format: "currency2",
    notes: "Meta-native; not blended cross-channel.",
  },
  conversions: {
    key: "conversions",
    label: "Conversions",
    short: "Conv",
    definition: "Platform conversions (native attribution, all counted actions).",
    formula: "Σ conversions",
    source: "Google conversions",
    channels: "google",
    direction: "up",
    format: "integer",
    notes: "NEVER presented as leads or live leads.",
  },
  leads: {
    key: "leads",
    label: "Leads",
    definition: "Conversion actions mapped to category=lead (G) or platform lead actions (M).",
    formula: "Σ mapped lead actions",
    source: "Mapping + Meta actions",
    channels: "both",
    direction: "up",
    format: "integer",
    notes: "Distinct from Conversions and from Live Leads.",
  },
  live_leads: {
    key: "live_leads",
    label: "Live leads",
    definition:
      'Conversions of the action(s) mapped to "Live Leads" (Google). Meta: CRM-joined only.',
    formula: "Σ Live-Leads-mapped conversion actions",
    source: "Conversion-action mapping (A1)",
    channels: "both",
    direction: "up",
    format: "integer",
    notes: 'THE metric. Never inferred from totals. Meta shows "—" until CRM source lands.',
  },
  live_lead_rate: {
    key: "live_lead_rate",
    label: "Live-lead rate",
    definition: "Share of platform leads that are live leads.",
    formula: "live_leads / leads",
    source: "Derived",
    channels: "both",
    direction: "up",
    format: "percent",
    notes: "Low-volume guard applies; labelled platform-based in v1.",
  },
  cpl: {
    key: "cpl",
    label: "Cost per lead",
    short: "CPL",
    definition: "Average cost per platform lead.",
    formula: "spend / leads",
    source: "Derived",
    channels: "both",
    direction: "down",
    format: "currency",
    notes: '"—" if 0 leads.',
  },
  cpll: {
    key: "cpll",
    label: "Cost per live lead",
    short: "CPLL",
    definition: "The headline efficiency metric — cost per live lead.",
    formula: "spend / live_leads",
    source: "Derived",
    channels: "both",
    direction: "down",
    format: "currency",
    notes: '"—" when 0 live leads (a "spend with 0 live leads" alert fires instead).',
  },
  cvr: {
    key: "cvr",
    label: "Conversion rate",
    short: "CvR",
    definition: "Google: conversions/clicks. Meta: leads/link clicks.",
    formula: "conversions / clicks",
    source: "Derived",
    channels: "both",
    direction: "up",
    format: "percent",
    notes: "Different numerators per channel — never blended without a label.",
  },
  search_is: {
    key: "search_is",
    label: "Search impression share",
    short: "Search IS",
    definition: "Impressions received divided by eligible impressions (Search).",
    formula: "impressions / eligible impressions",
    source: "Google search_impression_share",
    channels: "google",
    direction: "up",
    format: "percent",
    notes: 'Floored values render "<10%". Search-network only.',
  },
  search_is_lost_budget: {
    key: "search_is_lost_budget",
    label: "Lost IS (budget)",
    definition: "Share of eligible impressions lost due to budget.",
    formula: "search_budget_lost_impression_share",
    source: "Google",
    channels: "google",
    direction: "down",
    format: "percent",
    notes: "Pairs with pacing alerts.",
  },
  search_is_lost_rank: {
    key: "search_is_lost_rank",
    label: "Lost IS (rank)",
    definition: "Share of eligible impressions lost due to Ad Rank.",
    formula: "search_rank_lost_impression_share",
    source: "Google",
    channels: "google",
    direction: "down",
    format: "percent",
    notes: "Pairs with the Quality Score story.",
  },
  quality_score: {
    key: "quality_score",
    label: "Quality Score",
    short: "QS",
    definition: "Google keyword diagnostic 1–10 plus three component ratings.",
    formula: "keyword-level (daily snapshot)",
    source: "Google quality_info.*",
    channels: "google",
    direction: "up",
    format: "ratio1",
    notes: "Keyword-level only. No QS → excluded from averages, counted in coverage.",
  },
  weighted_qs: {
    key: "weighted_qs",
    label: "Weighted Quality Score",
    short: "Wtd QS",
    definition: "Impression-weighted average Quality Score over QS-bearing keywords.",
    formula: "Σ(QS × impr) / Σ(impr)",
    source: "Derived from snapshots",
    channels: "google",
    direction: "up",
    format: "ratio1",
    notes: "Always shown with coverage %. Derived — never a fabricated account QS.",
  },
  frequency: {
    key: "frequency",
    label: "Frequency",
    short: "Freq",
    definition: "Average times each person saw ads in the period.",
    formula: "impressions / reach",
    source: "Meta (period query)",
    channels: "meta",
    direction: "down",
    format: "ratio2",
    notes: "Non-additive (reach rule). Fatigue input.",
  },
};

export function metric(key: MetricKey): MetricDef {
  return METRICS[key];
}
