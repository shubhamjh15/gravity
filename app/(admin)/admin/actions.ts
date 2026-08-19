"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { ok, fail, zodErrors, type ActionResult } from "@/lib/action-result";
import { announcementSchema, featuredSchema } from "@/lib/validators/admin";

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

// ---------------------------------------------------------------------------
// Audited PII reveal (ROADMAP 6.1 · NON-NEGOTIABLE #6)
// ---------------------------------------------------------------------------

export type RevealedPii = {
  upi_id: string | null;
  phone: string | null;
  gov_id_type: string | null;
  kyc_status: string | null;
};

/**
 * Reveal one player's contact/payout PII to a superadmin.
 *
 * The users page previously *said* reveals were audited while never reading PII
 * and never writing an audit row. This is the real path: the RPC re-checks
 * superadmin in the database, writes the audit entry BEFORE returning, and
 * hands back only the summary fields — never the gov-ID document path, which
 * needs its own separately-audited signed URL.
 *
 * PII is returned to the caller only, on an explicit click. It is never
 * included in the page's initial payload.
 */
export async function revealPlayerPii(input: {
  user_id: string;
  reason?: string;
}): Promise<ActionResult<RevealedPii>> {
  const admin = await requireSuperadmin();
  if (!admin) return fail("Not authorized.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = (await supabase.rpc("reveal_player_pii", {
    p_user_id: input.user_id,
    p_reason: input.reason ?? undefined,
  })) as { data: RevealedPii[] | null; error: { message: string } | null };

  if (error) return fail("Could not reveal details.");

  const row = data?.[0];
  if (!row) {
    return ok(
      { upi_id: null, phone: null, gov_id_type: null, kyc_status: null },
      "This player hasn't added any details yet.",
    );
  }

  return ok(row, "Revealed. This access has been logged.");
}

// ---------------------------------------------------------------------------
// Announcements (SCHEMA.md §7 · ROADMAP 3.8 + 6.1)
// ---------------------------------------------------------------------------

/**
 * Publish an announcement. Superadmins may target any scope; a community owner
 * may target their own community — RLS enforces that, this check only produces
 * a friendlier message.
 */
export async function createAnnouncement(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { user } = await getAuthContext();
  if (!user) return fail("You must be logged in.");

  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the announcement.", zodErrors(parsed.error.issues));
  }
  const a = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      scope: a.scope,
      scope_id: a.scope === "global" ? null : (a.scope_id ?? null),
      title: a.title,
      body: a.body ?? null,
      level: a.level,
      active_from: a.active_from ?? new Date().toISOString(),
      active_to: a.active_to ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return fail("Could not publish the announcement. Check your permissions.");
  }

  await supabase.rpc("write_audit_log", {
    p_action: "create_announcement",
    p_target_table: "announcements",
    p_target_id: data.id,
    p_after: { scope: a.scope, scope_id: a.scope_id ?? null, title: a.title },
  });

  revalidatePath("/admin/announcements");
  revalidatePath("/");
  return ok({ id: data.id }, "Announcement published.");
}

/** Soft-delete an announcement (never hard-delete business data). */
export async function retireAnnouncement(input: {
  announcement_id: string;
}): Promise<ActionResult> {
  const { user } = await getAuthContext();
  if (!user) return fail("You must be logged in.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("announcements")
    .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", input.announcement_id);
  if (error) return fail("Could not retire the announcement.");

  await supabase.rpc("write_audit_log", {
    p_action: "retire_announcement",
    p_target_table: "announcements",
    p_target_id: input.announcement_id,
  });

  revalidatePath("/admin/announcements");
  revalidatePath("/");
  return ok(undefined, "Announcement retired.");
}

// ---------------------------------------------------------------------------
// Featured placements (SCHEMA.md §7 · ROADMAP 6.1)
// ---------------------------------------------------------------------------

/** Feature an event or community. Upserts, so re-featuring re-orders. */
export async function setFeaturedPlacement(
  input: unknown,
): Promise<ActionResult> {
  const admin = await requireSuperadmin();
  if (!admin) return fail("Not authorized.");

  const parsed = featuredSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the placement.", zodErrors(parsed.error.issues));
  }
  const f = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("featured_placements").upsert(
    {
      kind: f.kind,
      target_id: f.target_id,
      reason: f.reason,
      sort_order: f.sort_order,
      active: f.active,
      created_by: admin.id,
    },
    { onConflict: "kind,target_id" },
  );
  if (error) return fail("Could not update the placement.");

  await supabase.rpc("write_audit_log", {
    p_action: "set_featured_placement",
    p_target_table: "featured_placements",
    p_target_id: f.target_id,
    p_after: { kind: f.kind, reason: f.reason, active: f.active },
  });

  revalidatePath("/admin/announcements");
  revalidatePath("/");
  return ok(undefined, f.active ? "Featured." : "Placement paused.");
}

/** Remove a featured placement outright. */
export async function removeFeaturedPlacement(input: {
  placement_id: string;
}): Promise<ActionResult> {
  const admin = await requireSuperadmin();
  if (!admin) return fail("Not authorized.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("featured_placements")
    .delete()
    .eq("id", input.placement_id);
  if (error) return fail("Could not remove the placement.");

  await supabase.rpc("write_audit_log", {
    p_action: "remove_featured_placement",
    p_target_table: "featured_placements",
    p_target_id: input.placement_id,
  });

  revalidatePath("/admin/announcements");
  revalidatePath("/");
  return ok(undefined, "Placement removed.");
}
