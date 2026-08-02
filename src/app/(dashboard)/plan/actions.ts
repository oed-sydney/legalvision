"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TASK_BY_ID, KPI_BY_ID } from "@/lib/plan/definition";
import { setTaskStatus, setManualValue } from "@/lib/plan/store";

const taskSchema = z.object({
  taskId: z.string(),
  status: z.enum(["todo", "in_progress", "done"]),
});

/** Persist a plan task status (90-Day Plan → task dropdowns). */
export async function saveTaskStatus(input: { taskId: string; status: string }) {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid status." };
  if (!TASK_BY_ID[parsed.data.taskId]) return { ok: false, error: "Unknown task." };
  setTaskStatus(parsed.data.taskId, parsed.data.status);
  revalidatePath("/plan");
  return { ok: true };
}

const kpiSchema = z.object({
  kpiId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  value: z.number().min(0).max(10_000_000).nullable(),
});

/** Persist a manually-tracked KPI's monthly value (null clears it). */
export async function saveManualKpi(input: { kpiId: string; month: string; value: number | null }) {
  const parsed = kpiSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid value." };
  const def = KPI_BY_ID[parsed.data.kpiId];
  if (!def || def.metric !== "manual") return { ok: false, error: "Not a manual KPI." };
  setManualValue(parsed.data.kpiId, parsed.data.month, parsed.data.value);
  revalidatePath("/plan");
  return { ok: true };
}
