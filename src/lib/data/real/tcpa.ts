import type { MarketCode } from "../../domain/types";

/**
 * REAL campaign bid-strategy targets — pulled 2026-07-27 via Windsor (dimension-only
 * pull: bidding_strategy_type + target_cpa; never combined with metrics per the verified
 * campaign_status quirk). Native currency per account (AUD / NZD / GBP).
 *
 * Scope: Google's 2026-08-17 bidding update applies to campaigns on target-based bid
 * strategies — pure TARGET_CPA and MAXIMIZE_CONVERSIONS with a target CPA set (which
 * functions as tCPA). Campaigns with no target (target_cpa = 0) are excluded here.
 * Targets are entity attributes (not date-dependent); actual CPA comes from the
 * warehouse for the selected date range.
 */

export type BidStrategy = "TARGET_CPA" | "MAXIMIZE_CONVERSIONS";

export interface TcpaTarget {
  market: MarketCode;
  campaignName: string;
  strategy: BidStrategy;
  /** Target CPA, native account currency. */
  targetCpa: number;
}

// [market, campaign, strategy, targetCpa] — ENABLED campaigns with target_cpa > 0
const ROWS: [MarketCode, string, BidStrategy, number][] = [
  // Australia (AUD)
  ["AU", "AU-SC - All High Converters", "MAXIMIZE_CONVERSIONS", 150],
  ["AU", "AU-SC - Business", "MAXIMIZE_CONVERSIONS", 150],
  ["AU", "AU-SC - Business - Call Only", "MAXIMIZE_CONVERSIONS", 150],
  ["AU", "AU-SC - Business - Selling & Buying", "MAXIMIZE_CONVERSIONS", 120],
  ["AU", "AU-SC - Contract - Call Only", "TARGET_CPA", 100],
  ["AU", "AU-SC - Contracts", "MAXIMIZE_CONVERSIONS", 157],
  ["AU", "AU-SC - Debt Recovery", "MAXIMIZE_CONVERSIONS", 100],
  ["AU", "AU-SC - Disputes", "MAXIMIZE_CONVERSIONS", 120],
  ["AU", "AU-SC - Employment", "MAXIMIZE_CONVERSIONS", 95],
  ["AU", "AU-SC - Franchise", "MAXIMIZE_CONVERSIONS", 125],
  ["AU", "AU-SC - IP", "MAXIMIZE_CONVERSIONS", 120],
  ["AU", "AU-SC - IT", "MAXIMIZE_CONVERSIONS", 130],
  ["AU", "AU-SC - Leasing", "MAXIMIZE_CONVERSIONS", 120],
  ["AU", "AU-SC - Legal Documents", "MAXIMIZE_CONVERSIONS", 130],
  ["AU", "AU-SC - Local", "MAXIMIZE_CONVERSIONS", 140],
  ["AU", "AU-SC - Regulatory and Compliance", "MAXIMIZE_CONVERSIONS", 110],
  ["AU", "AU-SC - Startup", "TARGET_CPA", 130],
  ["AU", "AU-SC - Trade Marks", "MAXIMIZE_CONVERSIONS", 110],
  ["AU", "AU-SC - eCommerce", "MAXIMIZE_CONVERSIONS", 130],
  // New Zealand (NZD)
  ["NZ", "NZ-SC - Business", "MAXIMIZE_CONVERSIONS", 135],
  ["NZ", "NZ-SC - Business - Call Only", "MAXIMIZE_CONVERSIONS", 120],
  ["NZ", "NZ-SC - Business - Selling & Buying", "MAXIMIZE_CONVERSIONS", 100],
  ["NZ", "NZ-SC - Contract", "MAXIMIZE_CONVERSIONS", 120],
  ["NZ", "NZ-SC - Disputes", "MAXIMIZE_CONVERSIONS", 90],
  ["NZ", "NZ-SC - Employment", "MAXIMIZE_CONVERSIONS", 60],
  ["NZ", "NZ-SC - Franchise", "MAXIMIZE_CONVERSIONS", 95],
  ["NZ", "NZ-SC - IP", "MAXIMIZE_CONVERSIONS", 100],
  ["NZ", "NZ-SC - IT", "MAXIMIZE_CONVERSIONS", 80],
  ["NZ", "NZ-SC - Leasing", "MAXIMIZE_CONVERSIONS", 150],
  ["NZ", "NZ-SC - Legal Documents", "MAXIMIZE_CONVERSIONS", 110],
  ["NZ", "NZ-SC - Local", "MAXIMIZE_CONVERSIONS", 90],
  ["NZ", "NZ-SC - Startup", "MAXIMIZE_CONVERSIONS", 130],
  ["NZ", "NZ-SC - Trademark", "MAXIMIZE_CONVERSIONS", 100],
  // United Kingdom (GBP)
  ["UK", "UK-SC - Business", "MAXIMIZE_CONVERSIONS", 87],
  ["UK", "UK-SC - Business - Selling & Buying", "MAXIMIZE_CONVERSIONS", 95],
  ["UK", "UK-SC - Contract", "MAXIMIZE_CONVERSIONS", 125],
  ["UK", "UK-SC - Disputes", "MAXIMIZE_CONVERSIONS", 100],
  ["UK", "UK-SC - Employment", "MAXIMIZE_CONVERSIONS", 55],
  ["UK", "UK-SC - Franchise", "MAXIMIZE_CONVERSIONS", 110],
  ["UK", "UK-SC - IP", "MAXIMIZE_CONVERSIONS", 85],
  ["UK", "UK-SC - IT", "MAXIMIZE_CONVERSIONS", 90],
  ["UK", "UK-SC - Leasing", "MAXIMIZE_CONVERSIONS", 80],
  ["UK", "UK-SC - Legal Documents", "MAXIMIZE_CONVERSIONS", 120],
  ["UK", "UK-SC - Local", "MAXIMIZE_CONVERSIONS", 80],
  ["UK", "UK-SC - Startup", "MAXIMIZE_CONVERSIONS", 75],
  ["UK", "UK-SC - Trademark", "MAXIMIZE_CONVERSIONS", 145],
];

/** Lookup key: `${market}|${campaignName}`. */
export function tcpaTargets(): Map<string, TcpaTarget> {
  const map = new Map<string, TcpaTarget>();
  for (const [market, campaignName, strategy, targetCpa] of ROWS) {
    map.set(`${market}|${campaignName}`, { market, campaignName, strategy, targetCpa });
  }
  return map;
}

/** The Google bidding change these targets need reviewing against. */
export const BIDDING_CHANGE_DATE = "2026-08-17";
