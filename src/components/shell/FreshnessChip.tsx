"use client";

import * as Popover from "@radix-ui/react-popover";
import { CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FreshnessSource {
  label: string;
  finishedAt: string;
  hoursSince: number;
  status: "ok" | "partial" | "failed" | "running";
}

function state(hours: number, status: string): { tone: string; text: string } {
  if (status === "failed") return { tone: "text-danger", text: "failed" };
  if (hours > 36) return { tone: "text-danger", text: "critical" };
  if (hours > 12) return { tone: "text-warning", text: "stale" };
  return { tone: "text-success", text: "fresh" };
}

/** "Data updated" chip = oldest in-view source, popover per source (§20). */
export function FreshnessChip({
  oldestHours,
  sources,
}: {
  oldestHours: number;
  sources: FreshnessSource[];
}) {
  const s = state(oldestHours, "ok");
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="inline-flex items-center gap-2 rounded-full border border-[var(--lv-border)] bg-white px-3 py-1.5 text-[12px] font-medium text-secondary hover:bg-canvas">
          <CircleDot className={cn("h-3.5 w-3.5", s.tone)} />
          Data updated {formatAge(oldestHours)}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 rounded-lg border border-[var(--lv-border)] bg-white p-3 text-[12px] shadow-xl"
        >
          <div className="mb-2 font-semibold text-ink">Data freshness by source</div>
          <ul className="space-y-1.5">
            {sources.map((src) => {
              const st = state(src.hoursSince, src.status);
              return (
                <li key={src.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-secondary">
                    <CircleDot className={cn("h-3 w-3", st.tone)} />
                    {src.label}
                  </span>
                  <span className={cn("tnum", st.tone)}>
                    {src.status === "failed" ? "failed" : formatAge(src.hoursSince)}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 border-t border-[var(--lv-border)] pt-2 text-[11px] text-muted">
            Amber &gt;12h · Red &gt;36h. Times are viewer-local.
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function formatAge(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
