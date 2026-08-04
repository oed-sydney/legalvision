# Deploying to Vercel

This app is a Next.js 16 app. Deploying it is: import the repo into Vercel, set the
environment variables, deploy, then attach your domain.

## 1. Import the repo
Vercel → **Add New… → Project** → import this GitHub repo. Vercel auto-detects Next.js —
leave Framework Preset, Build Command, and Output Directory at their defaults.

## 2. Environment variables (required)
Add these under **Settings → Environment Variables** for **Production** (and Preview).
The real values are supplied separately by your agency — they are secrets and are not in
this repo. See `.env.example` for the full annotated list.

| Variable | Notes |
|---|---|
| `MOCK_MODE` | `false` |
| `USE_REAL_DATA` | `true` |
| `WINDSOR_API_KEY` | Google Ads live pull (Windsor.ai) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (safe to expose) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only secret** — bypasses RLS, never expose |
| `DATABASE_URL` | Supabase **pooler** string (port 6543, `?pgbouncer=true`) |
| `DIRECT_URL` | Supabase **direct** string (port 5432) |

Optional: `META_SYSTEM_USER_TOKEN` (live Meta data; without it Meta uses an estimate).

## 3. Deploy
Trigger the first deployment. Every push to the default branch auto-deploys after this.

## 4. Domain
Vercel → **Settings → Domains** → add your hostname (e.g. `reporting.yourdomain.com`).
Vercel shows the exact **CNAME** record to add at your DNS provider. Add it; the domain
goes live once DNS propagates.

## 5. Deployment Protection (important for a client-facing app)
If your Vercel team has **Deployment Protection / Vercel Authentication** on by default,
turn it **off** for this project (Settings → Deployment Protection) — otherwise visitors
are blocked by Vercel's own login. The app already has its own Supabase login gate, so it
stays protected.

## Notes
- The database, auth, and saved data live in **Supabase** (unchanged by this deploy).
- Data refreshes when a user clicks **Refresh** in the app; a scheduled daily refresh can
  be added later.
- Local dev: copy `.env.example` → `.env.local`, fill values, `npm install`, `npm run dev`.
