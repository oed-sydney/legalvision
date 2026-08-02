"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** In-page sub-tabs that toggle server-rendered panels (no navigation). */
export function PanelTabs({
  tabs,
}: {
  tabs: { key: string; label: string; panel: React.ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.key);
  return (
    <div>
      <div className="mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-[var(--lv-border)] bg-canvas p-1 lv-scroll">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            aria-pressed={active === t.key}
            className={cn(
              "whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              active === t.key
                ? "bg-white text-primary shadow-[0_1px_2px_rgb(15_23_42_/_0.08)] ring-1 ring-[var(--lv-border)]"
                : "text-secondary hover:bg-white/60 hover:text-ink"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} hidden={active !== t.key}>
          {t.panel}
        </div>
      ))}
    </div>
  );
}
