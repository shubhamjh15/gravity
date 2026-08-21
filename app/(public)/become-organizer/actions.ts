"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { ok, fail, zodErrors, type ActionResult } from "@/lib/action-result";
import { organizerApplicationSchema } from "@/lib/validators/organizer";

/**
 * Organizer applications.
 *
 * Approval is the ONLY path that grants the role, and it happens inside
 * review_organizer_application() — a SECURITY DEFINER RPC that records the
 * decision and grants the role in one transaction. Nothing here can hand out a
 * role (#2), least of all to the applicant themselves.
 */
export async function applyForOrganizer(input: unknown): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("Please log in first.");

  const parsed = organizerApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodErrors(parsed.error.issues));
  }
  const a = parsed.data;

  const supabase = await createSupabaseServerClient();

  // Re-applying after a rejection reuses the row (one per user) and puts it
  // back in the queue with a clean review state.
  const { error } = await supabase.from("organizer_applications").upsert(
    {
      user_id: user.id,
      org_name: a.org_name,
      games: a.games ?? null,
      experience: a.experience,
      audience_size: a.audience_size ?? null,
      links: a.links ?? null,
      status: "pending",
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
    },
    { onConflict: "user_id" },
  );

  if (error) return fail("Could not submit your application. Please try again.");

  revalidatePath("/become-organizer");
  revalidatePath("/admin/organizers");
  return ok(undefined, "Application submitted — we'll review it shortly.");
}

/** Withdraw a pending application. */
export async function withdrawOrganizerApplication(): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("Please log in first.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("organizer_applications")
    .update({ status: "withdrawn" })
    .eq("user_id", user.id)
    .eq("status", "pending");
  if (error) return fail("Could not withdraw your application.");

  revalidatePath("/become-organizer");
  return ok(undefined, "Application withdrawn.");
}

/** Superadmin decision. The RPC grants the role atomically and audits it. */
export async function reviewOrganizerApplication(input: {
  application_id: string;
  approve: boolean;
  review_note?: string;
}): Promise<ActionResult<{ outcome: string }>> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = (await supabase.rpc("review_organizer_application", {
    p_application_id: input.application_id,
    p_approve: input.approve,
    p_review_note: input.review_note ?? undefined,
  })) as { data: string | null; error: { message: string } | null };

  if (error) {
    if (/ALREADY_REVIEWED/.test(error.message)) {
      return fail("That application has already been reviewed.");
    }
    return fail("Could not review this application. Check your permissions.");
  }

  revalidatePath("/admin/organizers");
  revalidatePath("/admin/users");
  return ok(
    { outcome: data ?? "reviewed" },
    input.approve ? "Organizer approved." : "Application rejected.",
  );
}
