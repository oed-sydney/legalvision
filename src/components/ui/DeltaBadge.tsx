import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Delta } from "@/lib/metrics/format";

const TONE: Record<Delta["tone"], string> = {
  good: "text-success",
  bad: "text-danger",
  neutral: "text-secondary",
};

/** Comparison delta = arrow + sign + % (colour respects direction-of-good). */
export function DeltaBadge({
  delta,
  className,
  showAbs,
  absFormatted,
}: {
  delta: Delta | null;
  className?: string;
  showAbs?: boolean;
  absFormatted?: string;
}) {
  if (!delta) return <span className="text-[12px] text-muted">—</span>;
  const Icon = delta.abs === 0 ? Minus : delta.abs > 0 ? ArrowUp : ArrowDown;
  const pct =
    delta.pct === null ? "n/a" : `${delta.pct > 0 ? "+" : ""}${(delta.pct * 100).toFixed(1)}%`;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[12px] font-medium tnum", TONE[delta.tone], className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {pct}
      {showAbs && absFormatted ? <span className="ml-1 text-muted">({absFormatted})</span> : null}
    </span>
  );
}
