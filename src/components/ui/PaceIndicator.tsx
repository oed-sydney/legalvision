import { ArrowUp, ArrowDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Clear "% over / under pace" indicator. pct = pacing variance % = (spend − expected)/expected.
 * Positive = spending faster than the period has elapsed (over pace).
 */
export function PaceIndicator({
  pct,
  size = "md",
  className,
}: {
  pct: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  if (pct === null) return <span className="text-[13px] text-muted">Pace —</span>;

  const abs = Math.abs(pct);
  const onPace = abs < 0.02;
  const tone = onPace ? "green" : abs <= 0.1 ? "amber" : "red";
  const color =
    tone === "green" ? "var(--lv-success)" : tone === "amber" ? "var(--lv-warning)" : "var(--lv-danger)";

  const label = onPace ? "On pace" : `${(abs * 100).toFixed(1)}% ${pct > 0 ? "over" : "under"} pace`;
  const Icon = onPace ? Check : pct > 0 ? ArrowUp : ArrowDown;
  const text = size === "lg" ? "text-[18px]" : size === "sm" ? "text-[12px]" : "text-[14px]";

  return (
    <span className={cn("inline-flex items-center gap-1 font-semibold tnum", text, className)} style={{ color }}>
      <Icon className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />
      {label}
    </span>
  );
}
