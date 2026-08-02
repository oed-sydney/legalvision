import { Card, CardTitle } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { CopyButton } from "@/components/ui/CopyButton";
import { InfoTip } from "@/components/ui/InfoTip";
import { NegativeActions, UndoDecision } from "@/components/panels/NegativeActions";
import { formatInt, formatMoney, formatPercent } from "@/lib/metrics/format";
import type { AccountNegatives } from "@/lib/insights/negatives";
import type { NegativesApprovals } from "@/lib/data/negatives-store";

/**
 * Preemptive negative-keyword workflow: the engine proposes themed candidates,
 * a human approves or dismisses each, and only APPROVED terms make the
 * paste-ready list. Core service-intent queries are held to a stricter
 * evidence bar before they can even appear as candidates.
 */

const METHOD = (
  <div>
    <div className="font-semibold text-ink">How candidates are chosen</div>
    <div className="mt-1">
      Terms with zero leads where at least one was statistically expected (clicks × the account&apos;s lead rate), or
      with material spend, clustered by intent (free/DIY, jobs, study, legal aid, wrong jurisdiction). Core service
      queries (&ldquo;…lawyer&rdquo;, &ldquo;…solicitor&rdquo;) are only proposed at ~95% confidence or 2+ leads&apos;
      worth of zero-lead spend — we don&apos;t exclude commercial terms unless they&apos;re genuinely bleeding.
      Nothing enters the paste list until you approve it.
    </div>
  </div>
);

export function NegativesPanel({
  accounts,
  approvals,
}: {
  accounts: AccountNegatives[];
  approvals: NegativesApprovals;
}) {
  if (accounts.length === 0) return null;
  return (
    <Card>
      <CardTitle
        action={
          <span className="flex items-center gap-1.5 text-[12px] text-muted">
            Method <InfoTip content={METHOD} />
          </span>
        }
      >
        Preemptive negative keywords
      </CardTitle>

      <div className="space-y-6">
        {accounts.map((a) => {
          const decisions = approvals[a.accountId] ?? {};
          const decided = new Set(Object.keys(decisions));
          const pending = a.candidates.filter((c) => !decided.has(c.term.toLowerCase().trim()));
          const approved = Object.entries(decisions)
            .filter(([, d]) => d.status === "approved")
            .map(([term, d]) => ({ term, at: d.at }))
            .sort((x, y) => (x.at < y.at ? 1 : -1));
          const dismissedCount = Object.values(decisions).filter((d) => d.status === "dismissed").length;
          const pendingSpend = pending.reduce((s, c) => s + c.spend, 0);

          return (
            <div key={a.accountId}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-semibold text-ink">
                  {a.accountName} <span className="font-normal text-muted">· {a.market}</span>
                </span>
                {pendingSpend > 0 && (
                  <StatusPill tone="warning" dot={false}>
                    {formatMoney(pendingSpend, a.currency)} /30d awaiting review
                  </StatusPill>
                )}
                {a.hiddenSpend != null && a.hiddenPct != null && a.hiddenPct > 0.02 && (
                  <span className="text-[12px] text-muted">
                    + {formatMoney(a.hiddenSpend, a.currency)} ({formatPercent(a.hiddenPct)}) of search spend has no
                    reported query
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* themed clusters */}
                <div className="lg:col-span-1">
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-secondary">
                    Waste by theme (30d)
                  </div>
                  {a.clusters.length === 0 ? (
                    <p className="text-[12.5px] text-muted">No flagged terms.</p>
                  ) : (
                    <ul className="space-y-2">
                      {a.clusters.map((c) => (
                        <li key={c.key} className="rounded-lg border border-[var(--lv-border)] px-3 py-2">
                          <div className="flex items-baseline justify-between gap-2 text-[13px]">
                            <span className="font-medium text-ink">{c.label}</span>
                            <span className="tnum font-semibold text-ink">{formatMoney(c.spend, a.currency)}</span>
                          </div>
                          <div className="text-[11.5px] text-muted">
                            {c.why} · {formatInt(c.pauseCount + c.reviewCount)} terms
                          </div>
                          <div className="mt-0.5 truncate text-[11.5px] italic text-secondary" title={c.examples.join(" · ")}>
                            e.g. {c.examples.join(" · ")}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* candidates awaiting a decision */}
                <div className="lg:col-span-1">
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-secondary">
                    Candidates awaiting review ({pending.length})
                    {dismissedCount > 0 && (
                      <span className="ml-1.5 normal-case tracking-normal text-muted">· {dismissedCount} dismissed</span>
                    )}
                  </div>
                  {pending.length === 0 ? (
                    <p className="text-[12.5px] text-muted">All candidates reviewed.</p>
                  ) : (
                    <ul className="lv-scroll max-h-72 space-y-1.5 overflow-y-auto pr-1">
                      {pending.slice(0, 25).map((c) => (
                        <li key={c.term} className="rounded-lg border border-[var(--lv-border)] px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-[13px] font-medium text-ink" title={c.term}>
                              {c.term}
                            </span>
                            <span className="shrink-0 tnum text-[12px] font-semibold text-ink">
                              {formatMoney(c.spend, a.currency)}
                            </span>
                          </div>
                          <div className="mb-1.5 text-[11.5px] text-muted">{c.reason}</div>
                          <NegativeActions accountId={a.accountId} term={c.term} />
                        </li>
                      ))}
                      {pending.length > 25 && (
                        <li className="text-[11.5px] text-muted">+{pending.length - 25} more by spend…</li>
                      )}
                    </ul>
                  )}
                </div>

                {/* approved paste list */}
                <div className="lg:col-span-1">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-secondary">
                      Approved negatives ({approved.length})
                    </span>
                    {approved.length > 0 && (
                      <CopyButton text={approved.map((x) => `"${x.term}"`).join("\n")} />
                    )}
                  </div>
                  {approved.length === 0 ? (
                    <p className="text-[12.5px] text-muted">
                      Nothing approved yet — approve candidates to build the paste-ready phrase-negative list.
                    </p>
                  ) : (
                    <ul className="lv-scroll max-h-72 space-y-1 overflow-y-auto rounded-lg border border-[var(--lv-border)] bg-canvas px-3 py-2">
                      {approved.map((x) => (
                        <li key={x.term} className="flex items-center justify-between gap-2 text-[12.5px]">
                          <span className="min-w-0 truncate font-mono text-ink" title={x.term}>
                            &ldquo;{x.term}&rdquo;
                          </span>
                          <UndoDecision accountId={a.accountId} term={x.term} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {a.rootSuggestions.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-secondary">
                        Preemptive root suggestions
                      </div>
                      <ul className="space-y-1">
                        {a.rootSuggestions.map((r) => (
                          <li key={r.root} className="flex items-baseline justify-between text-[12.5px]">
                            <span className="font-mono text-ink">{r.root}</span>
                            <span className="text-[11.5px] text-secondary">
                              {formatInt(r.queries)} queries · {formatMoney(r.spend, a.currency)} · 0 leads
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
