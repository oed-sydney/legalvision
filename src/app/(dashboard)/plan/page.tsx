import { CalendarDays, ExternalLink, MessageSquare, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle, SectionLabel } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { PanelTabs } from "@/components/ui/PanelTabs";
import { InfoTip } from "@/components/ui/InfoTip";
import { TaskStatusSelect } from "@/components/plan/TaskStatusSelect";
import { ManualKpiInput } from "@/components/plan/ManualKpiInput";
import { ClickUpRefreshButton } from "@/components/plan/ClickUpRefreshButton";
import {
  MARKET_SECTIONS,
  PLAN,
  PLAN_TASKS,
  REPORTING_CADENCE,
  type PlanKpiDef,
} from "@/lib/plan/definition";
import { planReport, type KpiRow, type KpiStatus, type PlanMonth } from "@/lib/plan/metrics";
import { readPlanState } from "@/lib/plan/store";
import {
  clickupConfigured,
  readClickUpSnapshot,
  RECENT_COMMENT_DAYS,
  type ClickUpTask,
} from "@/lib/plan/clickup";
import { readMeetingsSnapshot } from "@/lib/plan/meetings";
import { formatInt, formatMoney } from "@/lib/metrics/format";
import { cn } from "@/lib/utils";

export default async function PlanPage() {
  const report = await planReport();
  const state = await readPlanState();
  const snapshot = readClickUpSnapshot();
  const meetings = readMeetingsSnapshot();

  const doneCount = PLAN_TASKS.filter((t) => state.taskStatuses[t.id] === "done").length;
  const statusTally = report.kpis.reduce(
    (acc, k) => ((acc[k.status] = (acc[k.status] ?? 0) + 1), acc),
    {} as Record<KpiStatus, number>
  );

  return (
    <div>
      <PageHeader
        title="90-Day Plan"
        subtitle={`${PLAN.name} · 1 May – 31 Jul 2026`}
      />

      {/* Plan progress hero */}
      <Card className="mb-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Hero label="Plan elapsed" value={`${Math.round(report.elapsedPct * 100)}%`} sub={`Day ${report.dayOfPlan} of ${report.totalDays}`} />
          <Hero label="Tasks done" value={`${doneCount} / ${PLAN_TASKS.length}`} sub="Workstreams & tests" />
          <div className="flex flex-col justify-between">
            <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-secondary">KPI scoreboard</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusPill tone="success">{statusTally.on_track ?? 0} on track</StatusPill>
              {(statusTally.at_risk ?? 0) > 0 && <StatusPill tone="warning">{statusTally.at_risk} at risk</StatusPill>}
              <StatusPill tone="danger">{statusTally.off_track ?? 0} off track</StatusPill>
              {(statusTally.no_data ?? 0) > 0 && <StatusPill tone="grey">{statusTally.no_data} no data</StatusPill>}
            </div>
            <div className="mt-2 text-[12px] text-muted">Judged on last complete month</div>
          </div>
          <Momentum report={report} />
        </div>
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-canvas">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(report.elapsedPct * 100, 100)}%` }} />
        </div>
      </Card>

      <PanelTabs
        tabs={[
          { key: "plan", label: "Strategy & KPIs", panel: <PlanPanel report={report} state={state} /> },
          {
            key: "meetings",
            label: `Meetings${meetings ? ` (${meetings.meetings.length})` : ""}`,
            panel: <MeetingsPanel snapshot={meetings} />,
          },
          {
            key: "clickup",
            label: `ClickUp activity${snapshot ? ` (${snapshot.tasks.length})` : ""}`,
            panel: <ClickUpPanel snapshot={snapshot} configured={clickupConfigured()} />,
          },
        ]}
      />
    </div>
  );
}

// ---------------- Strategy & KPIs ----------------

function PlanPanel({
  report,
  state,
}: {
  report: Awaited<ReturnType<typeof planReport>>;
  state: Awaited<ReturnType<typeof readPlanState>>;
}) {
  return (
    <div className="space-y-6">
      {MARKET_SECTIONS.map((section) => {
        const kpis = report.kpis.filter((k) => k.def.market === section.market);
        const tasks = PLAN_TASKS.filter((t) => t.market === section.market);
        return (
          <Card key={section.market}>
            <div className="mb-4">
              <SectionLabel>{section.heading}</SectionLabel>
            </div>

            {kpis.length > 0 && <KpiTable kpis={kpis} months={report.months} />}

            {tasks.length > 0 && (
              <ul className={cn("space-y-2.5", kpis.length > 0 && "mt-5 border-t border-[var(--lv-border)] pt-4")}>
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3">
                    <TaskStatusSelect taskId={t.id} initial={state.taskStatuses[t.id] ?? "todo"} />
                    <div className="min-w-0">
                      <span
                        className={cn(
                          "text-[14px] font-medium text-ink",
                          state.taskStatuses[t.id] === "done" && "text-muted line-through"
                        )}
                      >
                        {t.title}
                      </span>
                      {t.details && (
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12.5px] text-secondary">
                          {t.details.split("\n").map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}

      {/* Reporting cadence — standing commitments, not tasks */}
      <Card>
        <div className="mb-4">
          <SectionLabel>Reporting cadence</SectionLabel>
        </div>
        <ul className="divide-y divide-[var(--lv-border)]">
          {REPORTING_CADENCE.map((r) => (
            <li key={r.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="mt-px inline-flex w-[104px] shrink-0 items-center justify-center rounded-full bg-canvas px-2 py-0.5 text-[11px] font-medium text-secondary">
                {r.cadence}
              </span>
              <div className="min-w-0">
                <span className="text-[14px] font-medium text-ink">{r.title}</span>
                {r.details && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{r.details}</p>}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-[11px] text-muted">
        * current month is in progress — status is judged against the last complete month. Hover a KPI&apos;s ⓘ for how
        it&apos;s measured.
      </p>
    </div>
  );
}

function KpiTable({ kpis, months }: { kpis: KpiRow[]; months: PlanMonth[] }) {
  return (
    <div className="overflow-x-auto lv-scroll">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[var(--lv-border)] text-left text-[11px] font-medium uppercase tracking-[0.04em] text-secondary">
            <th className="py-2 pr-3 font-medium">KPI</th>
            <th className="py-2 pr-3 text-right font-medium">Baseline</th>
            <th className="py-2 pr-3 text-right font-medium">Target</th>
            {months.map((m) => (
              <th key={m.month} className="py-2 pr-3 text-right font-medium">
                {m.label}
              </th>
            ))}
            <th className="py-2 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {kpis.map((k) => (
            <tr key={k.def.id} className="border-b border-[var(--lv-border)] last:border-0">
              <td className="py-2.5 pr-3">
                <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                  {k.def.name}
                  <InfoTip
                    content={
                      <div>
                        <div className="font-semibold text-ink">{k.def.name}</div>
                        <div className="mt-1">{k.def.description}</div>
                      </div>
                    }
                  />
                  {k.def.metric === "manual" && (
                    <span className="rounded bg-canvas px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-muted">
                      manual
                    </span>
                  )}
                </span>
              </td>
              <td className="py-2.5 pr-3 text-right tnum text-secondary">{fmtKpi(k.def, k.def.baseline)}</td>
              <td className="whitespace-nowrap py-2.5 pr-3 text-right font-medium tnum text-ink">
                {k.def.direction === 1 ? "≥ " : "≤ "}
                {fmtKpi(k.def, k.def.target)}
              </td>
              {months.map((m, i) => (
                <td key={m.month} className="whitespace-nowrap py-2.5 pr-3 text-right tnum text-ink">
                  {k.def.metric === "manual" ? (
                    <ManualKpiInput
                      kpiId={k.def.id}
                      month={m.month}
                      initial={k.values[i]}
                      suffix={k.def.unit === "percent" ? "%" : undefined}
                    />
                  ) : (
                    <>
                      {fmtKpi(k.def, k.values[i])}
                      {m.partial && k.values[i] !== null && <span className="text-muted">*</span>}
                    </>
                  )}
                </td>
              ))}
              <td className="py-2.5 text-right">
                <KpiStatusPill status={k.status} />
                {k.gapText && (
                  <div className="mt-1 whitespace-nowrap text-[11px] tnum text-muted">{k.gapText}</div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const KPI_STATUS: Record<KpiStatus, { tone: "success" | "warning" | "danger" | "grey"; label: string }> = {
  on_track: { tone: "success", label: "On track" },
  at_risk: { tone: "warning", label: "At risk" },
  off_track: { tone: "danger", label: "Off track" },
  no_data: { tone: "grey", label: "No data" },
};

function KpiStatusPill({ status }: { status: KpiStatus }) {
  const s = KPI_STATUS[status];
  return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
}

function fmtKpi(def: PlanKpiDef, value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  switch (def.unit) {
    case "currency":
      return formatMoney(value, def.currency ?? "AUD");
    case "percent":
      return `${value.toLocaleString("en-AU", { maximumFractionDigits: 1 })}%`;
    default:
      return formatInt(value);
  }
}

// ---------------- Meetings ----------------

function MeetingsPanel({ snapshot }: { snapshot: ReturnType<typeof readMeetingsSnapshot> }) {
  return (
    <Card>
      <CardTitle>LegalVision meetings</CardTitle>
      <p className="-mt-3 mb-4 text-[12.5px] text-muted">
        AI Notetaker summaries from ClickUp
        {snapshot && <> · captured {formatWhen(snapshot.fetchedAt)}</>}
      </p>

      {!snapshot || snapshot.meetings.length === 0 ? (
        <p className="text-[13px] text-muted">
          {snapshot?.note ?? "No LegalVision meeting summaries found in ClickUp yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {snapshot.meetings.map((m) => (
            <li key={m.id} className="rounded-lg border border-[var(--lv-border)] bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-canvas px-2 py-0.5 text-[12px] font-semibold tnum text-secondary">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatMeetingDate(m.date)}
                </span>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[14px] font-semibold text-ink hover:text-primary hover:underline"
                >
                  {m.title}
                  <ExternalLink className="h-3 w-3 text-muted" />
                </a>
              </div>
              {m.attendees && (
                <div className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-muted">
                  <Users className="h-3 w-3" />
                  {m.attendees}
                </div>
              )}
              {m.bullets && m.bullets.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-snug text-secondary">
                  {m.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              ) : (
                m.summary && <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">{m.summary}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------- ClickUp activity ----------------

function ClickUpPanel({
  snapshot,
  configured,
}: {
  snapshot: ReturnType<typeof readClickUpSnapshot>;
  configured: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle action={<ClickUpRefreshButton enabled={configured} />}>
          {snapshot?.listName ?? "LV - PPC (client share)"}
        </CardTitle>
        <p className="-mt-3 mb-4 text-[12.5px] text-muted">
          Open tasks with comment activity in the last {RECENT_COMMENT_DAYS} days
          {snapshot && <> · snapshot from {formatWhen(snapshot.fetchedAt)}</>}
        </p>

        {!configured && (
          <div className="mb-4 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-2.5 text-[13px] text-[#92400E]">
            Live refresh needs <code className="font-semibold">CLICKUP_API_TOKEN</code> in{" "}
            <code>.env.local</code> (ClickUp → avatar → Settings → Apps → Generate API token). Until
            then this page shows the stored snapshot.
          </div>
        )}

        {!snapshot || snapshot.tasks.length === 0 ? (
          <p className="text-[13px] text-muted">No open tasks with recent comments.</p>
        ) : (
          <ul className="space-y-3">
            {snapshot.tasks.map((t) => (
              <ClickUpTaskCard key={t.id} task={t} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Status tone resolved from ClickUp's free-form status names. */
function clickupStatusStyle(status: string): { label: string; badge: string; edge: string } {
  const s = status.toLowerCase();
  if (/(complete|closed|done)/.test(s))
    return { label: status, badge: "bg-[#DCFCE7] text-[#15803D] ring-[#86EFAC]", edge: "bg-[#22C55E]" };
  if (/(progress|doing|active)/.test(s))
    return { label: status, badge: "bg-[#DBEAFE] text-[#1D4ED8] ring-[#93C5FD]", edge: "bg-[#3B82F6]" };
  if (/(review|approval)/.test(s))
    return { label: status, badge: "bg-[#EDE9FE] text-[#6D28D9] ring-[#C4B5FD]", edge: "bg-[#8B5CF6]" };
  if (/(blocked|hold|stuck)/.test(s))
    return { label: status, badge: "bg-[#FEE2E2] text-[#B91C1C] ring-[#FCA5A5]", edge: "bg-[#EF4444]" };
  return { label: status || "no status", badge: "bg-[#F1F5F9] text-[#475569] ring-[#CBD5E1]", edge: "bg-[#94A3B8]" };
}

const PRIORITY_CLASS: Record<string, string> = {
  urgent: "bg-[#FEE2E2] text-[#B91C1C]",
  high: "bg-[#FFEDD5] text-[#C2410C]",
  normal: "bg-[#F1F5F9] text-[#64748B]",
  low: "bg-[#F1F5F9] text-[#94A3B8]",
};

function ClickUpTaskCard({ task }: { task: ClickUpTask }) {
  const style = clickupStatusStyle(task.status);
  return (
    <li className="relative overflow-hidden rounded-lg border border-[var(--lv-border)] bg-white">
      {/* status colour edge — makes state readable at a glance */}
      <span className={cn("absolute inset-y-0 left-0 w-1", style.edge)} aria-hidden />
      <div className="flex flex-col gap-2 py-3 pl-4 pr-4 sm:flex-row sm:items-start sm:gap-4">
        {/* prominent status badge, fixed column so statuses align down the list */}
        <span
          className={cn(
            "inline-flex h-7 shrink-0 items-center justify-center self-start rounded-md px-2.5 text-[11px] font-bold uppercase tracking-[0.05em] ring-1 sm:w-[112px]",
            style.badge
          )}
        >
          {style.label}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <a
              href={task.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[14px] font-semibold text-ink hover:text-primary hover:underline"
            >
              {task.name}
              <ExternalLink className="h-3 w-3 text-muted" />
            </a>
            {task.priority && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                  PRIORITY_CLASS[task.priority.toLowerCase()] ?? PRIORITY_CLASS.normal
                )}
              >
                {task.priority}
              </span>
            )}
            {task.tags &&
              task.tags.split(", ").map((tag) => (
                <span key={tag} className="rounded-full bg-canvas px-2 py-0.5 text-[11px] text-secondary">
                  {tag}
                </span>
              ))}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted">
            {task.assignees && <span>{task.assignees}</span>}
            {task.dueDate && <span>due {formatMeetingDate(task.dueDate)}</span>}
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {task.recentCommentCount} comment{task.recentCommentCount === 1 ? "" : "s"} in {RECENT_COMMENT_DAYS}d
            </span>
          </div>

          {task.lastCommentText && (
            <p className="mt-1.5 text-[12.5px] leading-snug text-secondary">
              <span className="font-medium text-ink">{task.lastCommentBy}</span>{" "}
              <span className="text-muted">({formatWhen(task.lastCommentAt)}):</span> &ldquo;{task.lastCommentText}&rdquo;
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

// ---------------- shared bits ----------------

function Momentum({ report }: { report: Awaited<ReturnType<typeof planReport>> }) {
  const last = report.months.length - 1;
  const prev = last - 1;
  let improving = 0;
  let comparable = 0;
  if (prev >= 0) {
    for (const k of report.kpis) {
      const a = k.values[prev];
      const b = k.values[last];
      if (a == null || b == null) continue;
      comparable++;
      if (k.def.direction === 1 ? b >= a : b <= a) improving++;
    }
  }
  return (
    <Hero
      label="Momentum"
      value={comparable > 0 ? `${improving} / ${comparable}` : "—"}
      sub={
        comparable > 0
          ? `KPIs improving — ${report.months[last].label.toLowerCase()} vs ${report.months[prev].label}`
          : "Needs two months of data"
      }
    />
  );
}

function Hero({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col justify-between">
      <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-secondary">{label}</div>
      <div className="mt-2 text-[28px] font-bold leading-none tnum text-ink">{value}</div>
      {sub && <div className="mt-2 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

function formatMeetingDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatWhen(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export const dynamic = "force-dynamic";
