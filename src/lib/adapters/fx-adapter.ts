import type { CurrencyCode } from "../domain/types";

/**
 * FxAdapter — frankfurter.app (ECB daily reference rates), free, no key.
 * Rates stored in `exchange_rates` (date, base, quote, rate). Gaps carry-forward ≤7d
 * flagged stale; converted views degrade to native-only beyond that (§19.5).
 */
export class FxAdapter {
  readonly name = "fx-frankfurter";
  private base = "https://api.frankfurter.app";

  /** Fetch ECB rates for a date, expressed against the reporting currency. */
  async fetchRates(date: string, quote: CurrencyCode): Promise<Record<string, number>> {
    const url = `${this.base}/${date}?to=${["AUD", "GBP", "NZD"].join(",")}&from=${quote}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`FX fetch failed (${res.status})`);
    const json = (await res.json()) as { rates: Record<string, number> };
    return json.rates;
  }
}
