"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { createRazorpayOrder } from "@/lib/razorpay";
import { paise } from "@/lib/money";
import { publicEnv } from "@/lib/env";

/**
 * Registration + payment kickoff.
 *
 * Flow:
 *  1. reserve_slot RPC atomically holds a slot (oversell-safe).
 *  2. Free events -> confirmed immediately, done.
 *  3. Paid events -> create a Razorpay order tagged with notes so the webhook
 *     can settle it into the ledger + flip the registration to 'paid'.
 *
 * Money settles ONLY from the webhook (#5); this action never marks paid.
 */
export async function registerForEvent(input: {
  event_id: string;
  form_data?: Record<string, unknown>;
}): Promise<
  ActionResult<{
    free: boolean;
    registrationId: string;
    order?: { id: string; amount: number; currency: string; keyId: string };
  }>
> {
  const user = await getUser();
  if (!user) return fail("Please log in to register.");

  const supabase = await createSupabaseServerClient();

  // Load event basics (public-safe view).
  const { data: ev } = await supabase
    .from("public_events")
    .select("id, title, entry_fee_paise, status, requires_approval")
    .eq("id", input.event_id)
    .single();

  if (!ev) return fail("Tournament not found.");
  if (!["upcoming", "ongoing"].includes(ev.status)) {
    return fail("Registration is closed for this tournament.");
  }

  // 1 — atomic slot reservation.
  const { data: regId, error: rpcErr } = await supabase.rpc("reserve_slot", {
    p_event_id: input.event_id,
    p_form_data: input.form_data ?? {},
  });

  if (rpcErr) {
    const code = rpcErr.message || "";
    if (code.includes("EVENT_FULL")) return fail("This tournament is full.");
    if (code.includes("ALREADY_REGISTERED"))
      return fail("You're already registered for this tournament.");
    if (code.includes("REGISTRATION_CLOSED"))
      return fail("Registration is closed.");
    return fail("Could not reserve your slot. Try again.");
  }

  const registrationId = regId as unknown as string;
  const fee = Number(ev.entry_fee_paise);

  // 2 — free event: done.
  if (fee === 0) {
    revalidatePath(`/events`);
    return ok(
      { free: true, registrationId },
      ev.requires_approval
        ? "Registered! Awaiting organizer approval."
        : "You're in! See you in the lobby.",
    );
  }

  // 3 — paid event: create the Razorpay order tagged for the webhook.
  try {
    const order = await createRazorpayOrder({
      amount: paise(fee),
      receipt: `reg_${registrationId}`,
      notes: {
        source_type: "event_entry",
        user_id: user.id,
        event_id: input.event_id,
        registration_id: registrationId,
      },
    });

    // Stash the order id on the registration for reconciliation.
    await supabase
      .from("registrations")
      .update({ razorpay_order_id: order.id })
      .eq("id", registrationId);

    return ok(
      {
        free: false,
        registrationId,
        order: {
          id: order.id,
          amount: Number(order.amount),
          currency: order.currency,
          keyId: publicEnv.razorpayKeyId,
        },
      },
      "Slot held — complete payment to confirm.",
    );
  } catch {
    // Payment setup failed: release the hold so the slot isn't stuck.
    await supabase
      .from("registrations")
      .update({ status: "cancelled" })
      .eq("id", registrationId);
    return fail(
      "Couldn't start payment. Your slot was released — please try again.",
    );
  }
}

/** Cancel one's own pending/held registration. */
export async function cancelRegistration(
  registrationId: string,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("registrations")
    .update({ status: "cancelled" })
    .eq("id", registrationId)
    .eq("user_id", user.id)
    .in("status", ["slot_held", "waitlisted"]);

  if (error) return fail("Could not cancel.");
  revalidatePath("/events");
  return ok(undefined, "Registration cancelled.");
}

/** Fetch room credentials (entitled users only — enforced by the RPC). */
export async function getRoomCredentials(eventId: string): Promise<
  ActionResult<{ roomId: string | null; roomPassword: string | null; releasedAt: string | null }>
> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_room_credentials", {
    p_event_id: eventId,
  });

  if (error) return fail("Could not fetch room details.");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.room_id) {
    return fail("Room credentials aren't available yet.");
  }
  return ok({
    roomId: row.room_id,
    roomPassword: row.room_password,
    releasedAt: row.room_released_at,
  });
}
