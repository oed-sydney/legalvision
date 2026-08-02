"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { saveManualKpi } from "@/app/(dashboard)/plan/actions";

/** Inline monthly input for manually-tracked KPIs (saves on blur / Enter). */
export function ManualKpiInput({
  kpiId,
  month,
  initial,
  suffix,
}: {
  kpiId: string;
  month: string;
  initial: number | null;
  suffix?: string;
}) {
  const [text, setText] = useState(initial === null ? "" : String(initial));
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();

  function commit() {
    const trimmed = text.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && !Number.isFinite(value)) {
      setText(saved === null ? "" : String(saved));
      return;
    }
    if (value === saved) return;
    startTransition(async () => {
      const res = await saveManualKpi({ kpiId, month, value });
      if (res.ok) setSaved(value);
      else setText(saved === null ? "" : String(saved));
    });
  }

  return (
    <span className="inline-flex items-center justify-end gap-1">
      <input
        type="number"
        inputMode="decimal"
        value={text}
        placeholder="—"
        disabled={pending}
        aria-label={`Value for ${month}`}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={cn(
          "h-7 w-[72px] rounded-md border border-[var(--lv-border)] bg-white px-1.5 text-right text-[13px] tnum text-ink outline-none",
          "focus:border-[var(--lv-primary)] disabled:opacity-60",
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        )}
      />
      {suffix && <span className="text-[12px] text-muted">{suffix}</span>}
    </span>
  );
}
