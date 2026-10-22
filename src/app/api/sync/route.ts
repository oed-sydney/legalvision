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

/**
 * Stamp the refresh time in a cookie as well as KV. KV is the global source of truth, but
 * on hosts where the KV service-role key isn't configured the write silently no-ops — the
 * cookie guarantees the freshness chip still advances for the person who hit Refresh.
 */
function stamp(res: NextResponse, at: string): NextResponse {
  res.cookies.set("lv_sync_at", at, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
  return res;
}

export async function POST() {
  const now = new Date().toISOString();
  let mode: "live" | "snapshot" = "snapshot";
  let rowsGoogle = 0;
  let days = 0;
  let note = "Snapshot re-validated. Add WINDSOR_API_KEY for a live Google pull.";

  // Live Windsor pull when configured. Each step is best-effort so a failure in one (or no
  // KV) never aborts the refresh — the cookie below always advances the freshness chip.
  try {
    if (windsorConfigured()) {
      const r = await syncGoogleLive("last_90d"); // 90d → enables period comparisons
      rowsGoogle = r.rows;
      days = r.days;
      mode = "live";
      note = `Live Windsor pull: ${r.rows} rows across ${r.days} days.`;
      await refreshPlanCache().catch(() => {});
      await refreshTermsCache().catch(() => {});
      await refreshBudgetLost().catch(() => {});
    }
  } catch (err) {
    note = `Live refresh unavailable — serving the latest snapshot.${err instanceof Error ? ` (${err.message})` : ""}`;
  }

  // Persist to KV (global source of truth) best-effort — ignore failures; the cookie carries
  // freshness per-browser where the KV service-role key isn't configured.
  try {
    const prev = await readSyncState();
    await writeSyncState({ ...prev, lastSyncedAt: now, mode, rowsGoogle: mode === "live" ? rowsGoogle : prev.rowsGoogle, note });
  } catch {}
  try {
    ["/overview", "/pacing", "/google", "/meta", "/leads", "/plan"].forEach((p) => revalidatePath(p));
  } catch {}

  return stamp(NextResponse.json({ ok: true, mode, rowsGoogle, days, syncedAt: now, note }), now);
}

export async function GET() {
  return NextResponse.json(await readSyncState());
}
