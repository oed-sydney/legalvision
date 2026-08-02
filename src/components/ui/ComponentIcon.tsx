import { ArrowUp, Minus, ArrowDown } from "lucide-react";
import type { ComponentRating } from "@/lib/domain/types";

/** QS component = icon + text, never colour alone (§11/§23). */
export function ComponentIcon({ rating }: { rating: ComponentRating }) {
  if (rating === null) return <span className="text-muted">—</span>;
  const map = {
    above: { Icon: ArrowUp, label: "Above", color: "#15803D" },
    average: { Icon: Minus, label: "Average", color: "#B45309" },
    below: { Icon: ArrowDown, label: "Below", color: "#B91C1C" },
  } as const;
  const { Icon, label, color } = map[rating];
  return (
    <span className="inline-flex items-center gap-1 text-[12px]" style={{ color }}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}
