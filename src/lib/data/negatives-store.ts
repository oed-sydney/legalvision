import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Approval state for negative-keyword candidates, persisted to
 * data/negatives-approvals.json. The paste-ready list only ever contains
 * APPROVED terms — the engine proposes, a human disposes.
 */

const STORE_PATH = path.join(process.cwd(), "data", "negatives-approvals.json");

export type NegativeStatus = "approved" | "dismissed";

export interface NegativeDecision {
  status: NegativeStatus;
  at: string; // ISO
}

/** accountId → term (lowercase) → decision */
export type NegativesApprovals = Record<string, Record<string, NegativeDecision>>;

export function readNegativesApprovals(): NegativesApprovals {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as NegativesApprovals;
  } catch {
    return {};
  }
}

export function setNegativeDecision(
  accountId: string,
  term: string,
  status: NegativeStatus | null
): void {
  const store = readNegativesApprovals();
  const acct = store[accountId] ?? {};
  const key = term.toLowerCase().trim();
  if (status === null) delete acct[key];
  else acct[key] = { status, at: new Date().toISOString() };
  if (Object.keys(acct).length === 0) delete store[accountId];
  else store[accountId] = acct;
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}
