import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Mutable 90-day-plan state (task statuses + manually-tracked KPI values),
 * persisted to data/plan-state.json — same pattern as budgets-store. The plan
 * definition itself is code-owned (definition.ts).
 */

const STORE_PATH = path.join(process.cwd(), "data", "plan-state.json");

export type PlanTaskStatus = "todo" | "in_progress" | "done";

export interface PlanState {
  /** taskId → status (absent = todo). */
  taskStatuses: Record<string, PlanTaskStatus>;
  /** kpiId → { "2026-05": 31.2 } for manually-tracked KPIs. */
  manualValues: Record<string, Record<string, number>>;
}

export function readPlanState(): PlanState {
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Partial<PlanState>;
    return {
      taskStatuses: raw.taskStatuses ?? {},
      manualValues: raw.manualValues ?? {},
    };
  } catch {
    return { taskStatuses: {}, manualValues: {} };
  }
}

function writePlanState(state: PlanState): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), "utf8");
}

export function setTaskStatus(taskId: string, status: PlanTaskStatus): void {
  const state = readPlanState();
  if (status === "todo") delete state.taskStatuses[taskId];
  else state.taskStatuses[taskId] = status;
  writePlanState(state);
}

/** value null clears the month's entry. */
export function setManualValue(kpiId: string, month: string, value: number | null): void {
  const state = readPlanState();
  const entry = state.manualValues[kpiId] ?? {};
  if (value === null) delete entry[month];
  else entry[month] = value;
  if (Object.keys(entry).length === 0) delete state.manualValues[kpiId];
  else state.manualValues[kpiId] = entry;
  writePlanState(state);
}
