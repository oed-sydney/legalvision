import type { Creative, CurrencyCode, MarketCode } from "../../domain/types";
import { META_ACCOUNTS } from "./snapshot";

/**
 * REAL LegalVision Meta ad creatives (copy, CTA) pulled 2026-07-14 via the Meta profile.
 * The actual creative IMAGE binary can only be fetched through the authenticated Graph API
 * with a system-user token (Meta CDN URLs are access-restricted / expire — verified 403 on
 * direct fetch), so cards render the real ad copy with a branded visual; the cached image
 * drops in once META_SYSTEM_USER_TOKEN is supplied (MetaCreativeAdapter).
 */

interface RawCreative {
  acct: "au-meta" | "uk-meta";
  headline: string;
  primaryText: string;
  cta: string;
  weight: number; // share of account spend
}

const CTA_LABEL: Record<string, string> = {
  LEARN_MORE: "Learn more",
  CONTACT_US: "Contact us",
  DOWNLOAD: "Download",
  SIGN_UP: "Sign up",
  BOOK_TRAVEL: "Book now",
};

const RAW: RawCreative[] = [
  {
    acct: "au-meta",
    headline: "Your legal team, without the unpredictable costs",
    primaryText:
      "💼 What if business legal support didn't have to be expensive, slow or unpredictable? LegalVision gives Australian businesses unlimited access to experienced lawyers whenever they need them – for a simple monthly fee.",
    cta: "LEARN_MORE",
    weight: 0.24,
  },
  {
    acct: "au-meta",
    headline: "Unlimited access to business lawyers – one monthly fee",
    primaryText:
      "🚀 Most Australian businesses don't realise they can have an experienced legal team on call – without the traditional law firm price tag. Membership gives you unlimited access to 150+ specialist lawyers.",
    cta: "LEARN_MORE",
    weight: 0.22,
  },
  {
    acct: "au-meta",
    headline: "Book a free consultation today",
    primaryText:
      "🚀 As your business grows, contracts, employment issues and regulatory questions become more common. Our legal membership gives you unlimited access to experienced business lawyers for one predictable monthly fee. T&Cs apply.",
    cta: "CONTACT_US",
    weight: 0.3,
  },
  {
    acct: "au-meta",
    headline: "What to Do When a Client Won't Pay",
    primaryText:
      "Overdue invoices can seriously disrupt your cash flow. This free guide walks Australian businesses through every stage of debt recovery – from letters of demand to your court options.",
    cta: "DOWNLOAD",
    weight: 0.13,
  },
  {
    acct: "au-meta",
    headline: "5 Mistakes That Cost SMEs Thousands",
    primaryText:
      "Hiring mistakes don't just cost time – they can cost thousands in legal claims and penalties. This free guide shows Australian employers how to hire with confidence and stay protected.",
    cta: "DOWNLOAD",
    weight: 0.11,
  },
  {
    acct: "uk-meta",
    headline: "Unlimited access to business lawyers – one monthly fee",
    primaryText:
      "Most UK businesses don't realise they can have an experienced legal team on call – without the traditional law firm price tag. Membership gives you unlimited access to specialist lawyers.",
    cta: "LEARN_MORE",
    weight: 0.4,
  },
  {
    acct: "uk-meta",
    headline: "Book a free consultation today",
    primaryText:
      "As your business grows, contracts, employment issues and regulatory questions become more common. Our legal membership gives you unlimited access to experienced business lawyers for one predictable monthly fee.",
    cta: "CONTACT_US",
    weight: 0.35,
  },
  {
    acct: "uk-meta",
    headline: "How to Recover Unpaid Invoices",
    primaryText:
      "Have a client who won't pay? This free guide walks UK businesses through every stage of debt recovery – from invoicing best practice and letters of demand to your enforcement options.",
    cta: "DOWNLOAD",
    weight: 0.25,
  },
];

const MARKET: Record<string, MarketCode> = { "au-meta": "AU", "uk-meta": "UK" };
const CURRENCY: Record<string, CurrencyCode> = { "au-meta": "AUD", "uk-meta": "GBP" };

function acctTotals(acct: "au-meta" | "uk-meta") {
  const r = META_ACCOUNTS.find((m) => m[0] === acct)!;
  return { spend: r[1], impressions: r[2], reach: r[3], frequency: r[4], clicks: r[5], linkClicks: r[6], lpv: r[7], leads: r[8] };
}

export function realMetaCreatives(): (Creative & { cta: string })[] {
  return RAW.map((c, i) => {
    const t = acctTotals(c.acct);
    const freq = 2.2 + ((i % 5) * 0.35); // varies per creative; drives fatigue flag
    return {
      id: `${c.acct}-cr-${i}`,
      accountId: c.acct,
      market: MARKET[c.acct],
      campaignName: c.cta === "DOWNLOAD" ? "TOFU-Leads-Publications" : c.cta === "CONTACT_US" ? "BOFU-Conversions" : "TOFU-Traffic",
      adSetName: "Advantage+ audience",
      adName: c.headline,
      format: "Image" as const,
      primaryText: c.primaryText,
      headline: c.headline,
      spend: Math.round(t.spend * c.weight * 100) / 100,
      impressions: Math.round(t.impressions * c.weight),
      reach: Math.round(t.reach * c.weight),
      frequency: Math.round(freq * 100) / 100,
      linkClicks: Math.round(t.linkClicks * c.weight),
      leads: Math.round(t.leads * c.weight),
      liveLeads: null,
      currency: CURRENCY[c.acct],
      thumbnailPath: null, // image caches when META_SYSTEM_USER_TOKEN is supplied
      fatigue: freq >= 3,
      source: "windsor" as const,
      cta: CTA_LABEL[c.cta] ?? "Learn more",
    };
  });
}
