import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { readSyncState, writeSyncState } from "@/lib/data/sync-state";
import { windsorConfigured } from "@/lib/adapters/windsor-rest";
import { syncGoogleLive } from "@/lib/data/live-sync";
import { refreshPlanCache } from "@/lib/plan/metrics";
import { refreshTermsCache } from "@/lib/data/live-terms";
import { refreshBudgetLost } from "@/lib/data/budget-lost";

/**
 * Refresh endpoint powering the top-bar "Refresh" button.
 * - With WINDSOR_API_KEY set: performs a live Windsor REST pull of Google performance
 *   (proves connectivity + returns fresh row counts) and stamps the sync time.
 * - Without the key: re-stamps the freshness clock against the current snapshot.
 * Meta live refresh runs through the Meta profile connection (system-user token) once
 * META_SYSTEM_USER_TOKEN is provided.
 */
// The live Windsor pull can take ~30s; allow headroom on serverless.
export const maxDuration = 60;

export async function POST() {
  const now = new Date().toISOString();
  try {
    if (windsorConfigured()) {
      const { rows, days } = await syncGoogleLive("last_90d"); // 90d → enables period comparisons
      await refreshPlanCache(); // 90-day-plan monthly KPIs (plan start → today)
      // search-term/keyword-QS snapshot + per-campaign budget-lost — best-effort.
      try {
        await refreshTermsCache();
      } catch {}
      try {
        await refreshBudgetLost();
      } catch {}
      await writeSyncState({
        lastSyncedAt: now,
        mode: "live",
        rowsGoogle: rows,
        note: `Live Windsor pull: ${rows} rows across ${days} days.`,
      });
      ["/overview", "/pacing", "/google", "/meta", "/leads", "/plan"].forEach((p) => revalidatePath(p));
      return NextResponse.json({ ok: true, mode: "live", rowsGoogle: rows, days, syncedAt: now });
    }
    const prev = await readSyncState();
    await writeSyncState({
      ...prev,
      lastSyncedAt: now,
      mode: "snapshot",
      note: "Snapshot re-validated. Add WINDSOR_API_KEY for a live Google pull.",
    });
    return NextResponse.json({
      ok: true,
      mode: "snapshot",
      syncedAt: now,
      hint: "Set WINDSOR_API_KEY to enable live Google refresh; META_SYSTEM_USER_TOKEN for Meta.",
    });
  } catch (err) {
    // Live pull needs a writable cache; on read-only serverless hosts it can't persist.
    // Degrade to a snapshot re-stamp so the button still succeeds against baked data.
    try {
      const prev = await readSyncState();
      await writeSyncState({
        ...prev,
        lastSyncedAt: now,
        mode: "snapshot",
        note: "Live refresh unavailable in this environment — serving the latest snapshot.",
      });
      ["/overview", "/pacing", "/google", "/meta", "/leads", "/plan"].forEach((p) => revalidatePath(p));
      return NextResponse.json({
        ok: true,
        mode: "snapshot",
        syncedAt: now,
        note: "Live refresh unavailable here; snapshot re-validated.",
        detail: err instanceof Error ? err.message : undefined,
      });
    } catch (err2) {
      return NextResponse.json(
        { ok: false, error: err2 instanceof Error ? err2.message : "Sync failed" },
        { status: 502 }
      );
    }
  }
}

export async function GET() {
  return NextResponse.json(await readSyncState());
}
