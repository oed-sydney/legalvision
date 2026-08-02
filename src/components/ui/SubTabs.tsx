"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** Underline sub-tabs (§22) — sub-view switch within a page area, filters preserved. */
export function SubTabs({
  tabs,
}: {
  tabs: { key: string; label: string; href: string; disabled?: boolean; tip?: string }[];
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const qs = search.toString();
  return (
    <div className="mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-[var(--lv-border)] bg-canvas p-1 lv-scroll">
      {tabs.map((t) => {
        const active = pathname === t.href || (t.href !== tabs[0].href && pathname.startsWith(t.href));
        if (t.disabled) {
          return (
            <span
              key={t.key}
              title={t.tip}
              className="cursor-not-allowed whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-muted/60"
            >
              {t.label}
            </span>
          );
        }
        return (
          <Link
            key={t.key}
            href={qs ? `${t.href}?${qs}` : t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-white text-primary shadow-[0_1px_2px_rgb(15_23_42_/_0.08)] ring-1 ring-[var(--lv-border)]"
                : "text-secondary hover:bg-white/60 hover:text-ink"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
