import type { ConversionAction, MarketCode } from "../domain/types";

/**
 * REAL Google Ads conversion actions (last 30d, pulled 2026-07-14 via Windsor).
 * The per-account "Live Leads (… Enhanced)" action is mapped to logical_metric='live_leads'
 * (A1). Other lead-category actions map to 'leads'; the rest to 'other'.
 */

type Row = [MarketCode, string, string, number, "lead" | "other", "live_leads" | "leads" | "other"];

const ROWS: Row[] = [
  // Australia (161-014-9859)
  ["AU", "au-google", "Live Leads (AU Enhanced)", 650.79, "lead", "live_leads"],
  ["AU", "au-google", "LegalVision - GA4 (web) generate_lead", 501.54, "lead", "leads"],
  ["AU", "au-google", "LegalVision - GA4 (web) phone_lead", 415, "lead", "leads"],
  ["AU", "au-google", "Calls from ads", 71, "lead", "leads"],
  ["AU", "au-google", "Quote Sent (AU)", 2.57, "lead", "other"],
  ["AU", "au-google", "Meeting Booked (AU)", 0, "lead", "other"],
  ["AU", "au-google", "LEAD_tagmanager", 0, "other", "other"],
  // New Zealand (682-873-3592)
  ["NZ", "nz-google", "Live Leads (NZ Enhanced)", 70.97, "lead", "live_leads"],
  ["NZ", "nz-google", "LegalVision NZ - GA4 (web) phone_lead", 66, "lead", "leads"],
  ["NZ", "nz-google", "LEAD_signup", 48, "lead", "leads"],
  ["NZ", "nz-google", "Quote Sent (NZ)", 2, "lead", "other"],
  ["NZ", "nz-google", "Meeting Booked (NZ)", 1, "lead", "other"],
  // United Kingdom (921-266-0072)
  ["UK", "uk-google", "Live Leads (UK Enhanced)", 363.98, "lead", "live_leads"],
  ["UK", "uk-google", "GA4_LEAD_Thank_you", 249, "lead", "leads"],
  ["UK", "uk-google", "phone_lead - GA4 (web)", 140, "lead", "leads"],
  ["UK", "uk-google", "Calls from ads", 106, "lead", "leads"],
  ["UK", "uk-google", "Quote Sent (UK)", 0.79, "lead", "other"],
];

export function realConversionActions(): ConversionAction[] {
  return ROWS.map((r, i) => ({
    id: `ca-${r[1]}-${i}`,
    accountId: r[1],
    market: r[0],
    name: r[2],
    category: r[4],
    logicalMetric: r[5],
    conversions: r[3],
    conversionValue: 0,
    source: "windsor",
  }));
}
