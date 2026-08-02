import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { PanelTabs } from "@/components/ui/PanelTabs";
import { StatusPill } from "@/components/ui/StatusPill";
import { AD_ACCOUNTS, marketName } from "@/lib/domain/accounts";
import { targets } from "@/lib/data/mock";
import { allBudgets as budgets } from "@/lib/data/budgets-store";
import { syncRuns, users, hoursSince } from "@/lib/data/ops";
import { BudgetEditor } from "@/components/admin/BudgetEditor";

const ROLE_TONE = { admin: "info", internal: "success", client: "purple", viewer: "grey" } as const;

export default function AdminPage() {
  const budgetRows = budgets();
  const targetRows = targets();
  const userRows = users();
  const runs = syncRuns();

  return (
    <div>
      <PageHeader title="Admin" subtitle="Administrators only · all enforcement is server-side (RLS deny-by-default + route guards)" />
      <PanelTabs
        tabs={[
          {
            key: "users",
            label: "Users & roles",
            panel: (
              <Card>
                <CardTitle action={<button className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-white">Invite user</button>}>
                  Users &amp; roles
                </CardTitle>
                <Table
                  head={["Name", "Email", "Role", "Scope", "Lead records", "Status", "Last login"]}
                  rows={userRows.map((u) => [
                    u.name,
                    u.email,
                    <StatusPill key={u.id} tone={ROLE_TONE[u.role]} dot={false}>{u.role}</StatusPill>,
                    u.scopes.length ? u.scopes.join(", ") : "All",
                    u.leadRecordAccess ? "Yes" : "No",
                    <StatusPill key={u.id + "s"} tone={u.status === "active" ? "success" : u.status === "invited" ? "warning" : "grey"} dot={false}>{u.status}</StatusPill>,
                    u.lastLoginAt ? new Date(u.lastLoginAt).toISOString().slice(0, 10) : "—",
                  ])}
                />
              </Card>
            ),
          },
          {
            key: "budgets",
            label: "Budgets",
            panel: (
              <Card>
                <CardTitle action={<span className="text-[12px] text-muted">Editable per account · feeds pacing live</span>}>
                  Monthly budgets (July 2026)
                </CardTitle>
                <BudgetEditor
                  rows={budgetRows.map((b) => {
                    const acct = AD_ACCOUNTS.find((a) => a.id === b.scopeId)!;
                    return {
                      accountId: acct.id,
                      accountLabel: acct.name,
                      market: marketName(acct.market),
                      channel: acct.channel === "google_ads" ? "Google" : "Meta",
                      currency: b.currency,
                      amount: b.amount,
                    };
                  })}
                />
              </Card>
            ),
          },
          {
            key: "targets",
            label: "Targets",
            panel: (
              <Card>
                <CardTitle action={<span className="text-[12px] text-muted">Resolution: campaign › account › market › global</span>}>
                  Targets
                </CardTitle>
                <Table
                  head={["Scope", "Scope value", "Metric", "Value"]}
                  rows={targetRows.map((t) => [
                    t.scopeType,
                    t.scopeId ? marketName(t.scopeId) : "—",
                    t.metric.toUpperCase().replace("_", " "),
                    t.metric === "cpll" || t.metric === "cpl" ? `A$${t.value}` : String(t.value),
                  ])}
                />
                <p className="mt-3 text-[11px] text-muted">Unset targets render &quot;No target&quot; on pills rather than fabricated defaults.</p>
              </Card>
            ),
          },
          {
            key: "connections",
            label: "Connections",
            panel: (
              <Card>
                <CardTitle>Connections &amp; sync</CardTitle>
                <Table
                  head={["Source", "Status", "Last sync", "Rows", "Action"]}
                  rows={runs.map((r) => [
                    r.label,
                    <StatusPill key={r.label} tone={r.status === "ok" ? "success" : r.status === "partial" ? "warning" : r.status === "failed" ? "danger" : "grey"} dot={false}>{r.status}</StatusPill>,
                    `${Math.round(hoursSince(r.finishedAt))}h ago`,
                    r.rowsUpserted.toLocaleString(),
                    <button key={r.label + "b"} className="rounded border border-[var(--lv-border)] px-2 py-0.5 text-[12px] text-secondary hover:bg-canvas">Refresh</button>,
                  ])}
                />
                <p className="mt-3 text-[11px] text-muted">Manual refresh rate-limited to 1 / 15 min per source. Meta NZ is blocked pending a Business-Manager system-user token (A11).</p>
              </Card>
            ),
          },
          {
            key: "settings",
            label: "Settings",
            panel: (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                  <CardTitle>Reporting</CardTitle>
                  <dl className="space-y-2 text-[13px]">
                    <SettingRow k="Reporting currency" v="AUD (A3)" />
                    <SettingRow k="FX source" v="ECB daily via frankfurter.app · fresh" />
                    <SettingRow k="Budget period" v="Calendar month, account-local (A5)" />
                    <SettingRow k="Pacing basis" v="Completed days (admin-toggle to partial)" />
                  </dl>
                </Card>
                <Card>
                  <CardTitle>Branding</CardTitle>
                  <div className="flex items-center gap-3 rounded-lg border border-[var(--lv-border)] bg-canvas p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/lv-logo-navy.svg" alt="LegalVision" style={{ height: 20 }} />
                    <span className="text-[12px] text-muted">SVG sanitised server-side (SVGO + script/foreignObject stripping) before storage.</span>
                  </div>
                  <button className="mt-3 rounded-md border border-[var(--lv-border)] px-3 py-1.5 text-[13px] font-medium text-secondary hover:bg-canvas">Upload logo (light / dark)</button>
                </Card>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto lv-scroll">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--lv-border)] text-[11px] uppercase tracking-wide text-secondary">
            {head.map((h, i) => (
              <th key={i} className={`px-3 py-2 ${i === 0 ? "pl-0 text-left" : "text-left"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-[var(--lv-border)] last:border-0">
              {r.map((cell, ci) => (
                <td key={ci} className={`px-3 py-2.5 ${ci === 0 ? "pl-0 font-medium text-ink" : "text-secondary"}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--lv-border)] pb-2 last:border-0">
      <dt className="text-secondary">{k}</dt>
      <dd className="font-medium text-ink">{v}</dd>
    </div>
  );
}

export const dynamic = "force-dynamic";
