import "server-only";
import fs from "node:fs";
import path from "node:path";
import { SNAPSHOT_PULLED_AT } from "./real/snapshot";

/** Tracks the last data refresh so the freshness chip + refresh button stay in sync. */

const STATE_PATH = path.join(process.cwd(), "data", "sync-state.json");

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

export function readSyncState(): SyncState {
  try {
    return { ...DEFAULT, ...(JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as SyncState) };
  } catch {
    return DEFAULT;
  }
}

export function writeSyncState(s: SyncState): void {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2), "utf8");
}
