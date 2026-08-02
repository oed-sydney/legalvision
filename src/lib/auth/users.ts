import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Role } from "./session";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: string;
  leadRecordAccess: boolean;
  lastLoginAt: string | null;
  markets: string[];
};

/** All app users with their market scopes (service-role read; admin UI only). */
export async function listAppUsers(): Promise<AppUser[]> {
  const admin = createSupabaseAdmin();
  const [{ data: profiles }, { data: scopes }] = await Promise.all([
    admin
      .from("UserProfile")
      .select("id,email,name,role,status,leadRecordAccess,lastLoginAt,createdAt")
      .order("createdAt", { ascending: true }),
    admin.from("UserScope").select("userId,scopeValue").eq("scopeType", "market"),
  ]);

  const byUser = new Map<string, string[]>();
  for (const s of scopes ?? []) {
    const arr = byUser.get(s.userId as string) ?? [];
    arr.push(s.scopeValue as string);
    byUser.set(s.userId as string, arr);
  }

  return (profiles ?? []).map((p) => ({
    id: p.id as string,
    email: p.email as string,
    name: (p.name as string) ?? null,
    role: p.role as Role,
    status: p.status as string,
    leadRecordAccess: Boolean(p.leadRecordAccess),
    lastLoginAt: (p.lastLoginAt as string) ?? null,
    markets: byUser.get(p.id as string) ?? [],
  }));
}
