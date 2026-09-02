import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth/session";
import { setKeywordHidden, clearHiddenKeywords, getHiddenKeywords } from "@/lib/data/hidden-keywords";

/**
 * Toggle a keyword's hidden state in the shared list (Quality Score → Keyword segments).
 * Body: { key, hidden } to set one, or { clearAll: true } to restore all. Auth-required.
 */
export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { key?: string; hidden?: boolean; clearAll?: boolean };

  if (body.clearAll) {
    await clearHiddenKeywords();
    return NextResponse.json({ ok: true, hidden: [] });
  }
  if (typeof body.key !== "string" || !body.key) {
    return NextResponse.json({ ok: false, error: "missing key" }, { status: 400 });
  }
  const hidden = await setKeywordHidden(body.key, body.hidden !== false);
  return NextResponse.json({ ok: true, hidden });
}

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, hidden: await getHiddenKeywords() });
}
