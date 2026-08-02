import type { Alert, AppUser, SyncRun } from "../domain/types";
import { AD_ACCOUNTS } from "../domain/accounts";
import { APP_NOW } from "./mock";

/** Seeded alerts across the rule templates (§21) — fire + auto-resolve on fixtures. */
export function alerts(): Alert[] {
  return [
    {
      id: "al1",
      ruleCode: "spend_no_live_leads",
      severity: "critical",
      market: "NZ",
      channel: "google_ads",
      entityType: "campaign",
      entityName: "NZ · Franchising — Display",
      reason: "Spend NZ$540 in period with 0 live leads",
      currentValue: "0 live leads",
      thresholdValue: "> NZ$500 spend",
      status: "open",
      triggeredAt: "2026-07-13T05:12:00Z",
    },
    {
      id: "al2",
      ruleCode: "cpll_over_target",
      severity: "warning",
      market: "AU",
      channel: "meta_ads",
      entityType: "campaign",
      entityName: "AU · Employment Law — Leads",
      reason: "CPLL A$312 is 130% of target (A$240) over 7 days",
      currentValue: "A$312",
      thresholdValue: "> A$276 (115%)",
      status: "open",
      triggeredAt: "2026-07-13T05:12:00Z",
    },
    {
      id: "al3",
      ruleCode: "conversion_action_drop",
      severity: "critical",
      market: "UK",
      channel: "google_ads",
      entityType: "account",
      entityName: "LegalVision UK",
      reason: 'Mapped "Live Leads" action −74% vs 14-day average (tracking suspected)',
      currentValue: "3/day",
      thresholdValue: "−70% vs 11/day",
      status: "open",
      triggeredAt: "2026-07-12T06:00:00Z",
    },
    {
      id: "al4",
      ruleCode: "meta_frequency_high",
      severity: "warning",
      market: "AU",
      channel: "meta_ads",
      entityType: "creative",
      entityName: "Employment Law Hero v2",
      reason: "Frequency 3.8 over trailing 30 days",
      currentValue: "3.8",
      thresholdValue: "> 3.0",
      status: "open",
      triggeredAt: "2026-07-11T05:12:00Z",
    },
    {
      id: "al5",
      ruleCode: "lost_is_budget",
      severity: "warning",
      market: "AU",
      channel: "google_ads",
      entityType: "campaign",
      entityName: "AU · Business Structuring — Search",
      reason: "Lost IS (budget) 24% over trailing 7 days",
      currentValue: "24%",
      thresholdValue: "> 20%",
      status: "open",
      triggeredAt: "2026-07-13T05:12:00Z",
    },
    {
      id: "al6",
      ruleCode: "qs_low_high_spend",
      severity: "warning",
      market: "UK",
      channel: "google_ads",
      entityType: "keyword",
      entityName: "trade marks solicitor",
      reason: "QS 4 on a top-20% spend keyword",
      currentValue: "QS 4",
      thresholdValue: "≤ 4",
      status: "open",
      triggeredAt: "2026-07-10T06:00:00Z",
    },
    {
      id: "al7",
      ruleCode: "pacing_over_budget",
      severity: "warning",
      market: "AU",
      channel: "google_ads",
      entityType: "account",
      entityName: "LegalVision (AU Google)",
      reason: "Projected spend 112% of monthly budget",
      currentValue: "112%",
      thresholdValue: "> 110%",
      status: "acknowledged",
      triggeredAt: "2026-07-09T06:00:00Z",
    },
  ];
}

/** Per-source freshness / sync history (§20). */
export function syncRuns(): SyncRun[] {
  const runs: SyncRun[] = [];
  for (const acct of AD_ACCOUNTS) {
    const label = `${acct.name} (${acct.channel === "google_ads" ? "Google" : "Meta"})`;
    const pending = acct.status === "pending_access";
    runs.push({
      source: acct.channel,
      label,
      accountId: acct.id,
      status: pending ? "failed" : acct.id === "uk-google" ? "partial" : "ok",
      finishedAt: pending
        ? "2026-07-08T04:00:00Z"
        : acct.id === "uk-google"
          ? "2026-07-14T00:10:00Z"
          : "2026-07-14T00:05:00Z",
      rowsUpserted: pending ? 0 : 900 + (acct.id.length * 37),
    });
  }
  runs.push({
    source: "fx",
    label: "FX rates (ECB via frankfurter.app)",
    accountId: null,
    status: "ok",
    finishedAt: "2026-07-13T21:00:00Z",
    rowsUpserted: 2,
  });
  runs.push({
    source: "live_leads",
    label: "Live-lead source (CRM)",
    accountId: null,
    status: "failed",
    finishedAt: "2026-07-01T00:00:00Z",
    rowsUpserted: 0,
  });
  return runs;
}

export function oldestFreshness(): { finishedAt: string; label: string } {
  const active = syncRuns().filter(
    (r) => r.source === "google_ads" || r.source === "meta_ads"
  );
  active.sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  return { finishedAt: active[0].finishedAt, label: active[0].label };
}

export function hoursSince(iso: string): number {
  return (APP_NOW.getTime() - new Date(iso).getTime()) / 3_600_000;
}

/** Seeded users (one admin + a few) for the Admin → Users view. */
export function users(): AppUser[] {
  return [
    {
      id: "u1",
      email: "agency@zeemarketing.com",
      name: "Zee Marketing (Agency)",
      role: "admin",
      status: "active",
      scopes: [],
      leadRecordAccess: true,
      lastLoginAt: "2026-07-14T08:30:00Z",
    },
    {
      id: "u2",
      email: "cmo@legalvision.com.au",
      name: "LegalVision CMO",
      role: "client",
      status: "active",
      scopes: [],
      leadRecordAccess: true,
      lastLoginAt: "2026-07-13T22:10:00Z",
    },
    {
      id: "u3",
      email: "au.lead@legalvision.com.au",
      name: "AU Marketing Lead",
      role: "client",
      status: "active",
      scopes: ["market:AU"],
      leadRecordAccess: false,
      lastLoginAt: "2026-07-12T04:00:00Z",
    },
    {
      id: "u4",
      email: "uk.manager@legalvision.co.uk",
      name: "UK Marketing Manager",
      role: "client",
      status: "invited",
      scopes: ["market:UK"],
      leadRecordAccess: false,
      lastLoginAt: null,
    },
    {
      id: "u5",
      email: "board@legalvision.com.au",
      name: "Board (Read-only)",
      role: "viewer",
      status: "active",
      scopes: [],
      leadRecordAccess: false,
      lastLoginAt: "2026-07-10T09:00:00Z",
    },
  ];
}
