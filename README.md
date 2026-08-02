# LegalVision — Paid Media Reporting Dashboard

Secure, client-facing paid media reporting for **Australia, the United Kingdom and New Zealand** — one Google Ads and one Meta Ads account per market (six accounts). Executive snapshot + deep granular drill-down (down to keyword / search term / Quality-Score component on Google and ad/creative on Meta), with **budget pacing as a first-class feature**.

Built to the accompanying **Framework** (`LegalVision-Dashboard-Framework.md`, the authoritative product spec) and its Opus build prompt.

## Status of this build

This is a **functional application running on hard-isolated mock data**, architected so real integrations activate the moment credentials are supplied — no reporting-code changes required. What is live vs. what awaits inputs:

| Area | State |
|---|---|
| App shell, IA, URL filter engine, freshness, design tokens | ✅ built |
| Metric dictionary (single source of truth → tooltips) | ✅ built |
| **Cross-currency guard** (throws on unconverted mixed-currency sums) | ✅ built + used everywhere |
| **Pacing engine** (§8, timezone-aware, completed-days basis) | ✅ built + **12 golden tests pass to the cent** |
| Executive Overview, Budget Pacing, Google (+Quality Score), Meta, Lead Quality, Admin | ✅ built on mock warehouse |
| `source='mock'` isolation (prod-path excludes mock) | ✅ built |
| Adapter interfaces (Windsor G/M, Meta creative, FX, LeadSource) | ✅ interfaces + stubs; activate on credentials |
| Prisma schema (§17) + RLS model | ✅ schema migration-ready |
| Real sync pipeline, Supabase Auth/RLS enforcement, live reconciliation, full E2E/a11y suites, deployment | ⏳ require the §31 inputs (Windsor key, Meta system-user token, Supabase project, budgets, targets, user list) |

See `SETUP.md` for first-run, `ADMIN-GUIDE.md` and `OPS-RUNBOOK.md` for operations, and `.env.example` for every environment variable.

## Stack

Next.js 16 (App Router) · TypeScript · React 19 · Tailwind v4 (CSS-token design system) · Radix primitives · Recharts · TanStack Table/Virtual · Prisma → PostgreSQL (Supabase) · Zod · Vitest.

## Quick start

```bash
# Node 22 (this repo was built with v22.17.0)
npm install
npm run dev          # http://localhost:3000  (runs on mock data — no credentials needed)
npm test             # pacing golden tests
npx tsc --noEmit     # typecheck
```

## The five guardrails, and where they live

1. **Conversions ≠ Leads ≠ Live Leads** — three distinct columns everywhere. Live Leads come only from the mapped conversion action (`src/lib/data/mock.ts`; dictionary in `src/lib/metrics/dictionary.ts`).
2. **No unconverted mixed-currency sums** — `src/lib/currency/guard.ts` throws `MixedCurrencyError`; the only cross-currency path is `convertAndSum`, which flags results `estimated` → the UI renders `≈`.
3. **Meta live leads render "—", never 0** — until the `LeadSourceAdapter` lands (`src/lib/adapters/lead-source.ts`).
4. **Quality Score is keyword-derived** — impression-weighted with coverage %; no fabricated account-level QS (`src/lib/data/quality.ts`, `src/components/panels/QualityScorePanel.tsx`).
5. **Reach/Frequency non-additive** — computed per period, never summed (`src/app/(dashboard)/meta/page.tsx`).

## Layout

```
src/lib/domain      confirmed accounts, markets, channels, domain types
src/lib/metrics     metric dictionary (single source of truth) + value formatters (§6.8)
src/lib/currency    cross-currency guard + FX
src/lib/pacing      pacing engine (§8) + golden tests (§29.2)
src/lib/filters     URL filter engine (§7)
src/lib/data        mock warehouse (source-isolated), report builders, QS analytics
src/lib/adapters    SourceAdapter interface + Windsor/Meta/FX/LeadSource stubs
src/components       shell, ui primitives, charts, tables, panels
src/app/(dashboard)  overview · pacing · google · meta · leads · admin
prisma               schema (§17), migration-ready
```
