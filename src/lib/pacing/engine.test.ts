import { describe, it, expect } from "vitest";
import { computePacing } from "./engine";

const AU = "Australia/Sydney";
const NZ = "Pacific/Auckland";
const UK = "Etc/GMT";
const JULY = { periodStart: "2026-07-01", periodEnd: "2026-07-31" }; // 31 days

describe("Pacing engine — golden hand-computed scenarios (§8/§29.2)", () => {
  it("1. Mid-month normal (AU) — perfectly on pace", () => {
    const r = computePacing({
      ...JULY,
      budget: 31000,
      spend: 15000,
      now: new Date("2026-07-16T02:00:00Z"), // Sydney 07-16 12:00
      timezone: AU,
    });
    expect(r.dTotal).toBe(31);
    expect(r.dComplete).toBe(15);
    expect(r.daysRemaining).toBe(16);
    expect(r.expectedSpend).toBeCloseTo(15000, 6);
    expect(r.pacingVariance).toBeCloseTo(0, 6);
    expect(r.pacingIndex).toBeCloseTo(1, 6);
    expect(r.dailyAvgSpend).toBeCloseTo(1000, 6);
    expect(r.projectedSpend).toBeCloseTo(31000, 6);
    expect(r.requiredDailySpend).toBeCloseTo(1000, 6);
    expect(r.status).toBe("on_track");
  });

  it("2. Day 1 of period — not started, no variance", () => {
    const r = computePacing({
      ...JULY,
      budget: 31000,
      spend: 200,
      now: new Date("2026-07-01T02:00:00Z"), // Sydney 07-01 12:00
      timezone: AU,
    });
    expect(r.dComplete).toBe(0);
    expect(r.daysRemaining).toBe(31);
    expect(r.status).toBe("not_started");
    expect(r.expectedSpend).toBeNull();
    expect(r.pacingVariance).toBeNull();
    expect(r.requiredDailySpend).toBeCloseTo(30800 / 31, 6); // ≈ 993.55
  });

  it("3. Final day — on pace", () => {
    const r = computePacing({
      ...JULY,
      budget: 31000,
      spend: 30000,
      now: new Date("2026-07-31T02:00:00Z"), // Sydney 07-31 12:00
      timezone: AU,
    });
    expect(r.dComplete).toBe(30);
    expect(r.daysRemaining).toBe(1);
    expect(r.expectedSpend).toBeCloseTo(30000, 6);
    expect(r.pacingIndex).toBeCloseTo(1, 6);
    expect(r.requiredDailySpend).toBeCloseTo(1000, 6);
    expect(r.status).toBe("on_track");
  });

  it("4. Period fully elapsed + overspend", () => {
    const r = computePacing({
      ...JULY,
      budget: 31000,
      spend: 31500,
      now: new Date("2026-08-01T02:00:00Z"), // Sydney 08-01 → past end
      timezone: AU,
    });
    expect(r.dComplete).toBe(31);
    expect(r.daysRemaining).toBe(0);
    expect(r.requiredDailySpend).toBeNull();
    expect(r.projectedSpend).toBeCloseTo(31500, 6);
    expect(r.status).toBe("over_budget");
  });

  it("5. February (28d) with Sydney DST offset (+11)", () => {
    // 2026-02-14 13:30Z in Sydney (UTC+11) = 2026-02-15 00:30 → today is the 15th
    const r = computePacing({
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
      budget: 28000,
      spend: 14000,
      now: new Date("2026-02-14T13:30:00Z"),
      timezone: AU,
    });
    expect(r.dTotal).toBe(28);
    expect(r.dComplete).toBe(14); // DST-correct; UTC-only would give 13
    expect(r.expectedSpend).toBeCloseTo(14000, 6);
    expect(r.status).toBe("on_track");
  });

  it("6. Three-timezone month boundary — one UTC instant, three verdicts", () => {
    const now = new Date("2026-07-31T14:30:00Z");
    // Sydney (+10) → 08-01 00:30 : July fully elapsed
    const au = computePacing({ ...JULY, budget: 31000, spend: 31000, now, timezone: AU });
    expect(au.dComplete).toBe(31);
    expect(au.daysRemaining).toBe(0);
    // Auckland (+12) → 08-01 02:30 : July fully elapsed
    const nz = computePacing({ ...JULY, budget: 31000, spend: 31000, now, timezone: NZ });
    expect(nz.dComplete).toBe(31);
    expect(nz.daysRemaining).toBe(0);
    // Etc/GMT → 07-31 14:30 : still the last day of July
    const uk = computePacing({ ...JULY, budget: 31000, spend: 29000, now, timezone: UK });
    expect(uk.dComplete).toBe(30);
    expect(uk.daysRemaining).toBe(1);
  });

  it("7. UK Etc/GMT (no BST) is NOT corrected to Europe/London", () => {
    // 2026-07-15 23:30Z. Etc/GMT → still 07-15 (D_complete 14).
    // Europe/London (BST, +1) would be 07-16 00:30 (D_complete 15) — we must NOT do that.
    const r = computePacing({
      ...JULY,
      budget: 31000,
      spend: 14000,
      now: new Date("2026-07-15T23:30:00Z"),
      timezone: UK,
    });
    expect(r.dComplete).toBe(14);
  });

  it("8. Mid-month budget change — uses latest budget for whole period (Watch)", () => {
    const r = computePacing({
      ...JULY,
      budget: 40000, // raised mid-month
      spend: 18000,
      now: new Date("2026-07-16T02:00:00Z"), // D_complete 15
      timezone: AU,
    });
    expect(r.expectedSpend).toBeCloseTo(600000 / 31, 6); // ≈ 19354.84
    expect(r.pacingIndex).toBeCloseTo(0.93, 6);
    expect(r.projectedSpend).toBeCloseTo(37200, 6);
    expect(r.status).toBe("watch");
  });

  it("9. Zero budget → Budget not set", () => {
    const r = computePacing({
      ...JULY,
      budget: 0,
      spend: 5000,
      now: new Date("2026-07-16T02:00:00Z"),
      timezone: AU,
    });
    expect(r.status).toBe("budget_not_set");
    expect(r.expectedSpend).toBeNull();
    expect(r.budgetUtilisation).toBeNull();
  });

  it("10. Overspend past 100% mid-month", () => {
    const r = computePacing({
      ...JULY,
      budget: 31000,
      spend: 32000,
      now: new Date("2026-07-16T02:00:00Z"), // D_complete 15
      timezone: AU,
    });
    expect(r.status).toBe("over_budget");
    expect(r.overspend).toBeCloseTo(1000, 6);
    expect(r.remainingBudget).toBe(0);
    expect(r.requiredDailySpend).toBe(0);
    expect(r.budgetExhausted).toBe(true);
  });

  it("11. Catch-up required > 2× daily average (At risk)", () => {
    const r = computePacing({
      ...JULY,
      budget: 31000,
      spend: 5000,
      now: new Date("2026-07-16T02:00:00Z"), // D_complete 15
      timezone: AU,
    });
    expect(r.dailyAvgSpend).toBeCloseTo(5000 / 15, 6);
    expect(r.requiredDailySpend).toBeCloseTo(1625, 6); // (26000)/16
    expect(r.requiredDailySpend! > 2 * r.dailyAvgSpend).toBe(true);
    expect(r.status).toBe("at_risk");
  });

  it("12. Partial-day basis on — includes today's elapsed fraction", () => {
    const r = computePacing({
      ...JULY,
      budget: 31000,
      spend: 15500,
      now: new Date("2026-07-16T02:00:00Z"), // Sydney 12:00 → fToday 0.5
      timezone: AU,
      basis: "partial",
    });
    expect(r.fToday).toBeCloseTo(0.5, 6);
    expect(r.periodElapsedPct).toBeCloseTo(15.5 / 31, 6); // 0.5
    expect(r.expectedSpend).toBeCloseTo(15500, 6);
    expect(r.pacingIndex).toBeCloseTo(1, 6);
    expect(r.projectedSpend).toBeCloseTo(31000, 6);
    expect(r.status).toBe("on_track");
  });
});
