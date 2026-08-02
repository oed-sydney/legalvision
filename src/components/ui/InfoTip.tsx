"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import { METRICS, type MetricKey } from "@/lib/metrics/dictionary";

/** Focusable, dismissible tooltip (WCAG 1.4.13). */
export function InfoTip({
  children,
  content,
}: {
  children?: React.ReactNode;
  content: React.ReactNode;
}) {
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center text-muted hover:text-secondary focus-visible:text-secondary"
            aria-label="More information"
          >
            {children ?? <Info className="h-3.5 w-3.5" />}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            align="start"
            sideOffset={6}
            className="z-50 max-w-[280px] rounded-lg border border-[var(--lv-border)] bg-white p-3 text-[12px] leading-relaxed text-secondary shadow-lg"
          >
            {content}
            <Tooltip.Arrow className="fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/** Metric label + ⓘ generated from the metric dictionary (single source of truth). */
export function MetricLabel({
  metricKey,
  label,
  className,
}: {
  metricKey: MetricKey;
  label?: string;
  className?: string;
}) {
  const m = METRICS[metricKey];
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <span>{label ?? m.label}</span>
      <InfoTip
        content={
          <div>
            <div className="font-semibold text-ink">{m.label}</div>
            <div className="mt-1">{m.definition}</div>
            <div className="mt-1.5 font-mono text-[11px] text-ink">{m.formula}</div>
            <div className="mt-1.5 text-[11px]">
              <span className="text-muted">Source:</span> {m.source}
            </div>
            {m.notes && <div className="mt-1 text-[11px] text-muted">{m.notes}</div>}
          </div>
        }
      />
    </span>
  );
}
