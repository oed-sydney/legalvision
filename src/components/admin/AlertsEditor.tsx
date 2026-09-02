"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Plus, Send, X } from "lucide-react";
import { saveAlertConfig, sendTestAlertAction } from "@/app/(dashboard)/admin/actions";
import type { AlertConfig } from "@/lib/alerts/config";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Admin → Alerts: configure budget-pacing email alerts (recipients, thresholds, cadence). */
export function AlertsEditor({ initial, emailReady }: { initial: AlertConfig; emailReady: boolean }) {
  const [cfg, setCfg] = useState<AlertConfig>(initial);
  const [recipientsText, setRecipientsText] = useState(initial.recipients.join(", "));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [testing, startTest] = useTransition();

  const set = <K extends keyof AlertConfig>(k: K, v: AlertConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const addCheckpoint = () => set("checkpoints", [...cfg.checkpoints, { day: 25, minSpendPct: 80 }]);
  const removeCheckpoint = (i: number) => set("checkpoints", cfg.checkpoints.filter((_, x) => x !== i));
  const updateCheckpoint = (i: number, field: "day" | "minSpendPct", val: number) =>
    set("checkpoints", cfg.checkpoints.map((c, x) => (x === i ? { ...c, [field]: val } : c)));

  const parseRecipients = (s: string) =>
    Array.from(new Set(s.split(/[\s,;]+/).map((x) => x.trim()).filter((x) => /.+@.+\..+/.test(x))));

  const save = () => {
    setMsg(null);
    const recipients = parseRecipients(recipientsText);
    start(async () => {
      const res = await saveAlertConfig({ ...cfg, recipients });
      if (res.ok) {
        setCfg((c) => ({ ...c, recipients }));
        setRecipientsText(recipients.join(", "));
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      } else {
        setMsg(res.error ?? "Couldn't save.");
      }
    });
  };

  const test = () => {
    setMsg(null);
    startTest(async () => {
      const res = await sendTestAlertAction();
      setMsg(res.ok ? "Test email sent." : res.error ?? "Couldn't send test.");
    });
  };

  return (
    <div className="space-y-4 text-[13px]">
      {!emailReady && (
        <div className="rounded-lg border border-[#FDE68A] bg-[#FEFCE8] px-4 py-2.5 text-[12px] text-[#92400E]">
          Email isn&apos;t connected yet. Set <code>RESEND_API_KEY</code> and <code>ALERT_FROM_EMAIL</code> in the host
          environment to start sending — you can still configure everything here now.
        </div>
      )}

      <label className="flex items-center gap-2.5">
        <input type="checkbox" checked={cfg.enabled} onChange={(e) => set("enabled", e.target.checked)} className="h-4 w-4" />
        <span className="font-medium text-ink">Enable budget-pacing email alerts</span>
      </label>

      <div>
        <div className="mb-1 font-medium text-ink">Recipients</div>
        <textarea
          value={recipientsText}
          onChange={(e) => setRecipientsText(e.target.value)}
          rows={2}
          placeholder="name@oneegg.com.au, client@legalvision.com.au"
          className="w-full rounded-md border border-[var(--lv-border)] bg-card px-3 py-2 text-ink outline-none focus:border-[var(--lv-accent)]"
        />
        <div className="mt-1 text-[11px] text-muted">Comma- or space-separated email addresses.</div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 font-medium text-ink">Overspend threshold</div>
          <div className="inline-flex items-center gap-1 rounded-md border border-[var(--lv-border)] px-2">
            <span className="text-muted">≥</span>
            <input type="number" min={50} max={300} value={cfg.overspendPct}
              onChange={(e) => set("overspendPct", Number(e.target.value))}
              className="w-16 bg-transparent py-1 text-right tnum outline-none" />
            <span className="text-muted">% of budget</span>
          </div>
          <div className="mt-1 text-[11px] text-muted">Alert when projected month-end spend reaches this.</div>
        </div>
        <div>
          <div className="mb-1 font-medium text-ink">Underspend threshold</div>
          <div className="inline-flex items-center gap-1 rounded-md border border-[var(--lv-border)] px-2">
            <span className="text-muted">≤</span>
            <input type="number" min={0} max={150} value={cfg.underspendPct}
              onChange={(e) => set("underspendPct", Number(e.target.value))}
              className="w-16 bg-transparent py-1 text-right tnum outline-none" />
            <span className="text-muted">% of budget</span>
          </div>
          <div className="mt-1 text-[11px] text-muted">Alert when a market is tracking well under budget.</div>
        </div>
      </div>

      <div>
        <div className="mb-1 font-medium text-ink">Spend-to-date checkpoints</div>
        <div className="mb-2 text-[11px] text-muted">
          Flag a market that hasn&apos;t spent enough of its budget by a given day of the month (catches under-pacing early).
        </div>
        <div className="space-y-2">
          {cfg.checkpoints.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="text-secondary">By day</span>
              <input type="number" min={1} max={31} value={c.day}
                onChange={(e) => updateCheckpoint(i, "day", Number(e.target.value))}
                className="w-14 rounded-md border border-[var(--lv-border)] bg-card px-2 py-1 text-right tnum outline-none focus:border-[var(--lv-accent)]" />
              <span className="text-secondary">of the month, spend should be ≥</span>
              <input type="number" min={0} max={200} value={c.minSpendPct}
                onChange={(e) => updateCheckpoint(i, "minSpendPct", Number(e.target.value))}
                className="w-14 rounded-md border border-[var(--lv-border)] bg-card px-2 py-1 text-right tnum outline-none focus:border-[var(--lv-accent)]" />
              <span className="text-secondary">% of budget</span>
              <button type="button" onClick={() => removeCheckpoint(i)} aria-label="Remove checkpoint" className="text-muted hover:text-danger">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {cfg.checkpoints.length === 0 && <div className="text-[12px] text-muted">No checkpoints — add one below.</div>}
        </div>
        <button type="button" onClick={addCheckpoint} className="mt-2 inline-flex items-center gap-1 rounded-md border border-[var(--lv-border)] px-2.5 py-1 text-[12px] font-medium text-secondary hover:bg-canvas">
          <Plus className="h-3.5 w-3.5" /> Add checkpoint
        </button>
      </div>

      <label className="flex items-center gap-2.5">
        <input type="checkbox" checked={cfg.triggerAlerts} onChange={(e) => set("triggerAlerts", e.target.checked)} className="h-4 w-4" />
        <span className="text-ink">Send an immediate alert when a market crosses a threshold</span>
      </label>

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex items-center gap-2.5">
          <input type="checkbox" checked={cfg.weeklyDigest} onChange={(e) => set("weeklyDigest", e.target.checked)} className="h-4 w-4" />
          <span className="text-ink">Weekly digest every</span>
        </label>
        <select
          value={cfg.weeklyDay}
          onChange={(e) => set("weeklyDay", Number(e.target.value))}
          disabled={!cfg.weeklyDigest}
          className="rounded-md border border-[var(--lv-border)] bg-card px-2 py-1 text-ink outline-none disabled:opacity-50"
        >
          {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--lv-border)] pt-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? "Saved" : "Save settings"}
        </button>
        <button
          type="button"
          onClick={test}
          disabled={testing}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--lv-border)] px-3 py-1.5 font-medium text-secondary hover:bg-canvas disabled:opacity-60"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Send test
        </button>
        {msg && <span className="text-[12px] text-secondary">{msg}</span>}
      </div>
    </div>
  );
}
