import { describe, it, expect } from "vitest";
import {
  paise,
  signedPaise,
  bps,
  rupeesToPaise,
  paiseToRupees,
  percentToBps,
  bpsToPercent,
  addPaise,
  subPaise,
  mulPaise,
  applyBps,
  splitEvenly,
  formatPaise,
  formatBps,
  parseRupeeInput,
  maxPaise,
  minPaise,
  MoneyError,
  ZERO,
  BPS_FULL,
} from "./money";

describe("construction & guards", () => {
  it("accepts non-negative safe integers as paise", () => {
    expect(paise(0)).toBe(0);
    expect(paise(2000)).toBe(2000);
  });

  it("rejects negative paise", () => {
    expect(() => paise(-1)).toThrow(MoneyError);
  });

  it("rejects non-integer paise", () => {
    expect(() => paise(10.5)).toThrow(MoneyError);
  });

  it("rejects NaN / Infinity", () => {
    expect(() => paise(NaN)).toThrow(MoneyError);
    expect(() => paise(Infinity)).toThrow(MoneyError);
  });

  it("signedPaise allows negatives (ledger deltas)", () => {
    expect(signedPaise(-500)).toBe(-500);
  });

  it("bps rejects values over 100% unless allowOverflow", () => {
    expect(() => bps(BPS_FULL + 1)).toThrow(MoneyError);
    expect(bps(BPS_FULL + 1, { allowOverflow: true })).toBe(10001);
  });
});

describe("conversions", () => {
  it("rupees -> paise (whole)", () => {
    expect(rupeesToPaise(40)).toBe(4000);
    expect(rupeesToPaise(2000)).toBe(200000);
  });

  it("rupees -> paise (decimal, no float drift)", () => {
    expect(rupeesToPaise(39.95)).toBe(3995);
    expect(rupeesToPaise(0.1)).toBe(10);
    expect(rupeesToPaise(0.01)).toBe(1);
    expect(rupeesToPaise(19.99)).toBe(1999);
  });

  it("paise -> rupees", () => {
    expect(paiseToRupees(paise(4000))).toBe(40);
    expect(paiseToRupees(paise(3995))).toBe(39.95);
  });

  it("percent <-> bps", () => {
    expect(percentToBps(5.5)).toBe(550);
    expect(percentToBps(100)).toBe(10000);
    expect(bpsToPercent(bps(250))).toBe(2.5);
  });
});

describe("arithmetic", () => {
  it("adds and subtracts in integer paise", () => {
    expect(addPaise(paise(700_00), paise(300_00), paise(100_00))).toBe(110000);
    expect(subPaise(paise(2000_00), paise(110_00))).toBe(189000);
  });

  it("multiplies by an integer factor", () => {
    // 50 players * ₹40 = ₹2000
    expect(mulPaise(rupeesToPaise(40), 50)).toBe(200000);
  });

  it("applyBps rounds half-up to whole paise", () => {
    // 5.5% of ₹2000 = ₹110.00
    expect(applyBps(rupeesToPaise(2000), bps(550))).toBe(11000);
    // 3.7% of ₹99.99 -> round
    const r = applyBps(rupeesToPaise(99.99), bps(370));
    expect(Number.isInteger(r)).toBe(true);
  });

  it("max / min", () => {
    expect(maxPaise(paise(490_00), paise(500_00))).toBe(50000);
    expect(minPaise(paise(490_00), paise(500_00))).toBe(49000);
  });
});

describe("splitEvenly — never loses or invents a paise", () => {
  it("splits evenly when divisible", () => {
    const parts = splitEvenly(paise(900), 3);
    expect(parts).toEqual([300, 300, 300]);
  });

  it("distributes the remainder deterministically (largest-remainder)", () => {
    const parts = splitEvenly(paise(1000), 3); // 1000/3
    expect(parts).toEqual([334, 333, 333]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it("handles 1 paise across many parts", () => {
    const parts = splitEvenly(paise(1), 4);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("rejects non-positive parts", () => {
    expect(() => splitEvenly(paise(100), 0)).toThrow(MoneyError);
  });
});

describe("formatting (display only)", () => {
  it("formats paise as INR", () => {
    expect(formatPaise(paise(700000))).toBe("₹7,000.00");
    expect(formatPaise(paise(3995))).toBe("₹39.95");
  });

  it("compactWhole drops .00 for whole rupees", () => {
    expect(formatPaise(paise(700000), { compactWhole: true })).toBe("₹7,000");
    // non-whole still shows decimals
    expect(formatPaise(paise(399550), { compactWhole: true })).toBe("₹3,995.50");
  });

  it("formats bps as percent", () => {
    expect(formatBps(bps(550))).toBe("5.5%");
    expect(formatBps(bps(1000))).toBe("10%");
  });

  it("parses user rupee input", () => {
    expect(parseRupeeInput("₹1,200.50")).toBe(120050);
    expect(parseRupeeInput("1200")).toBe(120000);
    expect(() => parseRupeeInput("abc")).toThrow(MoneyError);
  });
});

describe("ZERO", () => {
  it("is paise 0", () => {
    expect(ZERO).toBe(0);
    expect(addPaise(ZERO, paise(100))).toBe(100);
  });
});

/**
 * THE CANONICAL PRIZE TEST from the project plan:
 * 50 players × ₹40 = ₹2000 pool
 *  → 1st ₹700 · 2nd ₹300 · 3rd ₹100 · per-kill ₹10 (cap ₹490)
 *  · admin ₹110 · organizer ₹300
 *  Check: 1100 + 490 + 110 + 300 = 2000 ✓
 * This guards the money primitives the prize engine (Phase 2) will build on.
 */
describe("canonical prize split (₹2000 pool)", () => {
  it("the documented split sums exactly to the collected pool", () => {
    const entryFee = rupeesToPaise(40);
    const players = 50;
    const pool = mulPaise(entryFee, players);
    expect(pool).toBe(200000); // ₹2000

    const first = rupeesToPaise(700);
    const second = rupeesToPaise(300);
    const third = rupeesToPaise(100);
    const rankTotal = addPaise(first, second, third); // ₹1100
    expect(rankTotal).toBe(110000);

    const killCap = rupeesToPaise(490);
    const adminCut = rupeesToPaise(110);
    const organizerProfit = rupeesToPaise(300);

    const grandTotal = addPaise(rankTotal, killCap, adminCut, organizerProfit);
    expect(grandTotal).toBe(pool); // 2000 == 2000 ✓
    expect(subPaise(pool, grandTotal)).toBe(0);
  });

  it("per-kill budget is capped (60 kills × ₹10 capped at ₹490)", () => {
    const perKill = rupeesToPaise(10);
    const killCap = rupeesToPaise(490);
    const sixtyKills = mulPaise(perKill, 60); // ₹600
    const paidKillBudget = minPaise(sixtyKills, killCap);
    expect(paidKillBudget).toBe(49000); // ₹490 cap holds
  });
});
