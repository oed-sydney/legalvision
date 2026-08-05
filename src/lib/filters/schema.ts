/**
 * Global filter engine — Framework §7.
 * Full state serialises to the URL query string (shareable) and mirrors to
 * localStorage; URL wins over localStorage; defaults = Last 30 days / Previous
 * period / All markets / All channels.
 */

export type DatePreset =
  | "today"
  | "yesterday"
  | "last7d"
  | "last14d"
  | "last30d"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "ytd"
  | "custom";

export type Comparison = "prev_period" | "prev_month" | "prev_year" | "none";

export interface FilterState {
  range: DatePreset;
  from?: string; // custom
  to?: string;
  cmp: Comparison;
  country: string; // all|AU|UK|NZ
  channel: string; // all|google_ads|meta_ads
  account: string; // all|<accountId>
  campaign: string; // all|<campaignId>
  ctype: string; // all|<campaign type>
  device: string; // all|desktop|mobile|tablet
  network: string; // all|<network/placement>
}

export const DEFAULT_FILTERS: FilterState = {
  range: "last30d",
  cmp: "prev_period",
  country: "all",
  channel: "all",
  account: "all",
  campaign: "all",
  ctype: "all",
  device: "all",
  network: "all",
};

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function addDays(s: string, n: number) {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
}

/** Real "today" (server local clock). Latest complete synced day = yesterday. */
function todayIso(): string {
  const d = new Date();
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export interface ResolvedRange {
  from: string;
  to: string;
  label: string;
}

/**
 * Resolve a preset to concrete dates, anchored to the real current date.
 * "today"/"yesterday" are recomputed here on every call (never frozen at module load),
 * so ranges stay correct on a long-running server or a warm serverless instance.
 */
export function resolveRange(f: FilterState): ResolvedRange {
  const TODAY = todayIso();
  const YESTERDAY = addDays(TODAY, -1);
  const end = YESTERDAY; // presets end at the latest complete day
  const [y, m] = TODAY.split("-").map(Number);
  const monthStart = iso(y, m, 1);
  const qStartMonth = 3 * Math.floor((m - 1) / 3) + 1;
  const quarterStart = iso(y, qStartMonth, 1);
  const prevMonthY = m === 1 ? y - 1 : y;
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevQY = qStartMonth === 1 ? y - 1 : y;
  const prevQStartMonth = qStartMonth === 1 ? 10 : qStartMonth - 3;
  // Period-to-date presets (MTD/QTD/YTD) run through TODAY to match the ad platforms'
  // live "this month" view (which includes today's partial spend). Rolling "last N days"
  // presets end at the latest complete day (yesterday), as the platforms do.
  const clampTo = (from: string) => (TODAY >= from ? TODAY : from);
  switch (f.range) {
    case "today":
      return { from: TODAY, to: TODAY, label: "Today" };
    case "yesterday":
      return { from: YESTERDAY, to: YESTERDAY, label: "Yesterday" };
    case "last7d":
      return { from: addDays(end, -6), to: end, label: "Last 7 days" };
    case "last14d":
      return { from: addDays(end, -13), to: end, label: "Last 14 days" };
    case "last30d":
      return { from: addDays(end, -29), to: end, label: "Last 30 days" };
    case "this_month":
      return { from: monthStart, to: clampTo(monthStart), label: "This month (MTD)" };
    case "last_month":
      return { from: iso(prevMonthY, prevMonth, 1), to: addDays(monthStart, -1), label: "Last month" };
    case "this_quarter":
      return { from: quarterStart, to: clampTo(quarterStart), label: "This quarter (QTD)" };
    case "last_quarter":
      return { from: iso(prevQY, prevQStartMonth, 1), to: addDays(quarterStart, -1), label: "Last quarter" };
    case "ytd":
      return { from: iso(y, 1, 1), to: TODAY, label: "Year to date" };
    case "custom":
      return {
        from: f.from ?? addDays(end, -29),
        to: f.to ?? end,
        label: "Custom range",
      };
  }
}

/** Comparison window — same length immediately preceding, or MoM/YoY, elapsed-aligned. */
export function resolveComparison(
  f: FilterState,
  main: ResolvedRange
): ResolvedRange | null {
  if (f.cmp === "none") return null;
  const len = daysBetween(main.to, main.from); // inclusive length - 1
  if (f.cmp === "prev_period") {
    const to = addDays(main.from, -1);
    const from = addDays(to, -len);
    return { from, to, label: "Previous period" };
  }
  if (f.cmp === "prev_month") {
    return { from: addDays(main.from, -30), to: addDays(main.to, -30), label: "Previous month" };
  }
  // prev_year
  return { from: addDays(main.from, -365), to: addDays(main.to, -365), label: "Previous year" };
}

// ---- URL <-> state ----------------------------------------------------------

export function parseFilters(params: URLSearchParams | Record<string, string | undefined>): FilterState {
  const get = (k: string): string | undefined =>
    params instanceof URLSearchParams ? params.get(k) ?? undefined : params[k];
  const s: FilterState = { ...DEFAULT_FILTERS };
  const range = get("range") as DatePreset | undefined;
  if (range) s.range = range;
  if (get("from")) s.from = get("from");
  if (get("to")) s.to = get("to");
  const cmp = get("cmp") as Comparison | undefined;
  if (cmp) s.cmp = cmp;
  for (const k of ["country", "channel", "account", "campaign", "ctype", "device", "network"] as const) {
    const v = get(k);
    if (v) s[k] = v;
  }
  return applyCascade(s);
}

export function serializeFilters(f: FilterState): string {
  const p = new URLSearchParams();
  const push = (k: string, v: string | undefined, def?: string) => {
    if (v && v !== def) p.set(k, v);
  };
  push("range", f.range, "last30d");
  if (f.range === "custom") {
    push("from", f.from);
    push("to", f.to);
  }
  push("cmp", f.cmp, "prev_period");
  push("country", f.country, "all");
  push("channel", f.channel, "all");
  push("account", f.account, "all");
  push("campaign", f.campaign, "all");
  push("ctype", f.ctype, "all");
  push("device", f.device, "all");
  push("network", f.network, "all");
  return p.toString();
}

/**
 * Cascade auto-correction (§7): choosing a child that conflicts with a parent
 * corrects the parent. Kept import-light so it can run on client + server.
 */
export function applyCascade(f: FilterState): FilterState {
  // account implies its market + channel
  if (f.account !== "all") {
    const acct = ACCOUNT_INDEX[f.account];
    if (acct) {
      f.country = acct.market;
      f.channel = acct.channel;
    }
  }
  return f;
}

// minimal account index (avoids importing the full domain into client bundles)
const ACCOUNT_INDEX: Record<string, { market: string; channel: string }> = {
  "au-google": { market: "AU", channel: "google_ads" },
  "nz-google": { market: "NZ", channel: "google_ads" },
  "uk-google": { market: "UK", channel: "google_ads" },
  "au-meta": { market: "AU", channel: "meta_ads" },
  "uk-meta": { market: "UK", channel: "meta_ads" },
  "nz-meta": { market: "NZ", channel: "meta_ads" },
};

export function activeFilterCount(f: FilterState): number {
  let n = 0;
  const d = DEFAULT_FILTERS;
  (Object.keys(d) as (keyof FilterState)[]).forEach((k) => {
    if (k === "from" || k === "to") return;
    if (f[k] !== d[k]) n++;
  });
  return n;
}
