import type { CurrencyCode } from "../domain/types";
import type { FxTable } from "./guard";

/**
 * FX layer. In production, rates come from the FxAdapter (frankfurter.app ECB daily)
 * stored in `exchange_rates`. Here we provide stable reference rates so All-markets
 * rollups render with the "≈" estimate treatment. If rates were stale >7d the
 * converted views degrade to native-only with a banner (see components).
 */

// Reference rates as "1 unit of base = X AUD" (approximate, stable for the mock).
const TO_AUD: Record<CurrencyCode, number> = {
  AUD: 1,
  GBP: 1.95,
  NZD: 0.92,
};

/** Freshness of the FX feed (drives the >7d stale degradation rule). */
export const FX_LAST_UPDATED = "2026-07-14T07:00:00+10:00";
export const FX_STALE = false; // becomes true when the daily job hasn't run in >7d

export function fxRate(
  base: CurrencyCode,
  quote: CurrencyCode
): { rate: number; stale: boolean } {
  if (base === quote) return { rate: 1, stale: FX_STALE };
  // cross via AUD
  const rate = TO_AUD[base] / TO_AUD[quote];
  return { rate, stale: FX_STALE };
}

export const fxTable: FxTable = fxRate;
