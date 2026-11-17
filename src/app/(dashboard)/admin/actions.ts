"use server";

import { randomUUID, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setBudget } from "@/lib/data/budgets-store";
import { ACCOUNT_BY_ID } from "@/lib/domain/accounts";
import { getSessionProfile } from "@/lib/auth/session";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { setAlertConfig, type AlertConfig } from "@/lib/alerts/config";
import { sendTestAlert } from "@/lib/alerts/run";
import { setAutopaceConfig, type AutopaceConfig } from "@/lib/pacing/autopace-config";
import { computeAutopace, applyAutopace } from "@/lib/pacing/autopace";

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

const alertSchema = z.object({
  enabled: z.boolean(),
  recipients: z.array(z.string().email()).max(25),
  overspendPct: z.number().min(50).max(300),
  underspendPct: z.number().min(0).max(150),
  checkpoints: z
    .array(z.object({ day: z.number().int().min(1).max(31), minSpendPct: z.number().min(0).max(200) }))
    .max(10),
  triggerAlerts: z.boolean(),
  weeklyDigest: z.boolean(),
  weeklyDay: z.number().int().min(0).max(6),
});

/** Save the budget-pacing email alert config (Admin → Alerts). Admin only. */
export async function saveAlertConfig(input: AlertConfig) {
  const me = await getSessionProfile();
  if (!me || me.role !== "admin") return { ok: false as const, error: "Admins only." };
  const parsed = alertSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the thresholds and recipient emails." };
  await setAlertConfig(parsed.data);
  revalidatePath("/admin");
  return { ok: true as const };
}

/** Send a one-off test alert email to the configured recipients. Admin only. */
export async function sendTestAlertAction() {
  const me = await getSessionProfile();
  if (!me || me.role !== "admin") return { ok: false as const, error: "Admins only." };
  return sendTestAlert();
}

const funnelShares = z
  .object({
    BOFU: z.number().min(0).max(100).optional(),
    "SME Publication": z.number().min(0).max(100).optional(),
    Traffic: z.number().min(0).max(100).optional(),
  })
  .partial();

const autopaceSchema = z.object({
  mode: z.enum(["off", "recommend", "auto"]),
  accounts: z.array(z.string()).max(10),
  targetUtilisationPct: z.number().min(50).max(150),
  maxChangePct: z.number().min(5).max(100),
  minDailyBudget: z.number().min(0).max(100_000),
  maxDailyBudget: z.number().min(0).max(1_000_000),
  minChangeAbs: z.number().min(0).max(10_000),
  allocationMode: z.enum(["auto", "manual"]),
  allocations: z.record(z.string(), funnelShares).default({}),
  autoProtect: z.object({ enabled: z.boolean(), capPct: z.number().min(50).max(150) }),
});

/** Save the Meta auto-pacing config (Admin → Auto-pacing). Admin only. */
export async function saveAutopaceConfig(input: AutopaceConfig) {
  const me = await getSessionProfile();
  if (!me || me.role !== "admin") return { ok: false as const, error: "Admins only." };
  const parsed = autopaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the auto-pacing settings." };
  await setAutopaceConfig(parsed.data);
  revalidatePath("/admin");
  return { ok: true as const };
}

/**
 * Apply the CURRENT auto-pacing recommendations now (one-click). Recomputes the plan
 * server-side (never trusts client numbers) before writing budgets via the Meta API.
 */
export async function applyAutopaceNow() {
  const me = await getSessionProfile();
  if (!me || me.role !== "admin") return { ok: false as const, error: "Admins only." };
  try {
    const plan = await computeAutopace();
    const res = await applyAutopace(plan, me.email ?? "admin");
    revalidatePath("/admin");
    revalidatePath("/meta");
    return { ok: true as const, ...res };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Apply failed." };
  }
}

const roleUpdateSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["admin", "internal", "client", "viewer"]),
});

/**
 * Change an existing user's role (Admin → Users & roles). Admin only.
 * - Keeps `leadRecordAccess` consistent with the role (admin/internal = yes, client/viewer = no).
 * - admin/internal mean "all markets", so any leftover market-scope rows are cleared — otherwise
 *   session.ts would wrongly restrict a promoted admin to those markets.
 * - Refuses to demote the last remaining active admin (prevents locking everyone out).
 */
export async function updateUserRole(input: { userId: string; role: string }) {
  const me = await getSessionProfile();
  if (!me || me.role !== "admin") return { ok: false as const, error: "Admins only." };

  const parsed = roleUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid role." };
  const { userId, role } = parsed.data;

  const admin = createSupabaseAdmin();
  const { data: target, error: tErr } = await admin
    .from("UserProfile")
    .select("id,role")
    .eq("id", userId)
    .single();
  if (tErr || !target) return { ok: false as const, error: "User not found." };
  if (target.role === role) return { ok: true as const }; // no-op

  // Never strip the last admin — promote a replacement first.
  if (target.role === "admin" && role !== "admin") {
    const { count } = await admin
      .from("UserProfile")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("status", "active");
    if ((count ?? 0) <= 1) {
      return { ok: false as const, error: "Can't change the last admin's role — promote another admin first." };
    }
  }

  const allMarkets = role === "admin" || role === "internal";
  const { error: uErr } = await admin
    .from("UserProfile")
    .update({ role, leadRecordAccess: allMarkets, updatedAt: new Date().toISOString() })
    .eq("id", userId);
  if (uErr) return { ok: false as const, error: uErr.message };

  // admin/internal = all markets → drop any scope rows that would otherwise restrict them.
  if (allMarkets) {
    await admin.from("UserScope").delete().eq("userId", userId).eq("scopeType", "market");
  }

  revalidatePath("/admin");
  return { ok: true as const };
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
