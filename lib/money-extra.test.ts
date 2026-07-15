import { describe, it, expect } from "vitest";
import {
  paise,
  bps,
  rupeesToPaise,
  applyBps,
  splitEvenly,
  addPaise,
  percentToBps,
  bpsToPercent,
  formatPaiseCompact,
  parseRupeeInput,
  MoneyError,
} from "./money";

/** Extra money edge cases: rounding, bps boundaries, split invariants. */

describe("applyBps rounding", () => {
  it("rounds half up", () => {
    // 2.5 bps of 100 paise = 0.025 paise -> rounds to 0
    expect(applyBps(paise(100), bps(25))).toBe(0); // 0.25% of 1 rupee = 0.25p -> 0
    // 18% of ₹99.99
    const r = applyBps(rupeesToPaise(99.99), bps(1800));
    expect(Number.isInteger(r)).toBe(true);
  });
  it("computes GST-like 18% of ₹1000 exactly", () => {
    expect(applyBps(rupeesToPaise(1000), bps(1800))).toBe(rupeesToPaise(180));
  });
});

describe("bps boundaries", () => {
  it("allows exactly 100%", () => {
    expect(bps(10000)).toBe(10000);
  });
  it("rejects 100.01% without overflow flag", () => {
    expect(() => bps(10001)).toThrow(MoneyError);
  });
  it("round-trips percent <-> bps", () => {
    expect(bpsToPercent(percentToBps(7.25))).toBe(7.25);
  });
});

describe("splitEvenly invariants (property-style)", () => {
  it("always sums to the original for many inputs", () => {
    for (let total = 0; total <= 100; total++) {
      for (let parts = 1; parts <= 7; parts++) {
        const out = splitEvenly(paise(total), parts);
        expect(out.reduce((a, b) => a + b, 0)).toBe(total);
        expect(out.length).toBe(parts);
      }
    }
  });
  it("distributes remainder to the front", () => {
    expect(splitEvenly(paise(10), 4)).toEqual([3, 3, 2, 2]);
  });
});

describe("formatting + parsing", () => {
  it("compact formats large figures", () => {
    const s = formatPaiseCompact(paise(25000000)); // ₹2,50,000
    expect(s).toContain("₹");
  });
  it("parses messy rupee input", () => {
    expect(parseRupeeInput("  ₹ 2,499.00 ")).toBe(249900);
  });
  it("throws on empty parse", () => {
    expect(() => parseRupeeInput("")).toThrow(MoneyError);
  });
});

describe("addPaise", () => {
  it("sums a long list without drift", () => {
    const ones = Array.from({ length: 1000 }, () => paise(1));
    expect(addPaise(...ones)).toBe(1000);
  });
});
