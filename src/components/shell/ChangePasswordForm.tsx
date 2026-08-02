"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export function ChangePasswordForm() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) {
      setMsg({ ok: false, text: "Use at least 8 characters." });
      return;
    }
    if (pw !== confirm) {
      setMsg({ ok: false, text: "Passwords don't match." });
      return;
    }
    setBusy(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    setPw("");
    setConfirm("");
    setMsg({ ok: true, text: "Password updated." });
  }

  return (
    <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1 text-[12px] font-medium text-secondary">
        New password
        <input
          type="password"
          autoComplete="new-password"
          required
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="rounded-md border border-[var(--lv-border)] px-3 py-2 text-[13px] text-ink"
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-medium text-secondary">
        Confirm password
        <input
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="rounded-md border border-[var(--lv-border)] px-3 py-2 text-[13px] text-ink"
        />
      </label>
      {msg && (
        <p className={`text-[13px] ${msg.ok ? "text-[var(--lv-success)]" : "text-[var(--lv-danger)]"}`}>
          {msg.text}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-fit rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--lv-primary-hover)] disabled:opacity-60"
      >
        {busy ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
