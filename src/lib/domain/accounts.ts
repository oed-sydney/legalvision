import type { AdAccount, Channel, Market } from "./types";

/**
 * CONFIRMED environmental facts (verified 12 Jul 2026 via Windsor.ai + Meta discovery).
 * Treat as authoritative. Do NOT "correct" UK Google to Europe/London — the platform's
 * own daily buckets are fixed GMT year-round.
 */

export const MARKETS: Market[] = [
  { code: "AU", name: "Australia", currency: "AUD", displayTimezone: "Australia/Sydney" },
  { code: "UK", name: "United Kingdom", currency: "GBP", displayTimezone: "Etc/GMT" },
  { code: "NZ", name: "New Zealand", currency: "NZD", displayTimezone: "Pacific/Auckland" },
];

export const CHANNELS: Channel[] = [
  { code: "google_ads", name: "Google Ads", shortName: "Google" },
  { code: "meta_ads", name: "Meta Ads", shortName: "Meta" },
];

/** Reporting currency for All-markets rollups (assumed AUD — A3). */
export const REPORTING_CURRENCY = "AUD" as const;

export const AD_ACCOUNTS: AdAccount[] = [
  {
    id: "au-google",
    platformAccountId: "161-014-9859",
    market: "AU",
    channel: "google_ads",
    name: "LegalVision",
    currency: "AUD",
    reportingTimezone: "Australia/Sydney",
    status: "active",
    connectedSource: "mock",
  },
  {
    id: "nz-google",
    platformAccountId: "682-873-3592",
    market: "NZ",
    channel: "google_ads",
    name: "LegalVision NZ",
    currency: "NZD",
    reportingTimezone: "Pacific/Auckland",
    status: "active",
    connectedSource: "mock",
  },
  {
    id: "uk-google",
    platformAccountId: "921-266-0072",
    market: "UK",
    channel: "google_ads",
    name: "LegalVision UK",
    currency: "GBP",
    reportingTimezone: "Etc/GMT",
    status: "active",
    connectedSource: "mock",
    notes: "Fixed GMT year-round (no DST) — platform's own daily buckets.",
  },
  {
    id: "au-meta",
    platformAccountId: "572916339475556",
    market: "AU",
    channel: "meta_ads",
    name: "LegalVision",
    currency: "AUD",
    reportingTimezone: "Australia/Sydney",
    status: "active",
    connectedSource: "mock",
  },
  {
    id: "uk-meta",
    platformAccountId: "3250766361819452",
    market: "UK",
    channel: "meta_ads",
    name: "LegalVision UK",
    currency: "GBP",
    reportingTimezone: "Etc/GMT",
    status: "active",
    connectedSource: "mock",
    notes: "Reporting timezone pending Phase-2 validation.",
  },
  {
    id: "nz-meta",
    platformAccountId: "175621377645284",
    market: "NZ",
    channel: "meta_ads",
    name: "LegalVision NZ",
    currency: "NZD",
    reportingTimezone: "Pacific/Auckland",
    status: "pending_access",
    connectedSource: "mock",
    notes: "Access blocked pending Business-Manager system-user token (A11).",
  },
];

export const MARKET_BY_CODE = Object.fromEntries(MARKETS.map((m) => [m.code, m]));
export const ACCOUNT_BY_ID = Object.fromEntries(AD_ACCOUNTS.map((a) => [a.id, a]));

export function accountsFor(opts: {
  market?: string;
  channel?: string;
}): AdAccount[] {
  return AD_ACCOUNTS.filter((a) => {
    if (opts.market && opts.market !== "all" && a.market !== opts.market) return false;
    if (opts.channel && opts.channel !== "all" && a.channel !== opts.channel) return false;
    return true;
  });
}

export function marketName(code: string): string {
  return MARKET_BY_CODE[code]?.name ?? code;
}
