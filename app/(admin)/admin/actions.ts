"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";

/** Guard: every admin action requires superadmin (defense in depth + RLS). */
async function requireSuperadmin() {
  const { user, isSuperadmin } = await getAuthContext();
  if (!user || !isSuperadmin) return null;
  return user;
}

/** Grant a role to a user (e.g. promote to organizer). Audited. */
export async function grantRole(input: {
  user_id: string;
  role: "player" | "organizer" | "superadmin";
}): Promise<ActionResult> {
  const admin = await requireSuperadmin();
  if (!admin) return fail("Not authorized.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("user_roles")
    .upsert(
      { user_id: input.user_id, role: input.role, granted_by: admin.id },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
  if (error) return fail("Could not grant role.");

  await supabase.rpc("write_audit_log", {
    p_action: "grant_role",
    p_target_table: "user_roles",
    p_target_id: input.user_id,
    p_after: { role: input.role },
  });

  revalidatePath("/admin/users");
  return ok(undefined, `Granted ${input.role}.`);
}

/** Revoke a role from a user. Audited. Won't remove the last superadmin. */
export async function revokeRole(input: {
  user_id: string;
  role: "player" | "organizer" | "superadmin";
}): Promise<ActionResult> {
  const admin = await requireSuperadmin();
  if (!admin) return fail("Not authorized.");

  const supabase = await createSupabaseServerClient();

  if (input.role === "superadmin") {
    const { count } = await supabase
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "superadmin");
    if ((count ?? 0) <= 1) {
      return fail("Cannot remove the last superadmin.");
    }
  }

  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", input.user_id)
    .eq("role", input.role);
  if (error) return fail("Could not revoke role.");

  await supabase.rpc("write_audit_log", {
    p_action: "revoke_role",
    p_target_table: "user_roles",
    p_target_id: input.user_id,
    p_before: { role: input.role },
  });

  revalidatePath("/admin/users");
  return ok(undefined, `Revoked ${input.role}.`);
}

/** Approve a sponsorship request -> publish it as a sponsor row. */
export async function approveSponsorship(input: {
  request_id: string;
}): Promise<ActionResult> {
  const admin = await requireSuperadmin();
  if (!admin) return fail("Not authorized.");

  const supabase = await createSupabaseServerClient();
  const { data: req } = await supabase
    .from("sponsorship_requests")
    .select("*")
    .eq("id", input.request_id)
    .single();
  if (!req) return fail("Request not found.");

  await supabase.from("sponsors").insert({
    name: req.sponsor_name,
    details: req.details,
    community_id: req.target_community_id,
    published_by: admin.id,
    is_active: true,
  });

  await supabase
    .from("sponsorship_requests")
    .update({ status: "published", routed_to: admin.id })
    .eq("id", input.request_id);

  revalidatePath("/admin/sponsors");
  revalidatePath("/sponsors");
  return ok(undefined, "Sponsor published.");
}

export async function rejectSponsorship(input: {
  request_id: string;
}): Promise<ActionResult> {
  const admin = await requireSuperadmin();
  if (!admin) return fail("Not authorized.");
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("sponsorship_requests")
    .update({ status: "rejected", routed_to: admin.id })
    .eq("id", input.request_id);
  revalidatePath("/admin/sponsors");
  return ok(undefined, "Request rejected.");
}

/** Toggle a community's featured flag (admin-only column). */
export async function toggleFeatured(input: {
  community_id: string;
  featured: boolean;
}): Promise<ActionResult> {
  const admin = await requireSuperadmin();
  if (!admin) return fail("Not authorized.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("communities")
    .update({ is_featured: input.featured })
    .eq("id", input.community_id);
  if (error) return fail("Could not update.");
  revalidatePath("/admin");
  return ok(undefined, input.featured ? "Featured." : "Unfeatured.");
}
