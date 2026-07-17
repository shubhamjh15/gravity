import { describe, it, expect } from "vitest";
import {
  communityCreateSchema,
  postSchema,
  chatMessageSchema,
  matchInviteSchema,
} from "./community";

describe("communityCreateSchema", () => {
  it("accepts a valid free community", () => {
    expect(communityCreateSchema.safeParse({ name: "Mumbai Fire" }).success).toBe(true);
  });
  it("rejects a 2-char name", () => {
    expect(communityCreateSchema.safeParse({ name: "ab" }).success).toBe(false);
  });
  it("defaults to public + unpaid", () => {
    const r = communityCreateSchema.parse({ name: "Squad" });
    expect(r.visibility).toBe("public");
    expect(r.is_paid).toBe(false);
  });
});

describe("postSchema", () => {
  it("requires a non-empty body", () => {
    expect(
      postSchema.safeParse({
        community_id: "550e8400-e29b-41d4-a716-446655440000",
        body: "",
      }).success,
    ).toBe(false);
  });
  it("accepts a valid post", () => {
    expect(
      postSchema.safeParse({
        community_id: "550e8400-e29b-41d4-a716-446655440000",
        body: "GG everyone!",
      }).success,
    ).toBe(true);
  });
});

describe("chatMessageSchema", () => {
  it("rejects an empty message", () => {
    expect(
      chatMessageSchema.safeParse({
        channel_id: "550e8400-e29b-41d4-a716-446655440000",
        body: "",
      }).success,
    ).toBe(false);
  });
  it("rejects a >1000 char message", () => {
    expect(
      chatMessageSchema.safeParse({
        channel_id: "550e8400-e29b-41d4-a716-446655440000",
        body: "x".repeat(1001),
      }).success,
    ).toBe(false);
  });
});

describe("matchInviteSchema", () => {
  it("accepts a recipient uuid", () => {
    expect(
      matchInviteSchema.safeParse({
        to_user: "550e8400-e29b-41d4-a716-446655440000",
      }).success,
    ).toBe(true);
  });
  it("rejects a non-uuid recipient", () => {
    expect(matchInviteSchema.safeParse({ to_user: "nope" }).success).toBe(false);
  });
});
