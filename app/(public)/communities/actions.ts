"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser, isOrganizer } from "@/lib/auth";
import {
  communityCreateSchema,
  postSchema,
} from "@/lib/validators/community";
import { ok, fail, zodErrors, type ActionResult } from "@/lib/action-result";
import { slugify } from "@/lib/utils";
import { rupeesToPaise, paise } from "@/lib/money";
import { createRazorpayOrder } from "@/lib/razorpay";
import { publicEnv } from "@/lib/env";

/** Create a community (organizers + superadmins). */
export async function createCommunity(
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");
  if (!(await isOrganizer())) {
    return fail("Only organizers can create communities.");
  }

  const parsed = communityCreateSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodErrors(parsed.error.issues));
  }
  const d = parsed.data;

  const supabase = await createSupabaseServerClient();
  const slug = `${slugify(d.name) || "community"}-${Math.random().toString(36).slice(2, 6)}`;
  const inviteSlug = Math.random().toString(36).slice(2, 10);

  const { data: comm, error } = await supabase
    .from("communities")
    .insert({
      owner_id: user.id,
      name: d.name,
      slug,
      about: d.about ?? null,
      location: d.location ?? null,
      address: d.address ?? null,
      rules: d.rules ?? null,
      visibility: d.visibility,
      is_paid: d.is_paid,
      requires_approval: d.requires_approval,
      membership_cost_paise: rupeesToPaise(d.membership_cost_rupees),
      invite_slug: inviteSlug,
      profile_pic_path: d.profile_pic_path ?? null,
      banner_path: d.banner_path ?? null,
      created_by: user.id,
    })
    .select("slug")
    .single();

  if (error || !comm) return fail("Could not create the community.");

  // Owner is auto-added as an active member.
  await supabase.from("community_members").insert({
    community_id: (await supabase.from("communities").select("id").eq("slug", comm.slug).single()).data?.id,
    user_id: user.id,
    status: "active",
    role: "moderator",
    joined_via: "direct",
  });

  revalidatePath("/communities");
  return ok({ slug: comm.slug }, "Community created!");
}

/**
 * Join a community. Free/unpaid -> active (or pending if approval needed).
 * Paid -> create a Razorpay order (membership) settled by the webhook.
 */
export async function joinCommunity(input: {
  community_id: string;
}): Promise<
  ActionResult<{
    paid: boolean;
    order?: { id: string; amount: number; currency: string; keyId: string };
  }>
> {
  const user = await getUser();
  if (!user) return fail("Please log in to join.");

  const supabase = await createSupabaseServerClient();
  const { data: comm } = await supabase
    .from("communities")
    .select("id, is_paid, requires_approval, membership_cost_paise, name")
    .eq("id", input.community_id)
    .single();
  if (!comm) return fail("Community not found.");

  // Already a member?
  const { data: existing } = await supabase
    .from("community_members")
    .select("status")
    .eq("community_id", comm.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing && existing.status === "active") {
    return fail("You're already a member.");
  }

  // Free join.
  if (!comm.is_paid || Number(comm.membership_cost_paise) === 0) {
    const status = comm.requires_approval ? "pending" : "active";
    await supabase.from("community_members").upsert(
      {
        community_id: comm.id,
        user_id: user.id,
        status,
        joined_via: "direct",
      },
      { onConflict: "community_id,user_id" },
    );
    revalidatePath("/communities");
    return ok(
      { paid: false },
      status === "pending" ? "Request sent — awaiting approval." : "Welcome to the community!",
    );
  }

  // Paid membership -> create order + membership record.
  const { data: membership } = await supabase
    .from("memberships")
    .insert({
      community_id: comm.id,
      user_id: user.id,
      amount_paise: Number(comm.membership_cost_paise),
      status: "pending",
    })
    .select("id")
    .single();

  try {
    const order = await createRazorpayOrder({
      amount: paise(Number(comm.membership_cost_paise)),
      receipt: `mem_${membership?.id}`,
      notes: {
        source_type: "membership",
        user_id: user.id,
        community_id: comm.id,
        membership_id: membership?.id ?? "",
      },
    });
    return ok(
      {
        paid: true,
        order: {
          id: order.id,
          amount: Number(order.amount),
          currency: order.currency,
          keyId: publicEnv.razorpayKeyId,
        },
      },
      "Complete payment to join.",
    );
  } catch {
    return fail("Could not start membership payment.");
  }
}

/** Post to a community feed (members + owner). */
export async function createPost(input: unknown): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return fail("Write something to post.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("community_posts").insert({
    community_id: parsed.data.community_id,
    author_id: user.id,
    body: parsed.data.body,
    event_id: parsed.data.event_id ?? null,
    pinned: parsed.data.pinned,
  });
  if (error) return fail("Could not post (are you a member?).");

  revalidatePath("/communities");
  return ok(undefined, "Posted!");
}
