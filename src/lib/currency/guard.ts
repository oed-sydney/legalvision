import type { CurrencyCode } from "../domain/types";

/**
 * GUARDRAIL #3 — mixed-currency sums without conversion are structurally impossible.
 *
 * This is a real guard, not a convention: any attempt to sum money across differing
 * currency codes without going through an FX conversion throws. Native-currency sums
 * (all inputs share one currency) are allowed and exact.
 */
export class MixedCurrencyError extends Error {
  constructor(currencies: string[]) {
    super(
      `Refusing to sum money across currencies [${currencies.join(
        ", "
      )}] without an FX conversion. Use convertAndSum() / an FX join for cross-market rollups.`
    );
    this.name = "MixedCurrencyError";
  }
}

export interface Money {
  amount: number;
  currency: CurrencyCode;
}

/**
 * Sum money values that MUST all share one currency. Throws MixedCurrencyError otherwise.
 * Returns { amount, currency } so the currency is never lost downstream.
 */
export function sumNativeMoney(values: Money[]): Money {
  if (values.length === 0) return { amount: 0, currency: "AUD" };
  const currencies = Array.from(new Set(values.map((v) => v.currency)));
  if (currencies.length > 1) {
    throw new MixedCurrencyError(currencies);
  }
  return {
    amount: values.reduce((a, v) => a + v.amount, 0),
    currency: currencies[0],
  };
}

/** A converted figure carries the estimate flag so the UI always renders the "≈". */
export interface EstimatedMoney {
  amount: number;
  currency: CurrencyCode;
  estimated: true;
  /** true when any input rate was stale/carried-forward (>7d). */
  fxStale: boolean;
}

export type FxTable = (
  base: CurrencyCode,
  quote: CurrencyCode
) => { rate: number; stale: boolean };

/**
 * Convert-and-sum across currencies via an explicit FX table (the only sanctioned
 * cross-currency path). The result is flagged estimated:true → forces "≈" in the UI.
 */
export function convertAndSum(
  values: Money[],
  target: CurrencyCode,
  fx: FxTable
): EstimatedMoney {
  let total = 0;
  let stale = false;
  for (const v of values) {
    if (v.currency === target) {
      total += v.amount;
    } else {
      const { rate, stale: s } = fx(v.currency, target);
      total += v.amount * rate;
      stale = stale || s;
    }
  }
  return { amount: total, currency: target, estimated: true, fxStale: stale };
}

/** True if a set of currency codes can be summed natively (all identical). */
export function isSingleCurrency(currencies: CurrencyCode[]): boolean {
  return new Set(currencies).size <= 1;
}
