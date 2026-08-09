import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Durable key-value store in Postgres (table `app_kv`), used for the app's small
 * mutable stores (budgets, sync-state, negatives, plan-state, plan-cache) so they
 * persist on serverless hosts where the filesystem is read-only.
 *
 * Accessed via the service-role client (bypasses RLS; `app_kv` is deny-by-default
 * to the public API). All reads fall back to the caller's default on any error, so
 * a transient DB blip degrades gracefully rather than throwing.
 */
export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const { data, error } = await createSupabaseAdmin()
      .from("app_kv")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return fallback;
    return (data.value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const { error } = await createSupabaseAdmin()
    .from("app_kv")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`kvSet(${key}) failed: ${error.message}`);
}

export async function kvDelete(key: string): Promise<void> {
  try {
    await createSupabaseAdmin().from("app_kv").delete().eq("key", key);
  } catch {
    // best-effort (used for pruning old QS snapshots)
  }
}
