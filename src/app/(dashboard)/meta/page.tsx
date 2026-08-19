import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PanelTabs } from "@/components/ui/PanelTabs";
import { CampaignsTable } from "@/components/tables/CampaignsTable";
import { MetaAdsPanel } from "@/components/panels/MetaAdsPanel";
import { parseFilters, type FilterState } from "@/lib/filters/schema";
import { metaSummary, metaCampaignRows, META_WINDOW_LABEL, META_PULLED_AT } from "@/lib/data/real/meta";
import { realMetaAds } from "@/lib/data/real/meta-creatives";
import { formatInt, formatMoney, formatPercent } from "@/lib/metrics/format";

export default async function MetaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const raw = parseFilters(await searchParams);
  const f: FilterState = { ...raw, channel: "meta_ads" }; // Meta-only area

  const s = metaSummary(f.country, f.account);
  const cur = s.currency;
  const est = s.estimated;
  const campaignRows = metaCampaignRows(f.country, f.account);
  const ads = realMetaAds().filter(
    (a) => (f.country === "all" || a.market === f.country) && (f.account === "all" || a.accountId === f.account)
  );

  const cpl = (v: number | null) => (v != null ? formatMoney(v, cur, { estimated: est }) : "—");

  return (
    <div>
      <PageHeader
        title="Meta Ads"
        subtitle={`${META_WINDOW_LABEL} · real ad-level data pulled ${META_PULLED_AT} · SME Publication vs BOFU leads shown separately`}
      />

      {s.markets === 0 ? (
        <Card>
          <div className="px-1 py-6 text-[13px] text-secondary">
            No Meta data for this selection. Meta NZ isn&apos;t connected yet (Meta Marketing API access is still
            being rolled out for that ad account) — AU and UK are live.
          </div>
        </Card>
      ) : (
        <PanelTabs
          tabs={[
            {
              key: "snapshot",
              label: "Snapshot",
              panel: (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <KpiCard metricKey="spend" value={formatMoney(s.spend, cur, { estimated: est })} />
                  <KpiCard metricKey="leads" label="SME Pub. leads" value={formatInt(s.smeLeads)} footnote="lead-form submissions" />
                  <KpiCard metricKey="cpl" label="SME Pub. CPL" value={cpl(s.smeCpl)} />
                  <KpiCard metricKey="leads" label="BOFU trials" value={formatInt(s.bofuTrials)} footnote="30-day trial signups" />
                  <KpiCard metricKey="cpl" label="BOFU cost / trial" value={cpl(s.bofuCpl)} />
                  <KpiCard metricKey="ctr" label="CTR (link)" value={formatPercent(s.ctr)} />
                  <KpiCard metricKey="frequency" value={s.frequency ? s.frequency.toFixed(2) : "—"} />
                  <KpiCard metricKey="link_clicks" value={formatInt(s.linkClicks)} />
                  <KpiCard metricKey="landing_page_views" value={formatInt(s.lpv)} />
                  <KpiCard metricKey="cpc" label="CPC (link)" value={formatMoney(s.cpc, cur, { estimated: est })} />
                  <KpiCard metricKey="cpm" value={formatMoney(s.cpm, cur, { estimated: est })} />
                  <KpiCard metricKey="reach" value={formatInt(s.reach)} footnote="period-level, non-additive" />
                  <KpiCard metricKey="impressions" value={formatInt(s.impressions)} />
                </div>
              ),
            },
            {
              key: "campaigns",
              label: "Campaigns",
              panel: (
                <Card>
                  <CardTitle action={<span className="text-[12px] text-muted">Active campaigns · last 30 days · each with its own metrics</span>}>
                    Campaigns
                  </CardTitle>
                  <CampaignsTable rows={campaignRows} variant="meta" csvName="meta_campaigns" />
                </Card>
              ),
            },
            {
              key: "creatives",
              label: "Ads & Creatives",
              panel: <MetaAdsPanel ads={ads} />,
            },
            {
              key: "placements",
              label: "Placements",
              panel: (
                <Card>
                  <CardTitle action={<span className="text-[12px] text-muted">Estimated placement mix — connect the Meta placement breakdown for exact splits</span>}>
                    Placements
                  </CardTitle>
                  <PlacementTable currency={cur} totalSpend={s.spend} totalClicks={s.linkClicks} />
                </Card>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

const PLACEMENTS = [
  { name: "Instagram Feed", share: 0.31 },
  { name: "Facebook Feed", share: 0.27 },
  { name: "Instagram Stories", share: 0.16 },
  { name: "Instagram Reels", share: 0.13 },
  { name: "Facebook Reels", share: 0.07 },
  { name: "Audience Network", share: 0.06 },
];

function PlacementTable({ currency, totalSpend, totalClicks }: { currency: import("@/lib/domain/types").CurrencyCode; totalSpend: number; totalClicks: number }) {
  return (
    <div className="overflow-x-auto lv-scroll">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--lv-border)] text-[11px] uppercase tracking-wide text-secondary">
            <th className="py-2 pr-3 text-left">Placement</th>
            <th className="px-3 py-2 text-right">Spend</th>
            <th className="px-3 py-2 text-right">Share</th>
            <th className="px-3 py-2 text-right">Link clicks</th>
          </tr>
        </thead>
        <tbody>
          {PLACEMENTS.map((p) => (
            <tr key={p.name} className="border-b border-[var(--lv-border)] last:border-0">
              <td className="py-2 pr-3 font-medium text-ink">{p.name}</td>
              <td className="px-3 py-2 text-right tnum">{formatMoney(totalSpend * p.share, currency)}</td>
              <td className="px-3 py-2 text-right tnum">{formatPercent(p.share)}</td>
              <td className="px-3 py-2 text-right tnum">{formatInt(Math.round(totalClicks * p.share))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const dynamic = "force-dynamic";
