import { describe, it, expect } from "vitest";
import {
  eventCreateSchema,
  registerSchema,
  resultsUploadSchema,
} from "./event";

const baseEvent = {
  title: "Friday Night Free Fire",
  game_id: "550e8400-e29b-41d4-a716-446655440000",
  max_slots: 50,
  entry_fee_rupees: 40,
};

describe("eventCreateSchema", () => {
  it("accepts a valid minimal event", () => {
    const r = eventCreateSchema.safeParse(baseEvent);
    expect(r.success).toBe(true);
  });

  it("rejects a too-short title", () => {
    const r = eventCreateSchema.safeParse({ ...baseEvent, title: "ab" });
    expect(r.success).toBe(false);
  });

  it("rejects fewer than 2 slots", () => {
    const r = eventCreateSchema.safeParse({ ...baseEvent, max_slots: 1 });
    expect(r.success).toBe(false);
  });

  it("rejects a negative entry fee", () => {
    const r = eventCreateSchema.safeParse({ ...baseEvent, entry_fee_rupees: -5 });
    expect(r.success).toBe(false);
  });

  it("rejects a non-uuid game id", () => {
    const r = eventCreateSchema.safeParse({ ...baseEvent, game_id: "not-a-uuid" });
    expect(r.success).toBe(false);
  });

  it("defaults visibility to public and fill policy to scale_down", () => {
    const r = eventCreateSchema.parse(baseEvent);
    expect(r.visibility).toBe("public");
    expect(r.fill_policy).toBe("scale_down");
  });

  it("enforces registration closes <= start", () => {
    const r = eventCreateSchema.safeParse({
      ...baseEvent,
      registration_closes_at: "2026-07-10T10:00:00.000Z",
      starts_at: "2026-07-09T10:00:00.000Z", // before close — invalid
    });
    expect(r.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts an event id with empty form data", () => {
    const r = registerSchema.safeParse({
      event_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(r.success).toBe(true);
  });
  it("rejects a missing event id", () => {
    expect(registerSchema.safeParse({}).success).toBe(false);
  });
});

describe("resultsUploadSchema", () => {
  it("accepts rows with a screenshot", () => {
    const r = resultsUploadSchema.safeParse({
      event_id: "550e8400-e29b-41d4-a716-446655440000",
      screenshot_path: "org/event_123.jpg",
      rows: [
        { user_id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8", rank: 1, kills: 7 },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty rows array", () => {
    const r = resultsUploadSchema.safeParse({
      event_id: "550e8400-e29b-41d4-a716-446655440000",
      screenshot_path: "x.jpg",
      rows: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a missing screenshot", () => {
    const r = resultsUploadSchema.safeParse({
      event_id: "550e8400-e29b-41d4-a716-446655440000",
      screenshot_path: "",
      rows: [{ user_id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8", rank: 1, kills: 0 }],
    });
    expect(r.success).toBe(false);
  });
});
