import { Card, CardTitle } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { InfoTip } from "@/components/ui/InfoTip";
import { formatInt, formatMoney } from "@/lib/metrics/format";
import type { ScoredTerm, ScoredKeyword } from "@/lib/insights/term-score";

/**
 * Waste-score surfaces for the Search terms tab: negative-keyword candidates
 * (search terms) and pause candidates (keywords), each with the composite
 * score and the plain-English reason.
 */

function ScoreChip({ score, verdict }: { score: number; verdict: "PAUSE" | "REVIEW" | "KEEP" }) {
  const tone = verdict === "PAUSE" ? "danger" : verdict === "REVIEW" ? "warning" : "success";
  const label = verdict === "PAUSE" ? "Pause" : verdict === "REVIEW" ? "Review" : "Keep";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tnum w-8 text-right font-semibold text-ink">{score}</span>
      <StatusPill tone={tone}>{label}</StatusPill>
    </span>
  );
}

const METHOD = (
  <div>
    <div className="font-semibold text-ink">Waste score (0–100)</div>
    <div className="mt-1">
      55% wasted spend (spend with zero leads, weighted by how many leads the clicks should have produced at the
      account&apos;s lead rate) · 30% cost-per-lead vs the account average · 15% CTR shortfall. Keywords also factor
      Quality Score. Anything that produced a live lead is protected. &ldquo;Pause&rdquo; requires material spend
      (≥0.75× one lead&apos;s cost).
    </div>
  </div>
);

export function TermScorePanel({
  terms,
  keywords,
}: {
  terms: ScoredTerm[];
  keywords: ScoredKeyword[];
}) {
  const termCandidates = terms.filter((t) => t.verdict !== "KEEP").slice(0, 15);
  const kwCandidates = keywords.filter((k) => k.verdict !== "KEEP").slice(0, 12);
  const termWaste = termCandidates.reduce((s, t) => s + t.spend, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle
          action={
            <span className="flex items-center gap-1.5 text-[12px] text-muted">
              How the score works <InfoTip content={METHOD} />
            </span>
          }
        >
          Negative-keyword candidates — search terms
        </CardTitle>
        {termCandidates.length === 0 ? (
          <p className="text-[13px] text-muted">No search terms currently score high enough to recommend action.</p>
        ) : (
          <>
            <p className="-mt-2 mb-3 text-[12.5px] text-secondary">
              {termCandidates.length} terms scored Pause/Review, covering{" "}
              {formatMoney(termWaste, termCandidates[0].currency)} of last-30-day spend. Adding the Pause rows as
              negatives redirects that budget to converting queries.
            </p>
            <div className="overflow-x-auto lv-scroll">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--lv-border)] text-[11px] uppercase tracking-wide text-secondary">
                    <th className="py-2 pr-3 text-left">Search term</th>
                    <th className="px-3 py-2 text-left">Campaign</th>
                    <th className="px-3 py-2 text-right">Clicks</th>
                    <th className="px-3 py-2 text-right">Spend</th>
                    <th className="px-3 py-2 text-right">Leads</th>
                    <th className="px-3 py-2 text-left">Why</th>
                    <th className="px-3 py-2 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {termCandidates.map((t) => (
                    <tr key={t.id} className="border-b border-[var(--lv-border)] last:border-0">
                      <td className="max-w-[240px] truncate py-2 pr-3 font-medium text-ink" title={t.term}>
                        {t.term}
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-2 text-secondary" title={t.campaignName}>
                        {t.campaignName}
                      </td>
                      <td className="px-3 py-2 text-right tnum">{formatInt(t.clicks)}</td>
                      <td className="px-3 py-2 text-right tnum">{formatMoney(t.spend, t.currency)}</td>
                      <td className="px-3 py-2 text-right tnum">{formatInt(t.leads)}</td>
                      <td className="max-w-[300px] px-3 py-2 text-[12px] text-secondary">{t.reason}</td>
                      <td className="px-3 py-2 text-right">
                        <ScoreChip score={t.score} verdict={t.verdict} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card>
        <CardTitle>Keyword pause candidates</CardTitle>
        {kwCandidates.length === 0 ? (
          <p className="text-[13px] text-muted">No keywords currently score high enough to recommend pausing.</p>
        ) : (
          <div className="overflow-x-auto lv-scroll">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--lv-border)] text-[11px] uppercase tracking-wide text-secondary">
                  <th className="py-2 pr-3 text-left">Keyword</th>
                  <th className="px-3 py-2 text-left">Campaign</th>
                  <th className="px-3 py-2 text-right">QS</th>
                  <th className="px-3 py-2 text-right">Spend</th>
                  <th className="px-3 py-2 text-right">Leads</th>
                  <th className="px-3 py-2 text-left">Why</th>
                  <th className="px-3 py-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {kwCandidates.map((k) => (
                  <tr key={k.id} className="border-b border-[var(--lv-border)] last:border-0">
                    <td className="max-w-[220px] truncate py-2 pr-3 font-medium text-ink" title={k.text}>
                      {k.text}
                      <span className="ml-1.5 text-[11px] text-muted">{k.matchType}</span>
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-secondary" title={k.campaignName}>
                      {k.campaignName}
                    </td>
                    <td className="px-3 py-2 text-right tnum">{k.qualityScore ?? "—"}</td>
                    <td className="px-3 py-2 text-right tnum">{formatMoney(k.spend, k.currency)}</td>
                    <td className="px-3 py-2 text-right tnum">{formatInt(k.leads)}</td>
                    <td className="max-w-[300px] px-3 py-2 text-[12px] text-secondary">{k.reason}</td>
                    <td className="px-3 py-2 text-right">
                      <ScoreChip score={k.score} verdict={k.verdict} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
