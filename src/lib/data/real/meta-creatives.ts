import type { CurrencyCode, MarketCode } from "../../domain/types";
import type { MetaFunnel } from "./snapshot";

/**
 * REAL LegalVision Meta ads — pulled 2026-08-18 via the Meta Marketing API
 * (ad-level insights + creatives), window `last_30d`, LegalVision AU + UK.
 *
 * Ad IMAGES: the two static BOFU image ads and the AU testimonial expose a full-res
 * creative image, downloaded to /public/meta and served locally (Meta CDN URLs are
 * signed + expiring and can't be hot-linked). UGC video ads and link-preview
 * (lead-magnet) creatives only expose a tiny signed thumbnail, so those render the real
 * ad copy on a branded panel; the cached full image drops in when a Meta system-user
 * token is connected (server cache job).
 *
 * `fatigue` is computed downstream from `frequency` against an editable per-funnel
 * threshold (retargeted BOFU tolerates a higher frequency than prospecting) — see
 * MetaAdsPanel. It is intentionally NOT baked here.
 */

export interface MetaAd {
  id: string;
  accountId: "au-meta" | "uk-meta";
  market: MarketCode;
  currency: CurrencyCode;
  campaignName: string;
  funnel: MetaFunnel;
  adName: string;
  headline: string;
  primaryText: string;
  cta: string;
  format: "Image" | "Video";
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  ctr: number; // %
  cpc: number;
  resultLabel: string; // "Leads (form)" | "Trials" | "Landing page views"
  resultValue: number;
  resultCpa: number | null;
  thumbnailPath: string | null;
}

const BEIGE_BODY =
  "🚀 As your business grows, contracts, employment issues and regulatory questions become more common. Our legal membership gives you unlimited access to experienced business lawyers for one predictable monthly fee. Request a free consultation today. T&Cs apply.";
const UNPAID_BODY =
  "Have a client who won't pay? Overdue invoices can seriously disrupt your cash flow – if you don't know how to recover them. This free guide walks Australian businesses through every stage of debt recovery – from letters of demand to your court options.";
const DISPUTES_BODY =
  "A business dispute can cost you more than just money – if you don't know your options. This free guide helps UK businesses resolve conflicts without lengthy court proceedings.";

const ADS: MetaAd[] = [
  // ── AU ──────────────────────────────────────────────────────────────────
  {
    id: "au-6957812930554", accountId: "au-meta", market: "AU", currency: "AUD",
    campaignName: "BOFU-Conversions-Jun2026", funnel: "BOFU", adName: "Beige BOF",
    headline: "Book a free consultation today", primaryText: BEIGE_BODY, cta: "Contact us", format: "Image",
    spend: 1660.32, impressions: 56427, reach: 19378, frequency: 2.91, ctr: 1.63, cpc: 1.8,
    resultLabel: "Trials", resultValue: 38, resultCpa: 43.69, thumbnailPath: "/meta/au-beige-bof.png",
  },
  {
    id: "au-6969857828954", accountId: "au-meta", market: "AU", currency: "AUD",
    campaignName: "TOFU-Leads-Publications-May2026", funnel: "SME Publication", adName: "Unpaid Invoices – OTP",
    headline: "How to Recover Unpaid Invoices", primaryText: UNPAID_BODY, cta: "Download", format: "Image",
    spend: 997.7, impressions: 53523, reach: 23474, frequency: 2.28, ctr: 2.63, cpc: 0.71,
    resultLabel: "Leads (form)", resultValue: 67, resultCpa: 14.89, thumbnailPath: null,
  },
  {
    id: "au-6961904496754", accountId: "au-meta", market: "AU", currency: "AUD",
    campaignName: "TOFU-Traffic-Jun2026", funnel: "Traffic", adName: "Female UGC – I Used To Sign Contracts",
    headline: "“I used to sign contracts without reading them”",
    primaryText: "A LegalVision member shares why unlimited legal advice changed how her business handles contracts.",
    cta: "Learn more", format: "Video",
    spend: 917.72, impressions: 66067, reach: 35071, frequency: 1.88, ctr: 5.2, cpc: 0.27,
    resultLabel: "Landing page views", resultValue: 2987, resultCpa: 0.31, thumbnailPath: null,
  },
  {
    id: "au-6961904496954", accountId: "au-meta", market: "AU", currency: "AUD",
    campaignName: "TOFU-Traffic-Jun2026", funnel: "Traffic", adName: "UGC Mar – The Worst Feeling",
    headline: "“The worst feeling is a legal problem you didn’t see coming”",
    primaryText: "Real businesses share how on-call legal support helps them move faster with confidence.",
    cta: "Learn more", format: "Video",
    spend: 276.76, impressions: 17252, reach: 10547, frequency: 1.64, ctr: 3.68, cpc: 0.44,
    resultLabel: "Landing page views", resultValue: 468, resultCpa: 0.59, thumbnailPath: null,
  },
  {
    id: "au-6954721102354", accountId: "au-meta", market: "AU", currency: "AUD",
    campaignName: "TOFU-Leads-Publications-May2026", funnel: "SME Publication", adName: "Unpaid Invoices",
    headline: "How to Recover Unpaid Invoices", primaryText: UNPAID_BODY, cta: "Download", format: "Image",
    spend: 236.28, impressions: 6505, reach: 4567, frequency: 1.42, ctr: 1.8, cpc: 2.02,
    resultLabel: "Leads (form)", resultValue: 7, resultCpa: 33.75, thumbnailPath: null,
  },
  {
    id: "au-6956648358754", accountId: "au-meta", market: "AU", currency: "AUD",
    campaignName: "BOFU-Conversions-Jun2026", funnel: "BOFU", adName: "Green BOF",
    headline: "Book a free consultation today", primaryText: BEIGE_BODY, cta: "Contact us", format: "Image",
    spend: 114.13, impressions: 3535, reach: 2033, frequency: 1.74, ctr: 1.07, cpc: 3.0,
    resultLabel: "Trials", resultValue: 2, resultCpa: 57.07, thumbnailPath: "/meta/au-green-bof.png",
  },
  {
    id: "au-6956570987354", accountId: "au-meta", market: "AU", currency: "AUD",
    campaignName: "BOFU-Conversions-Jun2026", funnel: "BOFU", adName: "Janet testimonial",
    headline: "“LegalVision feels like having an in-house legal team”",
    primaryText: "Hear how a LegalVision member uses unlimited legal support to grow with confidence.",
    cta: "Contact us", format: "Image",
    spend: 84.01, impressions: 2109, reach: 1249, frequency: 1.69, ctr: 2.56, cpc: 1.56,
    resultLabel: "Trials", resultValue: 3, resultCpa: 28.0, thumbnailPath: "/meta/au-janet-testimonial.png",
  },
  {
    id: "au-6954721102754", accountId: "au-meta", market: "AU", currency: "AUD",
    campaignName: "TOFU-Leads-Publications-May2026", funnel: "SME Publication", adName: "Hire & Inspire",
    headline: "5 Mistakes That Cost Employers Thousands",
    primaryText: "Hiring mistakes can cost thousands in claims and penalties. This free guide shows Australian employers how to hire with confidence and stay protected.",
    cta: "Download", format: "Image",
    spend: 75.49, impressions: 957, reach: 511, frequency: 1.87, ctr: 2.61, cpc: 3.02,
    resultLabel: "Leads (form)", resultValue: 3, resultCpa: 25.16, thumbnailPath: null,
  },
  // ── UK ──────────────────────────────────────────────────────────────────
  {
    id: "uk-120250528402260220", accountId: "uk-meta", market: "UK", currency: "GBP",
    campaignName: "BOFU-Conversions-Jun2026", funnel: "BOFU", adName: "Green BOF – Your on-call legal team",
    headline: "Your on-call legal team",
    primaryText: "What if legal support didn’t have to be expensive, slow or unpredictable? LegalVision gives UK businesses unlimited access to experienced lawyers for a simple monthly fee.",
    cta: "Contact us", format: "Image",
    spend: 463.32, impressions: 11088, reach: 3598, frequency: 3.08, ctr: 3.02, cpc: 1.38,
    resultLabel: "Trials", resultValue: 8, resultCpa: 57.92, thumbnailPath: null,
  },
  {
    id: "uk-120248557205400220", accountId: "uk-meta", market: "UK", currency: "GBP",
    campaignName: "TOFU-Traffic-Jun2026", funnel: "Traffic", adName: "Female UGC Creator Video Mar 2026",
    headline: "Real businesses, real legal support",
    primaryText: "See why thousands of UK businesses trust LegalVision for unlimited, on-call legal advice.",
    cta: "Learn more", format: "Video",
    spend: 311.43, impressions: 21223, reach: 11296, frequency: 1.88, ctr: 8.62, cpc: 0.17,
    resultLabel: "Landing page views", resultValue: 857, resultCpa: 0.36, thumbnailPath: null,
  },
  {
    id: "uk-120251389989520220", accountId: "uk-meta", market: "UK", currency: "GBP",
    campaignName: "TOFU-Leads-Publications-May2026", funnel: "SME Publication", adName: "Resolving Business Disputes – OTP",
    headline: "Guide to Resolving UK Business Disputes", primaryText: DISPUTES_BODY, cta: "Download", format: "Image",
    spend: 240.34, impressions: 8658, reach: 4008, frequency: 2.16, ctr: 1.26, cpc: 2.2,
    resultLabel: "Leads (form)", resultValue: 3, resultCpa: 80.11, thumbnailPath: null,
  },
  {
    id: "uk-120247641742630220", accountId: "uk-meta", market: "UK", currency: "GBP",
    campaignName: "TOFU-Leads-Publications-May2026", funnel: "SME Publication", adName: "Resolving Business Disputes",
    headline: "Guide to Resolving UK Business Disputes", primaryText: DISPUTES_BODY, cta: "Download", format: "Image",
    spend: 206.72, impressions: 9219, reach: 4505, frequency: 2.05, ctr: 1.46, cpc: 1.53,
    resultLabel: "Leads (form)", resultValue: 10, resultCpa: 20.67, thumbnailPath: null,
  },
  {
    id: "uk-120248557432820220", accountId: "uk-meta", market: "UK", currency: "GBP",
    campaignName: "TOFU-Traffic-Jun2026", funnel: "Traffic", adName: "Male UGC Creator Video May 2026",
    headline: "Your legal team, without the unpredictable costs",
    primaryText: "Unlimited access to experienced lawyers for a simple monthly fee. See why UK businesses switch to LegalVision.",
    cta: "Learn more", format: "Video",
    spend: 145.65, impressions: 8204, reach: 4397, frequency: 1.87, ctr: 12.79, cpc: 0.14,
    resultLabel: "Landing page views", resultValue: 379, resultCpa: 0.38, thumbnailPath: null,
  },
  {
    id: "uk-120250396710290220", accountId: "uk-meta", market: "UK", currency: "GBP",
    campaignName: "BOFU-Conversions-Jun2026", funnel: "BOFU", adName: "Janet testimonial – orange",
    headline: "“LegalVision feels like having an in-house legal team”",
    primaryText: "Hear how a LegalVision member uses unlimited legal support to grow with confidence.",
    cta: "Contact us", format: "Image",
    spend: 29.15, impressions: 558, reach: 268, frequency: 2.08, ctr: 4.3, cpc: 1.21,
    resultLabel: "Trials", resultValue: 0, resultCpa: null, thumbnailPath: null,
  },
  {
    id: "uk-120251848759790220", accountId: "uk-meta", market: "UK", currency: "GBP",
    campaignName: "TOFU-Leads-Publications-May2026", funnel: "SME Publication", adName: "When A Customer Won't Pay – OTP",
    headline: "What to Do When a Customer Won’t Pay",
    primaryText: "Overdue invoices disrupt cash flow. This free guide walks UK businesses through recovering what they’re owed.",
    cta: "Download", format: "Image",
    spend: 24.78, impressions: 965, reach: 640, frequency: 1.51, ctr: 2.28, cpc: 1.13,
    resultLabel: "Leads (form)", resultValue: 2, resultCpa: 12.39, thumbnailPath: null,
  },
  {
    id: "uk-120251848638660220", accountId: "uk-meta", market: "UK", currency: "GBP",
    campaignName: "TOFU-Leads-Publications-May2026", funnel: "SME Publication", adName: "Hiring At Scale – OTP",
    headline: "Hiring at Scale: A Legal Guide",
    primaryText: "Growing your team? This free guide helps UK employers hire compliantly and avoid costly mistakes.",
    cta: "Download", format: "Image",
    spend: 23.86, impressions: 1014, reach: 580, frequency: 1.75, ctr: 1.28, cpc: 1.84,
    resultLabel: "Leads (form)", resultValue: 1, resultCpa: 23.86, thumbnailPath: null,
  },
];

export function realMetaAds(): MetaAd[] {
  return ADS;
}
