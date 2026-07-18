import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ok, fail, zodErrors } from "./action-result";

describe("ok / fail", () => {
  it("ok wraps data with success true", () => {
    const r = ok({ id: "1" }, "Created.");
    expect(r).toEqual({ success: true, message: "Created.", data: { id: "1" } });
  });
  it("ok uses a default message", () => {
    expect(ok(42).message).toBe("Done.");
  });
  it("fail carries a message + optional errors", () => {
    const r = fail("Bad", { name: "Required" });
    expect(r.success).toBe(false);
    expect(r.errors).toEqual({ name: "Required" });
  });
});

describe("zodErrors", () => {
  it("maps a flat field error", () => {
    const schema = z.object({ name: z.string().min(3, "Too short") });
    const res = schema.safeParse({ name: "a" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(zodErrors(res.error.issues).name).toBe("Too short");
    }
  });

  it("joins nested paths with dots", () => {
    const schema = z.object({ a: z.object({ b: z.string() }) });
    const res = schema.safeParse({ a: { b: 1 } });
    if (!res.success) {
      expect(Object.keys(zodErrors(res.error.issues))[0]).toBe("a.b");
    }
  });

  it("keeps only the first message per field", () => {
    const schema = z.object({ n: z.number().min(5).max(1) }); // impossible -> may emit several
    const res = schema.safeParse({ n: 3 });
    if (!res.success) {
      const errs = zodErrors(res.error.issues);
      expect(typeof errs.n).toBe("string");
    }
  });
});
