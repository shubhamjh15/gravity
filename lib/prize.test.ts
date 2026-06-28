import { describe, it, expect } from "vitest";
import { rupeesToPaise } from "./money";
import {
  validateStructure,
  assertValidStructure,
  committedTotal,
  poolForCount,
  computePayouts,
  sumRankPrizes,
  PrizeError,
  type PrizeStructure,
} from "./prize";

// The canonical structure from the project plan.
function canonical(): PrizeStructure {
  return {
    entryFee: rupeesToPaise(40),
    rankPrizes: {
      1: rupeesToPaise(700),
      2: rupeesToPaise(300),
      3: rupeesToPaise(100),
    },
    perKill: rupeesToPaise(10),
    killBudgetCap: rupeesToPaise(490),
    adminCut: rupeesToPaise(110),
    organizerProfit: rupeesToPaise(300),
    fillPolicy: "scale_down",
    killSurplusPolicy: "to_organizer",
    maxSlots: 50,
  };
}

describe("structure validation (canonical ₹2000)", () => {
  it("rank prizes sum to ₹1100", () => {
    expect(sumRankPrizes(canonical().rankPrizes)).toBe(110000);
  });

  it("committed total equals the full pool", () => {
    const s = canonical();
    expect(poolForCount(s.entryFee, s.maxSlots)).toBe(200000); // ₹2000
    expect(committedTotal(s)).toBe(200000); // 1100+490+110+300
  });

  it("validateStructure passes with zero delta", () => {
    const r = validateStructure(canonical());
    expect(r.ok).toBe(true);
    expect(r.deltaPaise).toBe(0);
  });

  it("assertValidStructure throws when the split doesn't sum to pool", () => {
    const bad = canonical();
    bad.adminCut = rupeesToPaise(200); // now off by +₹90
    expect(() => assertValidStructure(bad)).toThrow(PrizeError);
  });
});

describe("computePayouts — full fill", () => {
  it("pays rank prizes + capped kills, books admin + organizer", () => {
    const s = canonical();
    // 50 players; give some kills. Top 3 ranked.
    const results = Array.from({ length: 50 }, (_, i) => ({
      userId: `u${i}`,
      rank: i < 3 ? i + 1 : null,
      kills: i < 10 ? 5 : 0, // 10 players x 5 = 50 kills total
    }));
    const c = computePayouts(s, results, 50);

    // 50 kills x ₹10 = ₹500 raw, capped at ₹490.
    expect(c.totalKillPaid).toBe(49000);

    // rank prizes paid = ₹1100
    expect(c.totalRankPaid).toBe(110000);

    // no scaling at full fill
    expect(c.scaleFactorBps).toBe(10000);

    // 1st place gets ₹700 + their kill share
    const first = c.payouts.find((p) => p.rank === 1)!;
    expect(first.rankPrize).toBe(70000);
  });

  it("kill cap holds when kills would exceed the budget", () => {
    const s = canonical();
    const results = [
      { userId: "a", rank: 1, kills: 100 }, // 100 x ₹10 = ₹1000 raw, way over cap
    ];
    const c = computePayouts(s, results, 50);
    expect(c.totalKillPaid).toBeLessThanOrEqual(49000); // ≤ ₹490 cap
  });
});

describe("computePayouts — under-fill", () => {
  it("scale_down halves prizes when only 25/50 register", () => {
    const s = canonical();
    const results = Array.from({ length: 25 }, (_, i) => ({
      userId: `u${i}`,
      rank: i < 3 ? i + 1 : null,
      kills: 0,
    }));
    const c = computePayouts(s, results, 25);

    // collected = 25 x ₹40 = ₹1000; factor = 0.5
    expect(c.collectedPool).toBe(100000);
    expect(c.scaleFactorBps).toBe(5000);

    // 1st place prize scaled to ₹350
    const first = c.payouts.find((p) => p.rank === 1)!;
    expect(first.rankPrize).toBe(35000);
  });

  it("guaranteed keeps prizes at full value despite under-fill", () => {
    const s = canonical();
    s.fillPolicy = "guaranteed";
    const results = [{ userId: "a", rank: 1, kills: 0 }];
    const c = computePayouts(s, results, 10); // badly under-filled
    expect(c.scaleFactorBps).toBe(10000); // no scaling
    const first = c.payouts.find((p) => p.rank === 1)!;
    expect(first.rankPrize).toBe(70000); // full ₹700
  });
});

describe("kill surplus routing", () => {
  it("to_organizer adds leftover kill budget to organizer profit", () => {
    const s = canonical(); // cap ₹490, organizer ₹300
    const results = [{ userId: "a", rank: 1, kills: 0 }]; // zero kills => full surplus
    const c = computePayouts(s, results, 50);
    // surplus = ₹490 (nothing paid) -> organizer 300 + 490 = 790
    expect(c.organizerProfit).toBe(rupeesToPaise(790));
  });

  it("to_admin adds leftover to admin cut", () => {
    const s = canonical();
    s.killSurplusPolicy = "to_admin";
    const results = [{ userId: "a", rank: 1, kills: 0 }];
    const c = computePayouts(s, results, 50);
    expect(c.adminCut).toBe(rupeesToPaise(600)); // 110 + 490
  });
});

describe("invariant — never pays more than collected (full fill)", () => {
  it("total disbursed equals the pool for the canonical full-fill case", () => {
    const s = canonical();
    const results = Array.from({ length: 50 }, (_, i) => ({
      userId: `u${i}`,
      rank: i < 3 ? i + 1 : null,
      kills: i < 10 ? 5 : 0,
    }));
    const c = computePayouts(s, results, 50);
    const disbursed =
      (c.totalPaidToPlayers as number) +
      (c.adminCut as number) +
      (c.organizerProfit as number);
    // players(1100+490) + admin(110) + organizer(300) = 2000
    expect(disbursed).toBe(200000);
  });
});
