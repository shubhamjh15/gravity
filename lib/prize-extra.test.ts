import { describe, it, expect } from "vitest";
import { rupeesToPaise } from "./money";
import {
  poolForCount,
  committedTotal,
  validateStructure,
  computePayouts,
  sumRankPrizes,
  PrizeError,
  type PrizeStructure,
} from "./prize";

/**
 * Extra prize-engine edge cases beyond the canonical suite: zero-fill, single
 * player, to_prize routing, guaranteed under-fill payouts, and structure deltas.
 */
function structure(overrides: Partial<PrizeStructure> = {}): PrizeStructure {
  return {
    entryFee: rupeesToPaise(40),
    rankPrizes: { 1: rupeesToPaise(700), 2: rupeesToPaise(300), 3: rupeesToPaise(100) },
    perKill: rupeesToPaise(10),
    killBudgetCap: rupeesToPaise(490),
    adminCut: rupeesToPaise(110),
    organizerProfit: rupeesToPaise(300),
    fillPolicy: "scale_down",
    killSurplusPolicy: "to_organizer",
    maxSlots: 50,
    ...overrides,
  };
}

describe("pool + committed math", () => {
  it("poolForCount scales linearly", () => {
    expect(poolForCount(rupeesToPaise(40), 0)).toBe(0);
    expect(poolForCount(rupeesToPaise(40), 1)).toBe(4000);
    expect(poolForCount(rupeesToPaise(40), 100)).toBe(400000);
  });
  it("poolForCount rejects negatives", () => {
    expect(() => poolForCount(rupeesToPaise(40), -1)).toThrow(PrizeError);
  });
  it("committedTotal sums every bucket", () => {
    expect(committedTotal(structure())).toBe(200000);
  });
  it("sumRankPrizes handles an empty map", () => {
    expect(sumRankPrizes({})).toBe(0);
  });
});

describe("structure delta reporting", () => {
  it("reports a positive delta when over-committed", () => {
    const v = validateStructure(structure({ organizerProfit: rupeesToPaise(400) }));
    expect(v.ok).toBe(false);
    expect(v.deltaPaise).toBe(rupeesToPaise(100)); // +100 over
  });
  it("reports a negative delta when under-committed", () => {
    const v = validateStructure(structure({ adminCut: rupeesToPaise(10) }));
    expect(v.ok).toBe(false);
    expect(v.deltaPaise).toBeLessThan(0);
  });
});

describe("computePayouts edge cases", () => {
  it("zero participants pays nothing to players", () => {
    const c = computePayouts(structure(), [], 0);
    expect(c.totalPaidToPlayers).toBe(0);
    expect(c.collectedPool).toBe(0);
  });

  it("single player gets first prize (scaled by fill)", () => {
    const c = computePayouts(structure(), [{ userId: "a", rank: 1, kills: 0 }], 1);
    // collected = 40, full = 2000 -> heavily scaled
    expect(c.payouts[0].rankPrize).toBeLessThan(rupeesToPaise(700));
  });

  it("guaranteed policy ignores under-fill scaling", () => {
    const c = computePayouts(
      structure({ fillPolicy: "guaranteed" }),
      [{ userId: "a", rank: 1, kills: 0 }],
      1,
    );
    expect(c.scaleFactorBps).toBe(10000);
    expect(c.payouts[0].rankPrize).toBe(rupeesToPaise(700));
  });

  it("to_prize routes leftover kill budget to the top rank", () => {
    const c = computePayouts(
      structure({ killSurplusPolicy: "to_prize" }),
      [{ userId: "a", rank: 1, kills: 0 }],
      50,
    );
    // top rank prize includes the ₹490 surplus
    const first = c.payouts.find((p) => p.rank === 1)!;
    expect(first.rankPrize).toBe(rupeesToPaise(700 + 490));
  });

  it("destroy policy keeps surplus out of all buckets", () => {
    const c = computePayouts(
      structure({ killSurplusPolicy: "destroy" }),
      [{ userId: "a", rank: 1, kills: 0 }],
      50,
    );
    expect(c.killSurplus).toBe(rupeesToPaise(490));
    expect(c.organizerProfit).toBe(rupeesToPaise(300)); // unchanged
  });
});
