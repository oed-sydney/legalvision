import { MetricLabel } from "./InfoTip";
import { DeltaBadge } from "./DeltaBadge";
import { Sparkline } from "./Sparkline";
import type { MetricKey } from "@/lib/metrics/dictionary";
import type { Delta } from "@/lib/metrics/format";

/**
 * KPI card — label / value / delta stacked vertically (deltas never overflow).
 * SR-labelled group (§23). Estimated values render the "≈" via `value`.
 */
export function KpiCard({
  metricKey,
  label,
  value,
  delta,
  sparkline,
  sparkColor,
  footnote,
  srSummary,
}: {
  metricKey: MetricKey;
  label?: string;
  value: string;
  delta?: Delta | null;
  sparkline?: number[];
  sparkColor?: string;
  footnote?: React.ReactNode;
  srSummary?: string;
}) {
  return (
    <div
      className="flex flex-col justify-between rounded-[10px] border border-[var(--lv-border)] bg-card p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.06)]"
      role="group"
      aria-label={srSummary}
    >
      <div className="flex items-start justify-between">
        <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-secondary">
          <MetricLabel metricKey={metricKey} label={label} />
        </div>
      </div>
      <div className="mt-2 text-[28px] font-bold leading-none tnum text-ink">{value}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          {delta !== undefined && <DeltaBadge delta={delta} />}
          {footnote && <div className="text-[11px] text-muted">{footnote}</div>}
        </div>
        {sparkline && sparkline.length > 1 && (
          <Sparkline data={sparkline} color={sparkColor} />
        )}
      </div>
    </div>
  );
}
