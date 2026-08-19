import Image from "next/image";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatInt, formatMoney } from "@/lib/metrics/format";
import type { CurrencyCode } from "@/lib/domain/types";

export interface CreativeCard {
  id: string;
  adName: string;
  campaignName: string;
  funnel: string;
  format: "Image" | "Video" | "Carousel";
  primaryText: string;
  headline: string;
  cta?: string;
  spend: number;
  frequency: number;
  ctr: number; // %
  resultLabel: string;
  resultValue: number;
  resultCpa: number | null;
  currency: CurrencyCode;
  thumbnailPath: string | null;
  fatigue: boolean;
}

// Deterministic brand gradient per creative so the copy panel looks intentional.
const GRADIENTS = [
  "linear-gradient(135deg, #0a2e3a 0%, #16404f 100%)",
  "linear-gradient(135deg, #0a2e3a 0%, #1e5566 60%, #f1531c 220%)",
  "linear-gradient(135deg, #123a48 0%, #0a2e3a 100%)",
  "linear-gradient(135deg, #16404f 0%, #0a2e3a 70%, #b5420f 200%)",
];

export function CreativesGrid({ creatives }: { creatives: CreativeCard[] }) {
  if (creatives.length === 0) {
    return <div className="rounded-lg border border-[var(--lv-border)] bg-card px-4 py-8 text-center text-[13px] text-secondary">No ads ran in this market for the selected period.</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {creatives.map((c, i) => (
        <div key={c.id} className="flex flex-col overflow-hidden rounded-[10px] border border-[var(--lv-border)] bg-card">
          {/* Creative visual — real cached image when available; branded copy panel otherwise. */}
          <div className="relative h-44 w-full overflow-hidden">
            {c.thumbnailPath ? (
              <>
                <Image src={c.thumbnailPath} alt={c.adName} fill sizes="(max-width:1280px) 50vw, 25vw" className="object-cover" />
                <div className="absolute right-2.5 top-2.5 flex gap-1.5">
                  <span className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur">{c.format}</span>
                  {c.fatigue && <StatusPill tone="warning" dot={false}>Fatigue</StatusPill>}
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col justify-end p-3.5 text-white" style={{ background: GRADIENTS[i % GRADIENTS.length] }}>
                <div className="absolute right-2.5 top-2.5 flex gap-1.5">
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide backdrop-blur">{c.format}</span>
                  {c.fatigue && <StatusPill tone="warning" dot={false}>Fatigue</StatusPill>}
                </div>
                <div className="text-[15px] font-semibold leading-snug">{c.headline}</div>
                {c.cta && (
                  <span className="mt-2.5 inline-flex w-fit items-center rounded-md bg-[var(--lv-accent)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                    {c.cta}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col p-3">
            <div className="text-[13px] font-semibold leading-snug text-ink">{c.adName}</div>
            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-secondary" title={c.primaryText}>
              {c.primaryText}
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
              <span className="rounded bg-canvas px-1.5 py-0.5 font-medium text-secondary">{c.funnel}</span>
              <span className="truncate">{c.campaignName}</span>
            </div>
            <dl className="mt-2.5 grid grid-cols-2 gap-y-1 border-t border-[var(--lv-border)] pt-2.5 text-[12px]">
              <Cell k="Spend" v={formatMoney(c.spend, c.currency)} />
              <Cell k="Freq" v={c.frequency.toFixed(2)} />
              <Cell k="CTR (link)" v={`${c.ctr.toFixed(2)}%`} />
              <Cell k={c.resultLabel} v={formatInt(c.resultValue)} />
              {c.resultCpa != null && <Cell k="Cost / result" v={formatMoney(c.resultCpa, c.currency)} />}
            </dl>
          </div>
        </div>
      ))}
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="truncate text-secondary" title={k}>{k}</dt>
      <dd className="text-right font-medium tnum text-ink">{v}</dd>
    </>
  );
}
