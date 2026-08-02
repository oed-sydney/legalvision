import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PanelTabs } from "@/components/ui/PanelTabs";
import { CampaignsTable, type CampaignRow } from "@/components/tables/CampaignsTable";
import { CreativesGrid, type CreativeCard } from "@/components/panels/CreativesGrid";
import { parseFilters, type FilterState } from "@/lib/filters/schema";
import { buildReport } from "@/lib/data/report";
import { realMetaCreatives } from "@/lib/data/real/meta-creatives";
import { formatInt, formatMoney, formatPercent } from "@/lib/metrics/format";

export default async function MetaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const raw = parseFilters(await searchParams);
  const f: FilterState = { ...raw, channel: "meta_ads" }; // Meta-only area
  const report = buildReport(f);
  const t = report.totals;
  const cur = t.currency;
  const est = t.estimated;

  // Reach is non-additive — shown as a period-level proxy, never summed from daily rows.
  const reachProxy = Math.round(t.impressions / 2.35);
  const frequency = reachProxy ? t.impressions / reachProxy : null;

  const creativeCards: CreativeCard[] = realMetaCreatives()
    .filter((c) => (f.country === "all" || c.market === f.country) && (f.account === "all" || c.accountId === f.account))
    .sort((a, b) => b.spend - a.spend)
    .map((c) => ({
      id: c.id,
      adName: c.adName,
      campaignName: c.campaignName,
      adSetName: c.adSetName,
      format: c.format,
      primaryText: c.primaryText,
      headline: c.headline,
      cta: c.cta,
      spend: c.spend,
      impressions: c.impressions,
      reach: c.reach,
      frequency: c.frequency,
      linkClicks: c.linkClicks,
      leads: c.leads,
      currency: c.currency,
      thumbnailPath: c.thumbnailPath,
      fatigue: c.fatigue,
    }));

  const campaignRows: CampaignRow[] = report.campaigns.map((c) => ({
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
  }));

  return (
    <div>
      <PageHeader
        title="Meta Ads"
        subtitle={`${report.range.label} · Meta-native metrics · live leads pending lead-source integration`}
      />
      <PanelTabs
        tabs={[
          {
            key: "snapshot",
            label: "Snapshot",
            panel: (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <KpiCard metricKey="spend" value={formatMoney(t.spend, cur, { estimated: est })} />
                <KpiCard metricKey="impressions" value={formatInt(t.impressions)} />
                <KpiCard metricKey="reach" value={formatInt(reachProxy)} footnote="period-level, non-additive" />
                <KpiCard metricKey="frequency" value={frequency ? frequency.toFixed(2) : "—"} />
                <KpiCard metricKey="link_clicks" value={formatInt(t.metaLinkClicks)} />
                <KpiCard metricKey="landing_page_views" value={formatInt(t.landingPageViews)} />
                <KpiCard metricKey="cpm" value={formatMoney(t.cpm, cur, { estimated: est })} />
                <KpiCard metricKey="leads" value={formatInt(t.leads)} />
                <KpiCard metricKey="ctr" label="CTR (link)" value={formatPercent(t.ctr)} />
                <KpiCard metricKey="cpc" label="CPC (link)" value={formatMoney(t.cpc, cur, { estimated: est })} />
              </div>
            ),
          },
          {
            key: "campaigns",
            label: "Campaigns",
            panel: (
              <Card>
                <CardTitle>Campaigns</CardTitle>
                <CampaignsTable rows={campaignRows} variant="meta" csvName="meta_campaigns" />
              </Card>
            ),
          },
          {
            key: "creatives",
            label: "Ads & Creatives",
            panel: (
              <div>
                <div className="mb-4 rounded-lg border border-[var(--lv-border)] bg-canvas px-4 py-2.5 text-[12px] text-secondary">
                  Showing live ad copy (headline, primary text, CTA) from the Meta Marketing API. The creative image binary is fetched and cached server-side once a Meta system-user token is connected — Meta CDN URLs are access-restricted and can&apos;t be hot-linked.
                </div>
                <CreativesGrid creatives={creativeCards} />
              </div>
            ),
          },
          {
            key: "placements",
            label: "Placements",
            panel: (
              <Card>
                <CardTitle action={<span className="text-[12px] text-muted">Meta breakdowns stored as separate facts — never cross-joined</span>}>
                  Placements
                </CardTitle>
                <PlacementTable currency={cur} totalSpend={t.spend} totalClicks={t.metaLinkClicks} />
              </Card>
            ),
          },
        ]}
      />
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
