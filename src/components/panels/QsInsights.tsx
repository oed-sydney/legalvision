import { Card, CardTitle } from "@/components/ui/Card";
import { BarList } from "@/components/charts/BarList";
import { ComponentIcon } from "@/components/ui/ComponentIcon";
import { formatInt, formatMoney } from "@/lib/metrics/format";
import { primaryDrag } from "@/lib/data/quality";
import type { Keyword } from "@/lib/domain/types";

/**
 * Quality Score insights & recommendations: which QS component is dragging,
 * what it costs, and the specific fix per keyword. Server-computed from the
 * real keyword snapshot — recommendations are fixed playbook text keyed to
 * the weakest component, never invented per-row.
 */

const FIX: Record<string, string> = {
  "Expected CTR": "Rewrite headlines using the query's own language; pause the weakest RSA variants in this ad group.",
  "Ad relevance": "Move the keyword into a tighter ad group whose copy matches its theme.",
  "Landing page exp.": "Point the keyword at a more specific service page (content match + load speed).",
};

export function QsInsights({ kws, planTarget }: { kws: Keyword[]; planTarget?: { count: number; label: string } }) {
  const withQs = kws.filter((k) => k.qualityScore !== null);
  const low = withQs.filter((k) => k.qualityScore! <= 4);
  const lowSpend = low.reduce((s, k) => s + k.spend, 0);
  const totalSpend = kws.reduce((s, k) => s + k.spend, 0);
  const cur = kws[0]?.currency ?? "AUD";
  // never sum across currencies — money stats only when one market is in view
  const mono = new Set(kws.map((k) => k.currency)).size <= 1;

  // spend-weighted drag breakdown across all QS ≤ 6 keywords
  const dragAgg = new Map<string, { count: number; spend: number }>();
  for (const k of withQs.filter((x) => x.qualityScore! <= 6)) {
    const drag = primaryDrag(k);
    if (!drag) continue;
    const e = dragAgg.get(drag) ?? { count: 0, spend: 0 };
    e.count += 1;
    e.spend += k.spend;
    dragAgg.set(drag, e);
  }
  const drags = [...dragAgg.entries()].sort((a, b) => b[1].spend - a[1].spend);

  // priority fixes: highest-spend low-QS keywords with a clear drag
  const fixes = withQs
    .filter((k) => k.qualityScore! <= 5 && k.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10)
    .map((k) => ({ k, drag: primaryDrag(k) }));

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>What low Quality Score is costing</CardTitle>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Keywords below QS 4" value={formatInt(low.length)} sub={planTarget ? `${planTarget.label}: ≤ ${planTarget.count}` : undefined} />
          <Stat
            label="Spend on QS ≤ 4"
            value={mono ? formatMoney(lowSpend, cur) : `${totalSpend > 0 ? ((lowSpend / totalSpend) * 100).toFixed(0) : 0}%`}
            sub={mono ? (totalSpend > 0 ? `${((lowSpend / totalSpend) * 100).toFixed(0)}% of keyword spend` : undefined) : "of keyword spend — pick a market for amounts"}
          />
          <Stat label="Keywords QS 5–6" value={formatInt(withQs.filter((k) => k.qualityScore! >= 5 && k.qualityScore! <= 6).length)} />
          <Stat label="Keywords QS 7+" value={formatInt(withQs.filter((k) => k.qualityScore! >= 7).length)} />
        </div>
        <p className="mt-3 text-[12.5px] text-secondary">
          Low QS raises CPCs across the board — Google discounts high-QS ads in the auction, so every point recovered
          on a spending keyword lowers its cost per click.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>What&apos;s dragging Quality Score (QS ≤ 6, weighted by spend)</CardTitle>
          {drags.length === 0 ? (
            <p className="text-[13px] text-muted">No component ratings available for low-QS keywords.</p>
          ) : (
            <>
              <BarList
                color="var(--lv-warning)"
                items={drags.map(([name, v]) => ({
                  label: name,
                  value: mono ? v.spend : v.count,
                  formatted: mono ? `${formatMoney(v.spend, cur)} · ${v.count} kws` : `${v.count} keywords`,
                }))}
              />
              <ul className="mt-3 space-y-1.5 text-[12.5px] text-secondary">
                {drags.map(([name]) => (
                  <li key={name} className="flex gap-2">
                    <span className="font-medium text-ink">{name}:</span> {FIX[name]}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card>
          <CardTitle>Priority fixes — highest spend, QS ≤ 5</CardTitle>
          {fixes.length === 0 ? (
            <p className="text-[13px] text-muted">No spending keywords at QS ≤ 5. Nice.</p>
          ) : (
            <div className="overflow-x-auto lv-scroll">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--lv-border)] text-[11px] uppercase tracking-wide text-secondary">
                    <th className="py-2 pr-3 text-left">Keyword</th>
                    <th className="px-3 py-2 text-right">QS</th>
                    <th className="px-3 py-2 text-right">Spend</th>
                    <th className="px-3 py-2 text-left">Weakest part</th>
                    <th className="px-3 py-2 text-left">Recommended fix</th>
                  </tr>
                </thead>
                <tbody>
                  {fixes.map(({ k, drag }) => (
                    <tr key={k.id} className="border-b border-[var(--lv-border)] last:border-0">
                      <td className="max-w-[180px] truncate py-2 pr-3 font-medium text-ink" title={`${k.text} — ${k.campaignName}`}>
                        {k.text}
                        <span className="block text-[11px] font-normal text-muted">{k.campaignName}</span>
                      </td>
                      <td className="px-3 py-2 text-right tnum">{k.qualityScore}</td>
                      <td className="px-3 py-2 text-right tnum">{formatMoney(k.spend, k.currency)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-secondary">
                        {drag ? (
                          <span className="inline-flex items-center gap-1">
                            <ComponentIcon
                              rating={
                                drag === "Expected CTR" ? k.expectedCtr : drag === "Ad relevance" ? k.adRelevance : k.lpExperience
                              }
                            />
                            {drag}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-[260px] px-3 py-2 text-[12px] text-secondary">{drag ? FIX[drag] : "Review all three components."}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-secondary">{label}</div>
      <div className="mt-1 text-[24px] font-bold leading-none tnum text-ink">{value}</div>
      {sub && <div className="mt-1 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}
