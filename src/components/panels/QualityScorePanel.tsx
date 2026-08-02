import { Card, CardTitle } from "@/components/ui/Card";
import { ComponentIcon } from "@/components/ui/ComponentIcon";
import { MetricLabel } from "@/components/ui/InfoTip";
import { formatInt, formatMoney, formatPercent } from "@/lib/metrics/format";
import type { ComponentRating, CurrencyCode } from "@/lib/domain/types";
import type { QsSummary } from "@/lib/data/quality";

interface KwLite {
  id: string;
  text: string;
  campaignName: string;
  adGroupName: string;
  qualityScore: number | null;
  qs30dAgo: number | null;
  spend: number;
  impressions: number;
  liveLeads: number;
  currency: CurrencyCode;
  expectedCtr: ComponentRating;
  adRelevance: ComponentRating;
  lpExperience: ComponentRating;
}

export function QualityScorePanel({
  summary,
  decliners,
  highSpendLow,
  noScore,
}: {
  summary: QsSummary;
  decliners: KwLite[];
  highSpendLow: KwLite[];
  noScore: KwLite[];
}) {
  const delta =
    summary.weightedQs !== null && summary.weightedQs30dAgo !== null
      ? summary.weightedQs - summary.weightedQs30dAgo
      : null;
  const maxCount = Math.max(...summary.distribution.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-[var(--lv-border)] bg-canvas px-4 py-2.5 text-[12px] text-secondary">
        Every figure here is <strong>derived from keyword-level data</strong> and impression-weighted — there is no fabricated account-level Quality Score. Coverage % shows the share of Search impressions from QS-bearing keywords.
      </p>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        <StatCard label={<MetricLabel metricKey="weighted_qs" />} value={summary.weightedQs?.toFixed(1) ?? "—"} sub={delta === null ? undefined : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} vs 30d`} subTone={delta === null ? undefined : delta >= 0 ? "text-success" : "text-danger"} />
        <StatCard label="Coverage" value={formatPercent(summary.coverage)} sub={`${summary.totalKeywords - summary.noQsCount} of ${summary.totalKeywords} kw`} />
        {summary.buckets.map((b) => (
          <StatCard key={b.label} label={b.label} value={formatPercent(b.imprShare)} sub={`${b.count} kw · impr-weighted`} />
        ))}
        <StatCard label="No QS" value={formatInt(summary.noQsCount)} sub="keywords" />
      </div>

      {/* Distribution */}
      <Card>
        <CardTitle action={<span className="text-[12px] text-muted">keyword count (impressions in tooltip)</span>}>
          Quality Score distribution
        </CardTitle>
        <div className="flex items-end gap-2" style={{ height: 160 }}>
          {summary.distribution.map((d) => {
            const h = (d.count / maxCount) * 130;
            const tone = d.qs <= 3 ? "#B91C1C" : d.qs <= 6 ? "#B45309" : "#15803D";
            return (
              <div key={d.qs} className="flex flex-1 flex-col items-center justify-end gap-1" title={`QS ${d.qs}: ${d.count} keywords · ${formatInt(d.impressions)} impr`}>
                <span className="text-[11px] tnum text-muted">{d.count}</span>
                <div className="w-full rounded-t" style={{ height: Math.max(h, 2), background: tone, opacity: 0.85 }} />
                <span className="text-[11px] tnum text-secondary">{d.qs}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Component legend */}
      <p className="rounded-lg border border-[var(--lv-border)] bg-canvas px-4 py-2.5 text-[12px] text-secondary">
        Each keyword&apos;s Quality Score has three diagnostic components — <strong>Expected CTR</strong>, <strong>Ad relevance</strong> and <strong>Landing page experience</strong>. Google rates each{" "}
        <span className="inline-flex items-center gap-1"><ComponentIcon rating="above" /></span>,{" "}
        <span className="inline-flex items-center gap-1"><ComponentIcon rating="average" /></span> or{" "}
        <span className="inline-flex items-center gap-1"><ComponentIcon rating="below" /></span> relative to other advertisers.
      </p>

      {/* Action lists */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ActionList title="Declining QS (≥1 pt)" rows={decliners} kind="decliner" />
        <ActionList title="High-spend, low QS (≤5)" rows={highSpendLow} kind="lowqs" />
        <ActionList title="No QS with spend" rows={noScore} kind="noqs" />
      </div>
    </div>
  );
}

/** Component rating with its name, so it's clear what Above/Average/Below refers to. */
function LabeledComponent({ name, rating }: { name: string; rating: ComponentRating }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]">
      <span className="text-muted">{name}:</span>
      <ComponentIcon rating={rating} />
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  subTone,
}: {
  label: React.ReactNode;
  value: string;
  sub?: string;
  subTone?: string;
}) {
  return (
    <div className="rounded-[10px] border border-[var(--lv-border)] bg-card p-4">
      <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-secondary">{label}</div>
      <div className="mt-1.5 text-[24px] font-bold leading-none tnum text-ink">{value}</div>
      {sub && <div className={`mt-1.5 text-[11px] ${subTone ?? "text-muted"}`}>{sub}</div>}
    </div>
  );
}

function ActionList({ title, rows, kind }: { title: string; rows: KwLite[]; kind: "decliner" | "lowqs" | "noqs" }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted">None in the current scope.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((k) => (
            <li key={k.id} className="border-b border-[var(--lv-border)] pb-2.5 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-medium text-ink" title={k.text}>{k.text}</span>
                <span className="shrink-0 text-[13px] font-semibold tnum">
                  {kind === "decliner" ? (
                    <span className="text-danger">{k.qs30dAgo} → {k.qualityScore}</span>
                  ) : kind === "noqs" ? (
                    <span className="text-muted">no QS</span>
                  ) : (
                    <span className="text-warning">QS {k.qualityScore}</span>
                  )}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
                <span className="truncate">{k.adGroupName}</span>
                <span className="tnum">{formatMoney(k.spend, k.currency)}</span>
              </div>
              {kind !== "noqs" && (
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  <LabeledComponent name="Exp. CTR" rating={k.expectedCtr} />
                  <LabeledComponent name="Ad relevance" rating={k.adRelevance} />
                  <LabeledComponent name="Landing page" rating={k.lpExperience} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
