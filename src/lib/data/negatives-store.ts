import "server-only";
import { kvGet, kvSet } from "./kv";

/**
 * Approval state for negative-keyword candidates, persisted in Postgres
 * (`app_kv` key "negatives-approvals"). The paste-ready list only ever contains
 * APPROVED terms — the engine proposes, a human disposes.
 */

const KV_KEY = "negatives-approvals";

export type NegativeStatus = "approved" | "dismissed";

export interface NegativeDecision {
  status: NegativeStatus;
  at: string; // ISO
}

/** accountId → term (lowercase) → decision */
export type NegativesApprovals = Record<string, Record<string, NegativeDecision>>;

export async function readNegativesApprovals(): Promise<NegativesApprovals> {
  return kvGet<NegativesApprovals>(KV_KEY, {});
}

export async function setNegativeDecision(
  accountId: string,
  term: string,
  status: NegativeStatus | null
): Promise<void> {
  const store = await readNegativesApprovals();
  const acct = store[accountId] ?? {};
  const key = term.toLowerCase().trim();
  if (status === null) delete acct[key];
  else acct[key] = { status, at: new Date().toISOString() };
  if (Object.keys(acct).length === 0) delete store[accountId];
  else store[accountId] = acct;
  await kvSet(KV_KEY, store);
}
