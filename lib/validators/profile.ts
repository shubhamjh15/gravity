import { z } from "zod";

/**
 * Zod validators for the profile domain. Every server action validates its
 * input with one of these before touching the DB (production rule). Keep the
 * messages user-friendly — they surface in the form UI.
 */

export const profileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(40, "Name must be under 40 characters."),
  age: z
    .number({ message: "Enter a valid age." })
    .int("Age must be a whole number.")
    .min(13, "You must be at least 13.")
    .max(100, "Enter a valid age.")
    .nullable()
    .optional(),
  gender: z
    .enum(["male", "female", "other", "undisclosed"])
    .nullable()
    .optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

/** Sensitive PII — written to profiles_private only. */
export const privateProfileSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number.")
    .or(z.literal(""))
    .optional(),
  upi_id: z
    .string()
    .trim()
    .regex(/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/, "Enter a valid UPI ID (e.g. name@bank).")
    .or(z.literal(""))
    .optional(),
  gov_id_type: z
    .enum(["aadhaar", "pan", "dl", "passport", "voter"])
    .nullable()
    .optional(),
});
export type PrivateProfileInput = z.infer<typeof privateProfileSchema>;

/** Per-game profile (one per title). */
export const gameProfileSchema = z.object({
  game_id: z.string().uuid("Pick a game."),
  in_game_id: z
    .string()
    .trim()
    .min(2, "Enter your in-game ID.")
    .max(64, "In-game ID is too long."),
  ign: z.string().trim().max(40, "IGN is too long.").optional(),
  ranking: z.string().trim().max(40).optional(),
  kill_ratio: z
    .number()
    .min(0, "Kill ratio can't be negative.")
    .max(9999, "Enter a realistic kill ratio.")
    .nullable()
    .optional(),
  win_ratio: z
    .number()
    .min(0)
    .max(100, "Win ratio is a percentage (0-100).")
    .nullable()
    .optional(),
});
export type GameProfileInput = z.infer<typeof gameProfileSchema>;

/** Document upload metadata (the file itself goes to a private bucket). */
export const documentUploadSchema = z.object({
  doc_type: z.enum([
    "gov_id",
    "skill_proof",
    "kill_ratio_proof",
    "elite_pass_proof",
  ]),
  file_path: z.string().min(1, "Missing uploaded file path."),
  gov_id_type: z
    .enum(["aadhaar", "pan", "dl", "passport", "voter"])
    .optional(),
});
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
