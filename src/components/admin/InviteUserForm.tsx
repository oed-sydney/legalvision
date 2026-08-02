"use client";

import { useState } from "react";
import { inviteUser } from "@/app/(dashboard)/admin/actions";

const ROLES = [
  { value: "client", label: "Client — scoped to markets" },
  { value: "viewer", label: "Viewer — read-only, scoped" },
  { value: "internal", label: "Team — all markets" },
  { value: "admin", label: "Admin — full access" },
] as const;

const MARKETS = ["AU", "UK", "NZ"] as const;

export function InviteUserForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("client");
  const [markets, setMarkets] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);

  const scoped = role === "client" || role === "viewer";

  function toggleMarket(m: string) {
    setMarkets((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await inviteUser({ name, email, role, markets: scoped ? markets : [] });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult({ email: res.email!, tempPassword: res.tempPassword! });
    setName("");
    setEmail("");
    setRole("client");
    setMarkets([]);
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setResult(null);
        }}
        className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[var(--lv-primary-hover)]"
      >
        Invite user
      </button>
    );
  }

  return (
    <div className="w-full">
      {result ? (
        <div className="rounded-lg border border-[var(--lv-success)]/30 bg-[#f0fdf4] p-4 text-[13px]">
          <p className="font-semibold text-[var(--lv-success)]">Invite created for {result.email}</p>
          <p className="mt-1 text-secondary">
            Share this temporary password securely. They should change it after signing in
            (avatar menu → Account).
          </p>
          <code className="mt-2 block rounded bg-white px-3 py-2 font-mono text-[13px] text-ink">
            {result.tempPassword}
          </code>
          <button
            onClick={() => setOpen(false)}
            className="mt-3 rounded-md border border-[var(--lv-border)] px-3 py-1.5 font-medium text-secondary hover:bg-canvas"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-secondary">
            Name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-[var(--lv-border)] px-3 py-2 text-[13px] text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-secondary">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-[var(--lv-border)] px-3 py-2 text-[13px] text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-secondary">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-md border border-[var(--lv-border)] px-3 py-2 text-[13px] text-ink"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {scoped && (
            <div className="flex flex-col gap-1 text-[12px] font-medium text-secondary">
              Markets (none = all)
              <div className="flex gap-3 pt-1.5">
                {MARKETS.map((m) => (
                  <label key={m} className="flex items-center gap-1.5 text-[13px] font-normal text-ink">
                    <input
                      type="checkbox"
                      checked={markets.includes(m)}
                      onChange={() => toggleMarket(m)}
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-[13px] text-[var(--lv-danger)] sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[var(--lv-primary-hover)] disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create invite"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-[var(--lv-border)] px-3 py-1.5 text-[13px] font-medium text-secondary hover:bg-canvas"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
