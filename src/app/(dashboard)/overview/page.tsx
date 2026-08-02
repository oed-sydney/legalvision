import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { ComboTrend } from "@/components/charts/ComboTrend";
import { CampaignsTable, type CampaignRow } from "@/components/tables/CampaignsTable";
import { parseFilters } from "@/lib/filters/schema";
import { buildReport } from "@/lib/data/report";
import { marketPacing, marketTotals } from "@/lib/data/overview";
import { alerts } from "@/lib/data/ops";
import { marketName } from "@/lib/domain/accounts";
import {
  CURRENCY_SYMBOL,
  computeDelta,
  formatInt,
  formatMoney,
  formatPercent,
} from "@/lib/metrics/format";
import { PacingStatusPill } from "@/components/ui/StatusPill";
import type { CurrencyCode } from "@/lib/domain/types";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const f = parseFilters(await searchParams);
  const report = buildReport(f);
  const { totals: t, prevTotals: p, trend, range, compareLabel } = report;
  const cur = t.currency;
  const est = t.estimated;

  const pacing = await marketPacing(f);
  const markets = marketTotals(f, range.from, range.to);

  const spendSeries = trend.points.map((x) => x.spend);
  const llSeries = trend.points.map((x) => x.liveLeads);

  const topCampaigns: CampaignRow[] = report.campaigns.slice(0, 10).map(toRow);

  const openAlerts = alerts()
    .filter((a) => a.status === "open")
    .sort((a, b) => sev(b.severity) - sev(a.severity))
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Executive Overview"
        subtitle={
          <span>
            {range.label} · {range.from} → {range.to}
            {compareLabel ? ` · vs ${compareLabel}` : ""}
            {est ? " · All-markets figures converted to AUD (≈ estimated)" : ""}
          </span>
        }
      />

      {/* Row 1 — KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          metricKey="spend"
          value={formatMoney(t.spend, cur, { estimated: est })}
          delta={p ? computeDelta("spend", t.spend, p.spend) : null}
          sparkline={spendSeries}
          srSummary={`Spend ${formatMoney(t.spend, cur, { estimated: est })}`}
        />
        <KpiCard
          metricKey="budget_utilisation"
          label="Budget used"
          value={formatPercent(pacing.overall.utilisation)}
          footnote={<span>This month · {formatMoney(pacing.overall.spend, pacing.overall.currency, { estimated: pacing.overall.estimated })} of {formatMoney(pacing.overall.budget, pacing.overall.currency, { estimated: pacing.overall.estimated })}</span>}
          delta={undefined}
        />
        <KpiCard
          metricKey="projected_spend"
          label="Projected spend"
          value={formatMoney(pacing.overall.projected, pacing.overall.currency, { estimated: pacing.overall.estimated })}
          footnote={
            <span className={pacing.overall.projected > pacing.overall.budget ? "text-danger" : "text-success"}>
              {pacing.overall.projected > pacing.overall.budget ? "Over" : "Under"} budget by{" "}
              {formatMoney(Math.abs(pacing.overall.projected - pacing.overall.budget), pacing.overall.currency, { estimated: pacing.overall.estimated })}
            </span>
          }
        />
        <KpiCard
          metricKey="live_leads"
          value={t.liveLeads === null ? "—" : formatInt(t.liveLeads)}
          delta={p ? computeDelta("live_leads", t.liveLeads, p.liveLeads) : null}
          sparkline={llSeries}
          sparkColor="var(--lv-success)"
        />
        <KpiCard
          metricKey="impressions"
          value={formatInt(t.impressions)}
          delta={p ? computeDelta("impressions", t.impressions, p.impressions) : null}
        />
        <KpiCard
          metricKey="cpll"
          value={formatMoney(t.cpll, cur, { estimated: est })}
          delta={p ? computeDelta("cpll", t.cpll, p.cpll) : null}
        />
        <KpiCard
          metricKey="cvr"
          value={formatPercent(t.cvr)}
          delta={p ? computeDelta("cvr", t.cvr, p.cvr) : null}
        />
        <KpiCard
          metricKey="clicks"
          value={formatInt(t.comparableClicks)}
          delta={p ? computeDelta("clicks", t.comparableClicks, p.comparableClicks) : null}
          footnote="Google clicks + Meta link clicks"
        />
      </div>

      {/* Row 2 — combo trend */}
      <Card className="mt-6">
        <CardTitle
          action={
            <span className="text-[12px] text-muted">
              {est ? "≈ converted to AUD" : `Native ${cur}`}
            </span>
          }
        >
          Spend &amp; Live leads over time
        </CardTitle>
        <ComboTrend data={trend.points} currency={trend.currency} estimated={trend.estimated} />
      </Card>

      {/* Row 4 — pacing summary */}
      <Card className="mt-6">
        <CardTitle action={<a href="/pacing" className="text-[13px] font-medium text-primary hover:underline">Open Budget Pacing →</a>}>
          Budget pacing summary
        </CardTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {pacing.markets.map((m) => (
            <MarketPacingBar key={m.market} m={m} />
          ))}
        </div>
      </Card>

      {/* Row 5 — country comparison */}
      <Card className="mt-6">
        <CardTitle>Country comparison</CardTitle>
        <CompareTable
          rows={markets.map((m) => ({
            label: marketName(m.market),
            currency: m.currency,
            estimated: false,
            t: m.totals,
          }))}
        />
      </Card>

      {/* Row 6 — top campaigns + needs attention */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardTitle>Top campaigns by spend</CardTitle>
          <CampaignsTable rows={topCampaigns} variant="overview" csvName="overview_top_campaigns" />
        </Card>
        <Card>
          <CardTitle action={<span className="text-[12px] text-muted">{openAlerts.length} open</span>}>
            Needs attention
          </CardTitle>
          <ul className="space-y-3">
            {openAlerts.map((a) => (
              <li key={a.id} className="flex gap-2.5">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: a.severity === "critical" ? "#B91C1C" : a.severity === "warning" ? "#B45309" : "#1D4ED8" }}
                />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink">{a.entityName}</div>
                  <div className="text-[12px] text-secondary">{a.reason}</div>
                  <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">
                    {a.market} · {a.channel === "google_ads" ? "Google" : "Meta"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function sev(s: string) {
  return s === "critical" ? 3 : s === "warning" ? 2 : 1;
}

function toRow(c: {
  campaignId: string;
  campaignName: string;
  campaignType: string;
  market: string;
  channel: string;
  currency: CurrencyCode;
  estimated: boolean;
  spend: number;
  impressions: number;
  comparableClicks: number;
  leads: number;
  liveLeads: number | null;
  cpll: number | null;
  cvr: number | null;
  ctr: number | null;
  cpc: number | null;
}): CampaignRow {
  return {
    campaignId: c.campaignId,
    campaignName: c.campaignName,
    campaignType: c.campaignType,
    market: c.market,
    channel: c.channel,
    currency: c.currency,
    estimated: c.estimated,
    spend: c.spend,
    impressions: c.impressions,
    comparableClicks: c.comparableClicks,
    leads: c.leads,
    liveLeads: c.liveLeads,
    cpll: c.cpll,
    cvr: c.cvr,
    ctr: c.ctr,
    cpc: c.cpc,
  };
}

// ---- inline presentational bits --------------------------------------------

function MarketPacingBar({ m }: { m: import("@/lib/data/overview").MarketPacing }) {
  const util = m.budget ? m.spend / m.budget : 0;
  const elapsed = m.pacing.periodElapsedPct;
  const sym = CURRENCY_SYMBOL[m.currency];
  return (
    <div className="rounded-lg border border-[var(--lv-border)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink">{marketName(m.market)}</span>
        <PacingStatusPill status={m.pacing.status} />
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-canvas">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(util * 100, 100)}%` }} />
        <div className="absolute top-0 h-full w-[2px] bg-ink/60" style={{ left: `${Math.min(elapsed * 100, 100)}%` }} title="Expected to date" />
      </div>
      <div className="mt-2 flex justify-between text-[12px] text-secondary tnum">
        <span>{sym}{Math.round(m.spend).toLocaleString("en-AU")} / {sym}{Math.round(m.budget).toLocaleString("en-AU")}</span>
        <span>{formatPercent(util)}</span>
      </div>
    </div>
  );
}

function CompareTable({
  rows,
}: {
  rows: { label: string; currency: CurrencyCode; estimated: boolean; t: import("@/lib/data/warehouse").Totals }[];
}) {
  return (
    <div className="overflow-x-auto lv-scroll">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--lv-border)] text-[11px] uppercase tracking-wide text-secondary">
            <th className="py-2 pr-3 text-left">Segment</th>
            <th className="px-3 py-2 text-right">Spend</th>
            <th className="px-3 py-2 text-right">Live leads</th>
            <th className="px-3 py-2 text-right">CPLL</th>
            <th className="px-3 py-2 text-right">CvR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-[var(--lv-border)] last:border-0">
              <td className="py-2 pr-3 font-medium text-ink">{r.label}</td>
              <td className="px-3 py-2 text-right tnum">{formatMoney(r.t.spend, r.currency, { estimated: r.estimated })}</td>
              <td className="px-3 py-2 text-right tnum">{r.t.liveLeads === null ? "—" : formatInt(r.t.liveLeads)}</td>
              <td className="px-3 py-2 text-right tnum">{formatMoney(r.t.cpll, r.currency, { estimated: r.estimated })}</td>
              <td className="px-3 py-2 text-right tnum">{formatPercent(r.t.cvr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const dynamic = "force-dynamic";
