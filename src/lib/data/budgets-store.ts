import "server-only";
import { AD_ACCOUNTS } from "../domain/accounts";
import type { Budget, CurrencyCode } from "../domain/types";
import { kvGet, kvSet } from "./kv";

/**
 * Per-account monthly budgets, persisted in Postgres (`app_kv` key "budgets", via the
 * Admin → Budgets UI). Falls back to seeded defaults keyed to real spend run-rate.
 */

const PERIOD_START = "2026-07-01";
const PERIOD_END = "2026-07-31";
const KV_KEY = "budgets";

// Seed defaults (native currency) ≈ actual monthly run-rate (spend-to-date ÷ elapsed)
// from the real July pull, so out-of-box pacing is sensible. Override in Admin → Budgets.
const DEFAULTS: Record<string, number> = {
  "au-google": 205000,
  "uk-google": 88000,
  "nz-google": 21000,
  "au-meta": 7000,
  "uk-meta": 2000,
  "nz-meta": 0, // access-gated → "Budget not set"
};

type StoredBudgets = Record<string, number>;

async function readStore(): Promise<StoredBudgets> {
  return kvGet<StoredBudgets>(KV_KEY, {});
}

export async function budgetAmounts(): Promise<Record<string, number>> {
  const stored = await readStore();
  const out: Record<string, number> = { ...DEFAULTS };
  for (const [k, v] of Object.entries(stored)) out[k] = v;
  return out;
}

export async function allBudgets(): Promise<Budget[]> {
  const amounts = await budgetAmounts();
  return AD_ACCOUNTS.map((acct) => ({
    id: `${acct.id}-2026-07`,
    scopeType: "account" as const,
    scopeId: acct.id,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    amount: amounts[acct.id] ?? 0,
    currency: acct.currency as CurrencyCode,
    source: "manual" as const,
  }));
}

export async function budgetFor(accountId: string): Promise<Budget | undefined> {
  return (await allBudgets()).find((b) => b.scopeId === accountId);
}

/** Persist a single account's monthly budget (called by the Admin server action). */
export async function setBudget(accountId: string, amount: number): Promise<void> {
  const store = await readStore();
  store[accountId] = amount;
  await kvSet(KV_KEY, store);
}
