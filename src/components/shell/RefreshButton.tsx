"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Top-bar refresh: re-syncs metrics (live Windsor pull when configured) then re-renders. */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "ok" | "error">("idle");
  const [msg, setMsg] = useState<string>("");

  const refresh = async () => {
    setBusy(true);
    setState("idle");
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setState("ok");
        setMsg(json.mode === "live" ? `Live · ${json.rowsGoogle} rows` : "Refreshed");
        start(() => router.refresh());
      } else {
        setState("error");
        setMsg(json.error ?? "Failed");
      }
    } catch {
      setState("error");
      setMsg("Network error");
    } finally {
      setBusy(false);
      setTimeout(() => setState("idle"), 2500);
    }
  };

  const loading = busy || pending;
  return (
    <button
      onClick={refresh}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
        state === "ok"
          ? "border-[#BBF7D0] bg-[#DCFCE7] text-success"
          : state === "error"
            ? "border-[#FECACA] bg-[#FEE2E2] text-danger"
            : "border-[var(--lv-border)] bg-white text-secondary hover:bg-canvas"
      )}
      aria-label="Refresh data"
      title="Refresh all metrics"
    >
      {state === "ok" ? (
        <Check className="h-3.5 w-3.5" />
      ) : state === "error" ? (
        <AlertCircle className="h-3.5 w-3.5" />
      ) : (
        <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
      )}
      {loading ? "Refreshing…" : state === "idle" ? "Refresh" : msg}
    </button>
  );
}
