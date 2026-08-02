# OPS RUNBOOK — LegalVision Reporting Dashboard

Operational procedures for the agency. Client-facing errors never expose vendors, stacks or credentials.

## Sync schedule (Framework §20)

| Source | Cadence | Window | Restatement |
|---|---|---|---|
| Google insights / conv. actions / keywords (Windsor) | every 6h (04/10/16/22 AEST) | yesterday + today-partial | nightly rolling 30d re-import |
| Google search terms | nightly | trailing 7d | weekly 30d reconcile |
| Google QS snapshot | daily after 06:00 account-local | today's values | immutable snapshots |
| Meta insights | every 6h | yesterday + today-partial | nightly rolling 28d re-import |
| Meta creatives/thumbnails | daily + on cache-miss | changed creatives | hash-diffed |
| FX (ECB) | daily 07:00 AEST | latest ECB day | carry-forward ≤7d flagged |
| Live-lead source | TBD (hourly if API, else daily) | incremental by updated_at | 30d status re-check |

Mechanics: idempotent upserts on natural keys (re-running any window is safe); chunked per account × report × ≤31-day window with checkpoints in `sync_runs`; retries ×3 exponential backoff + jitter; 429/quota-aware. Cron routes are guarded by `CRON_SECRET`.

## Sync failure

1. Freshness chip degrades (amber >12h, red >36h) and affected widgets show a per-account "data through {date}" note.
2. After **2 consecutive failures**, a notification goes to `ALERT_NOTIFY_EMAIL` (and Slack webhook if set).
3. Triage: **Admin → Sync logs** for the error + last checkpoint. Re-run the failed window (idempotent). If a chunk repeatedly fails, narrow the window; the checkpoint resumes where it stopped.
4. If Windsor is degraded: the app keeps serving the last good Postgres data (freshness degrades, app does not). The direct-API adapters are the documented exit path.

## Re-authentication

- **Meta token expired/rotated:** update `META_SYSTEM_USER_TOKEN`, redeploy, then Admin → Connections → Refresh for the affected accounts.
- **Windsor key rotated:** update `WINDSOR_API_KEY`, redeploy.
- **Meta NZ (A11):** create a system user in the Business Manager with access to all three Meta ad accounts (`ads_read`); replace the personal-profile token. NZ shows a "pending" banner until then.

## Backfill

- Admin → Connections → Backfill (per account) or the backfill cron route. Runs the same pipeline month-by-month oldest-first (24mo Google, ~24–37mo Meta). Progress is visible from `sync_runs`. QS trends mature over the first 60–90 days (snapshots only accrue forward).

## FX staleness

- If ECB rates are stale >7 days, All-markets converted views degrade to native-per-row with a banner; native currency is always ground truth. Fix by re-running the FX job (no key needed).

## Secret rotation

- All secrets are server-side env only (never `NEXT_PUBLIC_*`). Rotate in Vercel env → redeploy. Nothing sensitive is in the repo. Confirm via a bundle/network audit that no secret reaches the browser.

## Backups & restore

- Supabase PITR (7-day minimum) + nightly logical dump to separate storage. **RPO ≤ 24h, RTO ≤ 4h.** Quarterly restore drill.
- Fact data is additionally recoverable by re-running backfills from the source APIs (documented above) — the DB is the source of truth but not the only recovery path.

## Health

- `/api/health` checks DB connectivity, last-sync age, and FX age. Sentry (client + server, PII/secret-scrubbed) captures widget-level failures without taking down the page.

## Mock-isolation invariant (must never regress)

- A production-path query must never return `source='mock'`. Guarded by the view layer (`MOCK_MODE=false` in staging/prod) and asserted in tests. If mock rows ever appear in a staging report, `MOCK_MODE` is misconfigured — set it to `false` and redeploy.
