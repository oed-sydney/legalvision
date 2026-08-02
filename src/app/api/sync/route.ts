import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { readSyncState, writeSyncState } from "@/lib/data/sync-state";
import { windsorConfigured } from "@/lib/adapters/windsor-rest";
import { syncGoogleLive } from "@/lib/data/live-sync";
import { refreshPlanCache } from "@/lib/plan/metrics";
import { refreshTermsCache } from "@/lib/data/live-terms";

/**
 * Refresh endpoint powering the top-bar "Refresh" button.
 * - With WINDSOR_API_KEY set: performs a live Windsor REST pull of Google performance
 *   (proves connectivity + returns fresh row counts) and stamps the sync time.
 * - Without the key: re-stamps the freshness clock against the current snapshot.
 * Meta live refresh runs through the Meta profile connection (system-user token) once
 * META_SYSTEM_USER_TOKEN is provided.
 */
export async function POST() {
  const now = new Date().toISOString();
  try {
    if (windsorConfigured()) {
      const { rows, days } = await syncGoogleLive("last_90d"); // 90d → enables period comparisons
      await refreshPlanCache(); // 90-day-plan monthly KPIs (plan start → today)
      // search-term/keyword-QS snapshot — best-effort, never fails the sync
      try {
        await refreshTermsCache();
      } catch {}
      writeSyncState({
        lastSyncedAt: now,
        mode: "live",
        rowsGoogle: rows,
        note: `Live Windsor pull: ${rows} rows across ${days} days.`,
      });
      ["/overview", "/pacing", "/google", "/meta", "/leads", "/plan"].forEach((p) => revalidatePath(p));
      return NextResponse.json({ ok: true, mode: "live", rowsGoogle: rows, days, syncedAt: now });
    }
    const prev = readSyncState();
    writeSyncState({
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
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sync failed" },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json(readSyncState());
}
