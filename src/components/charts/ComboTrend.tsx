"use client";

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

/** Spend (bars) & Live leads (line) over time — the Overview primary chart (§6.1). */
export function ComboTrend({
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
  const sym = CURRENCY_SYMBOL[currency];
  const tickDates = data.length > 40; // sparser labels on long ranges
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid vertical={false} stroke="#EEF2F7" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#64748B" }}
          tickFormatter={(d: string) => d.slice(5)}
          interval={tickDates ? Math.floor(data.length / 8) : 0}
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
        <YAxis
          yAxisId="ll"
          orientation="right"
          tick={{ fontSize: 11, fill: "#64748B" }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #E2E8F0",
            boxShadow: "0 4px 12px rgb(15 23 42 / 0.08)",
          }}
          formatter={(value: number, name: string) =>
            name === "spend"
              ? [`${estimated ? "≈ " : ""}${sym}${value.toLocaleString("en-AU")} ${currency}`, "Spend"]
              : [value.toLocaleString("en-AU"), "Live leads"]
          }
          labelFormatter={(d) => `Date ${d}`}
        />
        <Bar yAxisId="spend" dataKey="spend" fill="var(--lv-primary)" radius={[2, 2, 0, 0]} maxBarSize={22} />
        <Line
          yAxisId="ll"
          type="monotone"
          dataKey="liveLeads"
          stroke="var(--lv-success)"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function abbrev(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}
