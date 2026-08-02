import { cn } from "@/lib/utils";
import type { PacingStatus } from "@/lib/pacing/engine";

type Tone = "success" | "warning" | "danger" | "danger-filled" | "purple" | "grey" | "info";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-[#DCFCE7] text-[#15803D]",
  warning: "bg-[#FEF3C7] text-[#B45309]",
  danger: "bg-[#FEE2E2] text-[#B91C1C]",
  "danger-filled": "bg-[#B91C1C] text-white",
  purple: "bg-[#EDE9FE] text-[#6D28D9]",
  grey: "bg-[#F1F5F9] text-[#64748B]",
  info: "bg-[#DBEAFE] text-[#1D4ED8]",
};

/** Status pill = colour + text label ALWAYS (never colour alone) — §23. */
export function StatusPill({
  tone,
  children,
  dot = true,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  const dotColor: Record<Tone, string> = {
    success: "#15803D",
    warning: "#B45309",
    danger: "#B91C1C",
    "danger-filled": "#FFFFFF",
    purple: "#6D28D9",
    grey: "#64748B",
    info: "#1D4ED8",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium",
        TONE_CLASS[tone],
        className
      )}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: dotColor[tone] }}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}

const PACING_TONE: Record<PacingStatus, Tone> = {
  on_track: "success",
  watch: "warning",
  at_risk: "danger",
  over_budget: "danger-filled",
  budget_not_set: "grey",
  not_started: "grey",
};

const PACING_LABEL: Record<PacingStatus, string> = {
  on_track: "On track",
  watch: "Watch",
  at_risk: "At risk",
  over_budget: "Over budget",
  budget_not_set: "Budget not set",
  not_started: "Just started",
};

export function PacingStatusPill({ status }: { status: PacingStatus }) {
  return <StatusPill tone={PACING_TONE[status]}>{PACING_LABEL[status]}</StatusPill>;
}
