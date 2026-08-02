/**
 * SourceAdapter interface — Framework §16.
 *
 * Swapping the extraction layer (Windsor → direct Google/Meta APIs) must NOT touch
 * reporting code. Adapters fetch raw data; the sync pipeline transforms it into the
 * fact/dim tables that the app reads. Every adapter below is a stub that activates the
 * moment its credentials are supplied (see .env.example); until then the app runs on
 * the isolated mock warehouse (source='mock').
 */

export type Report =
  | "daily_performance"
  | "conversion_actions"
  | "keywords"
  | "search_terms"
  | "quality_score"
  | "meta_breakdowns"
  | "reach_periods";

export interface DateRange {
  from: string; // YYYY-MM-DD account-local
  to: string;
}

export interface SourceAdapter {
  readonly name: string;
  listAccounts(): Promise<{ platformAccountId: string; currency: string; timezone: string }[]>;
  fetchDaily(report: Report, accountId: string, range: DateRange): Promise<unknown[]>;
  fetchEntities(accountId: string): Promise<unknown[]>;
  fetchCreatives?(accountId: string): Promise<unknown[]>;
}

export class AdapterNotConfiguredError extends Error {
  constructor(adapter: string, missing: string) {
    super(`${adapter} is not configured — set ${missing}. Running on mock data until then.`);
    this.name = "AdapterNotConfiguredError";
  }
}

/** Guard used by every real adapter before making a network call. */
export function requireEnv(adapter: string, name: string): string {
  const v = process.env[name];
  if (!v) throw new AdapterNotConfiguredError(adapter, name);
  return v;
}
