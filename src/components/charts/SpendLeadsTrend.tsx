"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CURRENCY_SYMBOL } from "@/lib/metrics/format";
import type { CurrencyCode } from "@/lib/domain/types";

export interface TrendDatum {
  date: string;
  spend: number;
  liveLeads: number;
}

type Grouping = "day" | "week" | "month";

/** Monday (UTC) of the ISO week containing `iso` (YYYY-MM-DD), as YYYY-MM-DD. */
function weekStart(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

function bucketKey(iso: string, g: Grouping): string {
  if (g === "month") return iso.slice(0, 7); // YYYY-MM
  if (g === "week") return weekStart(iso);
  return iso;
}

interface Row {
  date: string;
  spend: number;
  liveLeads: number;
  cpll: number | null;
}

function aggregate(data: TrendDatum[], g: Grouping): Row[] {
  const buckets = new Map<string, { date: string; spend: number; liveLeads: number }>();
  for (const p of data) {
    const key = bucketKey(p.date, g);
    const b = buckets.get(key) ?? { date: key, spend: 0, liveLeads: 0 };
    b.spend += p.spend;
    b.liveLeads += p.liveLeads;
    buckets.set(key, b);
  }
  return [...buckets.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((b) => ({
      ...b,
      spend: Math.round(b.spend),
      cpll: b.liveLeads > 0 ? Math.round((b.spend / b.liveLeads) * 100) / 100 : null,
    }));
}

const GROUPS: { key: Grouping; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

/** Spend (bars) + Live leads + Cost / live lead (lines), groupable by day / week / month. */
export function SpendLeadsTrend({
  data,
  currency,
  estimated,
  height = 300,
}: {
  data: TrendDatum[];
  currency: CurrencyCode;
  estimated?: boolean;
  height?: number;
}) {
  const [group, setGroup] = useState<Grouping>("day");
  const rows = useMemo(() => aggregate(data, group), [data, group]);
  const sym = CURRENCY_SYMBOL[currency];
  const sparse = rows.length > 40;
  const money = (v: number) => `${estimated ? "≈ " : ""}${sym}${v.toLocaleString("en-AU")}`;
  const labelFmt = (d: string) => (group === "month" ? d : d.slice(5));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Legend />
        <div className="inline-flex overflow-hidden rounded-md border border-[var(--lv-border)] text-[12px]">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setGroup(g.key)}
              className={`px-2.5 py-1 font-medium transition-colors ${
                group === g.key ? "bg-[var(--lv-primary)] text-white" : "bg-card text-secondary hover:bg-canvas"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid vertical={false} stroke="#EEF2F7" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#64748B" }}
            tickFormatter={labelFmt}
            interval={sparse ? Math.floor(rows.length / 8) : 0}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
          />
          <YAxis
            yAxisId="spend"
            tick={{ fontSize: 11, fill: "#64748B" }}
            tickFormatter={(v: number) => `${estimated ? "≈" : ""}${sym}${abbrev(v)}`}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <YAxis yAxisId="ll" orientation="right" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} width={36} />
          {/* Cost/live-lead has its own hidden scale so its trend reads cleanly alongside the others. */}
          <YAxis yAxisId="cpll" orientation="right" hide />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgb(15 23 42 / 0.08)" }}
            formatter={(value: number, name: string) => {
              const v = value as number | null;
              if (name === "spend") return [`${money(value)} ${currency}`, "Spend"];
              if (name === "liveLeads") return [value.toLocaleString("en-AU"), "Live leads"];
              return [v == null ? "—" : `${money(value)} ${currency}`, "Cost / live lead"];
            }}
            labelFormatter={(d) => (group === "week" ? `Week of ${d}` : group === "month" ? `Month ${d}` : `Date ${d}`)}
          />
          <Bar yAxisId="spend" dataKey="spend" fill="var(--lv-primary)" radius={[2, 2, 0, 0]} maxBarSize={26} />
          <Line yAxisId="ll" type="monotone" dataKey="liveLeads" stroke="var(--lv-success)" strokeWidth={2} dot={false} />
          <Line yAxisId="cpll" type="monotone" dataKey="cpll" stroke="var(--lv-accent)" strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-secondary">
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--lv-primary)" }} />Spend</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3.5" style={{ background: "var(--lv-success)" }} />Live leads</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3.5 border-t-2 border-dashed" style={{ borderColor: "var(--lv-accent)" }} />Cost / live lead</span>
    </div>
  );
}

function abbrev(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}
