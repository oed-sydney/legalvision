import "server-only";

/**
 * Transactional email via Resend (https://resend.com). Needs two env vars on the host:
 *   RESEND_API_KEY   — from the Resend dashboard
 *   ALERT_FROM_EMAIL — a verified sender, e.g. "LegalVision Alerts <alerts@oneegg.com.au>"
 * Without them, sending is a no-op that reports "not configured" (nothing breaks).
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL);
}

export async function sendEmail(
  to: string[],
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "Email not configured (RESEND_API_KEY / ALERT_FROM_EMAIL)." };
  if (to.length === 0) return { ok: false, error: "No recipients." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: process.env.ALERT_FROM_EMAIL, to, subject, html }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
