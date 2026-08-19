/**
 * REAL LegalVision data snapshot — pulled 2026-07-14 via Windsor.ai (Google Ads,
 * account `zeemarketing`) and the Meta Ads profile connection.
 * Window: 2026-06-14 → 2026-07-13 (last 30 complete days).
 *
 * This is real platform data (source='windsor' for Google, 'direct' for Meta), NOT mock.
 * Google Live Leads resolve from the per-account mapped conversion actions:
 *   AU → "Live Leads (AU Enhanced)", NZ → "Live Leads (NZ Enhanced)", UK → "Live Leads (UK Enhanced)".
 * Meta live leads remain "—" (pending CRM lead-source join, A2). Meta NZ is access-gated (A11).
 */

import type { CampaignType } from "../../domain/types";

export const SNAPSHOT_FROM = "2026-06-14";
export const SNAPSHOT_TO = "2026-07-13";
export const SNAPSHOT_PULLED_AT = "2026-07-14T02:30:00Z";

export type AcctCode = "au-google" | "nz-google" | "uk-google" | "au-meta" | "uk-meta";

/** Real Google Live Leads conversion-action names (validated per account). */
export const LIVE_LEADS_ACTION: Record<string, string> = {
  "au-google": "Live Leads (AU Enhanced)",
  "nz-google": "Live Leads (NZ Enhanced)",
  "uk-google": "Live Leads (UK Enhanced)",
};

// [acct, date, spend, impressions, clicks, conversions]
export const GOOGLE_DAILY: [AcctCode, string, number, number, number, number][] = [
  ["au-google", "2026-06-14", 1289.26, 832, 54, 7],
  ["nz-google", "2026-06-15", 1222.49, 3668, 111, 5],
  ["uk-google", "2026-06-15", 4321.96, 6351, 276, 41],
  ["au-google", "2026-06-15", 9341.83, 9740, 303, 55.6],
  ["nz-google", "2026-06-16", 1072.87, 3632, 113, 13],
  ["uk-google", "2026-06-16", 4141.62, 6115, 262, 25],
  ["au-google", "2026-06-16", 7251.43, 8020, 295, 59.9],
  ["nz-google", "2026-06-17", 1180.28, 3164, 98, 4],
  ["uk-google", "2026-06-17", 3958.24, 7280, 303, 36],
  ["au-google", "2026-06-17", 8222.32, 7955, 314, 66],
  ["nz-google", "2026-06-18", 1185.43, 2315, 69, 9],
  ["uk-google", "2026-06-18", 4901.58, 6328, 261, 51],
  ["au-google", "2026-06-18", 7267.7, 9454, 401, 62.8],
  ["nz-google", "2026-06-19", 724.93, 2364, 76, 1],
  ["uk-google", "2026-06-19", 3143.22, 5008, 193, 31],
  ["au-google", "2026-06-19", 7073.53, 6576, 282, 58.8],
  ["au-google", "2026-06-20", 1411.43, 877, 50, 4],
  ["au-google", "2026-06-21", 1752.99, 812, 50, 10],
  ["nz-google", "2026-06-22", 873.27, 2940, 107, 12],
  ["uk-google", "2026-06-22", 3653.64, 6127, 256, 24],
  ["au-google", "2026-06-22", 9034.96, 8724, 335, 78.8],
  ["nz-google", "2026-06-23", 1102.04, 2584, 121, 12],
  ["uk-google", "2026-06-23", 3869.13, 7000, 286, 40],
  ["au-google", "2026-06-23", 7713.03, 10079, 375, 40.4],
  ["nz-google", "2026-06-24", 981.14, 2269, 114, 10],
  ["uk-google", "2026-06-24", 4099.1, 6641, 283, 37],
  ["au-google", "2026-06-24", 9057.43, 10437, 414, 65.7],
  ["nz-google", "2026-06-25", 994.92, 2663, 85, 9],
  ["uk-google", "2026-06-25", 4133.39, 6487, 261, 44],
  ["au-google", "2026-06-25", 9031.32, 9197, 393, 67.3],
  ["nz-google", "2026-06-26", 789.41, 2576, 92, 8],
  ["uk-google", "2026-06-26", 4204.3, 4948, 260, 38],
  ["au-google", "2026-06-26", 6527.59, 9041, 327, 65.9],
  ["au-google", "2026-06-27", 1277.67, 1036, 64, 6],
  ["au-google", "2026-06-28", 1348.47, 934, 51, 8.7],
  ["nz-google", "2026-06-29", 1245.67, 3278, 108, 16],
  ["uk-google", "2026-06-29", 4383.16, 10602, 347, 49],
  ["au-google", "2026-06-29", 10202.96, 9504, 395, 80],
  ["nz-google", "2026-06-30", 906.3, 2448, 84, 13],
  ["uk-google", "2026-06-30", 4663.63, 8987, 376, 47],
  ["au-google", "2026-06-30", 8055.76, 7529, 382, 74],
  ["nz-google", "2026-07-01", 1256.17, 1834, 85, 8],
  ["uk-google", "2026-07-01", 5611.45, 8722, 400, 53.8],
  ["au-google", "2026-07-01", 9371.05, 7228, 323, 78.6],
  ["nz-google", "2026-07-02", 925.7, 2947, 99, 11],
  ["uk-google", "2026-07-02", 4221.14, 8360, 322, 41],
  ["au-google", "2026-07-02", 8857.67, 7593, 332, 72.6],
  ["nz-google", "2026-07-03", 965.6, 2988, 124, 9],
  ["uk-google", "2026-07-03", 3481.18, 6301, 228, 29],
  ["au-google", "2026-07-03", 6826.26, 6638, 298, 48],
  ["au-google", "2026-07-04", 1786.57, 1034, 82, 19.5],
  ["au-google", "2026-07-05", 1746.83, 1062, 72, 7.5],
  ["nz-google", "2026-07-06", 1063.93, 3987, 198, 6],
  ["uk-google", "2026-07-06", 3764.84, 8268, 286, 46],
  ["au-google", "2026-07-06", 9260.05, 8900, 333, 76.2],
  ["nz-google", "2026-07-07", 798.09, 4384, 182, 4],
  ["uk-google", "2026-07-07", 4486.79, 9075, 338, 59.3],
  ["au-google", "2026-07-07", 8463.82, 8888, 363, 72.7],
  ["nz-google", "2026-07-08", 987.28, 4035, 174, 13],
  ["uk-google", "2026-07-08", 3717.3, 8795, 287, 30.7],
  ["au-google", "2026-07-08", 9241.57, 9556, 431, 86.3],
  ["nz-google", "2026-07-09", 899.33, 4500, 177, 10],
  ["uk-google", "2026-07-09", 4467.64, 8379, 286, 49.5],
  ["au-google", "2026-07-09", 9220.89, 10255, 422, 86.7],
  ["nz-google", "2026-07-10", 693.53, 3604, 151, 2],
  ["uk-google", "2026-07-10", 2530.55, 8188, 201, 33.5],
  ["au-google", "2026-07-10", 7830.15, 8910, 351, 81],
  ["au-google", "2026-07-11", 2695.14, 3116, 249, 39],
  ["au-google", "2026-07-12", 2092.61, 2843, 339, 47],
  ["nz-google", "2026-07-13", 1096.9, 4241, 168, 13],
  ["uk-google", "2026-07-13", 4793.07, 11075, 347, 54],
  ["au-google", "2026-07-13", 9506.44, 11068, 651, 115],
];

// [acct, date, liveLeads]
export const GOOGLE_LIVE_LEADS_DAILY: [AcctCode, string, number][] = [
  ["au-google", "2026-06-14", 4], ["au-google", "2026-06-15", 19], ["nz-google", "2026-06-15", 2],
  ["uk-google", "2026-06-15", 14], ["au-google", "2026-06-16", 20], ["nz-google", "2026-06-16", 4],
  ["uk-google", "2026-06-16", 12], ["au-google", "2026-06-17", 27], ["nz-google", "2026-06-17", 2],
  ["uk-google", "2026-06-17", 13], ["au-google", "2026-06-18", 26.5], ["nz-google", "2026-06-18", 3],
  ["uk-google", "2026-06-18", 24], ["au-google", "2026-06-19", 22.5], ["uk-google", "2026-06-19", 12],
  ["au-google", "2026-06-20", 2], ["au-google", "2026-06-21", 6], ["au-google", "2026-06-22", 31.5],
  ["nz-google", "2026-06-22", 4], ["uk-google", "2026-06-22", 11], ["au-google", "2026-06-23", 18.5],
  ["nz-google", "2026-06-23", 6], ["uk-google", "2026-06-23", 20], ["au-google", "2026-06-24", 29.7],
  ["nz-google", "2026-06-24", 3], ["uk-google", "2026-06-24", 16], ["au-google", "2026-06-25", 26.3],
  ["nz-google", "2026-06-25", 4], ["uk-google", "2026-06-25", 20], ["au-google", "2026-06-26", 25],
  ["nz-google", "2026-06-26", 3], ["uk-google", "2026-06-26", 16], ["au-google", "2026-06-27", 3],
  ["au-google", "2026-06-28", 4], ["au-google", "2026-06-29", 28], ["nz-google", "2026-06-29", 5],
  ["uk-google", "2026-06-29", 20], ["au-google", "2026-06-30", 28.5], ["nz-google", "2026-06-30", 5],
  ["uk-google", "2026-06-30", 23], ["au-google", "2026-07-01", 34.5], ["nz-google", "2026-07-01", 4],
  ["uk-google", "2026-07-01", 23], ["au-google", "2026-07-02", 33], ["nz-google", "2026-07-02", 5],
  ["uk-google", "2026-07-02", 18], ["au-google", "2026-07-03", 18], ["nz-google", "2026-07-03", 5],
  ["uk-google", "2026-07-03", 10], ["au-google", "2026-07-04", 10], ["au-google", "2026-07-05", 3.5],
  ["au-google", "2026-07-06", 26.5], ["nz-google", "2026-07-06", 2], ["uk-google", "2026-07-06", 18],
  ["au-google", "2026-07-07", 27.3], ["nz-google", "2026-07-07", 1], ["uk-google", "2026-07-07", 24.3],
  ["au-google", "2026-07-08", 35.7], ["nz-google", "2026-07-08", 3], ["uk-google", "2026-07-08", 9.7],
  ["au-google", "2026-07-09", 29], ["nz-google", "2026-07-09", 4], ["uk-google", "2026-07-09", 18.5],
  ["au-google", "2026-07-10", 25], ["nz-google", "2026-07-10", 1], ["uk-google", "2026-07-10", 14.5],
  ["au-google", "2026-07-11", 20], ["au-google", "2026-07-12", 26], ["au-google", "2026-07-13", 41],
  ["nz-google", "2026-07-13", 5], ["uk-google", "2026-07-13", 27],
];

// [acct, campaignName, spend, impressions, clicks, conversions]
export const GOOGLE_CAMPAIGNS: [AcctCode, string, number, number, number, number][] = [
  ["au-google", "AU-SC - Franchise", 8401.51, 3888, 240, 70.2],
  ["au-google", "AU-SC - Contracts", 18337.69, 6658, 460, 126.1],
  ["au-google", "AU-SC - Business", 28804.72, 15025, 901, 197.4],
  ["au-google", "AU-SC - Trade Marks", 23272.87, 20486, 1272, 227.1],
  ["au-google", "AU-SC - All High Converters", 30143.39, 21464, 1799, 299.6],
  ["au-google", "AU-SC - Leasing", 5477.83, 3626, 202, 56.5],
  ["au-google", "AU-SC - IP", 12470.93, 6877, 390, 101.6],
  ["au-google", "AU-SC - Business - Call Only", 1253.33, 542, 27, 9],
  ["au-google", "AU-SC - Contract - Call Only", 1362.31, 1327, 48, 17.5],
  ["au-google", "AU-SC - Employment", 3510.03, 2838, 244, 35],
  ["au-google", "AU-SC - Debt Recovery", 1731.68, 1264, 91, 20],
  ["au-google", "AU-SC - Startup", 5345.16, 3103, 171, 44.2],
  ["au-google", "AU-SC - Disputes", 13756.62, 12296, 515, 122.3],
  ["au-google", "AU-SC - Business - Selling & Buying", 3359.56, 3233, 178, 27.7],
  ["au-google", "AU-SC - IT", 3587.21, 2421, 139, 17.1],
  ["au-google", "AU-SC - eCommerce", 623.95, 276, 20, 1],
  ["au-google", "AU-SC - Regulatory and Compliance", 5762.22, 4251, 288, 65.2],
  ["au-google", "AU-SC - Local", 8039.44, 4656, 327, 69],
  ["au-google", "AU-SC - Legal Documents", 16118.37, 14922, 815, 131.8],
  ["au-google", "AU - Demand Gen", 1399.89, 68343, 604, 2.6],
  ["uk-google", "UK-SC - Business - Selling & Buying", 2859.15, 3217, 164, 30.5],
  ["uk-google", "UK-SC - Business", 22962.36, 39457, 1486, 231.3],
  ["uk-google", "UK-SC - Contract", 8302.83, 13539, 417, 84.2],
  ["uk-google", "UK-SC - Employment", 607.01, 974, 52, 10],
  ["uk-google", "UK-SC - Franchise", 2216.99, 1077, 69, 18],
  ["uk-google", "UK-SC - IP", 2451.38, 2927, 94, 28],
  ["uk-google", "UK-SC - IT", 2135.74, 3575, 124, 15],
  ["uk-google", "UK-SC - Leasing", 10410.79, 9590, 505, 127.5],
  ["uk-google", "UK-SC - Legal Documents", 6814.89, 9479, 321, 68.7],
  ["uk-google", "UK-SC - Startup", 2670.52, 2035, 140, 31],
  ["uk-google", "UK-SC - Trademark", 11672.91, 25752, 1696, 91.5],
  ["uk-google", "UK-SC - Local", 967.03, 306, 26, 5],
  ["uk-google", "UK-SC - Disputes", 12046.3, 21593, 705, 117.3],
  ["uk-google", "UK - Demand Gen", 429.03, 25229, 260, 1.8],
  ["nz-google", "NZ-SC - Startup", 819.65, 521, 31, 6.5],
  ["nz-google", "NZ-SC - Business", 3766.52, 1662, 139, 36.7],
  ["nz-google", "NZ-SC - IT", 499.4, 434, 36, 8.5],
  ["nz-google", "NZ-SC - IP", 848.74, 688, 55, 10],
  ["nz-google", "NZ-SC - Legal Documents", 2269.8, 2732, 148, 14.8],
  ["nz-google", "NZ-SC - Local", 864.47, 308, 32, 8],
  ["nz-google", "NZ-SC - Employment", 433.6, 1096, 58, 5],
  ["nz-google", "NZ-SC - Franchise", 1512.84, 422, 45, 11.5],
  ["nz-google", "NZ-SC - Trademark", 2281.21, 2176, 177, 21],
  ["nz-google", "NZ-SC - Business - Call Only", 571.44, 332, 22, 8],
  ["nz-google", "NZ-SC - Business - Selling & Buying", 728.22, 718, 67, 9],
  ["nz-google", "NZ-SC - Contract", 2469.77, 1509, 82, 15],
  ["nz-google", "NZ-SC - Debt Recovery", 1079.69, 504, 41, 5],
  ["nz-google", "NZ-SC - Leasing", 1213.44, 773, 35, 11],
  ["nz-google", "NZ-SC - Disputes", 1091.06, 1380, 83, 14],
  ["nz-google", "NZ - Demand Gen", 515.43, 50410, 1485, 3],
];

// [acct, campaignName, liveLeads]
export const GOOGLE_CAMPAIGN_LIVE_LEADS: [AcctCode, string, number][] = [
  ["au-google", "AU-SC - Contracts", 55.1], ["au-google", "AU-SC - Business", 74],
  ["au-google", "AU-SC - All High Converters", 119.5], ["au-google", "AU-SC - Franchise", 31.5],
  ["au-google", "AU-SC - IP", 42.8], ["au-google", "AU-SC - Debt Recovery", 7],
  ["au-google", "AU-SC - Startup", 19.5], ["au-google", "AU-SC - Disputes", 40.5],
  ["au-google", "AU-SC - Business - Selling & Buying", 13.3], ["au-google", "AU-SC - Trade Marks", 92.5],
  ["au-google", "AU-SC - Legal Documents", 63], ["au-google", "AU-SC - Leasing", 24.5],
  ["au-google", "AU-SC - Employment", 8], ["au-google", "AU-SC - Local", 26],
  ["au-google", "AU-SC - IT", 5], ["au-google", "AU-SC - Regulatory and Compliance", 21.2],
  ["au-google", "AU-SC - Business - Call Only", 1], ["au-google", "AU-SC - Contract - Call Only", 6.5],
  ["au-google", "AU-SC - eCommerce", 0],
  ["uk-google", "UK-SC - Business", 71.3], ["uk-google", "UK-SC - IT", 6],
  ["uk-google", "UK-SC - Leasing", 50.5], ["uk-google", "UK-SC - Legal Documents", 31.7],
  ["uk-google", "UK-SC - Trademark", 91.5], ["uk-google", "UK-SC - Disputes", 37.3],
  ["uk-google", "UK-SC - Contract", 30.2], ["uk-google", "UK-SC - IP", 12],
  ["uk-google", "UK-SC - Business - Selling & Buying", 7.5], ["uk-google", "UK-SC - Startup", 16],
  ["uk-google", "UK-SC - Franchise", 7], ["uk-google", "UK-SC - Local", 2],
  ["uk-google", "UK - Demand Gen", 1],
  ["nz-google", "NZ-SC - Business", 12], ["nz-google", "NZ-SC - Legal Documents", 5.5],
  ["nz-google", "NZ-SC - IP", 2], ["nz-google", "NZ-SC - Business - Call Only", 4],
  ["nz-google", "NZ-SC - Disputes", 5], ["nz-google", "NZ-SC - IT", 3],
  ["nz-google", "NZ-SC - Trademark", 11], ["nz-google", "NZ-SC - Business - Selling & Buying", 3.5],
  ["nz-google", "NZ-SC - Startup", 3], ["nz-google", "NZ-SC - Contract", 6],
  ["nz-google", "NZ-SC - Leasing", 4.5], ["nz-google", "NZ-SC - Franchise", 4],
  ["nz-google", "NZ-SC - Local", 2.5], ["nz-google", "NZ-SC - Debt Recovery", 2],
  ["nz-google", "NZ - Demand Gen", 2], ["nz-google", "NZ-SC - Employment", 1],
];

/**
 * REAL Meta Ads data — pulled 2026-08-18 via the Meta Marketing API (LegalVision AU
 * `act_572916339475556`, LegalVision UK `act_3250766361819452`), window `last_30d`.
 * NZ Meta (`act_175621377645284`) is not yet enabled for API access (Meta rollout), so
 * it stays absent — matching the account picker.
 *
 * The two lead types are DISTINCT Meta results and must never be blended:
 *  - SME Publication → Meta lead-form submissions   (`actions:leadgen.other`, the `lead` field)
 *  - BOFU            → "30 Day Trial" custom conversion (`offsite_conversion.custom.*`)
 * They come from different result fields, so the app reports them as separate tiles.
 */

export type MetaFunnel = "BOFU" | "SME Publication" | "Traffic";
export type MetaMarket = "AU" | "UK";
export type MetaCurrency = "AUD" | "GBP";

export interface MetaAccountSnap {
  acct: AcctCode;
  market: MetaMarket;
  currency: MetaCurrency;
  spend: number;
  impressions: number;
  reach: number; // deduplicated, account-level (non-additive across days)
  frequency: number;
  clicks: number;
  ctr: number; // %
  cpc: number;
  cpm: number;
  linkClicks: number; // outbound clicks
  lpv: number;
  smeLeads: number; // Meta lead-form submissions
  smeSpend: number; // spend on the SME Publication campaign
  bofuTrials: number; // "30 Day Trial" custom conversions
  bofuSpend: number; // spend on the BOFU-Conversions campaign
}

export interface MetaCampaignSnap {
  acct: AcctCode;
  market: MetaMarket;
  currency: MetaCurrency;
  id: string;
  name: string;
  funnel: MetaFunnel;
  objective: CampaignType; // Meta objective mapped to our union
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  linkClicks: number;
  lpv: number;
  leads: number; // SME lead-form submissions (0 for non-SME)
  leadCpl: number | null;
  trials: number; // BOFU trial conversions (0 for non-BOFU)
  trialCpl: number | null;
}

export const META_ACCOUNTS: MetaAccountSnap[] = [
  {
    acct: "au-meta", market: "AU", currency: "AUD",
    spend: 4383.95, impressions: 206901, reach: 84952, frequency: 2.44,
    clicks: 6643, ctr: 3.21, cpc: 0.66, cpm: 21.19, linkClicks: 4369, lpv: 3738,
    smeLeads: 77, smeSpend: 1324.27, bofuTrials: 43, bofuSpend: 1865.2,
  },
  {
    acct: "uk-meta", market: "UK", currency: "GBP",
    spend: 1464.24, impressions: 61380, reach: 25437, frequency: 2.41,
    clicks: 3524, ctr: 5.74, cpc: 0.42, cpm: 23.86, linkClicks: 2175, lpv: 1295,
    smeLeads: 16, smeSpend: 495.7, bofuTrials: 8, bofuSpend: 511.46,
  },
];

/** Real active Meta campaigns (last_30d) with their own distinct metrics. */
export const META_CAMPAIGNS: MetaCampaignSnap[] = [
  {
    acct: "au-meta", market: "AU", currency: "AUD",
    id: "au-bofu-conversions-jun2026", name: "BOFU-Conversions-Jun2026", funnel: "BOFU", objective: "Sales",
    spend: 1865.2, impressions: 62344, reach: 20291, frequency: 3.07, clicks: 1019, ctr: 1.63, cpc: 1.83, cpm: 29.92,
    linkClicks: 373, lpv: 267, leads: 0, leadCpl: null, trials: 43, trialCpl: 43.38,
  },
  {
    acct: "au-meta", market: "AU", currency: "AUD",
    id: "au-tofu-leads-publications-may2026", name: "TOFU-Leads-Publications-May2026", funnel: "SME Publication", objective: "Leads",
    spend: 1324.27, impressions: 61238, reach: 25991, frequency: 2.36, clicks: 1556, ctr: 2.54, cpc: 0.85, cpm: 21.62,
    linkClicks: 1556, lpv: 16, leads: 77, leadCpl: 17.2, trials: 0, trialCpl: null,
  },
  {
    acct: "au-meta", market: "AU", currency: "AUD",
    id: "au-tofu-traffic-jun2026", name: "TOFU-Traffic-Jun2026", funnel: "Traffic", objective: "Traffic",
    spend: 1194.48, impressions: 83319, reach: 42059, frequency: 1.98, clicks: 4068, ctr: 4.88, cpc: 0.29, cpm: 14.34,
    linkClicks: 3996, lpv: 3455, leads: 0, leadCpl: null, trials: 0, trialCpl: null,
  },
  {
    acct: "uk-meta", market: "UK", currency: "GBP",
    id: "uk-bofu-conversions-jun2026", name: "BOFU-Conversions-Jun2026", funnel: "BOFU", objective: "Sales",
    spend: 511.46, impressions: 12097, reach: 3663, frequency: 3.3, clicks: 366, ctr: 3.03, cpc: 1.4, cpm: 42.28,
    linkClicks: 168, lpv: 58, leads: 0, leadCpl: null, trials: 8, trialCpl: 63.93,
  },
  {
    acct: "uk-meta", market: "UK", currency: "GBP",
    id: "uk-tofu-leads-publications-may2026", name: "TOFU-Leads-Publications-May2026", funnel: "SME Publication", objective: "Leads",
    spend: 495.7, impressions: 19856, reach: 7049, frequency: 2.82, clicks: 279, ctr: 1.41, cpc: 1.78, cpm: 24.96,
    linkClicks: 279, lpv: 1, leads: 16, leadCpl: 30.98, trials: 0, trialCpl: null,
  },
  {
    acct: "uk-meta", market: "UK", currency: "GBP",
    id: "uk-tofu-traffic-jun2026", name: "TOFU-Traffic-Jun2026", funnel: "Traffic", objective: "Traffic",
    spend: 457.08, impressions: 29427, reach: 14794, frequency: 1.99, clicks: 2879, ctr: 9.78, cpc: 0.16, cpm: 15.53,
    linkClicks: 2007, lpv: 1236, leads: 0, leadCpl: null, trials: 0, trialCpl: null,
  },
];
