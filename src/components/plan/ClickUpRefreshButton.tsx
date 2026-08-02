"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClickUpRefreshButton({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/clickup", { method: "POST" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) setError(json.error ?? "Refresh failed");
      else router.refresh();
    } catch {
      setError("Refresh failed — is the server reachable?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-[12px] text-[var(--lv-danger,#B91C1C)]">{error}</span>}
      <button
        onClick={refresh}
        disabled={!enabled || busy}
        title={enabled ? "Pull the latest tasks and comments from ClickUp" : "Add CLICKUP_API_TOKEN to .env.local to enable live refresh"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-[var(--lv-border)] bg-white px-3 py-1.5 text-[13px] font-medium text-primary transition-colors",
          enabled ? "hover:bg-canvas" : "cursor-not-allowed opacity-50"
        )}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
        {busy ? "Refreshing…" : "Refresh from ClickUp"}
      </button>
    </span>
  );
}
