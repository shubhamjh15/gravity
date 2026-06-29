import { z } from "zod";

/**
 * Event + registration + prize validators. The organizer's create form sends
 * rupee figures and human inputs; we validate shape here and convert to paise
 * in the server action (single conversion point via lib/money).
 */

// A single dynamic registration field the organizer can define.
export const registrationFieldSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
  type: z.enum(["text", "number", "select", "tel"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(), // for select
});
export type RegistrationField = z.infer<typeof registrationFieldSchema>;

export const eventCreateSchema = z
  .object({
    title: z.string().trim().min(4, "Title is too short.").max(100),
    game_id: z.string().uuid("Pick a game."),
    community_id: z.string().uuid().nullable().optional(),
    description: z.string().trim().max(4000).optional(),
    dos_and_donts: z.string().trim().max(4000).optional(),
    rules: z.string().trim().max(8000).optional(),
    visibility: z.enum(["public", "private"]).default("public"),
    requires_approval: z.boolean().default(false),
    gov_id_required: z.boolean().default(false),
    max_slots: z
      .number()
      .int("Slots must be a whole number.")
      .min(2, "Need at least 2 slots.")
      .max(10000, "That's a lot of slots."),
    // rupees from the form; converted to paise server-side
    entry_fee_rupees: z.number().min(0, "Entry fee can't be negative."),
    registration_fields: z.array(registrationFieldSchema).default([]),
    registration_opens_at: z.string().datetime().nullable().optional(),
    registration_closes_at: z.string().datetime().nullable().optional(),
    starts_at: z.string().datetime().nullable().optional(),
    ends_at: z.string().datetime().nullable().optional(),
    banner_path: z.string().nullable().optional(),

    // prize structure (rupees)
    rank_prizes_rupees: z
      .array(z.object({ rank: z.number().int().min(1), amount: z.number().min(0) }))
      .default([]),
    per_kill_rupees: z.number().min(0).default(0),
    kill_budget_cap_rupees: z.number().min(0).default(0),
    admin_cut_rupees: z.number().min(0).default(0),
    organizer_profit_rupees: z.number().min(0).default(0),
    fill_policy: z.enum(["scale_down", "guaranteed"]).default("scale_down"),
    kill_surplus_policy: z
      .enum(["to_organizer", "to_admin", "to_prize", "destroy"])
      .default("to_organizer"),
  })
  .refine(
    (v) =>
      !v.registration_closes_at ||
      !v.starts_at ||
      new Date(v.registration_closes_at) <= new Date(v.starts_at),
    {
      message: "Registration must close on or before the tournament starts.",
      path: ["registration_closes_at"],
    },
  );
export type EventCreateInput = z.infer<typeof eventCreateSchema>;

export const registerSchema = z.object({
  event_id: z.string().uuid(),
  form_data: z.record(z.string(), z.unknown()).default({}),
});
export type RegisterInput = z.infer<typeof registerSchema>;

// Results upload: one row per participant.
export const resultRowSchema = z.object({
  user_id: z.string().uuid(),
  rank: z.number().int().min(1).nullable(),
  kills: z.number().int().min(0).default(0),
});
export const resultsUploadSchema = z.object({
  event_id: z.string().uuid(),
  screenshot_path: z.string().min(1, "Upload the leaderboard screenshot."),
  rows: z.array(resultRowSchema).min(1, "Add at least one result row."),
});
export type ResultsUploadInput = z.infer<typeof resultsUploadSchema>;
