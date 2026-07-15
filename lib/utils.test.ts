import { describe, it, expect } from "vitest";
import { slugify, clamp, cn } from "./utils";

describe("slugify", () => {
  it("lowercases and dashes spaces", () => {
    expect(slugify("Friday Night Showdown")).toBe("friday-night-showdown");
  });
  it("strips punctuation", () => {
    expect(slugify("BGMI #1 Cup!!")).toBe("bgmi-1-cup");
  });
  it("collapses repeated separators", () => {
    expect(slugify("a   ---   b")).toBe("a-b");
  });
  it("trims leading/trailing dashes", () => {
    expect(slugify("  -hello-  ")).toBe("hello");
  });
  it("handles unicode letters/numbers", () => {
    expect(slugify("Free Fire 2024")).toBe("free-fire-2024");
  });
  it("caps length at 80 chars", () => {
    expect(slugify("x".repeat(200)).length).toBeLessThanOrEqual(80);
  });
  it("returns empty for all-symbol input", () => {
    expect(slugify("@#$%")).toBe("");
  });
});

describe("clamp", () => {
  it("clamps below min", () => expect(clamp(-5, 0, 10)).toBe(0));
  it("clamps above max", () => expect(clamp(99, 0, 10)).toBe(10));
  it("passes through in range", () => expect(clamp(5, 0, 10)).toBe(5));
  it("handles equal bounds", () => expect(clamp(3, 5, 5)).toBe(5));
});

describe("cn (class merge)", () => {
  it("merges conditional classes", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
  it("dedupes conflicting tailwind utilities (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
  it("keeps non-conflicting utilities", () => {
    expect(cn("text-sm", "font-bold")).toContain("text-sm");
  });
});
