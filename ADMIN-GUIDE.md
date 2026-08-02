# ADMIN GUIDE — LegalVision Reporting Dashboard

For LegalVision-side and agency administrators. All admin actions are audit-logged; MFA is required for admin accounts.

## Users & roles (`/admin` → Users & roles)

- **Roles:** Administrator (everything, MFA required), Internal (all reporting + exports + annotations), Client (scoped reporting + approved exports; optional lead-record flag), Read-only (snapshot pages + pacing, limited filters, no exports).
- **Invite a user:** enter name/email/role → optional market/account/channel scope (empty = full access for the role) → optional lead-record access → send. Invite links expire in 7 days.
- **Deactivate:** revokes refresh tokens immediately. Role/scope changes take effect on the next request (checked server-side, not just at login).
- Scopes are an **allow-list**: adding any scope row restricts the user to those markets/accounts/channels. Enforcement is server-side via RLS — hiding UI is cosmetic only.

## Budgets (`/admin` → Budgets)

- Enter one monthly budget per account (calendar month, account-local). CSV import for bulk entry; full change history (who/when/old→new).
- **Mid-period changes** use the latest budget for the whole period and are annotated on the cumulative pacing chart.
- Campaign budgets are optional; where absent, the campaign pacing tab derives a budget from the platform daily budget × days and labels it **derived** (never mixed silently with entered budgets).

## Targets (`/admin` → Targets)

- Set CPLL, CPL, live-lead volume/rate, impression share, min QS, max frequency at global / market / account / campaign level.
- **Resolution order:** campaign › account › market › global. The effective-target preview shows which level wins.
- Unset targets render **"No target"** on status pills — never a fabricated default. Under-delivering status and target-based alerts only evaluate where a target exists.

## Live Leads mapping (the #1 correctness feature — A1)

- The "Live Leads" metric is defined by the conversion action(s) mapped to it per Google account (default action name `Live Leads`).
- If an account spells it differently, map the correct action(s) in Admin; the model supports N:1 mapping.
- **Conversions, Leads and Live Leads are always three separate columns.** Live Leads is never inferred from totals.

## Alert rules (`/admin` → Alert rules)

- Rule templates are seeded (§21) with admin-editable thresholds per scope. Volume floors are mandatory (prevents noise on tiny denominators).
- One open alert per (rule, entity); re-triggers update the value, not duplicates. Config gaps (no budget/target, unmapped action) are **setup checklist items, not alerts**.
- Client-visibility flag per rule controls whether client users see the derived status.

## Connections & sync (`/admin` → Connections)

- Per-source status, last sync age, row counts, errors. **Refresh now** is rate-limited to 1 / 15 min per source.
- **Backfill** trigger re-runs history month-by-month. Meta NZ shows blocked until a Business-Manager system-user token is provided (A11).

## Settings (`/admin` → Settings)

- Reporting currency (default AUD), FX source status, pacing basis (completed-days default; partial-day toggle), feature flags, and **branding upload** (SVG/PNG light+dark; SVG sanitised server-side before storage; rendered at fixed heights so a swapped logo never reflows).

## The four-task handover test (Framework §28-P17)

A non-builder admin should be able to, using this guide alone: **add a user**, **set a budget**, **change a target**, and **read a sync log**.
