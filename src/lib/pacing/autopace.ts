import "server-only";
import {
  META_ACCOUNT_MAP,
  metaConfigured,
  fetchMetaCampaignInsights,
  fetchMetaCampaignBudgets,
  setMetaCampaignDailyBudget,
  setMetaCampaignStatus,
  type MetaCampaignBudget,
} from "../adapters/meta-rest";
import { budgetAmounts } from "../data/budgets-store";
import { classifyFunnel } from "../data/live-meta";
import { currentPeriod } from "../data/period";
import {
  getAutopaceConfig,
  appendAutopaceLog,
  getAutoProtectState,
  setAutoProtectState,
  type AutopaceConfig,
  type AutopaceLogEntry,
  type FunnelKey,
} from "./autopace-config";

/**
 * Meta budget auto-pacing — recommendation engine (Phase 1) + applier (Phase 2/3).
 *
 * For each managed Meta account it computes, from the live month-to-date spend and the
 * account's monthly budget, the daily spend required to land on target by month-end, then
 * scales each active DAILY-budget campaign proportionally — bounded by the configured
 * guardrails. `computeAutopace()` is read-only (drives the dashboard); `runAutopace()`
 * applies the changes only when mode === "auto".
 *
 * All money is native currency per account (budget, spend and daily budgets share the
 * account's currency), so no FX is involved.
 *
 * NOTE on LinkedIn: there is no LinkedIn ad-account connection in this project yet (no
 * source, no token), so auto-pacing covers Meta only. LinkedIn joins once a connector lands.
 */

export interface CampaignPlan {
  campaignId: string;
  campaignName: string;
  funnel: FunnelKey;
  currentDaily: number;
  recommendedDaily: number;
  delta: number; // recommended − current
  clamped: boolean; // a guardrail bound the recommendation
  /** Target share of the monthly budget (manual allocation mode only). */
  allocationPct?: number | null;
}

export type AccountPaceStatus = "over" | "under" | "on_track" | "no_budget" | "no_campaigns";

export interface AccountPlan {
  accountId: string;
  market: "AU" | "UK" | "NZ";
  currency: "AUD" | "GBP" | "NZD";
  monthlyBudget: number;
  mtdSpend: number;
  spentPct: number; // mtd ÷ budget
  daysElapsed: number;
  daysRemaining: number;
  remainingBudget: number;
  /** Spend/day needed across remaining days to hit targetUtilisation of budget. */
  requiredDailySpend: number;
  currentDailyTotal: number; // Σ active managed campaigns' daily budgets
  recommendedDailyTotal: number;
  dailyChangePct: number; // (recommended − current) ÷ current
  projectedMonthEnd: number; // mtd + recommendedDailyTotal × daysRemaining (with the plan)
  projectedIfUnchanged: number; // mtd + currentDailyTotal × daysRemaining (do nothing)
  projectedIfUnchangedPct: number; // projectedIfUnchanged ÷ budget
  status: AccountPaceStatus; // the CURRENT trajectory the plan corrects
  allocation: "auto" | "manual"; // how the split was computed for this account
  /** AutoProtect state for this account (independent of pacing). */
  protect: { enabled: boolean; capPct: number; cap: number; breached: boolean };
  campaigns: CampaignPlan[];
  note?: string;
}

export interface AutopacePlan {
  configured: boolean;
  mode: AutopaceConfig["mode"];
  accounts: AccountPlan[];
}

/**
 * Bound a scaled target. The damping guardrails (max %-move per run, max daily ceiling) are
 * SAFETY rails for UNATTENDED auto writes, so they apply only when `enforce` is true (auto
 * mode). In recommend mode the raw scaled recommendation is shown — the human reviewing it
 * before clicking Apply is the control. The minimum-daily floor always applies (it keeps the
 * write valid against Meta's own minimum).
 */
function clampChange(current: number, target: number, cfg: AutopaceConfig, enforce: boolean): { value: number; clamped: boolean } {
  let clamped = false;
  let v = target;
  if (enforce) {
    // Per-run max move
    const maxUp = current * (1 + cfg.maxChangePct / 100);
    const maxDown = current * (1 - cfg.maxChangePct / 100);
    if (v > maxUp) { v = maxUp; clamped = true; }
    if (v < maxDown) { v = maxDown; clamped = true; }
    // Absolute ceiling
    if (cfg.maxDailyBudget > 0 && v > cfg.maxDailyBudget) { v = cfg.maxDailyBudget; clamped = true; }
  }
  // Absolute floor — always (write safety)
  if (v < cfg.minDailyBudget) { v = cfg.minDailyBudget; clamped = true; }
  return { value: Math.round(v * 100) / 100, clamped };
}

/**
 * A campaign is managed when it's ACTIVE, runs on its own campaign-level daily budget, AND
 * is one of the tracked funnels (BOFU / SME-publication / TOFU-traffic). Event, legacy and
 * lifetime-budget campaigns are deliberately out of scope — same as the Social tab.
 */
function managedCampaigns(budgets: MetaCampaignBudget[], activeNames: Set<string>): MetaCampaignBudget[] {
  return budgets.filter(
    (b) =>
      b.status === "ACTIVE" &&
      b.dailyBudget != null &&
      b.dailyBudget > 0 &&
      activeNames.has(b.name) &&
      classifyFunnel(b.name) != null
  );
}

/** Read-only pacing plan for every managed account (drives the Admin recommendations view). */
export async function computeAutopace(now = new Date()): Promise<AutopacePlan> {
  const cfg = await getAutopaceConfig();
  if (!metaConfigured()) return { configured: false, mode: cfg.mode, accounts: [] };

  const period = currentPeriod(now);
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const dayOfMonth = now.getUTCDate();
  const daysRemaining = Math.max(daysInMonth - dayOfMonth + 1, 1); // includes today
  const daysElapsed = dayOfMonth - 1;

  const budgets = await budgetAmounts();
  const enforce = cfg.mode === "auto"; // damping guardrails apply to unattended auto writes only
  const accounts: AccountPlan[] = [];

  for (const [numericId, meta] of Object.entries(META_ACCOUNT_MAP)) {
    if (!cfg.accounts.includes(meta.id)) continue;
    const monthlyBudget = budgets[meta.id] ?? 0;

    let insights: Awaited<ReturnType<typeof fetchMetaCampaignInsights>>;
    let campBudgets: MetaCampaignBudget[];
    try {
      [insights, campBudgets] = await Promise.all([
        fetchMetaCampaignInsights(numericId, "this_month"),
        fetchMetaCampaignBudgets(numericId),
      ]);
    } catch {
      continue;
    }

    const activeNames = new Set(insights.map((i) => i.campaign_name));
    // Scope MTD spend to the tracked funnels — the same campaigns being paced — so the
    // budget target and the spend compared against it share one scope (events/lifetime excluded).
    const mtdSpend =
      Math.round(insights.filter((i) => classifyFunnel(i.campaign_name) != null).reduce((s, i) => s + i.spend, 0) * 100) / 100;
    const managed = managedCampaigns(campBudgets, activeNames);
    const currentDailyTotal = Math.round(managed.reduce((s, b) => s + (b.dailyBudget ?? 0), 0) * 100) / 100;

    const targetPct = cfg.targetUtilisationPct / 100;
    const remainingBudget = Math.max(monthlyBudget * targetPct - mtdSpend, 0);
    const requiredDailySpend = Math.round((remainingBudget / daysRemaining) * 100) / 100;

    // Manual allocation: use this account's funnel shares if any are set (else proportional).
    const alloc = cfg.allocationMode === "manual" ? cfg.allocations[meta.id] ?? null : null;
    const useAlloc = Boolean(alloc && Object.values(alloc).some((v) => (v ?? 0) > 0));
    const mtdByCampaign = new Map(insights.map((i) => [i.campaign_name, i.spend]));

    let plan: CampaignPlan[] = [];
    let note: string | undefined;

    if (monthlyBudget <= 0) {
      note = "No monthly budget set for this account — set one in Budgets to enable pacing.";
    } else if (managed.length === 0) {
      note = "No active campaign-level daily budgets to manage (lifetime/ad-set budgets are left untouched).";
    } else if (currentDailyTotal <= 0) {
      note = "Managed campaigns have no daily budget to scale.";
    } else if (useAlloc && alloc) {
      // Per-funnel pacing: each funnel gets a % of the monthly budget and is paced to it.
      const byFunnel = new Map<FunnelKey, MetaCampaignBudget[]>();
      for (const b of managed) {
        const f = classifyFunnel(b.name)!.funnel as FunnelKey;
        (byFunnel.get(f) ?? byFunnel.set(f, []).get(f)!).push(b);
      }
      const rawSum = [...byFunnel.keys()].reduce((s, f) => s + (alloc[f] ?? 0), 0) || 1;
      for (const [f, camps] of byFunnel) {
        const sharePct = ((alloc[f] ?? 0) / rawSum) * 100; // normalised across active funnels
        const funnelBudget = monthlyBudget * (sharePct / 100);
        const funnelMtd = camps.reduce((s, b) => s + (mtdByCampaign.get(b.name) ?? 0), 0);
        const funnelDaily = Math.max(funnelBudget * targetPct - funnelMtd, 0) / daysRemaining;
        const per = funnelDaily / camps.length;
        for (const b of camps) {
          const current = b.dailyBudget ?? 0;
          const { value, clamped } = clampChange(current, per, cfg, enforce);
          plan.push({
            campaignId: b.id,
            campaignName: b.name,
            funnel: f,
            currentDaily: current,
            recommendedDaily: value,
            delta: Math.round((value - current) * 100) / 100,
            clamped,
            allocationPct: Math.round(sharePct * 10) / 10,
          });
        }
      }
    } else {
      const scale = requiredDailySpend / currentDailyTotal;
      plan = managed.map((b) => {
        const current = b.dailyBudget ?? 0;
        const { value, clamped } = clampChange(current, current * scale, cfg, enforce);
        return {
          campaignId: b.id,
          campaignName: b.name,
          funnel: classifyFunnel(b.name)!.funnel as FunnelKey,
          currentDaily: current,
          recommendedDaily: value,
          delta: Math.round((value - current) * 100) / 100,
          clamped,
          allocationPct: null,
        };
      });
    }

    const recommendedDailyTotal = plan.length
      ? Math.round(plan.reduce((s, c) => s + c.recommendedDaily, 0) * 100) / 100
      : currentDailyTotal;
    const projectedMonthEnd = Math.round((mtdSpend + recommendedDailyTotal * daysRemaining) * 100) / 100;
    const projectedIfUnchanged = Math.round((mtdSpend + currentDailyTotal * daysRemaining) * 100) / 100;
    const projectedIfUnchangedPct = monthlyBudget > 0 ? projectedIfUnchanged / monthlyBudget : 0;
    const dailyChangePct = currentDailyTotal > 0 ? (recommendedDailyTotal - currentDailyTotal) / currentDailyTotal : 0;

    let status: AccountPaceStatus;
    if (monthlyBudget <= 0) status = "no_budget";
    else if (plan.length === 0) status = "no_campaigns";
    else status = projectedIfUnchangedPct > 1.05 ? "over" : projectedIfUnchangedPct < 0.95 ? "under" : "on_track";

    const capPct = cfg.autoProtect.capPct;
    const cap = Math.round(monthlyBudget * (capPct / 100) * 100) / 100;
    const protect = {
      enabled: cfg.autoProtect.enabled,
      capPct,
      cap,
      breached: monthlyBudget > 0 && mtdSpend >= cap,
    };

    accounts.push({
      accountId: meta.id,
      market: meta.market,
      currency: meta.currency,
      monthlyBudget,
      mtdSpend,
      spentPct: monthlyBudget > 0 ? mtdSpend / monthlyBudget : 0,
      daysElapsed,
      daysRemaining,
      remainingBudget: Math.round(remainingBudget * 100) / 100,
      requiredDailySpend,
      currentDailyTotal,
      recommendedDailyTotal,
      dailyChangePct,
      projectedMonthEnd,
      projectedIfUnchanged,
      projectedIfUnchangedPct,
      status,
      allocation: useAlloc ? "manual" : "auto",
      protect,
      campaigns: plan,
      note,
    });
  }

  void period;
  return { configured: true, mode: cfg.mode, accounts };
}

/** Changes worth applying: material moves only (respects the noise guard). */
function materialChanges(plan: AutopacePlan, cfg: AutopaceConfig): { account: AccountPlan; campaign: CampaignPlan }[] {
  const out: { account: AccountPlan; campaign: CampaignPlan }[] = [];
  for (const a of plan.accounts) {
    for (const c of a.campaigns) {
      if (Math.abs(c.delta) >= cfg.minChangeAbs && c.recommendedDaily !== c.currentDaily) {
        out.push({ account: a, campaign: c });
      }
    }
  }
  return out;
}

export interface ApplyResult {
  applied: number;
  failed: number;
  errors: string[];
}

/**
 * Apply a plan's material budget changes via the Meta API. Used by the one-click
 * "Apply" (Admin) and by the auto cron. `by` records who triggered it in the audit log.
 */
export async function applyAutopace(plan: AutopacePlan, by: string): Promise<ApplyResult> {
  const cfg = await getAutopaceConfig();
  const changes = materialChanges(plan, cfg);
  const log: AutopaceLogEntry[] = [];
  const errors: string[] = [];
  let applied = 0;

  for (const { account, campaign } of changes) {
    try {
      await setMetaCampaignDailyBudget(campaign.campaignId, campaign.recommendedDaily);
      applied++;
      log.push({
        at: new Date().toISOString(),
        accountId: account.accountId,
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName,
        from: campaign.currentDaily,
        to: campaign.recommendedDaily,
        currency: account.currency,
        mode: plan.mode,
        by,
      });
    } catch (e) {
      errors.push(`${campaign.campaignName}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }
  await appendAutopaceLog(log);
  return { applied, failed: errors.length, errors };
}

/** Cron entry point: computes and applies ONLY in "auto" mode; a no-op otherwise. */
export async function runAutopace(): Promise<ApplyResult & { skipped?: string }> {
  const cfg = await getAutopaceConfig();
  if (cfg.mode !== "auto") return { applied: 0, failed: 0, errors: [], skipped: cfg.mode };
  if (!metaConfigured()) return { applied: 0, failed: 0, errors: [], skipped: "no-token" };
  const plan = await computeAutopace();
  return applyAutopace(plan, "cron");
}

export interface ProtectResult {
  paused: number;
  reenabled: number;
  errors: string[];
  skipped?: string;
}

/**
 * AutoProtect cron entry point — INDEPENDENT of the pacing mode. Each run it:
 *  1. Re-enables campaigns it paused in a previous month (month rollover), then
 *  2. Pauses the managed campaigns of any account whose MTD spend has reached its cap.
 * Only ever touches campaigns it paused itself (tracked in KV), so manual pauses are safe.
 */
export async function runAutoProtect(now = new Date()): Promise<ProtectResult> {
  const cfg = await getAutopaceConfig();
  if (!cfg.autoProtect.enabled) return { paused: 0, reenabled: 0, errors: [], skipped: "disabled" };
  if (!metaConfigured()) return { paused: 0, reenabled: 0, errors: [], skipped: "no-token" };

  const ym = currentPeriod(now).ym;
  const state = await getAutoProtectState();
  const errors: string[] = [];
  const log: AutopaceLogEntry[] = [];
  let paused = 0;
  let reenabled = 0;

  const plan = await computeAutopace(now);

  for (const a of plan.accounts) {
    const prev = state.paused[a.accountId];

    // 1) Re-enable what AutoProtect paused in an earlier month.
    if (prev && prev.ym !== ym) {
      for (const id of prev.campaignIds) {
        try { await setMetaCampaignStatus(id, "ACTIVE"); reenabled++; }
        catch (e) { errors.push(`re-enable ${id}: ${e instanceof Error ? e.message : "failed"}`); }
      }
      delete state.paused[a.accountId];
    }

    // 2) Pause this month's managed campaigns once the cap is reached (idempotent).
    if (a.protect.enabled && a.protect.breached && !state.paused[a.accountId]) {
      const ids: string[] = [];
      for (const c of a.campaigns) {
        try {
          await setMetaCampaignStatus(c.campaignId, "PAUSED");
          ids.push(c.campaignId);
          paused++;
          log.push({
            at: new Date().toISOString(),
            accountId: a.accountId,
            campaignId: c.campaignId,
            campaignName: `${c.campaignName} (AutoProtect pause)`,
            from: c.currentDaily,
            to: 0,
            currency: a.currency,
            mode: cfg.mode,
            by: "autoprotect",
          });
        } catch (e) {
          errors.push(`pause ${c.campaignName}: ${e instanceof Error ? e.message : "failed"}`);
        }
      }
      if (ids.length) state.paused[a.accountId] = { ym, campaignIds: ids };
    }
  }

  await setAutoProtectState(state);
  await appendAutopaceLog(log);
  return { paused, reenabled, errors };
}
