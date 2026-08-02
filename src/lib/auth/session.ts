import "server-only";
import { cache } from "react";
import { currentUser } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export type Role = "admin" | "internal" | "client" | "viewer";

export type SessionProfile = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: string;
  /** Market codes this user may see. null = all markets (admin/internal). */
  markets: string[] | null;
};

/**
 * The signed-in user's app profile (role + market scope), read with the
 * service-role client so it works before RLS is enabled. Memoised per request.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const user = await currentUser();
  if (!user) return null;

  const admin = createSupabaseAdmin();
  const { data: profile } = await admin
    .from("UserProfile")
    .select("id,email,name,role,status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") {
    return {
      id: user.id,
      email: user.email ?? "",
      name: null,
      role: "viewer",
      status: profile?.status ?? "inactive",
      markets: [],
    };
  }

  const role = profile.role as Role;
  // Scope semantics (schema): no market rows = all markets; any rows = allow-list.
  let markets: string[] | null = null;
  const { data: scopes } = await admin
    .from("UserScope")
    .select("scopeValue")
    .eq("userId", user.id)
    .eq("scopeType", "market");
  const marketScopes = (scopes ?? []).map((s) => s.scopeValue as string).filter(Boolean);
  if (marketScopes.length > 0) markets = marketScopes;
  else if (role === "client" || role === "viewer") markets = null; // no scope rows yet → treat as unrestricted until assigned

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role,
    status: profile.status,
    markets,
  };
});
