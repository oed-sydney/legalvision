import { ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { ComponentIcon } from "@/components/ui/ComponentIcon";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatMoney } from "@/lib/metrics/format";
import type { QsImpact } from "@/lib/data/real/qs-impact";

/**
 * QS Impact — what changed over the last 90 days and how Quality Scores moved.
 * Change log from ClickUp (LV - PPC); keyword + component movements from Windsor
 * current-vs-historical QS. Component movements surface even when the QS integer is flat.
 */
export function QsImpactSection({
  impact,
  marketLabel = "All markets",
  currentWeightedQs = null,
}: {
  impact: QsImpact;
  marketLabel?: string;
  currentWeightedQs?: number | null;
}) {
  const completed = impact.actionItems.filter((a) => a.status === "complete");
  const inProgress = impact.actionItems.filter((a) => a.status === "in_progress");
  const avgLift =
    impact.movements.length > 0
      ? impact.movements.reduce((s, m) => s + (m.qsAfter - m.qsBefore), 0) / impact.movements.length
      : 0;
  const componentUps = impact.components.reduce((s, c) => s + c.count, 0);
  const noHistory = impact.movements.length === 0;

  return (
    <Card className="border-l-4 border-l-[var(--lv-accent)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold text-ink">Quality Score impact — {marketLabel}</h2>
        <span className="text-[12px] text-muted">Change log: ClickUp · QS movement: Google historical vs current</span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label={`Current weighted QS · ${marketLabel}`} value={currentWeightedQs != null ? currentWeightedQs.toFixed(1) : "—"} sub="live · impression-weighted" />
        <Stat label="Action items completed" value={String(completed.length)} sub={`${inProgress.length} in progress`} />
        <Stat label="Component ratings improved" value={String(componentUps)} sub="Exp CTR / Ad rel / LP" subTone={componentUps > 0 ? "text-success" : undefined} />
        <Stat label="Avg QS lift" value={impact.movements.length ? `+${avgLift.toFixed(1)}` : "—"} sub={`${impact.movements.length} keywords`} subTone={impact.movements.length ? "text-success" : undefined} />
      </div>

      {noHistory && (
        <p className="mt-4 rounded-lg border border-[var(--lv-border)] bg-canvas px-4 py-2.5 text-[12px] text-secondary">
          No QS remediation movements have been logged for <strong>{marketLabel}</strong> in this window — the improvement history below reflects the AU remediation programme. Switch the market to <strong>Australia</strong> or <strong>All markets</strong> to see keyword-level movements, or use the <strong>Scores &amp; distribution</strong> tab for {marketLabel}&apos;s live Quality Score breakdown.
        </p>
      )}

      {/* Component improvements — even where the QS integer didn't move */}
      <div className="mt-5">
        <div className="mb-2 text-[13px] font-semibold text-ink">Component improvements</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {impact.components.map((c) => (
            <div key={c.component} className="rounded-lg border border-[var(--lv-border)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink">{c.component}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.count > 0 ? "bg-[#DCFCE7] text-success" : "bg-canvas text-muted"}`}>
                  {c.count > 0 ? `+${c.count} improved` : "no change"}
                </span>
              </div>
              {c.keywords.length === 0 ? (
                <p className="text-[12px] text-muted">No rating changes recorded yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {c.keywords.map((m) => (
                    <li key={m.keyword} className="text-[12px]">
                      <div className="truncate font-medium text-ink" title={m.keyword}>{m.keyword}</div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <ComponentIcon rating={m.ratingFrom} />
                        <ArrowRight className="h-3 w-3 text-success" />
                        <ComponentIcon rating={m.ratingTo} />
                        <span className="ml-auto text-[11px] text-muted">QS {m.qsBefore}→{m.qsAfter}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Action items / change log */}
        <div>
          <div className="mb-2 text-[13px] font-semibold text-ink">QS action items (change log)</div>
          <ul className="space-y-2.5">
            {impact.actionItems.map((a) => (
              <li key={a.url} className="flex items-start gap-2.5 border-b border-[var(--lv-border)] pb-2.5 last:border-0 last:pb-0">
                {a.status === "complete" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                ) : (
                  <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                )}
                <div className="min-w-0 flex-1">
                  <a href={a.url} target="_blank" rel="noreferrer" className="block truncate text-[13px] font-medium text-ink hover:text-primary" title={a.name}>
                    {a.name}
                  </a>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                    <span>{a.market}</span>
                    <span>·</span>
                    <span>Targets: {a.targets}</span>
                    <span>·</span>
                    <span>{a.status === "complete" ? `Completed ${a.date}` : `Started ${a.date}`}</span>
                  </div>
                </div>
                <StatusPill tone={a.status === "complete" ? "success" : "warning"} dot={false}>
                  {a.status === "complete" ? "Done" : "In progress"}
                </StatusPill>
              </li>
            ))}
          </ul>
        </div>

        {/* Keyword QS movements */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">Keyword QS movements</span>
            <span className="text-[12px] text-muted">before → after</span>
          </div>
          <ul className="space-y-2.5">
            {impact.movements
              .slice()
              .sort((a, b) => b.qsAfter - b.qsBefore - (a.qsAfter - a.qsBefore))
              .map((m) => (
                <li key={m.keyword} className="rounded-lg border border-[var(--lv-border)] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-ink" title={m.keyword}>{m.keyword}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[14px] font-bold tnum">
                      <span className="text-muted">{m.qsBefore}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-success" />
                      <span className="text-success">{m.qsAfter}</span>
                      <span className="ml-1 rounded bg-[#DCFCE7] px-1.5 py-0.5 text-[11px] text-success">+{m.qsAfter - m.qsBefore}</span>
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                    <span className="flex items-center gap-1.5">
                      <span>{m.component}:</span>
                      <ComponentIcon rating={m.ratingFrom} />
                      <ArrowRight className="h-3 w-3" />
                      <ComponentIcon rating={m.ratingTo} />
                    </span>
                    <span>{m.campaign} · {formatMoney(m.spend, m.currency)}</span>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-muted">
        Before = Google historical QS; after = current. Component ratings can improve before the QS integer catches up — remediation is in progress and movements accrue as the daily QS snapshot job runs.
      </p>
    </Card>
  );
}

function Stat({ label, value, sub, subTone }: { label: string; value: string; sub?: string; subTone?: string }) {
  return (
    <div>
      <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-secondary">{label}</div>
      <div className="mt-1.5 text-[24px] font-bold leading-none tnum text-ink">{value}</div>
      {sub && <div className={`mt-1.5 text-[11px] ${subTone ?? "text-muted"}`}>{sub}</div>}
    </div>
  );
}
