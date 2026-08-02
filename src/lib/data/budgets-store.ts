import "server-only";
import fs from "node:fs";
import path from "node:path";
import { AD_ACCOUNTS } from "../domain/accounts";
import type { Budget, CurrencyCode } from "../domain/types";

/**
 * Per-account monthly budgets, persisted to data/budgets.json (admin-editable via the
 * Admin → Budgets UI). Falls back to seeded defaults keyed to real spend run-rate.
 * In production this table lives in Postgres (`budgets` + `budget_changes`, §17).
 */

const PERIOD_START = "2026-07-01";
const PERIOD_END = "2026-07-31";
const STORE_PATH = path.join(process.cwd(), "data", "budgets.json");

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

function readStore(): StoredBudgets {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    return JSON.parse(raw) as StoredBudgets;
  } catch {
    return {};
  }
}

export function budgetAmounts(): Record<string, number> {
  const stored = readStore();
  const out: Record<string, number> = { ...DEFAULTS };
  for (const [k, v] of Object.entries(stored)) out[k] = v;
  return out;
}

export function allBudgets(): Budget[] {
  const amounts = budgetAmounts();
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

export function budgetFor(accountId: string): Budget | undefined {
  return allBudgets().find((b) => b.scopeId === accountId);
}

/** Persist a single account's monthly budget (called by the Admin server action). */
export function setBudget(accountId: string, amount: number): void {
  const store = readStore();
  store[accountId] = amount;
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}
