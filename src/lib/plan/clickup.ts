import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * ClickUp activity for the 90-day plan: open tasks in the "LV - PPC (client
 * share)" list with a comment in the last 14 days. Snapshot persists to
 * data/clickup-snapshot.json; live refreshes use the public ClickUp API v2
 * with a personal token (CLICKUP_API_TOKEN, ClickUp → Settings → Apps).
 */

const API = "https://api.clickup.com/api/v2";
export const LV_PPC_LIST_ID = process.env.CLICKUP_LV_LIST_ID || "6237529";
export const RECENT_COMMENT_DAYS = 14;
const STORE_PATH = path.join(process.cwd(), "data", "clickup-snapshot.json");

export interface ClickUpTask {
  id: string;
  name: string;
  status: string;
  url: string;
  assignees: string;
  tags: string;
  priority: string;
  dueDate: string;
  lastCommentAt: string; // ISO
  lastCommentBy: string;
  lastCommentText: string;
  recentCommentCount: number;
}

export interface ClickUpSnapshot {
  listId: string;
  listName: string;
  fetchedAt: string;
  tasks: ClickUpTask[];
}

export function clickupConfigured(): boolean {
  return Boolean(process.env.CLICKUP_API_TOKEN);
}

export function readClickUpSnapshot(): ClickUpSnapshot | null {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as ClickUpSnapshot;
  } catch {
    return null;
  }
}

async function cuGet<T>(pathname: string): Promise<T> {
  const res = await fetch(`${API}${pathname}`, {
    headers: { Authorization: process.env.CLICKUP_API_TOKEN ?? "" },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("ClickUp rejected CLICKUP_API_TOKEN (401)");
  if (res.status === 429) throw new Error("ClickUp rate limit reached (429)");
  if (!res.ok) throw new Error(`ClickUp HTTP ${res.status}`);
  return (await res.json()) as T;
}

interface CuTask {
  id: string;
  name: string;
  status?: { status?: string };
  url?: string;
  assignees?: { username?: string }[];
  tags?: { name?: string }[];
  priority?: { priority?: string } | null;
  due_date?: string | null;
  date_updated?: string;
}

interface CuComment {
  comment_text?: string;
  date?: string;
  user?: { username?: string };
}

/** Refresh the snapshot from the live API (replaces the stored file). */
export async function refreshClickUpSnapshot(): Promise<{ scanned: number; kept: number }> {
  if (!clickupConfigured()) {
    throw new Error(
      "CLICKUP_API_TOKEN is not set. Create a personal token in ClickUp (Settings → Apps) and add it to .env.local."
    );
  }
  const cutoff = Date.now() - RECENT_COMMENT_DAYS * 86_400_000;

  // open tasks, most recently updated first
  const tasks: CuTask[] = [];
  for (let page = 0; page < 3; page++) {
    const res = await cuGet<{ tasks: CuTask[]; last_page?: boolean }>(
      `/list/${LV_PPC_LIST_ID}/task?page=${page}&order_by=updated&reverse=true&subtasks=true&include_closed=false`
    );
    tasks.push(...(res.tasks ?? []));
    if (res.last_page || (res.tasks ?? []).length === 0) break;
  }

  const kept: ClickUpTask[] = [];
  for (const t of tasks) {
    // a task can't have a recent comment if it wasn't updated recently
    if (t.date_updated && Number(t.date_updated) < cutoff) continue;
    const { comments } = await cuGet<{ comments: CuComment[] }>(`/task/${t.id}/comment`);
    const recent = (comments ?? []).filter((c) => Number(c.date ?? 0) >= cutoff);
    if (recent.length === 0) continue;
    const newest = recent.reduce((a, b) => (Number(a.date) > Number(b.date) ? a : b));
    kept.push({
      id: t.id,
      name: t.name,
      status: t.status?.status ?? "",
      url: t.url ?? `https://app.clickup.com/t/${t.id}`,
      assignees: (t.assignees ?? []).map((a) => a.username).filter(Boolean).join(", "),
      tags: (t.tags ?? []).map((x) => x.name).filter(Boolean).join(", "),
      priority: t.priority?.priority ?? "",
      dueDate: t.due_date ? new Date(Number(t.due_date)).toISOString().slice(0, 10) : "",
      lastCommentAt: new Date(Number(newest.date)).toISOString(),
      lastCommentBy: newest.user?.username ?? "",
      lastCommentText: (newest.comment_text ?? "").slice(0, 300),
      recentCommentCount: recent.length,
    });
  }

  const snapshot: ClickUpSnapshot = {
    listId: LV_PPC_LIST_ID,
    listName: "LV - PPC (client share)",
    fetchedAt: new Date().toISOString(),
    tasks: kept,
  };
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(snapshot, null, 2), "utf8");
  return { scanned: tasks.length, kept: kept.length };
}
