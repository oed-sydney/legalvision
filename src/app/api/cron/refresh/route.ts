import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { windsorConfigured } from "@/lib/adapters/windsor-rest";
import { syncGoogleLive } from "@/lib/data/live-sync";
import { refreshTermsCache } from "@/lib/data/live-terms";
import { refreshPlanCache } from "@/lib/plan/metrics";
import { writeSyncState } from "@/lib/data/sync-state";

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
  if (!windsorConfigured()) {
    return NextResponse.json({ ok: false, error: "WINDSOR_API_KEY not configured" }, { status: 200 });
  }

  try {
    const { rows, days } = await syncGoogleLive("last_90d");
    // Best-effort: keyword/QS + plan caches (terms refresh also captures the QS snapshot).
    try {
      await refreshTermsCache();
    } catch {}
    try {
      await refreshPlanCache();
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
