"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { ok, fail, zodErrors, type ActionResult } from "@/lib/action-result";
import { rupeesToPaise } from "@/lib/money";
import { communityCodeSchema } from "@/lib/validators/community";
import { announcementSchema } from "@/lib/validators/admin";

/**
 * Community admin tools (ROADMAP 3.8).
 *
 * The announcement table and community-scoped referral codes both existed, but
 * the only composer lived in the superadmin console — a community owner had no
 * way in. These are the owner-facing equivalents.
 *
 * Authority is enforced by RLS in both cases (announcements: "community owner
 * insert"; referral_codes: created_by = auth.uid()). The ownership check here
 * only turns a silent empty result into a clear message.
 */
async function assertOwnsCommunity(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  communityId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("communities")
    .select("id")
    .eq("id", communityId)
    .eq("owner_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/** Post an announcement to this community's members. */
export async function postCommunityAnnouncement(
  input: unknown,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the announcement.", zodErrors(parsed.error.issues));
  }
  const a = parsed.data;

  // An owner may only ever announce to their own community — never globally.
  if (a.scope !== "community" || !a.scope_id) {
    return fail("Community announcements must target this community.");
  }

  const supabase = await createSupabaseServerClient();
  if (!(await assertOwnsCommunity(supabase, a.scope_id, user.id))) {
    return fail("Only the community owner can post announcements.");
  }

  const { error } = await supabase.from("announcements").insert({
    scope: "community",
    scope_id: a.scope_id,
    title: a.title,
    body: a.body ?? null,
    level: a.level,
    active_from: a.active_from ?? new Date().toISOString(),
    active_to: a.active_to ?? null,
    created_by: user.id,
  });
  if (error) return fail("Could not post the announcement.");

  await supabase.rpc("write_audit_log", {
    p_action: "create_community_announcement",
    p_target_table: "announcements",
    p_target_id: a.scope_id,
    p_after: { title: a.title, level: a.level },
  });

  revalidatePath("/communities");
  return ok(undefined, "Announcement posted.");
}

/**
 * Create a discount/referral code scoped to this community.
 *
 * The scope is forced to this community server-side: a community owner must not
 * be able to mint a global code that discounts the whole platform.
 */
export async function createCommunityCode(
  input: unknown,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const parsed = communityCodeSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the code.", zodErrors(parsed.error.issues));
  }
  const c = parsed.data;

  const supabase = await createSupabaseServerClient();
  if (!(await assertOwnsCommunity(supabase, c.community_id, user.id))) {
    return fail("Only the community owner can create codes.");
  }

  // Percent stays a whole percent (the RPC divides by 100 in integer math);
  // a flat discount is money, so it converts through lib/money (#1).
  const discountValue =
    c.discount_kind === "pct"
      ? Math.round(c.discount_value)
      : (rupeesToPaise(c.discount_value) as number);

  const { error } = await supabase.from("referral_codes").insert({
    code: c.code,
    kind: c.kind,
    scope: "community",
    scope_id: c.community_id,
    discount_kind: c.discount_kind,
    discount_value: discountValue,
    max_uses: c.max_uses ?? null,
    per_user_limit: c.per_user_limit,
    valid_to: c.valid_to ?? null,
    is_active: true,
    created_by: user.id,
  });

  if (error) {
    return fail("Could not create the code — is it already taken?", {
      code: "That code may already exist.",
    });
  }

  revalidatePath("/communities");
  return ok(undefined, `Code ${c.code} created.`);
}

/** Deactivate a code this owner created. */
export async function deactivateCommunityCode(input: {
  code_id: string;
}): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("referral_codes")
    .update({ is_active: false })
    .eq("id", input.code_id)
    .eq("created_by", user.id);
  if (error) return fail("Could not deactivate the code.");

  revalidatePath("/communities");
  return ok(undefined, "Code deactivated.");
}
