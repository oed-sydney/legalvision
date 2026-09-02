import "server-only";
import { kvGet, kvSet } from "../data/kv";

/**
 * Budget-pacing email alert configuration (Admin → Alerts), persisted in Postgres.
 * Thresholds are on projected month-end spend as a % of the market's budget.
 */
/** "By day D of the month, spend-to-date should be ≥ X% of budget" — else the market is behind. */
export interface PacingCheckpoint {
  day: number; // day of month (1–31)
  minSpendPct: number; // minimum % of budget that should be spent by that day
}

export interface AlertConfig {
  enabled: boolean;
  recipients: string[]; // email addresses
  overspendPct: number; // alert when projected ≥ this % of budget (e.g. 105)
  underspendPct: number; // alert when projected ≤ this % of budget (e.g. 85)
  checkpoints: PacingCheckpoint[]; // day-of-month spend-to-date checkpoints
  triggerAlerts: boolean; // email immediately when a market crosses a threshold
  weeklyDigest: boolean; // weekly summary email
  weeklyDay: number; // 0=Sun … 6=Sat (UTC) for the digest
}

const KV_KEY = "alert-config";

export const ALERT_DEFAULT: AlertConfig = {
  enabled: false,
  recipients: [],
  overspendPct: 105,
  underspendPct: 85,
  checkpoints: [{ day: 25, minSpendPct: 80 }],
  triggerAlerts: true,
  weeklyDigest: true,
  weeklyDay: 1, // Monday
};

export async function getAlertConfig(): Promise<AlertConfig> {
  return { ...ALERT_DEFAULT, ...(await kvGet<Partial<AlertConfig>>(KV_KEY, {})) };
}

export async function setAlertConfig(cfg: AlertConfig): Promise<void> {
  await kvSet(KV_KEY, cfg);
}
