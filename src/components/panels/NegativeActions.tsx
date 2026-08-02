"use client";

import { useTransition } from "react";
import { Check, X, Undo2 } from "lucide-react";
import { decideNegative } from "@/app/(dashboard)/google/actions";

export function NegativeActions({
  accountId,
  term,
}: {
  accountId: string;
  term: string;
}) {
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => void (await decideNegative({ accountId, term, status: "approved" })))}
        className="inline-flex items-center gap-1 rounded-md border border-[#86EFAC] bg-[#DCFCE7] px-2 py-1 text-[12px] font-medium text-[#15803D] hover:bg-[#c9f5d7] disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" /> Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => void (await decideNegative({ accountId, term, status: "dismissed" })))}
        className="inline-flex items-center gap-1 rounded-md border border-[var(--lv-border)] bg-white px-2 py-1 text-[12px] font-medium text-secondary hover:bg-canvas disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" /> Dismiss
      </button>
    </span>
  );
}

export function UndoDecision({
  accountId,
  term,
}: {
  accountId: string;
  term: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="Remove from this list"
      onClick={() => start(async () => void (await decideNegative({ accountId, term, status: null })))}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-canvas hover:text-ink disabled:opacity-50"
    >
      <Undo2 className="h-3 w-3" /> undo
    </button>
  );
}
