import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { clickupConfigured, refreshClickUpSnapshot } from "@/lib/plan/clickup";

/** Live refresh of the ClickUp activity snapshot ("Refresh from ClickUp" button). */
export async function POST() {
  if (!clickupConfigured()) {
    return NextResponse.json(
      { ok: false, error: "CLICKUP_API_TOKEN is not set — add it to .env.local to enable live refresh." },
      { status: 400 }
    );
  }
  try {
    const { scanned, kept } = await refreshClickUpSnapshot();
    revalidatePath("/plan");
    return NextResponse.json({ ok: true, scanned, kept });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "ClickUp refresh failed" },
      { status: 502 }
    );
  }
}
