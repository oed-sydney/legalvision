"use server";

import { randomUUID, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setBudget } from "@/lib/data/budgets-store";
import { ACCOUNT_BY_ID } from "@/lib/domain/accounts";
import { getSessionProfile } from "@/lib/auth/session";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const schema = z.object({
  accountId: z.string(),
  amount: z.number().min(0).max(100_000_000),
});

/** Persist a per-account monthly budget (Admin → Budgets). Server-side validated. */
export async function saveBudget(input: { accountId: string; amount: number }) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid budget value." };
  if (!ACCOUNT_BY_ID[parsed.data.accountId]) return { ok: false, error: "Unknown account." };
  await setBudget(parsed.data.accountId, parsed.data.amount);
  // pacing + overview + admin all read budgets
  revalidatePath("/admin");
  revalidatePath("/pacing");
  revalidatePath("/overview");
  return { ok: true };
}

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.enum(["admin", "internal", "client", "viewer"]),
  markets: z.array(z.enum(["AU", "UK", "NZ"])).default([]),
});

/** Generate a readable, strong temporary password. */
function tempPassword(): string {
  return "LV-" + randomBytes(6).toString("base64url") + "-Aa1!";
}

/**
 * Invite a new user (Admin only). Creates the Supabase auth account with a temp
 * password + matching UserProfile, and market scopes for client/viewer roles.
 * Returns the temp password once for the admin to hand over (no SMTP needed).
 */
export async function inviteUser(input: {
  email: string;
  name: string;
  role: string;
  markets: string[];
}) {
  const me = await getSessionProfile();
  if (!me || me.role !== "admin") return { ok: false as const, error: "Admins only." };

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the name, email, and role." };
  const { email, name, role, markets } = parsed.data;

  const admin = createSupabaseAdmin();
  const pw = tempPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: pw,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error || !data.user) {
    return { ok: false as const, error: error?.message ?? "Could not create the account." };
  }
  const uid = data.user.id;
  const now = new Date().toISOString();

  const { error: pErr } = await admin.from("UserProfile").insert({
    id: uid,
    email,
    name,
    role,
    status: "active",
    invitedBy: me.id,
    leadRecordAccess: role === "admin" || role === "internal",
    createdAt: now,
    updatedAt: now,
  });
  if (pErr) {
    // Roll back the orphaned auth user so the invite can be retried cleanly.
    await admin.auth.admin.deleteUser(uid).catch(() => {});
    return { ok: false as const, error: `Profile create failed: ${pErr.message}` };
  }

  if ((role === "client" || role === "viewer") && markets.length) {
    await admin.from("UserScope").insert(
      markets.map((m) => ({
        id: randomUUID(),
        userId: uid,
        scopeType: "market",
        scopeValue: m,
      }))
    );
  }

  revalidatePath("/admin");
  return { ok: true as const, tempPassword: pw, email };
}
