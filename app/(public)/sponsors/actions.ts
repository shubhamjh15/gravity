"use server";

import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { ok, fail, zodErrors, type ActionResult } from "@/lib/action-result";
import { rupeesToPaise } from "@/lib/money";

/**
 * Submit a sponsorship request. Public (anyone can submit) — routed to the
 * super-admin and optionally a targeted community admin. Uses the service role
 * since submitters may be unauthenticated; we validate strictly first.
 */
const requestSchema = z.object({
  sponsor_name: z.string().trim().min(2, "Enter the sponsor / brand name.").max(120),
  contact_email: z.string().trim().email("Enter a valid email."),
  contact_phone: z.string().trim().max(20).optional(),
  details: z.string().trim().max(2000).optional(),
  budget_rupees: z.number().min(0).optional(),
  target_community_id: z.string().uuid().nullable().optional(),
});

export async function submitSponsorshipRequest(
  input: unknown,
): Promise<ActionResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodErrors(parsed.error.issues));
  }
  const d = parsed.data;

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("sponsorship_requests").insert({
    sponsor_name: d.sponsor_name,
    contact_email: d.contact_email,
    contact_phone: d.contact_phone ?? null,
    details: d.details ?? null,
    budget_paise: d.budget_rupees ? Number(rupeesToPaise(d.budget_rupees)) : null,
    target_community_id: d.target_community_id ?? null,
    status: "pending",
  });

  if (error) return fail("Could not submit your request. Try again.");
  return ok(undefined, "Request submitted! Our team will reach out soon.");
}
