/**
 * The active budget/pacing period = the current calendar month.
 * Budgets are set per calendar month and pacing tracks the ongoing month, so this
 * advances automatically (no more hard-coded month). Computed in UTC — accounts still
 * pace in their own timezone inside the pacing engine; this only bounds the month.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface Period {
  start: string; // "YYYY-MM-01"
  end: string; // last day of month
  label: string; // "August 2026"
  ym: string; // "2026-08"
}

export function currentPeriod(now: Date = new Date()): Period {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 0)); // day 0 of next month = last day of this
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const mm = String(m + 1).padStart(2, "0");
  return {
    start: iso(start),
    end: iso(end),
    label: `${MONTHS[m]} ${y}`,
    ym: `${y}-${mm}`,
  };
}
