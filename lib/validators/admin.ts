import { z } from "zod";

/** Validators for the governance domain — announcements + featured placements. */

/**
 * An announcement's window is validated here rather than only at the DB CHECK
 * so the user gets a field error instead of a 500 (CLAUDE.md: every server
 * action validates with Zod before touching the DB).
 */
export const announcementSchema = z
  .object({
    scope: z.enum(["global", "community", "event"]).default("global"),
    scope_id: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(3, "Title is too short.").max(120),
    body: z.string().trim().max(4000).optional(),
    level: z.enum(["info", "warning", "critical"]).default("info"),
    active_from: z.string().datetime().optional(),
    active_to: z.string().datetime().nullable().optional(),
  })
  .refine((v) => (v.scope === "global" ? !v.scope_id : Boolean(v.scope_id)), {
    message: "Pick a target for a community or event announcement.",
    path: ["scope_id"],
  })
  .refine(
    (v) =>
      !v.active_to ||
      !v.active_from ||
      new Date(v.active_to) > new Date(v.active_from),
    { message: "The end time must be after the start time.", path: ["active_to"] },
  );
export type AnnouncementInput = z.infer<typeof announcementSchema>;

/**
 * Platform settings (ROADMAP 6.1).
 *
 * Rates are in BASIS POINTS, matching how they're stored and how lib/money
 * applies them — a percentage never appears in the pipeline (#1). The bounds
 * are business limits, not just type limits: a fee above 100% would take more
 * than was collected, and a slot hold under a minute breaks checkout while one
 * over a day parks slots indefinitely.
 */
export const platformSettingsSchema = z.object({
  platform_fee_bps: z
    .number()
    .int("Use whole basis points.")
    .min(0, "A fee can't be negative.")
    .max(10_000, "A fee can't exceed 100%."),
  fallback_gateway_fee_bps: z
    .number()
    .int("Use whole basis points.")
    .min(0, "A fee can't be negative.")
    .max(10_000, "A fee can't exceed 100%."),
  slot_hold_ttl_seconds: z
    .number()
    .int()
    .min(60, "Hold slots for at least a minute.")
    .max(86_400, "Don't hold slots for more than a day."),
  membership_default_paise: z
    .number()
    .int("Money must be whole paise.")
    .min(0, "Can't be negative."),
  maintenance_mode: z.boolean().default(false),
  payouts_mode: z.enum(["manual", "razorpayx"]).default("manual"),
  feature_store: z.boolean().default(true),
  feature_sponsors: z.boolean().default(true),
  feature_communities: z.boolean().default(true),
});
export type PlatformSettingsInput = z.infer<typeof platformSettingsSchema>;

export const featuredSchema = z.object({
  kind: z.enum(["event", "community"]),
  target_id: z.string().uuid(),
  reason: z.enum(["hype", "deal", "partner"]).default("hype"),
  sort_order: z.number().int().min(0).max(999).default(0),
  active: z.boolean().default(true),
});
export type FeaturedInput = z.infer<typeof featuredSchema>;
