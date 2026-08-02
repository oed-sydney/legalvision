import { AlertTriangle, ArrowDown, ArrowUp, Check } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { ExportCsvButton, type CsvCell } from "@/components/ui/ExportCsvButton";
import { formatInt, formatMoney } from "@/lib/metrics/format";
import { BIDDING_CHANGE_DATE, type TcpaTarget } from "@/lib/data/real/tcpa";
import type { CampaignTotals } from "@/lib/data/warehouse";
import type { CurrencyCode } from "@/lib/domain/types";

/**
 * Target CPA review — actual CPA vs target for active campaigns on target-based bid
 * strategies (pure tCPA + Maximize Conversions with a target set). Built for Google's
 * 2026-08-17 bidding update: budget-limited campaigns beating their target will drift
 * UP toward it, so overperformers (actual < target) need their targets tightened to
 * keep current performance.
 *
 * Actual CPA = spend / platform conversions (what tCPA optimizes toward) over the
 * globally selected date range — native currency per market, never cross-summed.
 */

export interface TcpaRow {
  campaign: CampaignTotals;
  target: TcpaTarget;
  actualCpa: number | null; // null = 0 conversions in range
  deltaPct: number | null; // (actual − target) / target
}

export function buildTcpaRows(
  campaigns: CampaignTotals[],
  targets: Map<string, TcpaTarget>
): { rows: TcpaRow[]; excludedActive: number } {
  const rows: TcpaRow[] = [];
  let excludedActive = 0;
  for (const c of campaigns) {
    if (c.channel !== "google_ads" || c.spend <= 0) continue;
    const t = targets.get(`${c.market}|${c.campaignName}`);
    if (!t) {
      excludedActive++;
      continue;
    }
    const actualCpa = c.conversions > 0 ? c.spend / c.conversions : null;
    rows.push({
      campaign: c,
      target: t,
      actualCpa,
      deltaPct: actualCpa === null ? null : (actualCpa - t.targetCpa) / t.targetCpa,
    });
  }
  // Most-overperforming first (biggest gap below target), then over-target, then no-conv.
  rows.sort((a, b) => (a.deltaPct ?? Number.MAX_VALUE) - (b.deltaPct ?? Number.MAX_VALUE));
  return { rows, excludedActive };
}

const STRATEGY_LABEL: Record<TcpaTarget["strategy"], string> = {
  TARGET_CPA: "Target CPA",
  MAXIMIZE_CONVERSIONS: "Max Conv + target",
};

export function TcpaPanel({
  rows,
  excludedActive,
  rangeLabel,
  rangeFrom,
  rangeTo,
}: {
  rows: TcpaRow[];
  excludedActive: number;
  rangeLabel: string;
  rangeFrom: string;
  rangeTo: string;
}) {
  const over = rows.filter((r) => r.deltaPct !== null && r.deltaPct < -0.05); // beating target by >5%
  const near = rows.filter((r) => r.deltaPct !== null && Math.abs(r.deltaPct) <= 0.05);
  const above = rows.filter((r) => r.deltaPct !== null && r.deltaPct > 0.05);

  // CSV export = exactly the on-screen rows (§25: plain numbers, currency column, no symbols).
  const csvHeaders = [
    "market", "campaign", "bid_strategy", "currency", "spend", "conversions",
    "actual_cpa", "target_cpa", "vs_target_pct", "status", "suggested_target",
  ];
  const csvRows: CsvCell[][] = rows.map((r) => {
    const status =
      r.deltaPct === null ? "no_conversions"
      : r.deltaPct < -0.05 ? "overperforming"
      : r.deltaPct > 0.05 ? "over_target"
      : "on_target";
    return [
      r.campaign.market,
      r.campaign.campaignName,
      r.target.strategy,
      r.campaign.currency,
      Math.round(r.campaign.spend * 100) / 100,
      Math.round(r.campaign.conversions * 100) / 100,
      r.actualCpa === null ? null : Math.round(r.actualCpa * 100) / 100,
      r.target.targetCpa,
      r.deltaPct === null ? null : Math.round(r.deltaPct * 1000) / 10,
      status,
      r.deltaPct !== null && r.deltaPct < -0.05 && r.actualCpa !== null
        ? Math.round(r.actualCpa / 5) * 5
        : null,
    ];
  });

  return (
    <div className="space-y-4">
      {/* Why this matters now */}
      <div className="flex items-start gap-3 rounded-lg border border-[#FDE68A] bg-[#FEF9C3] px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
        <p className="text-[13px] leading-relaxed text-[#854D0E]">
          <strong>Google bidding update — {BIDDING_CHANGE_DATE}.</strong> Budget-limited campaigns on
          target-based bidding will start delivering <em>at</em> their target instead of beating it. Any
          campaign below its target CPA today is likely to drift up to the target unless the target is
          lowered to match actual performance. Targets are not adjusted automatically.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Active tCPA campaigns" value={String(rows.length)} sub={`${rangeLabel} · with spend`} />
        <Stat label="Overperforming" value={String(over.length)} sub="actual CPA > 5% below target — tighten" subTone="text-success" />
        <Stat label="Near target" value={String(near.length)} sub="within ±5%" />
        <Stat label="Over target" value={String(above.length)} sub="actual CPA above target" subTone={above.length ? "text-danger" : undefined} />
      </div>

      <Card>
        <CardTitle
          action={
            <span className="flex items-center gap-3">
              <span className="hidden text-[12px] text-muted sm:inline">
                CPA = spend ÷ platform conversions · native currency per market
              </span>
              <ExportCsvButton
                filename={`legalvision_target_cpa_${rangeFrom}_${rangeTo}.csv`}
                headers={csvHeaders}
                rows={csvRows}
              />
            </span>
          }
        >
          CPA vs target CPA — active target-based campaigns
        </CardTitle>
        {rows.length === 0 ? (
          <p className="text-[13px] text-muted">No active campaigns with a CPA target in the current scope.</p>
        ) : (
          <div className="overflow-x-auto lv-scroll">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--lv-border)] text-[11px] uppercase tracking-wide text-secondary">
                  <th className="py-2 pr-3 text-left">Campaign</th>
                  <th className="px-3 py-2 text-left">Strategy</th>
                  <th className="px-3 py-2 text-right">Spend</th>
                  <th className="px-3 py-2 text-right">Conv</th>
                  <th className="px-3 py-2 text-right">Actual CPA</th>
                  <th className="px-3 py-2 text-right">Target CPA</th>
                  <th className="px-3 py-2 text-left">vs target</th>
                  <th className="px-3 py-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <TcpaTableRow key={`${r.campaign.market}-${r.campaign.campaignId}`} r={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted">
          {excludedActive > 0 && `${excludedActive} active campaign${excludedActive === 1 ? "" : "s"} without a CPA target excluded (Max Conv/Value with no target, Manual CPC, Impression Share). `}
          Suggested target ≈ current actual CPA — review before {BIDDING_CHANGE_DATE} so performance holds when Google aligns delivery to targets.
        </p>
      </Card>
    </div>
  );
}

function TcpaTableRow({ r }: { r: TcpaRow }) {
  const cur = r.campaign.currency as CurrencyCode;
  const over = r.deltaPct !== null && r.deltaPct < -0.05;
  const aboveTarget = r.deltaPct !== null && r.deltaPct > 0.05;
  const ratio = r.actualCpa === null ? null : Math.min(r.actualCpa / r.target.targetCpa, 1.5);

  return (
    <tr className={`border-b border-[var(--lv-border)] last:border-0 ${over ? "bg-[#F0FDF4]" : ""}`}>
      <td className="max-w-[240px] py-2.5 pr-3">
        <div className="truncate font-medium text-ink" title={r.campaign.campaignName}>{r.campaign.campaignName}</div>
        <div className="text-[11px] text-muted">{r.campaign.market}</div>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-secondary">{STRATEGY_LABEL[r.target.strategy]}</td>
      <td className="px-3 py-2.5 text-right tnum">{formatMoney(r.campaign.spend, cur)}</td>
      <td className="px-3 py-2.5 text-right tnum">{formatInt(r.campaign.conversions)}</td>
      <td className="px-3 py-2.5 text-right tnum font-semibold">
        {r.actualCpa === null ? <span className="font-normal text-muted">—</span> : formatMoney(r.actualCpa, cur, { force2: true })}
      </td>
      <td className="px-3 py-2.5 text-right tnum">{formatMoney(r.target.targetCpa, cur)}</td>
      <td className="whitespace-nowrap px-3 py-2.5">
        {r.deltaPct === null ? (
          <span className="text-[12px] text-muted">no conversions</span>
        ) : (
          <div className="flex items-center gap-2">
            {/* actual-vs-target bar: green under target, red over */}
            <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-canvas">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${((ratio ?? 0) / 1.5) * 100}%`,
                  background: over ? "var(--lv-success)" : aboveTarget ? "var(--lv-danger)" : "var(--lv-warning)",
                }}
              />
              <div className="absolute top-0 h-full w-[2px] bg-ink/50" style={{ left: `${(1 / 1.5) * 100}%` }} title="Target" />
            </div>
            <span
              className={`inline-flex items-center gap-0.5 text-[12px] font-semibold tnum ${
                over ? "text-success" : aboveTarget ? "text-danger" : "text-secondary"
              }`}
            >
              {r.deltaPct < 0 ? <ArrowDown className="h-3 w-3" /> : r.deltaPct > 0 ? <ArrowUp className="h-3 w-3" /> : <Check className="h-3 w-3" />}
              {Math.abs(r.deltaPct * 100).toFixed(0)}% {r.deltaPct < 0 ? "below" : "above"}
            </span>
          </div>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        {over && r.actualCpa !== null ? (
          <StatusPill tone="success" dot={false}>
            Lower target → ≈{formatMoney(Math.round(r.actualCpa / 5) * 5, cur)}
          </StatusPill>
        ) : aboveTarget ? (
          <StatusPill tone="danger" dot={false}>Over target — review</StatusPill>
        ) : r.deltaPct === null ? (
          <span className="text-[12px] text-muted">—</span>
        ) : (
          <StatusPill tone="grey" dot={false}>On target</StatusPill>
        )}
      </td>
    </tr>
  );
}

function Stat({ label, value, sub, subTone }: { label: string; value: string; sub?: string; subTone?: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--lv-border)] bg-card p-4">
      <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-secondary">{label}</div>
      <div className="mt-1.5 text-[24px] font-bold leading-none tnum text-ink">{value}</div>
      {sub && <div className={`mt-1.5 text-[11px] ${subTone ?? "text-muted"}`}>{sub}</div>}
    </div>
  );
}
