import type { DateRange } from "./source-adapter";

/**
 * LeadSourceAdapter — CRM / call-tracking join for Meta live leads and Lead Quality v2.
 * The source system is NOT yet confirmed (§31.C), so this is an explicit stub.
 * When it lands: leads match by click ID precedence (gclid/gbraid/wbraid > fbclid >
 * call-tracking ID > fuzzy UTM, flagged "inferred"). NO PII is ever stored (A13).
 */

export interface RawLead {
  externalLeadId: string;
  createdAt: string;
  qualifiedAt: string | null;
  market: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  callTrackingId?: string;
  utmCampaign?: string;
  status: "new" | "live" | "invalid" | "duplicate" | "unmatched";
}

export interface LeadSourceAdapter {
  readonly name: string;
  readonly configured: boolean;
  fetchLeads(range: DateRange): Promise<RawLead[]>;
}

/** Default stub: reports "not configured" so the UI renders v1 (limited) mode. */
export class StubLeadSourceAdapter implements LeadSourceAdapter {
  readonly name = "lead-source-stub";
  readonly configured = false;
  async fetchLeads(): Promise<RawLead[]> {
    return []; // v1 mode: Meta live leads render "—"; Lead Quality shows the pending banner
  }
}

export function getLeadSourceAdapter(): LeadSourceAdapter {
  // When LEAD_SOURCE_SYSTEM + credentials exist, return the concrete adapter here.
  return new StubLeadSourceAdapter();
}
