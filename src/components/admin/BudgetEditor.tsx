"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { saveBudget } from "@/app/(dashboard)/admin/actions";
import { CURRENCY_SYMBOL } from "@/lib/metrics/format";
import type { CurrencyCode } from "@/lib/domain/types";

export interface BudgetRow {
  accountId: string;
  accountLabel: string;
  market: string;
  channel: string;
  currency: CurrencyCode;
  amount: number;
}

/** Editable per-account monthly budget grid (AU/UK/NZ × Google/Meta). */
export function BudgetEditor({ rows }: { rows: BudgetRow[] }) {
  return (
    <div className="overflow-x-auto lv-scroll">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--lv-border)] text-[11px] uppercase tracking-wide text-secondary">
            <th className="py-2 pr-3 text-left">Account</th>
            <th className="px-3 py-2 text-left">Market</th>
            <th className="px-3 py-2 text-left">Channel</th>
            <th className="px-3 py-2 text-left">Period</th>
            <th className="px-3 py-2 text-right">Monthly budget</th>
            <th className="px-3 py-2 text-left"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <BudgetInputRow key={r.accountId} row={r} />
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-muted">
        Budgets persist immediately and feed the pacing engine. Native currency per account. A budget of 0 renders &quot;Budget not set&quot;.
      </p>
    </div>
  );
}

function BudgetInputRow({ row }: { row: BudgetRow }) {
  const [value, setValue] = useState(String(row.amount));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const commit = () => {
    const amount = Number(value.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(amount) || amount === row.amount) return;
    start(async () => {
      const res = await saveBudget({ accountId: row.accountId, amount });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
      }
    });
  };

  return (
    <tr className="border-b border-[var(--lv-border)] last:border-0">
      <td className="py-2.5 pr-3 font-medium text-ink">{row.accountLabel}</td>
      <td className="px-3 py-2.5 text-secondary">{row.market}</td>
      <td className="px-3 py-2.5 text-secondary">{row.channel}</td>
      <td className="px-3 py-2.5 text-secondary">Jul 2026</td>
      <td className="px-3 py-2.5 text-right">
        <div className="inline-flex items-center gap-1 rounded-md border border-[var(--lv-border)] px-2 focus-within:border-primary">
          <span className="text-muted">{CURRENCY_SYMBOL[row.currency]}</span>
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="w-28 bg-transparent py-1 text-right tnum outline-none"
            aria-label={`${row.accountLabel} monthly budget`}
          />
          <span className="text-[11px] text-muted">{row.currency}</span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted" />
        ) : saved ? (
          <span className="inline-flex items-center gap-1 text-[12px] text-success">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        ) : null}
      </td>
    </tr>
  );
}
