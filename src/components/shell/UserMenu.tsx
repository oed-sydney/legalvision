"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  internal: "Team",
  client: "Client",
  viewer: "Viewer",
};

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string | null;
  email: string;
  role: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const display = name || email;
  const initials = (name || email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function signOut() {
    setBusy(true);
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-[var(--lv-border)] bg-white py-1 pl-1 pr-3 transition hover:bg-[var(--lv-row-hover)]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-white">
          {initials || "?"}
        </span>
        <span className="hidden text-[13px] font-medium text-secondary sm:block">
          {ROLE_LABEL[role] ?? role}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--lv-border)] bg-white shadow-lg">
          <div className="border-b border-[var(--lv-border)] px-4 py-3">
            <p className="truncate text-[13px] font-semibold text-[var(--lv-text)]">
              {display}
            </p>
            <p className="truncate text-xs text-[var(--lv-muted)]">{email}</p>
            <span className="mt-1.5 inline-block rounded-full bg-[var(--lv-primary-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--lv-primary)]">
              {ROLE_LABEL[role] ?? role}
            </span>
          </div>
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 border-b border-[var(--lv-border)] px-4 py-2.5 text-left text-[13px] font-medium text-[var(--lv-text)] transition hover:bg-[var(--lv-row-hover)]"
          >
            <Settings className="h-4 w-4" />
            Account
          </Link>
          <button
            onClick={signOut}
            disabled={busy}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-medium text-[var(--lv-text)] transition hover:bg-[var(--lv-row-hover)] disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
