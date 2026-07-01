"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { chatMessageSchema, matchInviteSchema } from "@/lib/validators/community";
import { ok, fail, type ActionResult } from "@/lib/action-result";

/** Send a chat message (RLS ensures sender is a channel member). */
export async function sendMessage(input: unknown): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const parsed = chatMessageSchema.safeParse(input);
  if (!parsed.success) return fail("Empty message.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("chat_messages").insert({
    channel_id: parsed.data.channel_id,
    sender_id: user.id,
    body: parsed.data.body,
  });
  if (error) return fail("Could not send (are you in this channel?).");
  return ok(undefined, "");
}

/**
 * Ensure the community's default chat channel exists and the user is a member.
 * Returns the channel id. Idempotent.
 */
export async function ensureCommunityChannel(
  communityId: string,
): Promise<ActionResult<{ channelId: string }>> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const supabase = await createSupabaseServerClient();

  // Find an existing community channel.
  let channelId: string | null = null;
  const { data: existing } = await supabase
    .from("chat_channels")
    .select("id")
    .eq("community_id", communityId)
    .eq("kind", "community")
    .limit(1)
    .maybeSingle();

  if (existing) {
    channelId = existing.id;
  } else {
    // Only the owner can create the default channel.
    const { data: created } = await supabase
      .from("chat_channels")
      .insert({
        community_id: communityId,
        kind: "community",
        name: "General",
        created_by: user.id,
      })
      .select("id")
      .single();
    channelId = created?.id ?? null;
  }

  if (!channelId) return fail("Could not open chat.");

  // Add the user as a channel member (idempotent).
  await supabase
    .from("chat_members")
    .upsert(
      { channel_id: channelId, user_id: user.id },
      { onConflict: "channel_id,user_id", ignoreDuplicates: true },
    );

  return ok({ channelId });
}

/** Send a 1-v-1 match invite. */
export async function sendMatchInvite(input: unknown): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const parsed = matchInviteSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid invite.");
  if (parsed.data.to_user === user.id) return fail("You can't invite yourself.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("match_invites").insert({
    from_user: user.id,
    to_user: parsed.data.to_user,
    game_id: parsed.data.game_id ?? null,
    message: parsed.data.message ?? null,
  });
  if (error) return fail("Could not send invite.");
  return ok(undefined, "Invite sent!");
}

/** Respond to a match invite. */
export async function respondMatchInvite(input: {
  invite_id: string;
  accept: boolean;
}): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("match_invites")
    .update({ status: input.accept ? "accepted" : "declined" })
    .eq("id", input.invite_id)
    .eq("to_user", user.id);
  if (error) return fail("Could not respond.");
  return ok(undefined, input.accept ? "Invite accepted!" : "Invite declined.");
}
