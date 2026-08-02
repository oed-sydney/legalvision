import "server-only";
import { kvGet, kvSet } from "../data/kv";

/**
 * Mutable 90-day-plan state (task statuses + manually-tracked KPI values),
 * persisted in Postgres (`app_kv` key "plan-state"). The plan definition itself
 * is code-owned (definition.ts).
 */

const KV_KEY = "plan-state";

export type PlanTaskStatus = "todo" | "in_progress" | "done";

export interface PlanState {
  /** taskId → status (absent = todo). */
  taskStatuses: Record<string, PlanTaskStatus>;
  /** kpiId → { "2026-05": 31.2 } for manually-tracked KPIs. */
  manualValues: Record<string, Record<string, number>>;
}

export async function readPlanState(): Promise<PlanState> {
  const raw = await kvGet<Partial<PlanState>>(KV_KEY, {});
  return {
    taskStatuses: raw.taskStatuses ?? {},
    manualValues: raw.manualValues ?? {},
  };
}

async function writePlanState(state: PlanState): Promise<void> {
  await kvSet(KV_KEY, state);
}

export async function setTaskStatus(taskId: string, status: PlanTaskStatus): Promise<void> {
  const state = await readPlanState();
  if (status === "todo") delete state.taskStatuses[taskId];
  else state.taskStatuses[taskId] = status;
  await writePlanState(state);
}

/** value null clears the month's entry. */
export async function setManualValue(
  kpiId: string,
  month: string,
  value: number | null
): Promise<void> {
  const state = await readPlanState();
  const entry = state.manualValues[kpiId] ?? {};
  if (value === null) delete entry[month];
  else entry[month] = value;
  if (Object.keys(entry).length === 0) delete state.manualValues[kpiId];
  else state.manualValues[kpiId] = entry;
  await writePlanState(state);
}
