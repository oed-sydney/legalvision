import { Suspense } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { MobileNav } from "@/components/shell/MobileNav";
import { FilterBar, type AccountOpt, type CampaignOpt } from "@/components/shell/FilterBar";
import { FreshnessChip } from "@/components/shell/FreshnessChip";
import { RefreshButton } from "@/components/shell/RefreshButton";
import { AD_ACCOUNTS } from "@/lib/domain/accounts";
import { campaignMetas } from "@/lib/data/source";
import { syncRuns, hoursSince } from "@/lib/data/ops";
import { readSyncState } from "@/lib/data/sync-state";
import { UserMenu } from "@/components/shell/UserMenu";
import { getSessionProfile } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  const accounts: AccountOpt[] = AD_ACCOUNTS.map((a) => ({
    id: a.id,
    label: `${a.name} · ${a.channel === "google_ads" ? "Google" : "Meta"}`,
    market: a.market,
    channel: a.channel,
  }));
  const campaigns: CampaignOpt[] = campaignMetas().map((c) => ({
    id: c.id,
    label: c.name,
    market: c.account.market,
    channel: c.account.channel,
    type: c.type,
  }));

  const runs = syncRuns();
  const sync = await readSyncState();
  // Freshness relative to the last refresh (real wall-clock), falling back to snapshot time.
  const lastSyncedHours = Math.max(0, (Date.now() - new Date(sync.lastSyncedAt).getTime()) / 3_600_000);
  const sources = runs
    .filter((r) => r.source === "google_ads" || r.source === "meta_ads" || r.source === "fx" || r.source === "live_leads")
    .map((r) => ({
      label: r.label,
      finishedAt: r.finishedAt,
      hoursSince: hoursSince(r.finishedAt),
      status: r.status,
    }));

  return (
    <div className="flex min-h-screen">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col pb-14 lg:pb-0">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-[var(--lv-border)] bg-white px-4">
          <div className="lg:hidden">
            <span className="text-[15px] font-bold text-primary">LegalVision</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <RefreshButton />
            <Suspense fallback={null}>
              <FreshnessChip oldestHours={lastSyncedHours} sources={sources} />
            </Suspense>
            {profile && (
              <UserMenu name={profile.name} email={profile.email} role={profile.role} />
            )}
          </div>
        </header>

        <Suspense fallback={<div className="h-14 border-b border-[var(--lv-border)] bg-white" />}>
          <FilterBar accounts={accounts} campaigns={campaigns} />
        </Suspense>

        <main id="main" className="flex-1 overflow-x-hidden px-4 py-6 lg:px-6">
          {children}
        </main>
      </div>
      <Suspense fallback={null}>
        <MobileNav />
      </Suspense>
    </div>
  );
}
