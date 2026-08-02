import type { CurrencyCode } from "../domain/types";
import { METRICS, type MetricKey, type ValueFormat, type Direction } from "./dictionary";

/** Value handling rules — Framework §6.8. */

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  AUD: "A$",
  GBP: "£",
  NZD: "NZ$",
};

const MISSING = "—";

export interface FormatOpts {
  currency?: CurrencyCode;
  /** prefix with ≈ (converted / estimated value). */
  estimated?: boolean;
  /** low-volume guard triggered → caller should mute styling; value still formats. */
}

function fmtCurrency(value: number, currency: CurrencyCode, force2 = false): string {
  const sym = CURRENCY_SYMBOL[currency];
  const abs = Math.abs(value);
  if (abs > 0 && abs < 0.01) return `${sym}<0.01`;
  // 2 decimals under 1,000, 0 decimals at ≥1,000 (unless force2)
  const decimals = force2 ? 2 : abs >= 1000 ? 0 : 2;
  const num = value.toLocaleString("en-AU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sym}${num}`;
}

/**
 * Format a metric value per its dictionary format + the §6.8 rules.
 * `null`/`undefined` → "—". Real 0 → "0" (or "$0"). 0-denominator ratios pass null.
 */
export function formatMetric(
  key: MetricKey,
  value: number | null | undefined,
  opts: FormatOpts = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return MISSING;
  const def = METRICS[key];
  const currency = opts.currency ?? "AUD";
  const prefix = opts.estimated ? "≈ " : "";
  return prefix + formatByType(def.format, value, currency);
}

export function formatByType(
  format: ValueFormat,
  value: number,
  currency: CurrencyCode = "AUD"
): string {
  switch (format) {
    case "currency":
      return fmtCurrency(value, currency);
    case "currency2":
      return fmtCurrency(value, currency, true);
    case "integer":
      return Math.round(value).toLocaleString("en-AU");
    case "percent": {
      const abs = Math.abs(value);
      if (abs > 0 && abs < 0.001) return "<0.1%";
      return `${(value * 100).toLocaleString("en-AU", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`;
    }
    case "ratio1":
      return value.toLocaleString("en-AU", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
    case "ratio2":
      return value.toLocaleString("en-AU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    default:
      return String(value);
  }
}

export function formatMoney(
  value: number | null | undefined,
  currency: CurrencyCode,
  opts: { estimated?: boolean; force2?: boolean } = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return MISSING;
  return (opts.estimated ? "≈ " : "") + fmtCurrency(value, currency, opts.force2);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return MISSING;
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return MISSING;
  return Math.round(value).toLocaleString("en-AU");
}

/** Impression-share special value: floors under 10% render "<10%". */
export function formatImpressionShare(value: number | null, floored?: boolean): string {
  if (value === null || value === undefined) return MISSING;
  if (floored || value < 0.1) return "<10%";
  return formatPercent(value);
}

/** Safe ratio — returns null (→ "—") on a zero denominator, never NaN/∞. */
export function safeRatio(num: number, denom: number): number | null {
  if (!denom) return null;
  return num / denom;
}

export interface Delta {
  pct: number | null;
  abs: number;
  /** good/bad/neutral resolved against direction-of-good. */
  tone: "good" | "bad" | "neutral";
}

/** Δ% = (current − prior)/prior; direction-of-good decides tone (CPLL down = green). */
export function computeDelta(
  key: MetricKey,
  current: number | null,
  prior: number | null
): Delta | null {
  if (current === null || prior === null) return null;
  const abs = current - prior;
  const pct = prior === 0 ? null : abs / prior;
  const dir: Direction = METRICS[key].direction;
  let tone: Delta["tone"] = "neutral";
  if (dir !== "neutral" && abs !== 0) {
    const improving = dir === "up" ? abs > 0 : abs < 0;
    tone = improving ? "good" : "bad";
  }
  return { pct, abs, tone };
}

/** Low-volume guard: mute rate metrics under 100 impressions / 10 clicks (§6.8). */
export function isLowVolume(impressions: number, clicks: number): boolean {
  return impressions < 100 || clicks < 10;
}

export { MISSING };
