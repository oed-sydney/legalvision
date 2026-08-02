"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CURRENCY_SYMBOL } from "@/lib/metrics/format";
import type { CurrencyCode } from "@/lib/domain/types";

export interface CumulativePoint {
  day: number; // 1..D_total
  actual: number | null;
  ideal: number;
  projected: number | null;
}

/** The signature pacing visual: actual vs ideal-linear vs projected trajectory. */
export function CumulativeCurve({
  data,
  currency,
  estimated,
  height = 280,
}: {
  data: CumulativePoint[];
  currency: CurrencyCode;
  estimated?: boolean;
  height?: number;
}) {
  const sym = CURRENCY_SYMBOL[currency];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid vertical={false} stroke="#EEF2F7" />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: "#64748B" }}
          axisLine={{ stroke: "#E2E8F0" }}
          tickLine={false}
          label={{ value: "Day of period", position: "insideBottom", offset: -2, fontSize: 11, fill: "#94A3B8" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748B" }}
          tickFormatter={(v: number) => `${estimated ? "≈" : ""}${sym}${abbrev(v)}`}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
          formatter={(value: number, name: string) => [
            value === null ? "—" : `${estimated ? "≈ " : ""}${sym}${Math.round(value).toLocaleString("en-AU")}`,
            LABELS[name] ?? name,
          ]}
          labelFormatter={(d) => `Day ${d}`}
        />
        <Line type="monotone" dataKey="ideal" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
        <Line type="monotone" dataKey="actual" stroke="var(--lv-primary)" strokeWidth={2.5} dot={false} connectNulls />
        <Line type="monotone" dataKey="projected" stroke="var(--lv-warning)" strokeWidth={2} strokeDasharray="2 3" dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

const LABELS: Record<string, string> = {
  actual: "Actual",
  ideal: "Ideal (linear)",
  projected: "Projected",
};

function abbrev(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(Math.round(v));
}
