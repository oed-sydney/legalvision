import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { windsorConfigured } from "@/lib/adapters/windsor-rest";
import { syncGoogleLive } from "@/lib/data/live-sync";
import { refreshTermsCache } from "@/lib/data/live-terms";
import { refreshBudgetLost } from "@/lib/data/budget-lost";
import { refreshPlanCache } from "@/lib/plan/metrics";
import { writeSyncState } from "@/lib/data/sync-state";
import { runBudgetAlerts } from "@/lib/alerts/run";
import { metaConfigured } from "@/lib/adapters/meta-rest";
import { refreshMetaCache } from "@/lib/data/live-meta";
import { runAutopace, runAutoProtect } from "@/lib/pacing/autopace";

// The live pull + terms + plan can take ~40s; allow headroom.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Scheduled daily refresh (Vercel Cron → see vercel.json). Pulls fresh Google data,
 * refreshes the keyword/QS + plan caches (which also captures the daily QS snapshot so
 * per-keyword history accrues), and re-stamps freshness. Idempotent.
 *
 * Guarded by CRON_SECRET when set: Vercel automatically sends
 * `Authorization: Bearer <CRON_SECRET>` to cron routes. If CRON_SECRET is unset the
 * route still runs (it only refreshes data), but setting it is recommended.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Live Meta pull FIRST — fast + independent, so it refreshes even if Windsor is missing or
  // slow. Best-effort; the Social tab falls back to the baked snapshot on any failure.
  if (metaConfigured()) {
    try {
      await refreshMetaCache("last_30d");
    } catch {}
  }

  if (!windsorConfigured()) {
    // Meta still refreshed above; stamp so the freshness clock advances.
    try {
      await writeSyncState({ lastSyncedAt: now, mode: "live", rowsGoogle: 0, note: "Scheduled Meta refresh (Google not configured)." });
    } catch {}
    try {
      ["/meta"].forEach((p) => revalidatePath(p));
    } catch {}
    return NextResponse.json({ ok: true, mode: "live", meta: true, google: false, syncedAt: now });
  }

  try {
    const { rows, days } = await syncGoogleLive("last_90d");
    // Best-effort: keyword/QS + plan caches (terms refresh also captures the QS snapshot).
    try {
      await refreshTermsCache();
    } catch {}
    try {
      await refreshBudgetLost();
    } catch {}
    try {
      await refreshPlanCache();
    } catch {}
    // Budget-pacing email alerts — evaluated after data is fresh (no-op unless configured).
    try {
      await runBudgetAlerts();
    } catch {}
    // Meta auto-pacing — applies budget changes only in "auto" mode (no-op otherwise).
    try {
      await runAutopace();
    } catch {}
    // AutoProtect — pauses/re-enables at the spend cap (no-op unless enabled).
    try {
      await runAutoProtect();
    } catch {}
    await writeSyncState({
      lastSyncedAt: now,
      mode: "live",
      rowsGoogle: rows,
      note: `Scheduled refresh: ${rows} rows across ${days} days.`,
    });
    ["/overview", "/pacing", "/google", "/quality", "/meta", "/leads", "/plan"].forEach((p) =>
      revalidatePath(p)
    );
    return NextResponse.json({ ok: true, mode: "live", rowsGoogle: rows, days, syncedAt: now });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Refresh failed" },
      { status: 502 }
    );
  }
}
