import "server-only";
import { kvGet, kvSet } from "../data/kv";

/**
 * Auto-pacing configuration (Admin → Auto-pacing), persisted in Postgres.
 *
 * Phased by design and SAFE BY DEFAULT:
 *   • "off"       — engine idle, nothing computed for the cron.
 *   • "recommend" — recommendations are shown in the dashboard; NO budgets are changed
 *                   automatically. An admin applies them with one click.
 *   • "auto"      — the daily cron applies the recommendations within the guardrails below.
 *
 * Only Meta campaigns that use a campaign-level DAILY budget are managed. Lifetime budgets,
 * ad-set-level budgets (CBO off) and non-funnel campaigns (events/legacy) are left untouched.
 */

export type AutopaceMode = "off" | "recommend" | "auto";
export type FunnelKey = "BOFU" | "SME Publication" | "Traffic";
export type AllocationMode = "auto" | "manual";

/** Per-account manual budget split by funnel, as % of the monthly budget. */
export type AccountAllocation = Partial<Record<FunnelKey, number>>;

export interface AutopaceConfig {
  mode: AutopaceMode;
  /** Managed Meta account ids (our internal ids, e.g. "au-meta"). Empty = none. */
  accounts: string[];
  /** Aim to spend this % of the monthly budget by month-end (100 = land exactly on budget). */
  targetUtilisationPct: number;
  /** Max % a single campaign's daily budget may move in one run (damps swings). */
  maxChangePct: number;
  /** Absolute floor for any managed daily budget, native currency (Meta enforces its own min too). */
  minDailyBudget: number;
  /** Absolute ceiling for any managed daily budget, native currency (0 = no ceiling). */
  maxDailyBudget: number;
  /** Don't bother applying a change smaller than this, native currency (noise guard). */
  minChangeAbs: number;
  /**
   * How the account budget is split across funnels:
   *  - "auto"   → proportional to each campaign's current daily budget (default).
   *  - "manual" → each funnel gets a fixed % of the monthly budget (see `allocations`),
   *               and is paced to that sub-budget independently.
   */
  allocationMode: AllocationMode;
  /** accountId → funnel → % of monthly budget (manual mode). Shares are normalised if ≠ 100. */
  allocations: Record<string, AccountAllocation>;
  /**
   * AutoProtect — the hard-stop safety net, independent of pacing. When an account's
   * month-to-date spend reaches `capPct` % of its monthly budget, the daily job PAUSES that
   * account's managed campaigns and auto re-enables them at the start of the next month.
   */
  autoProtect: { enabled: boolean; capPct: number };
}

const KV_KEY = "autopace-config";

export const AUTOPACE_DEFAULT: AutopaceConfig = {
  mode: "off",
  accounts: ["au-meta", "uk-meta", "nz-meta"],
  targetUtilisationPct: 100,
  maxChangePct: 25,
  minDailyBudget: 5,
  maxDailyBudget: 0,
  minChangeAbs: 2,
  allocationMode: "auto",
  allocations: {},
  autoProtect: { enabled: false, capPct: 100 },
};

export async function getAutopaceConfig(): Promise<AutopaceConfig> {
  return { ...AUTOPACE_DEFAULT, ...(await kvGet<Partial<AutopaceConfig>>(KV_KEY, {})) };
}

export async function setAutopaceConfig(cfg: AutopaceConfig): Promise<void> {
  await kvSet(KV_KEY, cfg);
}

/** Append-only log of applied budget changes (last 200), for the UI audit trail. */
export interface AutopaceLogEntry {
  at: string;
  accountId: string;
  campaignId: string;
  campaignName: string;
  from: number;
  to: number;
  currency: string;
  mode: AutopaceMode;
  by: string; // "cron" | admin email
}

const LOG_KEY = "autopace-log";

export async function getAutopaceLog(): Promise<AutopaceLogEntry[]> {
  return kvGet<AutopaceLogEntry[]>(LOG_KEY, []);
}

export async function appendAutopaceLog(entries: AutopaceLogEntry[]): Promise<void> {
  if (!entries.length) return;
  const existing = await getAutopaceLog();
  await kvSet(LOG_KEY, [...entries, ...existing].slice(0, 200));
}

/**
 * AutoProtect state — which campaigns AutoProtect paused, and in which month, so the daily
 * job re-enables exactly those (not ones a human paused) when the month rolls over.
 */
export interface AutoProtectState {
  /** accountId → { ym, campaignIds } captured when AutoProtect paused the account. */
  paused: Record<string, { ym: string; campaignIds: string[] }>;
}
const PROTECT_KEY = "autoprotect-state";

export async function getAutoProtectState(): Promise<AutoProtectState> {
  return kvGet<AutoProtectState>(PROTECT_KEY, { paused: {} });
}
export async function setAutoProtectState(s: AutoProtectState): Promise<void> {
  await kvSet(PROTECT_KEY, s);
}
