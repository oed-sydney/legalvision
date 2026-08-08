import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PanelTabs } from "@/components/ui/PanelTabs";
import { StatusPill } from "@/components/ui/StatusPill";
import { CampaignsTable, type CampaignRow } from "@/components/tables/CampaignsTable";
import { KeywordsTable, type KeywordRow } from "@/components/tables/KeywordsTable";
import { SearchTermsTable, type SearchTermRow } from "@/components/tables/SearchTermsTable";
import { QualityScorePanel } from "@/components/panels/QualityScorePanel";
import { ComboTrend } from "@/components/charts/ComboTrend";
import { BarList } from "@/components/charts/BarList";
import type { CampaignTotals } from "@/lib/data/warehouse";
import { parseFilters, type FilterState } from "@/lib/filters/schema";
import { hydrateLiveData } from "@/lib/data/source";
import { buildReport } from "@/lib/data/report";
import { computeTotals, queryCampaignDaily } from "@/lib/data/warehouse";
import { searchTerms } from "@/lib/data/mock";
import { realConversionActions as conversionActions } from "@/lib/data/conversion-actions";
import { scopedKeywords, qsSummary, qsHighSpendLow, qsNoScoreWithSpend } from "@/lib/data/quality";
import { termsCache } from "@/lib/data/live-terms";
import { scoreSearchTerms, scoreKeywords } from "@/lib/insights/term-score";
import { buildNegatives } from "@/lib/insights/negatives";
import { NegativesPanel } from "@/components/panels/NegativesPanel";
import { readNegativesApprovals } from "@/lib/data/negatives-store";
import { TermScorePanel } from "@/components/panels/TermScorePanel";
import { QsInsights } from "@/components/panels/QsInsights";
import { TcpaPanel, buildTcpaRows } from "@/components/panels/TcpaPanel";
import { tcpaTargets } from "@/lib/data/real/tcpa";
import { formatInt, formatMoney, formatPercent } from "@/lib/metrics/format";

export default async function GooglePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await hydrateLiveData();
  const raw = parseFilters(await searchParams);
  const f: FilterState = { ...raw, channel: "google_ads" }; // this area is Google-only
  const report = buildReport(f);
  const t = report.totals;
  const cur = t.currency;
  const est = t.estimated;

  // Keyword / search-term / conversion-action base data reflects ~30 days; scale counts to
  // the selected window so the date selector updates them everywhere.
  const rangeDays = Math.round((Date.parse(report.range.to) - Date.parse(report.range.from)) / 86_400_000) + 1;
  const wf = Math.max(rangeDays, 1) / 30;
  const sc = (n: number) => Math.round(n * wf);
  const sc2 = (n: number) => Math.round(n * wf * 100) / 100;

  // Real 30-day search terms + keyword QS from Windsor (cached); mock fallback
  // keeps the area working before the first pull.
  const live = await termsCache();
  const liveKws = (live?.keywords ?? []).filter(
    (k) => (f.country === "all" || k.market === f.country) && (f.account === "all" || k.accountId === f.account)
  );
  const liveTerms = (live?.searchTerms ?? []).filter(
    (s) => (f.country === "all" || s.market === f.country) && (f.account === "all" || s.accountId === f.account)
  );
  const usingLive = liveKws.length > 0 || liveTerms.length > 0;

  const kws = usingLive ? liveKws : scopedKeywords(f);
  const qs = qsSummary(kws);

  // real rows are fixed 30-day aggregates — never scale them to the window
  const tf = usingLive ? 1 : wf;
  const sct = (n: number) => Math.round(n * tf);
  const sct2 = (n: number) => Math.round(n * tf * 100) / 100;

  const { scored: scoredTerms, base: termBase } = scoreSearchTerms(liveTerms);
  const { scored: scoredKws } = scoreKeywords(liveKws);
  const negatives = usingLive ? buildNegatives(liveTerms, scoredTerms, termBase) : [];
  const negativesApprovals = usingLive ? await readNegativesApprovals() : {};

  const stSource = usingLive ? liveTerms : searchTerms()
    .filter((s) => (f.country === "all" || s.market === f.country) && (f.account === "all" || s.accountId === f.account));
  // Cap the display table to the top-by-spend rows — there can be ~27k search terms, but
  // only the highest-spend ones are actionable and the table never shows more than a page.
  // Sending them all serialises tens of MB into every render (the main cause of slow loads).
  const TABLE_ROW_CAP = 500;
  const sts: SearchTermRow[] = [...stSource]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, TABLE_ROW_CAP)
    .map((s) => ({
      id: s.id,
      term: s.term,
      matchedKeyword: s.matchedKeyword,
      matchType: s.matchType,
      campaignName: s.campaignName,
      impressions: sct(s.impressions),
      clicks: sct(s.clicks),
      spend: sct2(s.spend),
      conversions: sct2(s.conversions),
      liveLeads: sct(s.liveLeads),
      currency: s.currency,
      isAddedKeyword: s.isAddedKeyword,
    }));

  const cas = conversionActions()
    .filter((c) => f.country === "all" || c.market === f.country)
    .map((c) => ({ ...c, conversions: sc2(c.conversions), conversionValue: sc2(c.conversionValue) }));

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

  // Full kws set still drives qsSummary/QS panel above; the table only needs the top rows.
  const keywordRows: KeywordRow[] = [...kws]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, TABLE_ROW_CAP)
    .map((k) => ({
      id: k.id,
      text: k.text,
      matchType: k.matchType,
      campaignName: k.campaignName,
      adGroupName: k.adGroupName,
      qualityScore: k.qualityScore,
      qs30dAgo: k.qs30dAgo,
      expectedCtr: k.expectedCtr,
      adRelevance: k.adRelevance,
      lpExperience: k.lpExperience,
      impressions: sct(k.impressions),
      clicks: sct(k.clicks),
      spend: sct2(k.spend),
      liveLeads: sct(k.liveLeads),
      currency: k.currency,
    }));

  return (
    <div>
      <PageHeader
        title="Google Ads"
        subtitle={`${report.range.label} · Live Leads shown separately from Conversions at every level`}
      />
      <PanelTabs
        tabs={[
          {
            key: "snapshot",
            label: "Snapshot",
            panel: (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <KpiCard metricKey="spend" value={formatMoney(t.spend, cur, { estimated: est })} />
                  <KpiCard metricKey="impressions" value={formatInt(t.impressions)} />
                  <KpiCard metricKey="clicks" value={formatInt(t.googleClicks)} />
                  <KpiCard metricKey="conversions" value={formatInt(t.conversions)} />
                  <KpiCard metricKey="live_leads" value={t.liveLeads === null ? "—" : formatInt(t.liveLeads)} />
                  <KpiCard metricKey="cpll" value={formatMoney(t.cpll, cur, { estimated: est })} />
                  <KpiCard metricKey="ctr" value={formatPercent(t.ctr)} />
                  <KpiCard
                    metricKey="weighted_qs"
                    value={qs.weightedQs === null ? "—" : qs.weightedQs.toFixed(1)}
                    footnote={`Coverage ${formatPercent(qs.coverage)}`}
                  />
                </div>

                <Card>
                  <CardTitle action={<span className="text-[12px] text-muted">{est ? "≈ converted to AUD" : `Native ${cur}`}</span>}>
                    Spend &amp; Live leads over time
                  </CardTitle>
                  <ComboTrend data={report.trend.points} currency={report.trend.currency} estimated={report.trend.estimated} />
                </Card>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Card>
                    <CardTitle>Top campaigns by live leads</CardTitle>
                    <BarList
                      color="var(--lv-success)"
                      items={report.campaigns
                        .filter((c) => (c.liveLeads ?? 0) > 0)
                        .sort((a, b) => (b.liveLeads ?? 0) - (a.liveLeads ?? 0))
                        .slice(0, 8)
                        .map((c) => ({
                          label: c.campaignName,
                          value: c.liveLeads ?? 0,
                          formatted: `${formatInt(c.liveLeads ?? 0)} · CPLL ${formatMoney(c.cpll, c.currency)}`,
                        }))}
                    />
                  </Card>
                  <Card>
                    <CardTitle>Spend by campaign type</CardTitle>
                    <BarList
                      color="var(--lv-google)"
                      items={spendByType(report.campaigns).map((r) => ({
                        label: r.type,
                        value: r.spend,
                        formatted: formatMoney(r.spend, cur, { estimated: est }),
                      }))}
                    />
                  </Card>
                </div>
              </div>
            ),
          },
          {
            key: "campaigns",
            label: "Campaigns",
            panel: (
              <Card>
                <CardTitle>Campaigns</CardTitle>
                <CampaignsTable rows={campaignRows} variant="google" csvName="google_campaigns" />
              </Card>
            ),
          },
          {
            key: "tcpa",
            label: "Target CPA",
            panel: (() => {
              const tcpa = buildTcpaRows(report.campaigns, tcpaTargets());
              return (
                <TcpaPanel
                  rows={tcpa.rows}
                  excludedActive={tcpa.excludedActive}
                  rangeLabel={report.range.label}
                  rangeFrom={report.range.from}
                  rangeTo={report.range.to}
                />
              );
            })(),
          },
          {
            key: "keywords",
            label: "Keywords",
            panel: (
              <Card>
                <CardTitle action={<span className="text-[12px] text-muted">Top {keywordRows.length} by spend</span>}>
                  Keywords &amp; Quality Score components
                </CardTitle>
                <KeywordsTable rows={keywordRows} />
              </Card>
            ),
          },
          {
            key: "searchterms",
            label: "Search terms",
            panel: (
              <div className="space-y-4">
                {usingLive && <NegativesPanel accounts={negatives} approvals={negativesApprovals} />}
                {usingLive && <TermScorePanel terms={scoredTerms} keywords={scoredKws} />}
                <Card>
                  <CardTitle
                    action={
                      <span className="text-[12px] text-muted">
                        Top {sts.length} by spend · {usingLive ? "last 30 days (live from Google via Windsor)" : "coverage < campaign totals"}
                      </span>
                    }
                  >
                    All search terms
                  </CardTitle>
                  <SearchTermsTable rows={sts} />
                </Card>
              </div>
            ),
          },
          {
            key: "convactions",
            label: "Conversion actions",
            panel: (
              <Card>
                <CardTitle action={<span className="text-[12px] text-muted">Tracking-health surface</span>}>
                  Conversion actions
                </CardTitle>
                <div className="overflow-x-auto lv-scroll">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--lv-border)] text-[11px] uppercase tracking-wide text-secondary">
                        <th className="py-2 pr-3 text-left">Conversion action</th>
                        <th className="px-3 py-2 text-left">Category</th>
                        <th className="px-3 py-2 text-left">Mapped metric</th>
                        <th className="px-3 py-2 text-left">Market</th>
                        <th className="px-3 py-2 text-right">Conversions</th>
                        <th className="px-3 py-2 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cas.map((c) => (
                        <tr
                          key={c.id}
                          className={`border-b border-[var(--lv-border)] last:border-0 ${c.logicalMetric === "live_leads" ? "bg-primary-subtle/60" : ""}`}
                        >
                          <td className="py-2 pr-3 font-medium text-ink">
                            {c.name}
                            {c.logicalMetric === "live_leads" && (
                              <StatusPill tone="info" dot={false} className="ml-2">Live Leads</StatusPill>
                            )}
                          </td>
                          <td className="px-3 py-2 capitalize text-secondary">{c.category}</td>
                          <td className="px-3 py-2 text-secondary">{c.logicalMetric.replace("_", " ")}</td>
                          <td className="px-3 py-2">{c.market}</td>
                          <td className="px-3 py-2 text-right tnum">{formatInt(c.conversions)}</td>
                          <td className="px-3 py-2 text-right tnum">{formatMoney(c.conversionValue, kws[0]?.currency ?? "AUD")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ),
          },
          {
            key: "qs",
            label: "Quality Score",
            panel: (
              <div className="space-y-6">
                <QualityScorePanel
                  summary={qs}
                  highSpendLow={qsHighSpendLow(kws).slice(0, 10).map(kwLite)}
                  noScore={qsNoScoreWithSpend(kws).slice(0, 10).map(kwLite)}
                />
                {usingLive && (
                  <QsInsights
                    kws={kws}
                    planTarget={f.country === "NZ" || f.account === "nz-google" ? { count: 82, label: "90-day plan target" } : undefined}
                  />
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function spendByType(campaigns: CampaignTotals[]): { type: string; spend: number }[] {
  const map = new Map<string, number>();
  for (const c of campaigns) map.set(c.campaignType, (map.get(c.campaignType) ?? 0) + c.spend);
  return Array.from(map.entries())
    .map(([type, spend]) => ({ type, spend }))
    .sort((a, b) => b.spend - a.spend);
}

function kwLite(k: import("@/lib/domain/types").Keyword) {
  return {
    id: k.id,
    text: k.text,
    campaignName: k.campaignName,
    adGroupName: k.adGroupName,
    qualityScore: k.qualityScore,
    qs30dAgo: k.qs30dAgo,
    spend: k.spend,
    impressions: k.impressions,
    liveLeads: k.liveLeads,
    currency: k.currency,
    expectedCtr: k.expectedCtr,
    adRelevance: k.adRelevance,
    lpExperience: k.lpExperience,
  };
}

export const dynamic = "force-dynamic";
