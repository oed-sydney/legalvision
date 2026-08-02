/** Lightweight horizontal bar list (pure CSS, server-safe) for snapshot breakdowns. */
export interface BarItem {
  label: string;
  value: number;
  formatted: string;
  sublabel?: string;
}

export function BarList({
  items,
  color = "var(--lv-google)",
  max,
}: {
  items: BarItem[];
  color?: string;
  max?: number;
}) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-[12px]">
            <span className="truncate font-medium text-ink" title={it.label}>
              {it.label}
            </span>
            <span className="shrink-0 tnum text-secondary">{it.formatted}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max((it.value / top) * 100, 2)}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
