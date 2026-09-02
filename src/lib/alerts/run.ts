import "server-only";
import type { FilterState } from "../filters/schema";
import type { CurrencyCode, MarketCode } from "../domain/types";
import { pacingAccounts, pacingMarkets } from "../data/pacing-report";
import { currentPeriod } from "../data/period";
import { marketName } from "../domain/accounts";
import { formatMoney, formatPercent } from "../metrics/format";
import { kvGet, kvSet } from "../data/kv";
import { getAlertConfig } from "./config";
import { emailConfigured, sendEmail } from "./email";

export type PaceStatus = "over" | "under" | "ok";

export interface MarketPaceLine {
  market: MarketCode;
  currency: CurrencyCode;
  budget: number;
  spend: number;
  projected: number;
  pct: number; // projected ÷ budget
  status: PaceStatus;
}

/** All-market budget pacing with each market's projected month-end vs budget. */
export async function evaluatePacing(): Promise<MarketPaceLine[]> {
  const cfg = await getAlertConfig();
  // pacingAccounts only reads country + channel from the filter.
  const accounts = await pacingAccounts({ country: "all", channel: "all" } as unknown as FilterState);
  const markets = pacingMarkets(accounts);
  return markets.map((m) => {
    const projected = m.pacing.projectedSpend ?? m.spend;
    const pct = m.budget ? (projected / m.budget) * 100 : 0;
    const status: PaceStatus = !m.budget
      ? "ok"
      : pct >= cfg.overspendPct
        ? "over"
        : pct <= cfg.underspendPct
          ? "under"
          : "ok";
    return { market: m.market, currency: m.currency, budget: m.budget, spend: m.spend, projected, pct, status };
  });
}

interface AlertState {
  lastStatus: Record<string, PaceStatus>;
  lastWeeklyDate?: string;
}
const STATE_KEY = "alert-state";
async function getState(): Promise<AlertState> {
  return kvGet<AlertState>(STATE_KEY, { lastStatus: {} });
}
async function setState(s: AlertState): Promise<void> {
  await kvSet(STATE_KEY, s);
}

// ---- HTML rendering ----------------------------------------------------------

function row(l: MarketPaceLine): string {
  const colour = l.status === "over" ? "#B91C1C" : l.status === "under" ? "#B45309" : "#15803D";
  const label = l.status === "over" ? "Over pace" : l.status === "under" ? "Under pace" : "On track";
  return `<tr>
    <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;font-weight:600">${marketName(l.market)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;text-align:right">${formatMoney(l.budget, l.currency)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;text-align:right">${formatMoney(l.projected, l.currency)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;text-align:right">${formatPercent(l.pct / 100)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;text-align:right;color:${colour};font-weight:600">${label}</td>
  </tr>`;
}

function table(lines: MarketPaceLine[]): string {
  return `<table style="border-collapse:collapse;width:100%;font-size:13px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
    <thead><tr style="text-align:left;color:#64748B;font-size:11px;text-transform:uppercase">
      <th style="padding:8px 10px">Market</th>
      <th style="padding:8px 10px;text-align:right">Budget</th>
      <th style="padding:8px 10px;text-align:right">Forecast month-end</th>
      <th style="padding:8px 10px;text-align:right">% of budget</th>
      <th style="padding:8px 10px;text-align:right">Status</th>
    </tr></thead>
    <tbody>${lines.map(row).join("")}</tbody>
  </table>`;
}

function wrap(title: string, intro: string, lines: MarketPaceLine[]): string {
  const period = currentPeriod().label;
  return `<div style="max-width:640px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0F172A">
    <h2 style="font-size:18px;margin:0 0 4px">${title}</h2>
    <p style="color:#64748B;font-size:13px;margin:0 0 16px">${period} · ${intro}</p>
    ${table(lines)}
    <p style="color:#94A3B8;font-size:11px;margin-top:16px">LegalVision Paid Media Reporting · budget pacing alert. Configure recipients and thresholds in the dashboard (Admin → Alerts).</p>
  </div>`;
}

// ---- orchestration -----------------------------------------------------------

export interface AlertRunResult {
  triggered: MarketCode[];
  weeklySent: boolean;
  skipped?: string;
  error?: string;
}

/**
 * Evaluate pacing and send emails per the config: an immediate alert when a market newly
 * crosses a threshold (de-duped against the last run), plus a weekly digest on the chosen
 * day. Safe to call daily from the cron — it only emails when there's something to say.
 */
export async function runBudgetAlerts(now = new Date()): Promise<AlertRunResult> {
  const cfg = await getAlertConfig();
  if (!cfg.enabled) return { triggered: [], weeklySent: false, skipped: "disabled" };
  if (cfg.recipients.length === 0) return { triggered: [], weeklySent: false, skipped: "no-recipients" };
  if (!emailConfigured()) return { triggered: [], weeklySent: false, skipped: "email-not-configured" };

  const lines = await evaluatePacing();
  const state = await getState();
  const nextStatus: Record<string, PaceStatus> = {};
  const triggered: MarketPaceLine[] = [];
  for (const l of lines) {
    nextStatus[l.market] = l.status;
    // fire when a market moves INTO an over/under state it wasn't in last run
    if ((l.status === "over" || l.status === "under") && state.lastStatus[l.market] !== l.status) {
      triggered.push(l);
    }
  }

  if (cfg.triggerAlerts && triggered.length > 0) {
    const subject = `⚠️ Budget pacing alert — ${triggered.map((t) => marketName(t.market)).join(", ")}`;
    await sendEmail(cfg.recipients, subject, wrap("Budget pacing alert", "a market has crossed its pacing threshold", triggered));
  }

  const today = now.toISOString().slice(0, 10);
  let weeklySent = false;
  if (cfg.weeklyDigest && now.getUTCDay() === cfg.weeklyDay && state.lastWeeklyDate !== today) {
    await sendEmail(cfg.recipients, "Weekly budget pacing digest", wrap("Weekly budget pacing digest", "all markets, month-to-date pacing", lines));
    weeklySent = true;
  }

  await setState({ lastStatus: nextStatus, lastWeeklyDate: weeklySent ? today : state.lastWeeklyDate });
  return { triggered: triggered.map((t) => t.market), weeklySent };
}

/** Send a one-off test email to the current recipients (Admin → Alerts "Send test"). */
export async function sendTestAlert(): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getAlertConfig();
  if (cfg.recipients.length === 0) return { ok: false, error: "Add at least one recipient first." };
  if (!emailConfigured()) return { ok: false, error: "Email isn't configured yet (RESEND_API_KEY / ALERT_FROM_EMAIL)." };
  const lines = await evaluatePacing();
  return sendEmail(cfg.recipients, "Test — budget pacing alert", wrap("Test alert", "this is a test of the budget pacing alerts", lines));
}
