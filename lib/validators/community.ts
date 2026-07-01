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
