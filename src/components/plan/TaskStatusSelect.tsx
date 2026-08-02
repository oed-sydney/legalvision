"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { saveTaskStatus } from "@/app/(dashboard)/plan/actions";
import type { PlanTaskStatus } from "@/lib/plan/store";

const OPTIONS: { value: PlanTaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const STATUS_CLASS: Record<PlanTaskStatus, string> = {
  todo: "border-[var(--lv-border)] bg-white text-secondary",
  in_progress: "border-[#93C5FD] bg-[#DBEAFE] text-[#1D4ED8]",
  done: "border-[#86EFAC] bg-[#DCFCE7] text-[#15803D]",
};

export function TaskStatusSelect({
  taskId,
  initial,
}: {
  taskId: string;
  initial: PlanTaskStatus;
}) {
  const [status, setStatus] = useState<PlanTaskStatus>(initial);
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={pending}
      aria-label="Task status"
      onChange={(e) => {
        const next = e.target.value as PlanTaskStatus;
        const prev = status;
        setStatus(next);
        startTransition(async () => {
          const res = await saveTaskStatus({ taskId, status: next });
          if (!res.ok) setStatus(prev);
        });
      }}
      className={cn(
        "h-8 shrink-0 cursor-pointer rounded-md border px-2 text-[12px] font-semibold outline-none transition-colors disabled:opacity-60",
        STATUS_CLASS[status]
      )}
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
