import { describe, it, expect } from "vitest";
import {
  profileSchema,
  privateProfileSchema,
  gameProfileSchema,
} from "./profile";

describe("profileSchema", () => {
  it("accepts a valid name + age", () => {
    expect(profileSchema.safeParse({ display_name: "ProGamer", age: 18 }).success).toBe(true);
  });
  it("rejects a 1-char name", () => {
    expect(profileSchema.safeParse({ display_name: "x" }).success).toBe(false);
  });
  it("rejects under-13 age", () => {
    expect(profileSchema.safeParse({ display_name: "abc", age: 10 }).success).toBe(false);
  });
  it("allows null age", () => {
    expect(profileSchema.safeParse({ display_name: "abc", age: null }).success).toBe(true);
  });
});

describe("privateProfileSchema", () => {
  it("accepts a valid Indian mobile", () => {
    expect(privateProfileSchema.safeParse({ phone: "9876543210" }).success).toBe(true);
  });
  it("rejects a 9-digit phone", () => {
    expect(privateProfileSchema.safeParse({ phone: "987654321" }).success).toBe(false);
  });
  it("rejects a phone starting with 5", () => {
    expect(privateProfileSchema.safeParse({ phone: "5876543210" }).success).toBe(false);
  });
  it("accepts a valid UPI id", () => {
    expect(privateProfileSchema.safeParse({ upi_id: "player@okaxis" }).success).toBe(true);
  });
  it("rejects a malformed UPI id", () => {
    expect(privateProfileSchema.safeParse({ upi_id: "noatsign" }).success).toBe(false);
  });
  it("allows empty strings (optional)", () => {
    expect(privateProfileSchema.safeParse({ phone: "", upi_id: "" }).success).toBe(true);
  });
});

describe("gameProfileSchema", () => {
  const base = {
    game_id: "550e8400-e29b-41d4-a716-446655440000",
    in_game_id: "123456789",
  };
  it("accepts a minimal game profile", () => {
    expect(gameProfileSchema.safeParse(base).success).toBe(true);
  });
  it("rejects an empty in-game id", () => {
    expect(gameProfileSchema.safeParse({ ...base, in_game_id: "" }).success).toBe(false);
  });
  it("rejects a win ratio over 100", () => {
    expect(gameProfileSchema.safeParse({ ...base, win_ratio: 150 }).success).toBe(false);
  });
  it("rejects a negative kill ratio", () => {
    expect(gameProfileSchema.safeParse({ ...base, kill_ratio: -1 }).success).toBe(false);
  });
});
