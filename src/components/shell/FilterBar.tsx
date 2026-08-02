"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { SlidersHorizontal, RotateCcw, X } from "lucide-react";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  applyCascade,
  parseFilters,
  serializeFilters,
  type FilterState,
} from "@/lib/filters/schema";

export interface AccountOpt {
  id: string;
  label: string;
  market: string;
  channel: string;
}
export interface CampaignOpt {
  id: string;
  label: string;
  market: string;
  channel: string;
  type: string;
}

const RANGE_OPTS: [FilterState["range"], string][] = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["last7d", "Last 7 days"],
  ["last14d", "Last 14 days"],
  ["last30d", "Last 30 days"],
  ["this_month", "This month"],
  ["last_month", "Last month"],
  ["this_quarter", "This quarter"],
  ["last_quarter", "Last quarter"],
  ["ytd", "Year to date"],
];

const CMP_OPTS: [FilterState["cmp"], string][] = [
  ["prev_period", "Previous period"],
  ["prev_month", "Previous month"],
  ["prev_year", "Previous year"],
  ["none", "No comparison"],
];

export function FilterBar({
  accounts,
  campaigns,
}: {
  accounts: AccountOpt[];
  campaigns: CampaignOpt[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const isPacing = pathname.startsWith("/pacing");

  const filters = useMemo(() => parseFilters(search), [search]);
  const isAdmin = pathname.startsWith("/admin");

  // Restore from localStorage when the URL carries no filter state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (search.toString().length === 0) {
      const saved = window.localStorage.getItem("lv:filters");
      if (saved) router.replace(`${pathname}?${saved}`);
    }
  }, [pathname, router, search]);

  const commit = (patch: Partial<FilterState>) => {
    const next = applyCascade({ ...filters, ...patch });
    const qs = serializeFilters(next);
    if (typeof window !== "undefined") window.localStorage.setItem("lv:filters", qs);
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const reset = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem("lv:filters");
    router.push(pathname);
  };

  const accountOpts = accounts.filter(
    (a) =>
      (filters.country === "all" || a.market === filters.country) &&
      (filters.channel === "all" || a.channel === filters.channel)
  );
  const campaignOpts = campaigns.filter(
    (c) =>
      (filters.country === "all" || c.market === filters.country) &&
      (filters.channel === "all" || c.channel === filters.channel) &&
      (filters.account === "all" || accounts.find((a) => a.id === filters.account)?.market === c.market)
  );
  const ctypeOpts = Array.from(new Set(campaignOpts.map((c) => c.type)));
  const count = activeFilterCount(filters);

  // Global filter bar is excluded on Admin (§5).
  if (isAdmin) return null;

  return (
    <div className="flex h-14 items-center gap-2 overflow-x-auto border-b border-[var(--lv-border)] bg-white px-4 lv-scroll">
      <Select
        label="Date"
        value={filters.range}
        disabled={isPacing}
        onChange={(v) => commit({ range: v as FilterState["range"] })}
        options={RANGE_OPTS}
        title={isPacing ? "Pacing uses budget periods — date range does not apply here" : undefined}
      />
      <Select
        label="Compare"
        value={filters.cmp}
        disabled={isPacing}
        onChange={(v) => commit({ cmp: v as FilterState["cmp"] })}
        options={CMP_OPTS}
      />
      <Select
        label="Country"
        value={filters.country}
        onChange={(v) => commit({ country: v, account: "all", campaign: "all" })}
        options={[["all", "All markets"], ["AU", "Australia"], ["UK", "United Kingdom"], ["NZ", "New Zealand"]]}
      />
      <Select
        label="Channel"
        value={filters.channel}
        onChange={(v) => commit({ channel: v, account: "all", campaign: "all" })}
        options={[["all", "All channels"], ["google_ads", "Google Ads"], ["meta_ads", "Meta Ads"]]}
      />
      <Select
        label="Account"
        value={filters.account}
        onChange={(v) => commit({ account: v, campaign: "all" })}
        options={[["all", "All accounts"], ...accountOpts.map((a) => [a.id, a.label] as [string, string])]}
      />

      <Popover.Root>
        <Popover.Trigger asChild>
          <button className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[var(--lv-border)] bg-white px-2.5 text-[13px] font-medium text-secondary hover:bg-canvas">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            More
            {count > 0 && (
              <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white tnum">
                {count}
              </span>
            )}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={8}
            className="z-50 w-72 space-y-3 rounded-lg border border-[var(--lv-border)] bg-white p-4 shadow-xl"
          >
            <div className="text-[12px] font-semibold uppercase tracking-wide text-secondary">More filters</div>
            <StackSelect
              label="Campaign"
              value={filters.campaign}
              onChange={(v) => commit({ campaign: v })}
              options={[["all", "All campaigns"], ...campaignOpts.map((c) => [c.id, c.label] as [string, string])]}
            />
            <StackSelect
              label="Campaign type"
              value={filters.ctype}
              onChange={(v) => commit({ ctype: v })}
              options={[["all", "All types"], ...ctypeOpts.map((t) => [t, t] as [string, string])]}
            />
            <StackSelect
              label="Device"
              value={filters.device}
              onChange={(v) => commit({ device: v })}
              options={[["all", "All devices"], ["desktop", "Desktop"], ["mobile", "Mobile"], ["tablet", "Tablet"]]}
            />
            <StackSelect
              label="Network / Placement"
              value={filters.network}
              onChange={(v) => commit({ network: v })}
              options={[
                ["all", "All"],
                ["search", "Search"],
                ["search_partners", "Search partners"],
                ["display", "Display"],
                ["youtube", "YouTube"],
              ]}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {count > 0 && (
        <button
          onClick={reset}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-secondary hover:text-danger"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      )}

      {isPacing && (
        <span className="ml-auto shrink-0 rounded-full bg-primary-subtle px-2.5 py-1 text-[11px] font-medium text-primary">
          Pacing uses budget periods — global date range does not apply
        </span>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  disabled,
  title,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <label className="flex shrink-0 items-center gap-1.5" title={title}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-[var(--lv-border)] bg-white px-2 text-[13px] font-medium text-ink outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function StackSelect(props: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-secondary">{props.label}</span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-[var(--lv-border)] bg-white px-2 text-[13px] outline-none focus:border-primary"
      >
        {props.options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export { DEFAULT_FILTERS, X };
