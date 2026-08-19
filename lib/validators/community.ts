import { z } from "zod";

/** Validators for the community domain. */

export const communityCreateSchema = z.object({
  name: z.string().trim().min(3, "Name is too short.").max(60),
  about: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(120).optional(),
  address: z.string().trim().max(200).optional(),
  rules: z.string().trim().max(4000).optional(),
  visibility: z.enum(["public", "private"]).default("public"),
  is_paid: z.boolean().default(false),
  requires_approval: z.boolean().default(false),
  membership_cost_rupees: z.number().min(0).default(0),
  profile_pic_path: z.string().nullable().optional(),
  banner_path: z.string().nullable().optional(),
});
export type CommunityCreateInput = z.infer<typeof communityCreateSchema>;

export const postSchema = z.object({
  community_id: z.string().uuid(),
  body: z.string().trim().min(1, "Write something.").max(2000),
  event_id: z.string().uuid().nullable().optional(),
  pinned: z.boolean().default(false),
});
export type PostInput = z.infer<typeof postSchema>;

export const chatMessageSchema = z.object({
  channel_id: z.string().uuid(),
  body: z.string().trim().min(1).max(1000),
});
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

export const matchInviteSchema = z.object({
  to_user: z.string().uuid(),
  game_id: z.string().uuid().nullable().optional(),
  message: z.string().trim().max(200).optional(),
});
export type MatchInviteInput = z.infer<typeof matchInviteSchema>;

/**
 * Elite tier (ROADMAP 3.7). Kill ratio is a display statistic, not money, so a
 * decimal is correct here — it never touches lib/money. Capped at 100 because
 * anything higher is a typo, and the column is numeric(6,2).
 */
export const elitePolicySchema = z.object({
  community_id: z.string().uuid(),
  requires_gov_id: z.boolean().default(true),
  min_kill_ratio: z
    .number()
    .min(0, "Kill ratio can't be negative.")
    .max(100, "That kill ratio isn't realistic.")
    .nullable()
    .optional(),
  rules: z.string().trim().max(4000).optional(),
});
export type ElitePolicyInput = z.infer<typeof elitePolicySchema>;

/**
 * Community-scoped discount / referral code (ROADMAP 3.8).
 *
 * `discount_value` carries two different units depending on `discount_kind`,
 * which is why the action converts it rather than the form: a `pct` code is a
 * whole percent (the RPC divides by 100 in integer math), while a `flat` code
 * is RUPEES that must go through lib/money to become paise (#1).
 */
export const communityCodeSchema = z
  .object({
    community_id: z.string().uuid(),
    code: z
      .string()
      .trim()
      .min(3, "Codes need at least 3 characters.")
      .max(24, "That code is too long.")
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "Use letters, numbers, hyphens and underscores only.",
      )
      .transform((v) => v.toUpperCase()),
    kind: z.enum(["referral", "discount"]).default("discount"),
    discount_kind: z.enum(["pct", "flat"]).default("pct"),
    discount_value: z.number().min(0, "A discount can't be negative."),
    max_uses: z
      .number()
      .int()
      .min(1, "Allow at least one use.")
      .max(1_000_000)
      .nullable()
      .optional(),
    per_user_limit: z.number().int().min(1).max(100).default(1),
    valid_to: z.string().datetime().nullable().optional(),
  })
  .refine(
    (v) => v.discount_kind !== "pct" || v.discount_value <= 100,
    { message: "A percentage discount can't exceed 100%.", path: ["discount_value"] },
  );
export type CommunityCodeInput = z.infer<typeof communityCodeSchema>;

export const eliteApplicationSchema = z.object({
  community_id: z.string().uuid(),
  kill_ratio_claimed: z
    .number()
    .min(0, "Kill ratio can't be negative.")
    .max(100, "That kill ratio isn't realistic.")
    .nullable()
    .optional(),
  note: z.string().trim().max(1000).optional(),
});
export type EliteApplicationInput = z.infer<typeof eliteApplicationSchema>;
