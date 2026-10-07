"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Eye, AlertTriangle } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatInt, formatMoney, formatPercent } from "@/lib/metrics/format";
import type { UnderPerformerRow } from "@/lib/data/underperformers";

const MATCH_STYLE: Record<string, { bg: string; fg: string }> = {
  exact: { bg: "#EEF2FF", fg: "#4338CA" },
  phrase: { bg: "#ECFDF5", fg: "#0F766E" },
  broad: { bg: "#FFF7ED", fg: "#C2410C" },
};

function MatchBadge({ type }: { type: string }) {
  const s = MATCH_STYLE[type] ?? { bg: "#F1F5F9", fg: "#475569" };
  return (
    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: s.bg, color: s.fg }}>
      {type}
    </span>
  );
}

function ratingLabel(r: string | null): { label: string; tone: string } {
  if (r === "above") return { label: "Above average", tone: "text-success" };
  if (r === "average") return { label: "Average", tone: "text-warning" };
  if (r === "below") return { label: "Below average", tone: "text-danger" };
  return { label: "—", tone: "text-muted" };
}

function pct(v: number | null): string {
  return v == null ? "—" : formatPercent(v);
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-[14px] font-semibold tnum ${tone ?? "text-ink"}`}>{value}</div>
    </div>
  );
}

function Card({ r }: { r: UnderPerformerRow }) {
  const [open, setOpen] = useState(false);
  const rel = ratingLabel(r.adRelevance);
  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--lv-border)] bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-3 p-4 text-left hover:bg-canvas/50">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold text-ink">{r.text}</span>
            <MatchBadge type={r.matchType} />
            {r.visibilityConcern && (
              <StatusPill tone="warning" dot={false}>Low visibility</StatusPill>
            )}
            {r.crmLeads > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--lv-success)]/12 px-2 py-0.5 text-[11px] font-semibold text-success">
                {r.crmLeads} CRM lead{r.crmLeads === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="mt-1 truncate text-[12px] text-muted">{r.campaignName} · {r.adGroupName}</div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <div className="text-[15px] font-bold tnum text-ink">{formatMoney(r.spend, r.currency)}</div>
            <div className="text-[11px] font-medium text-danger">{r.spendVsTarget.toFixed(1)}× target CPA</div>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Compact stat strip */}
      <div className="grid grid-cols-3 gap-3 border-t border-[var(--lv-border)] px-4 py-3 sm:grid-cols-6">
        <Metric label="Spend" value={formatMoney(r.spend, r.currency)} />
        <Metric label="Target CPA" value={formatMoney(r.targetCpa, r.currency)} />
        <Metric label="Actual CPA" value={r.actualCpa == null ? "— (0 conv)" : formatMoney(r.actualCpa, r.currency)} tone={r.actualCpa == null ? "text-danger" : "text-ink"} />
        <Metric label="Conversions" value={formatInt(r.conversions)} />
        <Metric label="Top-of-page IS" value={pct(r.topImpressionShare)} tone={r.topImpressionShare != null && r.topImpressionShare < 0.5 ? "text-danger" : "text-ink"} />
        <Metric label="IS lost (rank)" value={pct(r.rankLostImpressionShare)} tone={r.rankLostImpressionShare != null && r.rankLostImpressionShare > 0.25 ? "text-danger" : "text-ink"} />
      </div>

      {open && (
        <div className="space-y-4 border-t border-[var(--lv-border)] bg-canvas/40 px-4 py-4">
          {/* 1. Visibility */}
          <section>
            <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-ink">
              <Eye className="h-3.5 w-3.5" /> Visibility
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-secondary">
              <span>Search IS: <b className="tnum text-ink">{pct(r.impressionShare)}</b></span>
              <span>Top-of-page IS: <b className="tnum text-ink">{pct(r.topImpressionShare)}</b></span>
              <span>IS lost to rank: <b className="tnum text-ink">{pct(r.rankLostImpressionShare)}</b></span>
            </div>
            {r.visibilityConcern && (
              <div className="mt-1.5 flex items-start gap-1.5 text-[12px] text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Barely serving in top positions / losing impressions to Ad Rank — worth improving visibility (bid/QS) before pausing.
              </div>
            )}
          </section>

          {/* 3. Ad relevance + the ad being served */}
          <section>
            <div className="mb-1.5 text-[12px] font-semibold text-ink">Ad relevance &amp; the ad being served</div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[12px] text-secondary">
              <span>Ad relevance (QS): <b className={rel.tone}>{rel.label}</b></span>
              <span>Ad strength: <b className="text-ink">{r.ad?.adStrength ?? "—"}</b></span>
              <span>Type: <b className="text-ink">{(r.ad?.adType ?? "—").replace(/_/g, " ").toLowerCase()}</b></span>
              {r.googleAdsUrl && (
                <a href={r.googleAdsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  Open ad in Google Ads <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="mt-1 text-[11px] text-muted">Google Ads doesn&apos;t expose RSA copy text via the API — open in Google Ads to read the headlines.</div>
          </section>

          {/* 2. Top spending search terms */}
          <section>
            <div className="mb-1.5 text-[12px] font-semibold text-ink">Top spending search terms</div>
            {r.topSearchTerms.length === 0 ? (
              <div className="text-[12px] text-muted">No search-term rows cached for this ad group.</div>
            ) : (
              <table className="w-full text-[12px]">
                <tbody>
                  {r.topSearchTerms.map((t) => (
                    <tr key={t.term} className="border-b border-[var(--lv-border)] last:border-0">
                      <td className="py-1.5 pr-3 text-ink">{t.term}</td>
                      <td className="px-3 py-1.5 text-right tnum text-secondary">{formatMoney(t.spend, t.currency)}</td>
                      <td className="px-3 py-1.5 text-right tnum text-secondary">{formatInt(t.conversions)} conv</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-1 text-[11px] text-muted">
              {r.adGroupKeywordCount > 1
                ? `Ad-group level — ${r.adGroupKeywordCount} keywords share this ad group (Google can't attribute a search term to one keyword).`
                : "This keyword is alone in its ad group, so these terms are attributable to it."}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export function UnderPerformersPanel({ rows, usingLive }: { rows: UnderPerformerRow[]; usingLive: boolean }) {
  if (!usingLive) {
    return (
      <div className="rounded-lg border border-[var(--lv-border)] bg-card px-4 py-8 text-center text-[13px] text-secondary">
        Under-performing keywords appear once live keyword data has been pulled (Refresh).
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--lv-border)] bg-card px-4 py-8 text-center text-[13px] text-secondary">
        No keywords in this market have spent ≥ 2× their campaign&apos;s target CPA. (Only campaigns with a target CPA set are assessed.)
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-relaxed text-muted">
        Keywords that have spent at least <b>2× their campaign target CPA</b> (last 30 days). Before pausing, check the three
        triage signals on each: <b>visibility</b> (are we serving at the top, or losing rank?), the <b>top spending search terms</b>
        (are they relevant?), and <b>ad relevance</b> (is the ad meeting intent?). CRM leads show real leads attributed to the keyword.
      </p>
      {rows.map((r) => (
        <Card key={r.id} r={r} />
      ))}
    </div>
  );
}
