"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Zap, Eye, Pause, AlertTriangle, ArrowRight, TrendingDown, TrendingUp, Shield, ShieldAlert } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { saveAutopaceConfig, applyAutopaceNow } from "@/app/(dashboard)/admin/actions";
import type { AutopaceConfig, FunnelKey } from "@/lib/pacing/autopace-config";
import type { AutopacePlan, AccountPlan, AccountPaceStatus } from "@/lib/pacing/autopace";
import type { AutopaceLogEntry } from "@/lib/pacing/autopace-config";
import { formatMoney, formatPercent } from "@/lib/metrics/format";
import type { CurrencyCode } from "@/lib/domain/types";

const ACCOUNTS: { id: string; market: "AU" | "UK" | "NZ"; label: string }[] = [
  { id: "au-meta", market: "AU", label: "Australia" },
  { id: "uk-meta", market: "UK", label: "United Kingdom" },
  { id: "nz-meta", market: "NZ", label: "New Zealand" },
];

const MARKET: Record<string, { hue: string; name: string }> = {
  AU: { hue: "var(--lv-au)", name: "Australia" },
  UK: { hue: "var(--lv-uk)", name: "United Kingdom" },
  NZ: { hue: "var(--lv-nz)", name: "New Zealand" },
};

const FUNNEL_LABEL: Record<FunnelKey, string> = {
  BOFU: "BOFU",
  "SME Publication": "SME Pub",
  Traffic: "Traffic",
};

const MODES: { key: AutopaceConfig["mode"]; label: string; desc: string; icon: typeof Pause }[] = [
  { key: "off", label: "Off", desc: "Idle. Budgets are never changed — preview only.", icon: Pause },
  { key: "recommend", label: "Recommend", desc: "Suggestions shown. You apply them with one click.", icon: Eye },
  { key: "auto", label: "Auto", desc: "The daily job applies them within your guardrails.", icon: Zap },
];

const STATUS: Record<AccountPaceStatus, { tone: "success" | "warning" | "danger" | "grey"; label: string }> = {
  on_track: { tone: "success", label: "On track" },
  over: { tone: "danger", label: "Pacing over" },
  under: { tone: "warning", label: "Pacing under" },
  no_budget: { tone: "grey", label: "No budget set" },
  no_campaigns: { tone: "grey", label: "Nothing to manage" },
};

function money(v: number, c: string) {
  return formatMoney(v, c as CurrencyCode);
}
function tint(hue: string, pct: number) {
  return `color-mix(in srgb, ${hue} ${pct}%, transparent)`;
}

export function AutopaceEditor({
  initial,
  plan,
  log,
}: {
  initial: AutopaceConfig;
  plan: AutopacePlan;
  log: AutopaceLogEntry[];
}) {
  const [cfg, setCfg] = useState<AutopaceConfig>(initial);
  const [pending, start] = useTransition();
  const [applying, startApply] = useTransition();
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = <K extends keyof AutopaceConfig>(k: K, v: AutopaceConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const toggleAccount = (id: string) =>
    set("accounts", cfg.accounts.includes(id) ? cfg.accounts.filter((a) => a !== id) : [...cfg.accounts, id]);

  const save = () => {
    setMsg(null);
    start(async () => {
      const res = await saveAutopaceConfig(cfg);
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1800); }
      else setMsg(res.error ?? "Couldn't save.");
    });
  };
  const apply = () => {
    setMsg(null);
    startApply(async () => {
      const res = await applyAutopaceNow();
      if (res.ok) setMsg(`Applied ${res.applied} change${res.applied === 1 ? "" : "s"}${res.failed ? `, ${res.failed} failed` : ""}.`);
      else setMsg(res.error ?? "Apply failed.");
    });
  };

  const changesFor = (a: AccountPlan) =>
    a.campaigns.filter((c) => Math.abs(c.delta) >= cfg.minChangeAbs && c.recommendedDaily !== c.currentDaily).length;
  const totalChanges = plan.accounts.reduce((n, a) => n + changesFor(a), 0);

  // funnels present per account (for the manual-allocation editor)
  const funnelsByAccount: Record<string, FunnelKey[]> = {};
  for (const a of plan.accounts) funnelsByAccount[a.accountId] = [...new Set(a.campaigns.map((c) => c.funnel))];
  const setShare = (accountId: string, funnel: FunnelKey, pct: number) =>
    set("allocations", { ...cfg.allocations, [accountId]: { ...(cfg.allocations[accountId] ?? {}), [funnel]: pct } });
  const setProtect = (patch: Partial<AutopaceConfig["autoProtect"]>) => set("autoProtect", { ...cfg.autoProtect, ...patch });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ======= Tool header ======= */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-tight text-ink">Meta auto-pacing</h2>
        <ModeTag mode={cfg.mode} />
      </div>

      {/* ======= Controls ======= */}
      <section className="overflow-hidden rounded-2xl border border-[var(--lv-border)] bg-card shadow-[0_1px_3px_rgb(15_23_42_/_0.06)]">
        <Bar>Controls</Bar>
        <div className="space-y-6 p-5">
          {/* mode */}
          <div className="grid gap-3 sm:grid-cols-3">
            {MODES.map((m) => {
              const on = cfg.mode === m.key;
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => set("mode", m.key)}
                  className={`group relative rounded-xl border p-3.5 text-left transition ${
                    on ? "border-primary bg-primary-subtle/60 ring-1 ring-primary/40" : "border-[var(--lv-border)] hover:border-primary/40 hover:bg-canvas"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${on ? "bg-primary text-white" : "bg-canvas text-muted group-hover:text-secondary"}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className={`text-[14px] font-semibold ${on ? "text-primary" : "text-ink"}`}>{m.label}</span>
                    {on && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </div>
                  <p className="mt-2 text-[11.5px] leading-snug text-muted">{m.desc}</p>
                </button>
              );
            })}
          </div>

          {cfg.mode === "auto" && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/[0.07] px-3.5 py-2.5 text-[12px] leading-relaxed text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Auto mode writes live Meta budgets on the daily job. Every change is bounded by the guardrails below and logged.</span>
            </div>
          )}

          {/* accounts */}
          <Group label="Managed accounts" hint="Meta accounts the engine paces">
            <div className="flex flex-wrap gap-2">
              {ACCOUNTS.map((a) => {
                const on = cfg.accounts.includes(a.id);
                const hue = MARKET[a.market].hue;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAccount(a.id)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${
                      on ? "border-[var(--lv-border)] bg-canvas text-ink" : "border-dashed border-[var(--lv-border)] text-muted hover:bg-canvas"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: on ? hue : "var(--lv-muted)" }} />
                    Meta · {a.label}
                    {on ? <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} /> : <span className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          </Group>

          {cfg.mode !== "off" && (
            <Group label="Pacing goal" hint="What the recommendations aim for">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Target utilisation" suffix="%" value={cfg.targetUtilisationPct} onChange={(v) => set("targetUtilisationPct", v)} hint="Land on this % of the monthly budget by month-end" />
              </div>
            </Group>
          )}

          {cfg.mode !== "off" && (
            <Group label="Budget split" hint="How each account's budget is divided across funnels">
              <div className="inline-flex rounded-lg border border-[var(--lv-border)] bg-canvas p-0.5">
                {(["auto", "manual"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set("allocationMode", m)}
                    className={`rounded-md px-3 py-1.5 text-[12.5px] font-medium capitalize transition ${
                      cfg.allocationMode === m ? "bg-card text-primary shadow-sm ring-1 ring-[var(--lv-border)]" : "text-muted hover:text-ink"
                    }`}
                  >
                    {m === "auto" ? "Auto (proportional)" : "Manual %"}
                  </button>
                ))}
              </div>

              {cfg.allocationMode === "manual" && (
                <div className="mt-3 space-y-2.5">
                  {plan.accounts.filter((a) => (funnelsByAccount[a.accountId] ?? []).length > 0).map((a) => {
                    const funnels = funnelsByAccount[a.accountId];
                    const alloc = cfg.allocations[a.accountId] ?? {};
                    const sum = funnels.reduce((s, f) => s + (alloc[f] ?? 0), 0);
                    const hue = MARKET[a.market]?.hue ?? "var(--lv-primary)";
                    return (
                      <div key={a.accountId} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-[var(--lv-border)] bg-card px-3 py-2.5">
                        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: hue }} /> {a.market}
                        </span>
                        {funnels.map((f) => (
                          <label key={f} className="flex items-center gap-1.5 text-[11.5px] text-secondary">
                            {FUNNEL_LABEL[f]}
                            <span className="flex items-center rounded-md border border-[var(--lv-border)] bg-canvas px-1.5 py-1">
                              <input
                                type="number"
                                value={alloc[f] ?? 0}
                                onChange={(e) => setShare(a.accountId, f, Number(e.target.value))}
                                className="w-10 bg-transparent text-right text-[12.5px] font-semibold text-ink outline-none"
                              />
                              <span className="text-[11px] text-muted">%</span>
                            </span>
                          </label>
                        ))}
                        <span className={`ml-auto text-[11px] font-medium ${sum === 100 ? "text-success" : "text-warning"}`}>
                          {sum}%{sum !== 100 ? " — normalised to 100" : ""}
                        </span>
                      </div>
                    );
                  })}
                  <p className="text-[10.5px] text-muted">Shares are a % of each account&apos;s monthly budget; each funnel is then paced to its own slice. If they don&apos;t total 100 they&apos;re scaled to fit.</p>
                </div>
              )}
            </Group>
          )}

          {cfg.mode === "auto" && (
            <Group label="Guardrails" hint="Safety limits on the automatic daily changes">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Max change / run" suffix="%" value={cfg.maxChangePct} onChange={(v) => set("maxChangePct", v)} hint="Biggest move allowed in one daily run" />
                <Field label="Min daily budget" prefix="$" value={cfg.minDailyBudget} onChange={(v) => set("minDailyBudget", v)} hint="Never set a campaign below this (account currency)" />
                <Field label="Max daily budget" prefix="$" value={cfg.maxDailyBudget} onChange={(v) => set("maxDailyBudget", v)} hint="0 = no ceiling (account currency)" />
                <Field label="Min change to apply" prefix="$" value={cfg.minChangeAbs} onChange={(v) => set("minChangeAbs", v)} hint="Skip a daily-budget change smaller than this each run" />
              </div>
            </Group>
          )}
        </div>

        {/* footer actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--lv-border)] bg-canvas/50 px-5 py-3.5">
          <button onClick={save} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-primary-hover disabled:opacity-60">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}
            {saved ? "Saved" : "Save settings"}
          </button>
          {cfg.mode === "recommend" && totalChanges > 0 && (
            <button onClick={apply} disabled={applying} className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-card px-4 py-2 text-[13px] font-semibold text-primary transition hover:bg-primary-subtle disabled:opacity-60">
              {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Apply {totalChanges} change{totalChanges === 1 ? "" : "s"} now
            </button>
          )}
          {msg && <span className="text-[12px] font-medium text-secondary">{msg}</span>}
        </div>
      </section>

      {/* ======= AutoProtect ======= */}
      <section className="overflow-hidden rounded-2xl border border-[var(--lv-border)] bg-card shadow-[0_1px_3px_rgb(15_23_42_/_0.06)]">
        <Bar>AutoProtect</Bar>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cfg.autoProtect.enabled ? "bg-primary/10 text-primary" : "bg-canvas text-muted"}`}>
                <Shield className="h-4.5 w-4.5" />
              </span>
              <div>
                <div className="text-[14px] font-semibold text-ink">Hard spend cap</div>
                <p className="mt-0.5 max-w-lg text-[12px] leading-relaxed text-secondary">
                  A safety net on top of pacing. When an account&apos;s month-to-date spend reaches the cap, the daily job
                  <b className="font-semibold text-ink"> pauses its campaigns</b> and auto re-enables them on the 1st. Runs independently of the mode above.
                </p>
              </div>
            </div>
            <Switch on={cfg.autoProtect.enabled} onChange={(v) => setProtect({ enabled: v })} />
          </div>

          {cfg.autoProtect.enabled && (
            <div className="mt-4 border-t border-[var(--lv-border)] pt-4">
              <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start">
                <Field label="Pause at" suffix="%" value={cfg.autoProtect.capPct} onChange={(v) => setProtect({ capPct: v })} hint="of the monthly budget" />
                <div className="space-y-1.5">
                  <Lbl>Cap per account</Lbl>
                  <div className="flex flex-wrap gap-2">
                    {plan.accounts.filter((a) => a.monthlyBudget > 0).map((a) => (
                      <span key={a.accountId} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] ${a.protect.breached ? "border-danger/30 bg-danger/[0.06] text-danger" : "border-[var(--lv-border)] bg-canvas text-secondary"}`}>
                        {a.protect.breached ? <ShieldAlert className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                        <b className="font-semibold">{a.market}</b> {money(a.protect.cap, a.currency)}
                        {a.protect.breached && <span className="font-semibold">· cap reached</span>}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ======= Recommendations ======= */}
      <div>
        <div className="mb-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-secondary">Recommendations</h3>
        </div>

        {!plan.configured ? (
          <Empty>Add <code className="rounded bg-canvas px-1">META_SYSTEM_USER_TOKEN</code> to compute live pacing recommendations.</Empty>
        ) : plan.accounts.length === 0 ? (
          <Empty>No managed accounts selected. Tick at least one account above.</Empty>
        ) : (
          <div className="space-y-4">
            {plan.accounts.map((a) => (
              <AccountCard key={a.accountId} a={a} />
            ))}
          </div>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Recommendations use live month-to-date spend. In Recommend mode they show the raw target; in Auto they are bounded by the
          guardrails. LinkedIn isn&apos;t connected yet, so this is Meta-only for now.
        </p>
      </div>

      {/* ======= Audit log ======= */}
      {log.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-[var(--lv-border)] bg-card shadow-[0_1px_3px_rgb(15_23_42_/_0.06)]">
          <Bar>Recent changes</Bar>
          <table className="w-full text-[12.5px]">
            <tbody>
              {log.slice(0, 12).map((e, i) => (
                <tr key={i} className="border-t border-[var(--lv-border)] first:border-0">
                  <td className="px-5 py-2.5 text-muted">{e.at.slice(0, 16).replace("T", " ")}</td>
                  <td className="px-3 py-2.5 text-ink">{e.campaignName}</td>
                  <td className="px-3 py-2.5 text-right tnum text-secondary">{money(e.from, e.currency)} → {money(e.to, e.currency)}</td>
                  <td className="px-5 py-2.5 text-right text-muted">{e.by === "cron" ? "auto" : e.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

// ===========================================================================

function AccountCard({ a }: { a: AccountPlan }) {
  const st = STATUS[a.status];
  const hue = MARKET[a.market]?.hue ?? "var(--lv-primary)";
  const name = MARKET[a.market]?.name ?? a.market;
  const actionable = a.status === "over" || a.status === "under" || a.status === "on_track";
  const spentPct = Math.min(Math.max(a.spentPct, 0), 1);
  const delta = a.recommendedDailyTotal - a.currentDailyTotal;

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--lv-border)] bg-card shadow-[0_1px_3px_rgb(15_23_42_/_0.06)]">
      {/* market accent bar */}
      <div style={{ background: hue, height: 3 }} />

      {/* header */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span
            className="flex h-8 w-11 items-center justify-center rounded-lg text-[12px] font-bold tracking-wide"
            style={{ background: tint(hue, 12), color: hue }}
          >
            {a.market}
          </span>
          <div>
            <div className="text-[14.5px] font-semibold leading-tight text-ink">Meta · {name}</div>
            <div className="text-[11px] text-muted">{a.daysRemaining} day{a.daysRemaining === 1 ? "" : "s"} left this month</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {a.allocation === "manual" && (
            <span className="rounded-full border border-[var(--lv-border)] bg-canvas px-2 py-0.5 text-[11px] font-medium text-secondary">Manual split</span>
          )}
          {a.protect.enabled && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${a.protect.breached ? "bg-danger/10 text-danger" : "bg-canvas text-secondary"}`}>
              {a.protect.breached ? <ShieldAlert className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
              {a.protect.breached ? "Cap reached" : "Protected"}
            </span>
          )}
          <StatusPill tone={st.tone} dot>{st.label}</StatusPill>
        </div>
      </div>

      {a.note ? (
        <div className="border-t border-[var(--lv-border)] px-5 py-5 text-[12.5px] text-muted">{a.note}</div>
      ) : (
        <>
          {a.protect.enabled && a.protect.breached && (
            <div className="flex items-start gap-2 border-t border-danger/20 bg-danger/[0.05] px-5 py-2.5 text-[12px] font-medium text-danger">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Spend cap reached ({money(a.protect.cap, a.currency)}) — AutoProtect pauses these campaigns on the next run, re-enabling on the 1st.
            </div>
          )}
          {/* stat tiles */}
          <div className="grid grid-cols-1 divide-y divide-[var(--lv-border)] border-t border-[var(--lv-border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Tile label="Monthly budget" value={money(a.monthlyBudget, a.currency)} />
            <div className="px-5 py-4">
              <Lbl>Spent so far</Lbl>
              <div className="mt-1 text-[18px] font-bold tnum text-ink">{money(a.mtdSpend, a.currency)}</div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--lv-border)]">
                <div className="h-full rounded-full" style={{ width: `${Math.max(spentPct * 100, 2)}%`, background: a.status === "over" ? "var(--lv-danger)" : hue }} />
              </div>
              <div className="mt-1.5 text-[11px] text-muted">{formatPercent(a.spentPct)} of budget</div>
            </div>
            <div className="px-5 py-4">
              <Lbl>Projected finish</Lbl>
              {actionable ? (
                <>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-[18px] font-bold tnum text-success">{money(a.projectedMonthEnd, a.currency)}</span>
                    <span className="text-[10.5px] font-semibold uppercase tracking-wide text-success">with plan</span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-muted">
                    If unchanged:{" "}
                    <span className={a.status === "over" ? "font-semibold text-danger" : a.status === "under" ? "font-semibold text-warning" : "text-secondary"}>
                      {money(a.projectedIfUnchanged, a.currency)} ({formatPercent(a.projectedIfUnchangedPct)})
                    </span>
                  </div>
                </>
              ) : (
                <div className="mt-1 text-[18px] font-bold tnum text-ink">{money(a.projectedMonthEnd, a.currency)}</div>
              )}
            </div>
          </div>

          {/* daily-budget hero */}
          <div className="border-t border-[var(--lv-border)] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--lv-border)] bg-canvas/60 px-4 py-3.5">
              <div className="flex items-center gap-4">
                <div>
                  <Lbl>Daily budget (today)</Lbl>
                  <div className="mt-0.5 text-[16px] font-semibold tnum text-secondary">{money(a.currentDailyTotal, a.currency)}</div>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-muted" />
                <div>
                  <Lbl>Recommended</Lbl>
                  <div className="mt-0.5 text-[20px] font-bold tnum" style={{ color: hue }}>{money(a.recommendedDailyTotal, a.currency)}</div>
                </div>
              </div>
              <DeltaBadge delta={delta} pct={a.dailyChangePct} currency={a.currency} large />
            </div>
          </div>

          {/* campaign table */}
          <div className="border-t border-[var(--lv-border)]">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-canvas/50 text-[10px] uppercase tracking-[0.06em] text-secondary">
                  <th className="px-5 py-2.5 text-left font-semibold">Campaign</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Current / day</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Recommended</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Change</th>
                </tr>
              </thead>
              <tbody>
                {a.campaigns.map((c) => (
                  <tr key={c.campaignId} className="border-t border-[var(--lv-border)] transition-colors hover:bg-rowhover/40">
                    <td className="px-5 py-3 text-ink">
                      {c.campaignName}
                      {c.allocationPct != null && (
                        <span className="ml-2 rounded bg-primary-subtle px-1.5 py-0.5 text-[10px] font-semibold text-primary" title="Target share of budget">{c.allocationPct}%</span>
                      )}
                      {c.clamped && <span className="ml-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-muted" title="Bound by a guardrail">clamped</span>}
                    </td>
                    <td className="px-3 py-3 text-right tnum text-secondary">{money(c.currentDaily, a.currency)}</td>
                    <td className="px-3 py-3 text-right tnum font-semibold text-ink">{money(c.recommendedDaily, a.currency)}</td>
                    <td className="px-5 py-3 text-right"><DeltaBadge delta={c.delta} currency={a.currency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

// ---- small building blocks ----

function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--lv-border)] bg-canvas/50 px-5 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">{children}</span>
    </div>
  );
}

function ModeTag({ mode }: { mode: AutopaceConfig["mode"] }) {
  const map = {
    off: { tone: "grey" as const, label: "Engine off", Icon: Pause },
    recommend: { tone: "info" as const, label: "Recommend mode", Icon: Eye },
    auto: { tone: "success" as const, label: "Auto mode", Icon: Zap },
  };
  const m = map[mode];
  return <StatusPill tone={m.tone} dot={false}><m.Icon className="h-3 w-3" /> {m.label}</StatusPill>;
}

function Group({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline gap-2">
        <span className="text-[12.5px] font-semibold text-ink">{label}</span>
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <Lbl>{label}</Lbl>
      <div className="mt-1 text-[18px] font-bold tnum text-ink">{value}</div>
    </div>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">{children}</div>;
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? "bg-primary" : "bg-[var(--lv-border)]"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function DeltaBadge({ delta, pct, currency, large }: { delta: number; pct?: number; currency: string; large?: boolean }) {
  const flat = Math.abs(delta) < 0.005;
  const up = delta > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const cls = flat ? "bg-canvas text-muted" : up ? "bg-success/10 text-success" : "bg-danger/10 text-danger";
  const pad = large ? "px-3 py-1.5 text-[13px]" : "px-2 py-0.5 text-[12px]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold tnum ${cls} ${pad}`}>
      {flat ? "No change" : (
        <>
          <Icon className={large ? "h-3.5 w-3.5" : "h-3 w-3"} />
          {up ? "+" : ""}{money(delta, currency)}
          {pct != null && <span className="opacity-70">({up ? "+" : ""}{formatPercent(pct)})</span>}
        </>
      )}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-[var(--lv-border)] bg-card px-4 py-10 text-center text-[13px] text-secondary">{children}</div>;
}

function Field({ label, value, onChange, prefix, suffix, hint }: { label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-secondary">{label}</span>
      <span className="mt-1.5 flex items-center gap-0.5 rounded-lg border border-[var(--lv-border)] bg-card px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30">
        {prefix && <span className="text-[13px] font-medium text-muted">{prefix}</span>}
        <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full bg-transparent text-[13px] font-semibold text-ink outline-none" />
        {suffix && <span className="text-[12px] text-muted">{suffix}</span>}
      </span>
      {hint && <span className="mt-1 block text-[10px] leading-snug text-muted">{hint}</span>}
    </label>
  );
}
