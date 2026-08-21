"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { ExternalLink, EyeOff, RotateCcw } from "lucide-react";
import { DataTable, type ColMeta } from "@/components/ui/DataTable";
import { formatInt, formatMoney, formatPercent } from "@/lib/metrics/format";
import type { SegmentRow } from "@/lib/data/keyword-segments";
import {
  POOR_SPEND_MIN,
  HIGH_CPC_MULTIPLE,
  LOW_IS_MIN_CONV,
  LOW_IS_CPA_TOLERANCE,
} from "@/lib/data/keyword-segments";

type SegKey = "poor" | "highCpc" | "lowIs";

const HIDDEN_KEY = "lv-kw-hidden"; // per-user hidden keyword ids (actioned rows)

/** Colour token per match type so exact / phrase / broad read at a glance. */
const MATCH_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  exact: { bg: "#EEF2FF", fg: "#4338CA", label: "Exact" },
  phrase: { bg: "#ECFDF5", fg: "#0F766E", label: "Phrase" },
  broad: { bg: "#FFF7ED", fg: "#C2410C", label: "Broad" },
};

function MatchBadge({ type }: { type: string }) {
  const s = MATCH_STYLE[type] ?? { bg: "#F1F5F9", fg: "#475569", label: type };
  return (
    <span
      className="mt-0.5 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

function num(extra?: Partial<ColMeta>): { meta: ColMeta } {
  return { meta: { align: "right", numeric: true, ...extra } };
}

function signedPct(v: number | null): string {
  if (v == null) return "—";
  return (v > 0 ? "+" : "") + formatPercent(v);
}

function kwCol(): ColumnDef<SegmentRow, unknown> {
  return {
    id: "text",
    header: "Keyword",
    accessorKey: "text",
    cell: (c) => (
      <div className="min-w-0">
        <div className="truncate font-medium text-ink" title={c.row.original.text}>{c.row.original.text}</div>
        <MatchBadge type={c.row.original.matchType} />
      </div>
    ),
    meta: { align: "left", sticky: true },
  };
}

function campaignCol(): ColumnDef<SegmentRow, unknown> {
  return {
    id: "campaign",
    header: "Campaign",
    accessorKey: "campaignName",
    cell: (c) => <span className="text-secondary">{c.row.original.campaignName}</span>,
    meta: { align: "left" },
  };
}

function moneyCol(id: string, header: string, key: keyof SegmentRow): ColumnDef<SegmentRow, unknown> {
  return {
    id,
    header,
    accessorFn: (r) => (r[key] as number | null) ?? -1,
    cell: (c) => {
      const v = c.row.original[key] as number | null;
      return v == null ? "—" : formatMoney(v, c.row.original.currency);
    },
    ...num(),
  };
}

function intCol(id: string, header: string, key: keyof SegmentRow): ColumnDef<SegmentRow, unknown> {
  return {
    id,
    header,
    accessorKey: key,
    cell: (c) => formatInt(c.row.original[key] as number),
    ...num(),
  };
}

/** Trailing actions: open in Google Ads (to pause/remove) + hide the row once actioned. */
function actionsCol(onHide: (id: string) => void): ColumnDef<SegmentRow, unknown> {
  return {
    id: "action",
    header: "",
    enableSorting: false,
    cell: (c) => {
      const r = c.row.original;
      return (
        <div className="flex items-center justify-end gap-1.5">
          {r.googleAdsUrl && (
            <a
              href={r.googleAdsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open this account's keywords in Google Ads and copy “${r.text}” to paste into search`}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--lv-border)] px-2 py-1 text-[11px] font-medium text-secondary hover:bg-canvas hover:text-ink"
              onClick={(e) => {
                e.stopPropagation();
                // Google can't deep-link to a single keyword row; copy the text so it's ready to paste.
                navigator.clipboard?.writeText(r.text).catch(() => {});
              }}
            >
              Google Ads <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            type="button"
            title="Hide this row (once you've actioned it)"
            aria-label={`Hide ${r.text}`}
            onClick={(e) => {
              e.stopPropagation();
              onHide(r.id);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--lv-border)] px-2 py-1 text-[11px] font-medium text-secondary hover:bg-canvas hover:text-ink"
          >
            <EyeOff className="h-3 w-3" /> Hide
          </button>
        </div>
      );
    },
    meta: { align: "right" },
  };
}

function columnsFor(seg: SegKey, onHide: (id: string) => void): ColumnDef<SegmentRow, unknown>[] {
  if (seg === "poor") {
    return [
      kwCol(),
      campaignCol(),
      moneyCol("spend", "Spend", "spend"),
      intCol("clicks", "Clicks", "clicks"),
      moneyCol("cpc", "CPC", "cpc"),
      intCol("conversions", "Conv.", "conversions"),
      intCol("liveLeads", "Live leads", "liveLeads"),
      actionsCol(onHide),
    ];
  }
  if (seg === "highCpc") {
    return [
      kwCol(),
      campaignCol(),
      moneyCol("cpc", "CPC", "cpc"),
      moneyCol("accountAvgCpc", "Acct avg CPC", "accountAvgCpc"),
      {
        id: "vsAvgCpcPct",
        header: "vs avg",
        accessorFn: (r) => r.vsAvgCpcPct ?? 0,
        cell: (c) => <span className="font-medium text-danger">{signedPct(c.row.original.vsAvgCpcPct)}</span>,
        ...num(),
      },
      moneyCol("spend", "Spend", "spend"),
      intCol("conversions", "Conv.", "conversions"),
      actionsCol(onHide),
    ];
  }
  // lowIs
  return [
    kwCol(),
    campaignCol(),
    intCol("conversions", "Conv.", "conversions"),
    moneyCol("costPerConv", "Cost / conv.", "costPerConv"),
    moneyCol("targetCpa", "Target CPA", "targetCpa"),
    {
      id: "vsTargetPct",
      header: "vs target",
      accessorFn: (r) => r.vsTargetPct ?? 0,
      cell: (c) => {
        const v = c.row.original.vsTargetPct;
        return <span className={`font-medium ${v != null && v <= 0 ? "text-success" : "text-ink"}`}>{signedPct(v)}</span>;
      },
      ...num(),
    },
    moneyCol("spend", "Spend", "spend"),
    actionsCol(onHide),
  ];
}

const SORT: Record<SegKey, SortingState> = {
  poor: [{ id: "spend", desc: true }],
  highCpc: [{ id: "cpc", desc: true }],
  lowIs: [{ id: "conversions", desc: true }],
};

export function KeywordSegmentsPanel({
  poor,
  highCpc,
  lowIs,
}: {
  poor: SegmentRow[];
  highCpc: SegmentRow[];
  lowIs: SegmentRow[];
}) {
  const [seg, setSeg] = useState<SegKey>("poor");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      if (raw) setHidden(new Set(JSON.parse(raw) as string[]));
    } catch {}
  }, []);

  const persist = (s: Set<string>) => {
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...s]));
    } catch {}
  };

  const hide = useCallback((id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.add(id);
      persist(next);
      return next;
    });
  }, []);

  const restoreAll = () => {
    setHidden(() => {
      persist(new Set());
      return new Set();
    });
  };

  const visible = useCallback((rows: SegmentRow[]) => rows.filter((r) => !hidden.has(r.id)), [hidden]);
  const poorV = visible(poor);
  const highV = visible(highCpc);
  const lowV = visible(lowIs);

  // How many rows currently in scope are hidden (for the restore affordance).
  const inScopeIds = useMemo(() => new Set([...poor, ...highCpc, ...lowIs].map((r) => r.id)), [poor, highCpc, lowIs]);
  const hiddenInScope = [...hidden].filter((id) => inScopeIds.has(id)).length;

  const tabs: { key: SegKey; label: string; count: number; blurb: string }[] = [
    {
      key: "poor",
      label: "Poor performing",
      count: poorV.length,
      blurb: `Spend over ${POOR_SPEND_MIN} (native currency) with zero conversions and zero live leads in the last 30 days — candidates to pause or rework. Open in Google Ads to pause/remove, then Hide the row once it's actioned.`,
    },
    {
      key: "highCpc",
      label: "High CPC",
      count: highV.length,
      blurb: `CPC more than ${Math.round((HIGH_CPC_MULTIPLE - 1) * 100)}% above the keyword's account-average CPC — review bids, match types and Quality Score.`,
    },
    {
      key: "lowIs",
      label: "Low IS",
      count: lowV.length,
      blurb: `Proven, efficient keywords worth scaling: more than ${LOW_IS_MIN_CONV} conversions and cost/conv at or within ${Math.round(
        LOW_IS_CPA_TOLERANCE * 100
      )}% of the campaign's target CPA — strong candidates to raise bids/budget where impression share is limited.`,
    },
  ];

  const data = seg === "poor" ? poorV : seg === "highCpc" ? highV : lowV;
  const columns = useMemo(() => columnsFor(seg, hide), [seg, hide]);
  const active = tabs.find((t) => t.key === seg)!;

  const restoreNote =
    hiddenInScope > 0 ? (
      <button
        type="button"
        onClick={restoreAll}
        title="Show all hidden keyword rows again"
        className="inline-flex items-center gap-1 text-[12px] font-medium text-secondary hover:text-ink"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {hiddenInScope} hidden · Restore
      </button>
    ) : undefined;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSeg(t.key)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
              seg === t.key
                ? "border-[var(--lv-accent)] bg-[var(--lv-accent)]/10 text-ink"
                : "border-[var(--lv-border)] text-secondary hover:bg-canvas"
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] tnum ${seg === t.key ? "bg-[var(--lv-accent)] text-white" : "bg-canvas text-muted"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <p className="mb-3 text-[12px] leading-relaxed text-muted">{active.blurb}</p>

      <DataTable
        key={seg}
        data={data}
        columns={columns}
        csvName={`keywords_${seg}`}
        searchPlaceholder="Search keywords…"
        initialSort={SORT[seg]}
        toolbarNote={restoreNote}
        emptyMessage="No keywords match this segment in the current scope."
      />
    </div>
  );
}
