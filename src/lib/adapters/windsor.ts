import { requireEnv, type DateRange, type Report, type SourceAdapter } from "./source-adapter";

const WINDSOR_BASE = "https://connectors.windsor.ai/";

/**
 * Windsor.ai Google Ads adapter (account `zeemarketing`, paid plan).
 * VERIFIED QUIRK: never combine the `campaign_status` entity attribute with metric
 * fields in one query — it silently returns stale metrics. Entity attributes are
 * fetched in a separate dimension-only pull (fetchEntities).
 */
export class WindsorGoogleAdapter implements SourceAdapter {
  readonly name = "windsor-google";

  private key() {
    return requireEnv(this.name, "WINDSOR_API_KEY");
  }

  async listAccounts(): Promise<{ platformAccountId: string; currency: string; timezone: string }[]> {
    this.key();
    // GET /google_ads?api_key=…&fields=account_id,account_currency_code,account_time_zone
    throw new Error("WindsorGoogleAdapter.listAccounts not wired — supply WINDSOR_API_KEY.");
  }

  async fetchDaily(report: Report, accountId: string, range: DateRange): Promise<unknown[]> {
    this.key();
    void WINDSOR_BASE;
    void report;
    void accountId;
    void range;
    // Metric pulls exclude campaign_status (stale-data bug). Fields per §9.3.
    throw new Error("WindsorGoogleAdapter.fetchDaily not wired — supply WINDSOR_API_KEY.");
  }

  async fetchEntities(accountId: string): Promise<unknown[]> {
    this.key();
    void accountId;
    // dimension-only pull (campaign_status, names, statuses) — never mixed with metrics
    throw new Error("WindsorGoogleAdapter.fetchEntities not wired — supply WINDSOR_API_KEY.");
  }
}

/** Windsor.ai Meta insights adapter (swap-in: MetaDirectAdapter with ads_read). */
export class WindsorMetaAdapter implements SourceAdapter {
  readonly name = "windsor-meta";
  private key() {
    return requireEnv(this.name, "WINDSOR_API_KEY");
  }
  async listAccounts(): Promise<{ platformAccountId: string; currency: string; timezone: string }[]> {
    this.key();
    throw new Error("WindsorMetaAdapter.listAccounts not wired — supply WINDSOR_API_KEY.");
  }
  async fetchDaily(report: Report, accountId: string, range: DateRange): Promise<unknown[]> {
    this.key();
    void report;
    void accountId;
    void range;
    // Meta breakdowns are pulled as separate segmented queries (never cross-joined).
    throw new Error("WindsorMetaAdapter.fetchDaily not wired — supply WINDSOR_API_KEY.");
  }
  async fetchEntities(accountId: string): Promise<unknown[]> {
    this.key();
    void accountId;
    throw new Error("WindsorMetaAdapter.fetchEntities not wired — supply WINDSOR_API_KEY.");
  }
}
