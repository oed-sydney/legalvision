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
  pct: number; // projected ÷ budget (%)
  spendPct: number; // spend-to-date ÷ budget (%)
  status: PaceStatus;
}

/** All-market budget pacing with projected month-end AND spend-to-date vs budget. */
export async function evaluatePacing(): Promise<MarketPaceLine[]> {
  const cfg = await getAlertConfig();
  // pacingAccounts only reads country + channel from the filter.
  const accounts = await pacingAccounts({ country: "all", channel: "all" } as unknown as FilterState);
  const markets = pacingMarkets(accounts);
  return markets.map((m) => {
    const projected = m.pacing.projectedSpend ?? m.spend;
    const pct = m.budget ? (projected / m.budget) * 100 : 0;
    const spendPct = m.budget ? (m.spend / m.budget) * 100 : 0;
    const status: PaceStatus = !m.budget
      ? "ok"
      : pct >= cfg.overspendPct
        ? "over"
        : pct <= cfg.underspendPct
          ? "under"
          : "ok";
    return { market: m.market, currency: m.currency, budget: m.budget, spend: m.spend, projected, pct, spendPct, status };
  });
}

interface AlertState {
  lastFlags: Record<string, string[]>; // market → active flag types (for de-dup)
  lastWeeklyDate?: string;
}
const STATE_KEY = "alert-state";
async function getState(): Promise<AlertState> {
  return kvGet<AlertState>(STATE_KEY, { lastFlags: {} });
}
async function setState(s: AlertState): Promise<void> {
  await kvSet(STATE_KEY, s);
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

// ---- HTML rendering ----------------------------------------------------------

function shell(title: string, intro: string, body: string): string {
  const period = currentPeriod().label;
  return `<div style="max-width:640px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0F172A">
    <h2 style="font-size:18px;margin:0 0 4px">${title}</h2>
    <p style="color:#64748B;font-size:13px;margin:0 0 16px">${period} · ${intro}</p>
    ${body}
    <p style="color:#94A3B8;font-size:11px;margin-top:16px">LegalVision Paid Media Reporting · budget pacing alert. Configure recipients, thresholds and checkpoints in the dashboard (Admin → Alerts).</p>
  </div>`;
}

function digestTable(lines: MarketPaceLine[]): string {
  const rows = lines
    .map((l) => {
      const colour = l.status === "over" ? "#B91C1C" : l.status === "under" ? "#B45309" : "#15803D";
      const label = l.status === "over" ? "Over pace" : l.status === "under" ? "Under pace" : "On track";
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;font-weight:600">${marketName(l.market)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;text-align:right">${formatMoney(l.budget, l.currency)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;text-align:right">${formatMoney(l.spend, l.currency)} (${formatPercent(l.spendPct / 100)})</td>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;text-align:right">${formatMoney(l.projected, l.currency)} (${formatPercent(l.pct / 100)})</td>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;text-align:right;color:${colour};font-weight:600">${label}</td>
      </tr>`;
    })
    .join("");
  return `<table style="border-collapse:collapse;width:100%;font-size:13px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
    <thead><tr style="text-align:left;color:#64748B;font-size:11px;text-transform:uppercase">
      <th style="padding:8px 10px">Market</th>
      <th style="padding:8px 10px;text-align:right">Budget</th>
      <th style="padding:8px 10px;text-align:right">Spent to date</th>
      <th style="padding:8px 10px;text-align:right">Forecast month-end</th>
      <th style="padding:8px 10px;text-align:right">Status</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

interface Flag {
  market: MarketCode;
  type: string;
  reason: string;
}

function flagBlocks(flags: Flag[], lines: MarketPaceLine[]): string {
  const byMarket = new Map<MarketCode, Flag[]>();
  for (const f of flags) {
    const list = byMarket.get(f.market) ?? [];
    list.push(f);
    byMarket.set(f.market, list);
  }
  return [...byMarket.entries()]
    .map(([m, fs]) => {
      const l = lines.find((x) => x.market === m)!;
      return `<div style="margin-bottom:14px;padding:10px 12px;border:1px solid #E2E8F0;border-radius:8px">
        <div style="font-weight:600;font-size:14px">${marketName(m)}</div>
        <ul style="margin:6px 0 0;padding-left:18px;color:#334155;font-size:13px">${fs.map((f) => `<li>${f.reason}</li>`).join("")}</ul>
        <div style="color:#64748B;font-size:12px;margin-top:6px">Budget ${formatMoney(l.budget, l.currency)} · spent ${formatMoney(l.spend, l.currency)} · forecast ${formatMoney(l.projected, l.currency)}</div>
      </div>`;
    })
    .join("");
}

// ---- orchestration -----------------------------------------------------------

export interface AlertRunResult {
  triggered: MarketCode[];
  weeklySent: boolean;
  skipped?: string;
}

/** Build the active alert flags per market (over/under pace + day-of-month checkpoints). */
function buildFlags(lines: MarketPaceLine[], cfg: Awaited<ReturnType<typeof getAlertConfig>>, now: Date): Flag[] {
  const day = now.getUTCDate();
  // The most recent checkpoint whose day has arrived governs "behind" this run.
  const passed = [...cfg.checkpoints].filter((c) => day >= c.day).sort((a, b) => b.day - a.day)[0];
  const flags: Flag[] = [];
  for (const l of lines) {
    if (l.budget <= 0) continue;
    if (l.status === "over") {
      flags.push({ market: l.market, type: "over", reason: `Projected ${formatPercent(l.pct / 100)} of budget — over the ${cfg.overspendPct}% ceiling` });
    } else if (l.status === "under") {
      flags.push({ market: l.market, type: "under", reason: `Projected ${formatPercent(l.pct / 100)} of budget — under the ${cfg.underspendPct}% floor` });
    }
    if (passed && l.spendPct < passed.minSpendPct) {
      flags.push({
        market: l.market,
        type: `cp${passed.day}`,
        reason: `Only ${formatPercent(l.spendPct / 100)} of budget spent by the ${ordinal(passed.day)} — behind the ${passed.minSpendPct}% checkpoint`,
      });
    }
  }
  return flags;
}

/**
 * Evaluate pacing and email per the config: an immediate alert when a market NEWLY raises a
 * flag (over/under pace, or a day-of-month checkpoint miss), de-duped against the last run;
 * plus a weekly digest on the chosen day. Safe to call daily from the cron.
 */
export async function runBudgetAlerts(now = new Date()): Promise<AlertRunResult> {
  const cfg = await getAlertConfig();
  if (!cfg.enabled) return { triggered: [], weeklySent: false, skipped: "disabled" };
  if (cfg.recipients.length === 0) return { triggered: [], weeklySent: false, skipped: "no-recipients" };
  if (!emailConfigured()) return { triggered: [], weeklySent: false, skipped: "email-not-configured" };

  const lines = await evaluatePacing();
  const flags = buildFlags(lines, cfg, now);
  const state = await getState();

  const activeByMarket: Record<string, string[]> = {};
  for (const f of flags) (activeByMarket[f.market] ??= []).push(f.type);
  // A flag is a trigger only if it wasn't already active for that market last run.
  const newFlags = flags.filter((f) => !(state.lastFlags[f.market] ?? []).includes(f.type));

  if (cfg.triggerAlerts && newFlags.length > 0) {
    const markets = [...new Set(newFlags.map((f) => f.market))].map(marketName).join(", ");
    await sendEmail(cfg.recipients, `⚠️ Budget pacing alert — ${markets}`, shell("Budget pacing alert", "a market has crossed an alert threshold", flagBlocks(newFlags, lines)));
  }

  const today = now.toISOString().slice(0, 10);
  let weeklySent = false;
  if (cfg.weeklyDigest && now.getUTCDay() === cfg.weeklyDay && state.lastWeeklyDate !== today) {
    await sendEmail(cfg.recipients, "Weekly budget pacing digest", shell("Weekly budget pacing digest", "all markets, month-to-date pacing", digestTable(lines)));
    weeklySent = true;
  }

  await setState({ lastFlags: activeByMarket, lastWeeklyDate: weeklySent ? today : state.lastWeeklyDate });
  return { triggered: [...new Set(newFlags.map((f) => f.market))], weeklySent };
}

/** Send a one-off test email to the current recipients (Admin → Alerts "Send test"). */
export async function sendTestAlert(): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getAlertConfig();
  if (cfg.recipients.length === 0) return { ok: false, error: "Add at least one recipient first." };
  if (!emailConfigured()) return { ok: false, error: "Email isn't configured yet (RESEND_API_KEY / ALERT_FROM_EMAIL)." };
  const lines = await evaluatePacing();
  return sendEmail(cfg.recipients, "Test — budget pacing alert", shell("Test alert", "this is a test of the budget pacing alerts", digestTable(lines)));
}
