"use client";

import { useEffect, useMemo, useState } from "react";
import { CreativesGrid, type CreativeCard } from "./CreativesGrid";
import type { MetaAd } from "@/lib/data/real/meta-creatives";

/**
 * Ads & Creatives panel. Fatigue is flagged from ad frequency against an EDITABLE,
 * per-funnel threshold — retargeted BOFU tolerates a higher frequency before it fatigues
 * than cold prospecting. Thresholds persist per user (localStorage); defaults below.
 */
const DEFAULTS = { bofu: 4.0, prospecting: 3.0 };
const LS_KEY = "lv-meta-fatigue-thresholds";

export function MetaAdsPanel({ ads }: { ads: MetaAd[] }) {
  const [thr, setThr] = useState(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setThr({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  const update = (key: "bofu" | "prospecting", value: number) => {
    const next = { ...thr, [key]: value };
    setThr(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {}
  };

  const cards: CreativeCard[] = useMemo(
    () =>
      ads
        .slice()
        .sort((a, b) => b.spend - a.spend)
        .map((a) => {
          const threshold = a.funnel === "BOFU" ? thr.bofu : thr.prospecting;
          return {
            id: a.id,
            adName: a.adName,
            campaignName: a.campaignName,
            funnel: a.funnel,
            format: a.format,
            primaryText: a.primaryText,
            headline: a.headline,
            cta: a.cta,
            spend: a.spend,
            frequency: a.frequency,
            ctr: a.ctr,
            resultLabel: a.resultLabel,
            resultValue: a.resultValue,
            resultCpa: a.resultCpa,
            currency: a.currency,
            thumbnailPath: a.thumbnailPath,
            fatigue: a.frequency >= threshold,
          };
        }),
    [ads, thr]
  );

  const fatigued = cards.filter((c) => c.fatigue).length;

  return (
    <div>
      <div className="mb-4 rounded-lg border border-[var(--lv-border)] bg-canvas px-4 py-3 text-[12px] text-secondary">
        Real ad-level metrics from the Meta Marketing API (last 30 days). Static image ads show their
        creative; video &amp; lead-magnet ads show the live ad copy on a branded panel until the Meta image
        cache job runs (needs a system-user token).
      </div>

      {/* Editable fatigue thresholds */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-[var(--lv-border)] bg-card px-4 py-3">
        <div className="text-[12px]">
          <div className="font-semibold text-ink">Fatigue threshold (frequency)</div>
          <div className="text-muted">Flag an ad when its 30-day frequency reaches the threshold for its funnel.</div>
        </div>
        <ThresholdInput label="Retargeted BOFU" value={thr.bofu} onChange={(v) => update("bofu", v)} />
        <ThresholdInput label="Prospecting / TOFU" value={thr.prospecting} onChange={(v) => update("prospecting", v)} />
        <div className="ml-auto flex items-center gap-3 text-[12px]">
          <span className="text-secondary">
            {fatigued} of {cards.length} ad{cards.length === 1 ? "" : "s"} flagged
          </span>
          <button
            type="button"
            onClick={() => {
              setThr(DEFAULTS);
              try {
                localStorage.setItem(LS_KEY, JSON.stringify(DEFAULTS));
              } catch {}
            }}
            className="rounded-md border border-[var(--lv-border)] px-2.5 py-1 font-medium text-secondary hover:bg-canvas"
          >
            Reset
          </button>
        </div>
      </div>

      <CreativesGrid creatives={cards} />
    </div>
  );
}

function ThresholdInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-[12px]">
      <span className="text-secondary">{label}</span>
      <input
        type="number"
        step={0.1}
        min={1.5}
        max={10}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(Math.min(10, Math.max(1.5, v)));
        }}
        className="w-16 rounded-md border border-[var(--lv-border)] bg-card px-2 py-1 text-right tnum text-ink focus:border-[var(--lv-accent)] focus:outline-none"
      />
    </label>
  );
}
