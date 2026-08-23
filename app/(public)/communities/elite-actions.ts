"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { ok, fail, zodErrors, type ActionResult } from "@/lib/action-result";
import {
  eliteApplicationSchema,
  elitePolicySchema,
} from "@/lib/validators/community";

/**
 * Elite tier workflow (ROADMAP 3.7).
 *
 * The policy is per-community and enforced in the DATABASE by
 * review_elite_application — a community owner reviews, but they cannot wave
 * someone past their own gov-ID or kill-ratio bar, and they never see the PII
 * the check reads (#6).
 */

/** Human wording for the exceptions the review RPC raises. */
const REVIEW_ERRORS: Record<string, string> = {
  ELITE_GOV_ID_REQUIRED:
    "This community requires a verified government ID before elite approval.",
  ELITE_KILL_RATIO_TOO_LOW:
    "Their kill ratio is below this community's elite threshold.",
};

function reviewErrorMessage(message: string): string {
  const key = Object.keys(REVIEW_ERRORS).find((k) => message.includes(k));
  return key
    ? REVIEW_ERRORS[key]
    : "Could not review this application. Check your permissions.";
}

/** Community owner sets or updates the elite bar. */
export async function saveElitePolicy(input: unknown): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const parsed = elitePolicySchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the policy.", zodErrors(parsed.error.issues));
  }
  const p = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("elite_policies").upsert(
    {
      community_id: p.community_id,
      requires_gov_id: p.requires_gov_id,
      min_kill_ratio: p.min_kill_ratio ?? null,
      rules: p.rules ?? null,
    },
    { onConflict: "community_id" },
  );
  if (error) return fail("Could not save the policy. Are you the owner?");

  revalidatePath("/communities");
  return ok(undefined, "Elite policy saved.");
}

/** An active member applies for elite status. */
export async function applyForElite(input: unknown): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const parsed = eliteApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix your application.", zodErrors(parsed.error.issues));
  }
  const a = parsed.data;

  const supabase = await createSupabaseServerClient();

  // Re-applying after a rejection updates the existing row (one per member per
  // community) and puts it back in the queue.
  const { error } = await supabase.from("elite_applications").upsert(
    {
      community_id: a.community_id,
      user_id: user.id,
      status: "pending",
      kill_ratio_claimed: a.kill_ratio_claimed ?? null,
      note: a.note ?? null,
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
    },
    { onConflict: "community_id,user_id" },
  );

  if (error) {
    return fail("Could not apply — you must be an active member first.");
  }

  revalidatePath("/communities");
  return ok(undefined, "Application submitted. The organizer will review it.");
}

/** Withdraw a pending application. */
export async function withdrawEliteApplication(input: {
  application_id: string;
}): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("elite_applications")
    .update({ status: "withdrawn" })
    .eq("id", input.application_id)
    .eq("user_id", user.id)
    .eq("status", "pending");
  if (error) return fail("Could not withdraw the application.");

  revalidatePath("/communities");
  return ok(undefined, "Application withdrawn.");
}

/**
 * Owner approves or rejects. The RPC re-checks ownership and enforces the
 * community's policy, so a permissive UI can't grant elite by itself.
 */
export async function reviewEliteApplication(input: {
  application_id: string;
  approve: boolean;
  review_note?: string;
}): Promise<ActionResult<{ outcome: string }>> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = (await supabase.rpc("review_elite_application", {
    p_application_id: input.application_id,
    p_approve: input.approve,
    p_review_note: input.review_note ?? undefined,
  })) as { data: string | null; error: { message: string } | null };

  if (error) return fail(reviewErrorMessage(error.message));

  revalidatePath("/communities");
  return ok(
    { outcome: data ?? "reviewed" },
    input.approve ? "Elite status granted." : "Application rejected.",
  );
}
