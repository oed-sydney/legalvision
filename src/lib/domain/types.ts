/**
 * Core domain types for the LegalVision reporting dashboard.
 * Money is ALWAYS stored in native account currency; conversion happens only
 * at the aggregation edge (see lib/currency/guard.ts). Reach/Frequency are
 * non-additive and never summed across days/entities.
 */

export type MarketCode = "AU" | "UK" | "NZ";
export type ChannelCode = "google_ads" | "meta_ads";
export type CurrencyCode = "AUD" | "GBP" | "NZD";

/** Every fact row carries a source tag; prod-path queries structurally exclude 'mock'. */
export type DataSource = "mock" | "windsor" | "direct";

export interface Market {
  code: MarketCode;
  name: string;
  currency: CurrencyCode;
  /** Display timezone for the market (accounts may differ, e.g. UK Google = Etc/GMT). */
  displayTimezone: string;
}

export interface Channel {
  code: ChannelCode;
  name: string;
  shortName: string;
}

export interface AdAccount {
  /** Internal id (stable slug). */
  id: string;
  /** Platform-native account id (natural key). */
  platformAccountId: string;
  market: MarketCode;
  channel: ChannelCode;
  name: string;
  currency: CurrencyCode;
  /** Platform reporting timezone — authoritative for daily bucketing + pacing math. */
  reportingTimezone: string;
  status: "active" | "pending_access";
  connectedSource: DataSource;
  /** Meta attribution settings / access notes. */
  notes?: string;
}

/** Distinct metric columns. Conversions ≠ Leads ≠ Live Leads — enforced everywhere. */
export interface DailyMetrics {
  spend: number;
  impressions: number;
  /** Google all-clicks. */
  clicks: number;
  /** Meta link clicks (the comparable pair to Google clicks). */
  linkClicks: number;
  landingPageViews: number;
  /** Platform conversions (Google native attribution) — never shown as leads. */
  conversions: number;
  conversionValue: number;
  /** Mapped lead-type conversion actions. */
  leads: number;
  /** THE metric: mapped "Live Leads" conversion action only. null = pending source (Meta). */
  liveLeads: number | null;
}

/** A daily fact row (already resolved live_leads via conversion-action mapping). */
export interface DailyFact extends DailyMetrics {
  date: string; // account-local calendar date, ISO (YYYY-MM-DD)
  accountId: string;
  source: DataSource;
}

export type CampaignType =
  | "Search"
  | "Performance Max"
  | "Display"
  | "Video"
  | "Demand Gen"
  // Meta objectives
  | "Leads"
  | "Traffic"
  | "Awareness"
  | "Sales"
  | "Engagement";

export interface Campaign extends DailyMetrics {
  id: string;
  accountId: string;
  market: MarketCode;
  channel: ChannelCode;
  name: string;
  type: CampaignType;
  status: "enabled" | "paused" | "removed";
  /** Platform daily budget (native currency) where exposed. */
  platformDailyBudget: number | null;
  currency: CurrencyCode;
  // Google-only (null on Meta / PMax where n/a)
  searchIS: number | null;
  lostISBudget: number | null;
  lostISRank: number | null;
  weightedQs: number | null;
  // Meta-only
  reach: number | null;
  frequency: number | null;
  source: DataSource;
}

export interface Keyword {
  id: string;
  accountId: string;
  market: MarketCode;
  campaignId: string;
  campaignName: string;
  adGroupName: string;
  text: string;
  matchType: "exact" | "phrase" | "broad";
  status: "enabled" | "paused";
  qualityScore: number | null; // 1..10, null = no QS
  expectedCtr: ComponentRating;
  adRelevance: ComponentRating;
  lpExperience: ComponentRating;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  liveLeads: number;
  currency: CurrencyCode;
  qs30dAgo: number | null;
  source: DataSource;
}

export type ComponentRating = "above" | "average" | "below" | null;

export interface SearchTerm {
  id: string;
  accountId: string;
  market: MarketCode;
  campaignName: string;
  adGroupName: string;
  term: string;
  matchedKeyword: string;
  matchType: "exact" | "phrase" | "broad";
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  liveLeads: number;
  currency: CurrencyCode;
  isAddedKeyword: boolean;
  source: DataSource;
}

export interface Creative {
  id: string;
  accountId: string;
  market: MarketCode;
  campaignName: string;
  adSetName: string;
  adName: string;
  format: "Image" | "Video" | "Carousel";
  primaryText: string;
  headline: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  linkClicks: number;
  leads: number;
  liveLeads: number | null;
  currency: CurrencyCode;
  /** null = pending Meta CDN cache (renders a format-icon fallback). */
  thumbnailPath: string | null;
  fatigue: boolean;
  source: DataSource;
}

export interface ConversionAction {
  id: string;
  accountId: string;
  market: MarketCode;
  name: string;
  category: "lead" | "purchase" | "page_view" | "other";
  /** Logical mapping (admin-editable A1). */
  logicalMetric: "live_leads" | "leads" | "other";
  conversions: number;
  conversionValue: number;
  source: DataSource;
}

export interface Budget {
  id: string;
  scopeType: "account" | "campaign";
  scopeId: string;
  periodStart: string; // YYYY-MM-DD account-local
  periodEnd: string;
  amount: number;
  currency: CurrencyCode;
  source: "manual" | "csv" | "derived";
}

export type TargetMetric =
  | "cpll"
  | "cpl"
  | "live_leads_volume"
  | "live_lead_rate"
  | "impression_share"
  | "min_qs"
  | "max_frequency";

export interface Target {
  id: string;
  scopeType: "global" | "market" | "account" | "campaign";
  scopeId: string | null;
  metric: TargetMetric;
  value: number;
}

export type Severity = "info" | "warning" | "critical";

export interface Alert {
  id: string;
  ruleCode: string;
  severity: Severity;
  market: MarketCode;
  channel: ChannelCode;
  entityType: "account" | "campaign" | "keyword" | "creative";
  entityName: string;
  reason: string;
  currentValue: string;
  thresholdValue: string;
  status: "open" | "acknowledged" | "resolved";
  triggeredAt: string;
}

export interface ExchangeRate {
  date: string;
  base: CurrencyCode;
  quote: CurrencyCode;
  rate: number;
  stale: boolean;
}

export interface SyncRun {
  source: string;
  label: string;
  accountId: string | null;
  status: "ok" | "failed" | "partial" | "running";
  finishedAt: string; // ISO datetime UTC
  rowsUpserted: number;
}

export type UserRole = "admin" | "internal" | "client" | "viewer";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: "invited" | "active" | "deactivated";
  scopes: string[]; // empty = all-access for the role
  leadRecordAccess: boolean;
  lastLoginAt: string | null;
}
