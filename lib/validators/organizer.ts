import { z } from "zod";

/**
 * Organizer application (ROADMAP acceptance: "register + become verified").
 *
 * Deliberately collects no phone or ID. That is PII and lives in
 * profiles_private (#6) — a reviewer who needs it uses the audited reveal path
 * rather than having it copied into a second table.
 */
export const organizerApplicationSchema = z.object({
  org_name: z
    .string()
    .trim()
    .min(2, "Tell us what your org or team is called.")
    .max(80, "That name is too long."),
  games: z.string().trim().max(200).optional(),
  experience: z
    .string()
    .trim()
    .min(30, "Give us a bit more detail — at least a couple of sentences.")
    .max(4000, "That's too long."),
  audience_size: z.string().trim().max(80).optional(),
  links: z.string().trim().max(500).optional(),
});
export type OrganizerApplicationInput = z.infer<typeof organizerApplicationSchema>;
