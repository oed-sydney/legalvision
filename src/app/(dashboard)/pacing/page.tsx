import { Fragment } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { PacingStatusPill } from "@/components/ui/StatusPill";
import { PaceIndicator } from "@/components/ui/PaceIndicator";
import { PanelTabs } from "@/components/ui/PanelTabs";
import { CumulativeCurve } from "@/components/charts/CumulativeCurve";
import { PacingAccountTable, type PacingTableRow } from "@/components/tables/PacingAccountTable";
import { parseFilters } from "@/lib/filters/schema";
import {
  pacingAccounts,
  pacingCampaigns,
  pacingCurve,
  pacingMarkets,
  pacingOverall,
  lastMonthPerformance,
  type LastMonthPerformance,
} from "@/lib/data/pacing-report";
import { currentPeriod } from "@/lib/data/period";
import { hydrateLiveData } from "@/lib/data/source";
import { marketName } from "@/lib/domain/accounts";
import { CURRENCY_SYMBOL, formatMoney, formatPercent } from "@/lib/metrics/format";
import { PACING_STATUS_LABEL } from "@/lib/pacing/engine";

export default async function PacingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await hydrateLiveData();
  const f = parseFilters(await searchParams);
  const accounts = await pacingAccounts(f);
  const markets = pacingMarkets(accounts);
  const overall = pacingOverall(markets);
  const curve = pacingCurve(f, overall);
  const campaigns = pacingCampaigns(f);
  const lastMonth = await lastMonthPerformance(f);

  const accountRows: PacingTableRow[] = accounts.map((a) => ({
    key: a.accountId,
    col1: marketName(a.market),
    col2: a.channel === "google_ads" ? "Google" : "Meta",
    label: a.accountName,
    currency: a.currency,
    pacing: a.pacing,
  }));

  const campaignRows: PacingTableRow[] = campaigns.map((c) => ({
    key: c.campaignId,
    col1: marketName(c.market),
    col2: c.channel === "google_ads" ? "Google" : "Meta",
    label: c.campaignName,
    currency: c.currency,
    budgetSource: c.budgetSource,
    pacing: c.pacing,
  }));

  return (
    <div>
      <PageHeader
        title="Budget Pacing"
        subtitle={`Period: ${currentPeriod().label} (calendar month, account-local) · spend-to-date includes today`}
        actions={
          <a
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--lv-border)] bg-white px-3 py-1.5 text-[13px] font-medium text-primary hover:bg-canvas"
          >
            Edit monthly budgets →
          </a>
        }
      />

      <div className="mb-4 rounded-lg border border-[var(--lv-border)] bg-primary-subtle px-4 py-2.5 text-[13px] text-primary">
        Pacing operates on <strong>budget periods</strong>{" "}in each account&apos;s own timezone — the global date-range filter does not apply on this page.
      </div>

      <PanelTabs
        tabs={[
          {
            key: "summary",
            label: "Summary",
            panel: (
              <SummaryPanel markets={markets} accounts={accounts} overall={overall} curve={curve} />
            ),
          },
          {
            key: "accounts",
            label: "By account",
            panel: (
              <Card>
                <CardTitle>Pacing by account</CardTitle>
                <PacingAccountTable rows={accountRows} csvName="pacing_accounts" />
              </Card>
            ),
          },
          {
            key: "campaigns",
            label: "By campaign",
            panel: (
              <Card>
                <CardTitle
                  action={<span className="text-[12px] text-muted">Budgets derived from platform daily budget × days (labelled)</span>}
                >
                  Pacing by campaign
                </CardTitle>
                <PacingAccountTable
                  rows={campaignRows}
                  labelHeader="Campaign"
                  csvName="pacing_campaigns"
                />
              </Card>
            ),
          },
          {
            key: "last-month",
            label: "Last month",
            panel: <LastMonthPanel data={lastMonth} />,
          },
        ]}
      />
    </div>
  );
}

function SummaryPanel({
  markets,
  accounts,
  overall,
  curve,
}: {
  markets: ReturnType<typeof pacingMarkets>;
  accounts: Awaited<ReturnType<typeof pacingAccounts>>;
  overall: ReturnType<typeof pacingOverall>;
  curve: ReturnType<typeof pacingCurve>;
}) {
  return (
    <div className="space-y-6">
      {/* Overall hero */}
      <Card>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Hero label="Total budget" value={formatMoney(overall.budget, overall.currency, { estimated: overall.estimated })} />
          <Hero label="Spend to date" value={formatMoney(overall.spend, overall.currency, { estimated: overall.estimated })} />
          <Hero label="Projected spend" value={formatMoney(overall.projected, overall.currency, { estimated: overall.estimated })} />
          <div className="flex flex-col justify-between">
            <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-secondary">Period elapsed</div>
            <div className="mt-2 text-[28px] font-bold leading-none tnum text-ink">{formatPercent(overall.elapsedPct)}</div>
            <div className="mt-2 text-[12px] text-muted">{overall.daysRemaining} days remaining</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 border-t border-[var(--lv-border)] pt-3">
          <span className="text-[12px] font-medium uppercase tracking-[0.04em] text-secondary">All-markets pace</span>
          <PaceIndicator pct={overallPacePct(overall)} size="lg" />
          <span className="text-[12px] text-muted">
            (spend vs {formatMoney(overall.budget * overall.elapsedPct, overall.currency, { estimated: overall.estimated })} expected to date)
          </span>
        </div>
        {overall.estimated && (
          <p className="mt-3 text-[11px] text-muted">≈ All-markets figures converted to AUD at daily ECB rates (estimated).</p>
        )}
      </Card>

      {/* Market cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {markets.map((m) => {
          const sym = CURRENCY_SYMBOL[m.currency];
          const util = m.budget ? m.spend / m.budget : 0;
          const statusCounts = tally(m.childStatuses);
          return (
            <Card key={m.market}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-ink">{marketName(m.market)}</h3>
                <PacingStatusPill status={m.pacing.status} />
              </div>
              <div className="mb-2.5">
                <PaceIndicator pct={m.pacing.pacingVariancePct} />
              </div>
              <div className="relative mb-2 h-2.5 w-full overflow-hidden rounded-full bg-canvas">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(util * 100, 100)}%` }} />
                <div className="absolute top-0 h-full w-[2px] bg-ink/60" style={{ left: `${Math.min(m.pacing.periodElapsedPct * 100, 100)}%` }} />
              </div>
              <dl className="grid grid-cols-2 gap-y-1.5 text-[12px]">
                <Row k="Market budget" v={`${sym}${Math.round(m.budget).toLocaleString("en-AU")}`} />
                <Row k="Spend" v={`${sym}${Math.round(m.spend).toLocaleString("en-AU")}`} />
                <Row
                  k="Forecast (mo-end)"
                  v={m.pacing.projectedSpend != null ? `${sym}${Math.round(m.pacing.projectedSpend).toLocaleString("en-AU")}` : "—"}
                  tone={m.pacing.projectedSpend != null && m.budget > 0 && m.pacing.projectedSpend > m.budget ? "text-danger" : undefined}
                />
                <Row k="Expected" v={m.pacing.expectedSpend != null ? `${sym}${Math.round(m.pacing.expectedSpend).toLocaleString("en-AU")}` : "—"} />
                <Row k="Required/day" v={m.pacing.requiredDailySpend != null ? `${sym}${Math.round(m.pacing.requiredDailySpend).toLocaleString("en-AU")}` : "—"} />
              </dl>
              {/* Per-channel split — each budget maps 1:1 to what's set in the editor. */}
              <div className="mt-3 border-t border-[var(--lv-border)] pt-2.5">
                <div className="mb-1 grid grid-cols-[1fr_auto_auto] gap-x-4 text-[10px] font-medium uppercase tracking-[0.04em] text-muted">
                  <span>Channel</span>
                  <span className="text-right">Budget</span>
                  <span className="text-right">Spend</span>
                </div>
                {accounts
                  .filter((a) => a.market === m.market)
                  .sort((a) => (a.channel === "google_ads" ? -1 : 1))
                  .map((a) => (
                    <div key={a.accountId} className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-0.5 text-[12px]">
                      <span className="flex items-center gap-1.5 text-secondary">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: a.channel === "google_ads" ? "var(--lv-google)" : "var(--lv-meta)" }}
                        />
                        {a.channel === "google_ads" ? "Google" : "Meta"}
                      </span>
                      <span className="text-right tnum text-ink">
                        {a.pacing.budget ? `${sym}${Math.round(a.pacing.budget).toLocaleString("en-AU")}` : "—"}
                      </span>
                      <span className="text-right tnum text-ink">
                        {sym}
                        {Math.round(a.pacing.spend).toLocaleString("en-AU")}
                      </span>
                    </div>
                  ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(statusCounts).map(([s, c]) => (
                  <span key={s} className="text-[11px] text-muted">
                    {c} {PACING_STATUS_LABEL[s as keyof typeof PACING_STATUS_LABEL].toLowerCase()}
                  </span>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Cumulative curve */}
      <Card>
        <CardTitle
          action={
            <span className="flex items-center gap-3 text-[11px] text-muted">
              <Legend color="var(--lv-primary)" label="Actual" />
              <Legend color="#94A3B8" label="Ideal" dashed />
              <Legend color="var(--lv-warning)" label="Projected" dashed />
            </span>
          }
        >
          Cumulative spend — actual vs ideal vs projected
        </CardTitle>
        <CumulativeCurve data={curve.points} currency={curve.currency} estimated={curve.estimated} />
      </Card>

      {/* Pacing alerts */}
      <Card>
        <CardTitle>Pacing alerts</CardTitle>
        <ul className="space-y-2">
          {markets
            .filter((m) => m.pacing.status !== "on_track")
            .map((m) => (
              <li key={m.market} className="flex items-center justify-between rounded-lg border border-[var(--lv-border)] px-3 py-2 text-[13px]">
                <span className="font-medium text-ink">{marketName(m.market)} rollup</span>
                <span className="flex items-center gap-3">
                  <span className="text-secondary">
                    Projected {formatMoney(m.pacing.projectedSpend, m.currency)} vs budget {formatMoney(m.budget, m.currency)}
                  </span>
                  <PacingStatusPill status={m.pacing.status} />
                </span>
              </li>
            ))}
          {markets.every((m) => m.pacing.status === "on_track") && (
            <li className="text-[13px] text-muted">All market rollups are on track.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function Hero({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col justify-between">
      <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-secondary">{label}</div>
      <div className={`mt-2 text-[28px] font-bold leading-none tnum ${tone ?? "text-ink"}`}>{value}</div>
    </div>
  );
}

function pctTone(pct: number): string {
  if (pct > 1.05) return "text-danger"; // overspent
  if (pct < 0.9) return "text-warning"; // materially underspent
  return "text-success"; // on budget
}

function LastMonthPanel({ data }: { data: LastMonthPerformance }) {
  const o = data.overall;
  const variance = o.spend - o.budget;
  const pct = o.budget ? o.spend / o.budget : 0;
  const m$ = (v: number, cur: import("@/lib/domain/types").CurrencyCode, est = false) => formatMoney(v, cur, { estimated: est });

  return (
    <Card>
      <CardTitle action={<span className="text-[12px] text-muted">Final spend vs current monthly budget</span>}>
        {data.label} — pacing performance
      </CardTitle>

      {data.markets.length === 0 ? (
        <p className="text-[13px] text-muted">No spend recorded for {data.label} in the current scope.</p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Hero label="Total budget" value={m$(o.budget, o.currency, o.estimated)} />
            <Hero label="Total spend" value={m$(o.spend, o.currency, o.estimated)} />
            <Hero
              label="Variance"
              value={`${variance >= 0 ? "+" : "−"}${m$(Math.abs(variance), o.currency, o.estimated)}`}
              tone={variance > 0 ? "text-danger" : "text-success"}
            />
            <Hero label="% of budget" value={formatPercent(pct)} tone={pctTone(pct)} />
          </div>

          <div className="overflow-x-auto lv-scroll">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--lv-border)] text-[11px] uppercase tracking-wide text-secondary">
                  <th className="py-2 pr-3 text-left">Segment</th>
                  <th className="px-3 py-2 text-right">Budget</th>
                  <th className="px-3 py-2 text-right">Spent</th>
                  <th className="px-3 py-2 text-right">Variance</th>
                  <th className="px-3 py-2 text-right">% of budget</th>
                </tr>
              </thead>
              <tbody>
                {data.markets.map((mk) => {
                  const mv = mk.spend - mk.budget;
                  const mp = mk.budget ? mk.spend / mk.budget : 0;
                  return (
                    <Fragment key={mk.market}>
                      <tr className="border-b border-[var(--lv-border)] bg-canvas/40">
                        <td className="py-2 pr-3 font-semibold text-ink">{marketName(mk.market)}</td>
                        <td className="px-3 py-2 text-right tnum">{m$(mk.budget, mk.currency)}</td>
                        <td className="px-3 py-2 text-right tnum font-semibold">{m$(mk.spend, mk.currency)}</td>
                        <td className={`px-3 py-2 text-right tnum font-medium ${mv > 0 ? "text-danger" : "text-success"}`}>
                          {mv >= 0 ? "+" : "−"}{m$(Math.abs(mv), mk.currency)}
                        </td>
                        <td className={`px-3 py-2 text-right tnum font-medium ${pctTone(mp)}`}>{formatPercent(mp)}</td>
                      </tr>
                      {mk.accounts.map((a) => {
                        const av = a.spend - a.budget;
                        const ap = a.budget ? a.spend / a.budget : 0;
                        return (
                          <tr key={a.accountId} className="border-b border-[var(--lv-border)] last:border-0">
                            <td className="py-1.5 pr-3 pl-4 text-secondary">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="inline-block h-2 w-2 rounded-full" style={{ background: a.channel === "google_ads" ? "var(--lv-google)" : "var(--lv-meta)" }} />
                                {a.channel === "google_ads" ? "Google" : "Meta"}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-right tnum text-secondary">{m$(a.budget, a.currency)}</td>
                            <td className="px-3 py-1.5 text-right tnum text-secondary">{m$(a.spend, a.currency)}</td>
                            <td className={`px-3 py-1.5 text-right tnum ${av > 0 ? "text-danger" : "text-secondary"}`}>
                              {av >= 0 ? "+" : "−"}{m$(Math.abs(av), a.currency)}
                            </td>
                            <td className="px-3 py-1.5 text-right tnum text-secondary">{formatPercent(ap)}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
function Row({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <>
      <dt className="text-secondary">{k}</dt>
      <dd className={`text-right font-medium tnum ${tone ?? "text-ink"}`}>{v}</dd>
    </>
  );
}
function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block h-0 w-4 border-t-2" style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }} />
      {label}
    </span>
  );
}
function overallPacePct(overall: ReturnType<typeof pacingOverall>): number | null {
  const expected = overall.budget * overall.elapsedPct;
  if (!expected) return null;
  return (overall.spend - expected) / expected;
}
function tally(statuses: string[]): Record<string, number> {
  return statuses.reduce((acc, s) => ((acc[s] = (acc[s] ?? 0) + 1), acc), {} as Record<string, number>);
}

export const dynamic = "force-dynamic";
