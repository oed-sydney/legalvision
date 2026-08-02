import "server-only";
import { SNAPSHOT_PULLED_AT } from "./real/snapshot";
import { kvGet, kvSet } from "./kv";

/** Tracks the last data refresh so the freshness chip + refresh button stay in sync. */

const KV_KEY = "sync-state";

export interface SyncState {
  lastSyncedAt: string; // ISO
  mode: "live" | "snapshot";
  rowsGoogle: number;
  note?: string;
}

const DEFAULT: SyncState = {
  lastSyncedAt: SNAPSHOT_PULLED_AT,
  mode: "snapshot",
  rowsGoogle: 0,
};

export async function readSyncState(): Promise<SyncState> {
  return { ...DEFAULT, ...(await kvGet<Partial<SyncState>>(KV_KEY, {})) };
}

export async function writeSyncState(s: SyncState): Promise<void> {
  await kvSet(KV_KEY, s);
}
