import "server-only";
import { kvGet, kvSet } from "./kv";

/**
 * Keyword rows hidden from the Quality Score → Keyword segments lists once actioned.
 * Stored server-side (Postgres `app_kv`) so the hide is SHARED across all users and
 * survives refreshes/data pulls. Keys are the stable keyword key (see stableKwKey) —
 * never the row id, which is index-based and reshuffles on every pull.
 */

const KV_KEY = "hidden-keywords";

export async function getHiddenKeywords(): Promise<string[]> {
  return kvGet<string[]>(KV_KEY, []);
}

export async function setKeywordHidden(key: string, hidden: boolean): Promise<string[]> {
  const set = new Set(await getHiddenKeywords());
  if (hidden) set.add(key);
  else set.delete(key);
  const next = [...set];
  await kvSet(KV_KEY, next);
  return next;
}

export async function clearHiddenKeywords(): Promise<void> {
  await kvSet(KV_KEY, []);
}
