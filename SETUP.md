# SETUP — LegalVision Reporting Dashboard

## 0. Prerequisites

- Node.js 22 (built with v22.17.0). This machine's copy: `~/.local/runtime/node-v22.17.0-darwin-arm64/bin`.
- npm 10+.
- (For real data) a Supabase project in `ap-southeast-2`, a Windsor.ai paid plan, and a Meta system-user token.

## 1. First run (mock mode — no credentials)

```bash
npm install
cp .env.example .env.local      # MOCK_MODE=true is the default
npm run dev                     # http://localhost:3000
npm test                        # pacing golden tests (should be 12 passed)
```

Everything renders from the isolated mock warehouse. Mock rows are tagged `source='mock'`; setting `MOCK_MODE=false` makes the prod-path query layer structurally exclude them (`src/lib/data/warehouse.ts`).

## 2. Going live — required inputs (Framework §31)

Collect these before switching `MOCK_MODE=false`:

| Input | Env var / location | Blocking? |
|---|---|---|
| Windsor.ai paid-plan read key (`zeemarketing`) | `WINDSOR_API_KEY` | Google + Meta insights |
| Meta system-user token (Business Manager, AU/UK/NZ, `ads_read`) | `META_SYSTEM_USER_TOKEN` | **Meta NZ (A11)** + creative previews |
| Supabase project URL + keys | `NEXT_PUBLIC_SUPABASE_URL`, `..._ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL` | DB + auth |
| "Live Leads" action name per Google account | `LIVE_LEADS_ACTION_NAME_*` (seed) + Admin → mapping | Live-lead accuracy |
| Monthly budgets per account | Admin → Budgets (or CSV import) | Pacing |
| Targets (CPLL etc.) | Admin → Targets | Under-delivering status / alerts |
| Live-lead source system + credentials | `LEAD_SOURCE_*` | Meta live leads + Lead Quality v2 |
| User list + roles/scopes | Admin → Users | Access |
| Sentry DSN, cron secret, notify email | `SENTRY_DSN`, `CRON_SECRET`, `ALERT_NOTIFY_EMAIL` | Ops |

## 3. Database

```bash
# point DATABASE_URL / DIRECT_URL at the target Supabase project, then:
npx prisma migrate deploy         # apply migrations (schema per Framework §17)
npx prisma generate
# apply RLS policies (deny-by-default, join through user_scopes) — see migrations/rls.sql
```

The schema lives in `prisma/schema.prisma`; the Prisma 7 connection URL is read from `prisma.config.ts` (env `DATABASE_URL`). Every fact table carries a `source` column; production reads go through views that filter `source <> 'mock'`.

## 4. Backfill (24 months Google, ~24–37 Meta)

Run from **Admin → Connections → Backfill** or the cron backfill route. Backfill uses the same idempotent pipeline looped month-by-month oldest-first, per account × report × ≤31-day window, checkpointed in `sync_runs`. QS daily snapshots begin from first sync (history only accrues forward; earlier gaps render "no snapshot").

## 5. Environments

Separate Supabase projects + Vercel envs for `development` / `staging` / `production`. Prisma migrations run in CI before deploy. Mock data is dev-only; staging/prod set `MOCK_MODE=false`.

## 6. Verifying a data module before trusting it (Framework §6, guardrail 6)

Each module's go-live checklist: pull one real day, reconcile against the platform UI (≤1% tolerance; **Live Leads exact** vs Google's conversion-action report), then enable. Windsor quirk to respect: never combine `campaign_status` with metric fields in one query (stale-data bug) — fetch entity attributes separately (`WindsorGoogleAdapter.fetchEntities`).
