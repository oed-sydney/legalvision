"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setNegativeDecision } from "@/lib/data/negatives-store";
import { ACCOUNT_BY_ID } from "@/lib/domain/accounts";

const schema = z.object({
  accountId: z.string(),
  term: z.string().min(1).max(200),
  status: z.enum(["approved", "dismissed"]).nullable(),
});

/** Approve / dismiss / clear a negative-keyword candidate (Google → Search terms). */
export async function decideNegative(input: {
  accountId: string;
  term: string;
  status: "approved" | "dismissed" | null;
}) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  if (!ACCOUNT_BY_ID[parsed.data.accountId]) return { ok: false, error: "Unknown account." };
  await setNegativeDecision(parsed.data.accountId, parsed.data.term, parsed.data.status);
  revalidatePath("/google");
  return { ok: true };
}
