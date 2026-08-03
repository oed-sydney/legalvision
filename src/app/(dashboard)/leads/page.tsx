import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { ComboTrend } from "@/components/charts/ComboTrend";
import { parseFilters } from "@/lib/filters/schema";
import { hydrateLiveData } from "@/lib/data/source";
import { buildReport } from "@/lib/data/report";
import { marketTotals } from "@/lib/data/overview";
import { marketName } from "@/lib/domain/accounts";
import { formatInt, formatMoney, formatPercent } from "@/lib/metrics/format";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await hydrateLiveData();
  const f = parseFilters(await searchParams);
  const report = buildReport(f);
  const t = report.totals;
  const cur = t.currency;
  const est = t.estimated;
  const markets = marketTotals(f, report.range.from, report.range.to);

  return (
    <div>
      <PageHeader title="Lead Quality" subtitle={report.range.label} />

      <div className="mb-5 flex items-start gap-2 rounded-lg border border-[#FDE68A] bg-[#FEF9C3] px-4 py-3">
        <StatusPill tone="warning" dot={false}>v1 · limited mode</StatusPill>
        <p className="text-[13px] text-[#854D0E]">
          Live leads are the mapped Google Ads conversion action; CRM enrichment is pending.
          Invalid/duplicate/unmatched counts, qualification lag, reconciliation and lead-record drawers activate when the
          live-lead source connects. Meta live leads show as &quot;—&quot;.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard metricKey="live_leads" value={t.liveLeads === null ? "—" : formatInt(t.liveLeads)} sparkColor="var(--lv-success)" sparkline={report.trend.points.map((x) => x.liveLeads)} />
        <KpiCard metricKey="cpll" value={formatMoney(t.cpll, cur, { estimated: est })} />
        <KpiCard metricKey="spend" value={formatMoney(t.spend, cur, { estimated: est })} />
        <KpiCard metricKey="cvr" value={formatPercent(t.cvr)} />
      </div>

      <Card className="mt-6">
        <CardTitle>Live leads over time</CardTitle>
        <ComboTrend data={report.trend.points} currency={report.trend.currency} estimated={report.trend.estimated} />
      </Card>

      <Card className="mt-6">
        <CardTitle>Live-lead performance by market</CardTitle>
        <div className="overflow-x-auto lv-scroll">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--lv-border)] text-[11px] uppercase tracking-wide text-secondary">
                <th className="py-2 pr-3 text-left">Market</th>
                <th className="px-3 py-2 text-right">Spend</th>
                <th className="px-3 py-2 text-right">Live leads</th>
                <th className="px-3 py-2 text-right">CPLL</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((m) => (
                <tr key={m.market} className="border-b border-[var(--lv-border)] last:border-0">
                  <td className="py-2 pr-3 font-medium text-ink">{marketName(m.market)}</td>
                  <td className="px-3 py-2 text-right tnum">{formatMoney(m.totals.spend, m.currency)}</td>
                  <td className="px-3 py-2 text-right tnum">{m.totals.liveLeads === null ? "—" : formatInt(m.totals.liveLeads)}</td>
                  <td className="px-3 py-2 text-right tnum">{formatMoney(m.totals.cpll, m.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted">
          Live leads are the per-account mapped &quot;Live Leads (… Enhanced)&quot; conversion action. Native currency per market.
        </p>
      </Card>
    </div>
  );
}

export const dynamic = "force-dynamic";
