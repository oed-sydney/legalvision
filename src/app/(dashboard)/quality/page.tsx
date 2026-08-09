import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { PanelTabs } from "@/components/ui/PanelTabs";
import { KeywordsTable, type KeywordRow } from "@/components/tables/KeywordsTable";
import { QualityScorePanel } from "@/components/panels/QualityScorePanel";
import { QsInsights } from "@/components/panels/QsInsights";
import { QsImpactSection } from "@/components/panels/QsImpactSection";
import { parseFilters, type FilterState } from "@/lib/filters/schema";
import { hydrateLiveData } from "@/lib/data/source";
import { scopedKeywords, qsSummary, qsHighSpendLow, qsNoScoreWithSpend } from "@/lib/data/quality";
import { termsCache } from "@/lib/data/live-terms";
import { qsImpact } from "@/lib/data/real/qs-impact";
import type { Keyword } from "@/lib/domain/types";

const TABLE_ROW_CAP = 500;

export default async function QualityScorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await hydrateLiveData();
  const raw = parseFilters(await searchParams);
  const f: FilterState = { ...raw, channel: "google_ads" }; // Quality Score is Google-only

  // Real keyword QS from Windsor (fs in dev, Postgres in prod); mock fallback keeps the
  // area working before the first pull.
  const live = await termsCache();
  const liveKws = (live?.keywords ?? []).filter(
    (k) => (f.country === "all" || k.market === f.country) && (f.account === "all" || k.accountId === f.account)
  );
  const usingLive = liveKws.length > 0;
  const kws = usingLive ? liveKws : scopedKeywords(f);
  const qs = qsSummary(kws);

  const MARKET_LABEL: Record<string, string> = {
    all: "All markets",
    AU: "Australia",
    UK: "United Kingdom",
    NZ: "New Zealand",
  };
  const marketLabel = MARKET_LABEL[f.country] ?? "All markets";

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
      impressions: k.impressions,
      clicks: k.clicks,
      spend: k.spend,
      liveLeads: k.liveLeads,
      currency: k.currency,
    }));

  return (
    <div>
      <PageHeader
        title="Quality Score"
        subtitle="Google Ads keyword quality — impression-weighted, updates with the market filter"
      />
      <PanelTabs
        tabs={[
          {
            key: "impact",
            label: "QS Impact",
            panel: (
              <QsImpactSection
                impact={qsImpact(f.country)}
                marketLabel={marketLabel}
                currentWeightedQs={qs.weightedQs}
              />
            ),
          },
          {
            key: "scores",
            label: "Scores & distribution",
            panel: (
              <QualityScorePanel
                summary={qs}
                highSpendLow={qsHighSpendLow(kws).slice(0, 10).map(kwLite)}
                noScore={qsNoScoreWithSpend(kws).slice(0, 10).map(kwLite)}
              />
            ),
          },
          {
            key: "recommendations",
            label: "Recommendations",
            panel: usingLive ? (
              <QsInsights
                kws={kws}
                planTarget={
                  f.country === "NZ" || f.account === "nz-google"
                    ? { count: 82, label: "90-day plan target" }
                    : undefined
                }
              />
            ) : (
              <Card>
                <p className="text-[13px] text-muted">
                  Recommendations appear once live keyword data has been pulled (Refresh).
                </p>
              </Card>
            ),
          },
          {
            key: "keywords",
            label: "Keywords",
            panel: (
              <Card>
                <CardTitle action={<span className="text-[12px] text-muted">Top {keywordRows.length} by spend</span>}>
                  Keyword quality detail
                </CardTitle>
                <KeywordsTable rows={keywordRows} />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}

function kwLite(k: Keyword) {
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
