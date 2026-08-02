"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setBudget } from "@/lib/data/budgets-store";
import { ACCOUNT_BY_ID } from "@/lib/domain/accounts";

const schema = z.object({
  accountId: z.string(),
  amount: z.number().min(0).max(100_000_000),
});

/** Persist a per-account monthly budget (Admin → Budgets). Server-side validated. */
export async function saveBudget(input: { accountId: string; amount: number }) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid budget value." };
  if (!ACCOUNT_BY_ID[parsed.data.accountId]) return { ok: false, error: "Unknown account." };
  setBudget(parsed.data.accountId, parsed.data.amount);
  // pacing + overview + admin all read budgets
  revalidatePath("/admin");
  revalidatePath("/pacing");
  revalidatePath("/overview");
  return { ok: true };
}
