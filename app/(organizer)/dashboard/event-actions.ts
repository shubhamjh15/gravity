"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser, isOrganizer } from "@/lib/auth";
import { eventCreateSchema } from "@/lib/validators/event";
import { ok, fail, zodErrors, type ActionResult } from "@/lib/action-result";
import { slugify } from "@/lib/utils";
import { rupeesToPaise, paise, type Paise } from "@/lib/money";
import {
  validateStructure,
  type PrizeStructure,
} from "@/lib/prize";

/**
 * Create (or save-draft) a tournament. Validates input with Zod, builds the
 * prize structure in paise, and — if the organizer asks to publish — refuses
 * unless the split equals the full pool (the prize engine invariant).
 */
export async function createEvent(
  input: unknown,
  opts: { publish?: boolean } = {},
): Promise<ActionResult<{ id: string; slug: string }>> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");
  if (!(await isOrganizer())) {
    return fail("Only verified organizers can create tournaments.");
  }

  const parsed = eventCreateSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodErrors(parsed.error.issues));
  }
  const d = parsed.data;

  // Build the prize structure in paise.
  const entryFee = rupeesToPaise(d.entry_fee_rupees);
  const rankPrizes: Record<number, Paise> = {};
  for (const rp of d.rank_prizes_rupees) {
    rankPrizes[rp.rank] = rupeesToPaise(rp.amount);
  }
  const structure: PrizeStructure = {
    entryFee,
    rankPrizes,
    perKill: rupeesToPaise(d.per_kill_rupees),
    killBudgetCap: rupeesToPaise(d.kill_budget_cap_rupees),
    adminCut: rupeesToPaise(d.admin_cut_rupees),
    organizerProfit: rupeesToPaise(d.organizer_profit_rupees),
    fillPolicy: d.fill_policy,
    killSurplusPolicy: d.kill_surplus_policy,
    maxSlots: d.max_slots,
  };

  // For PAID events, validate the split sums to the pool before publishing.
  if (opts.publish && (entryFee as number) > 0) {
    const v = validateStructure(structure);
    if (!v.ok) {
      const rupees = (v.deltaPaise / 100).toFixed(2);
      return fail(
        `Prize split is off by ₹${rupees}. The rank prizes + kill cap + platform cut + organizer profit must equal the full pool (${(Number(v.fullPool) / 100).toFixed(2)}).`,
        { _prize: "Split does not equal the pool." },
      );
    }
  }

  const supabase = await createSupabaseServerClient();

  // Unique-ish slug.
  const baseSlug = slugify(d.title) || "tournament";
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

  const { data: ev, error: evErr } = await supabase
    .from("events")
    .insert({
      organizer_id: user.id,
      community_id: d.community_id ?? null,
      game_id: d.game_id,
      title: d.title,
      slug,
      description: d.description ?? null,
      dos_and_donts: d.dos_and_donts ?? null,
      rules: d.rules ?? null,
      registration_schema: d.registration_fields,
      entry_fee_paise: entryFee,
      max_slots: d.max_slots,
      visibility: d.visibility,
      requires_approval: d.requires_approval,
      gov_id_required: d.gov_id_required,
      banner_path: d.banner_path ?? null,
      registration_opens_at: d.registration_opens_at ?? null,
      registration_closes_at: d.registration_closes_at ?? null,
      starts_at: d.starts_at ?? null,
      ends_at: d.ends_at ?? null,
      status: opts.publish ? "upcoming" : "draft",
      created_by: user.id,
    })
    .select("id, slug")
    .single();

  if (evErr || !ev) {
    return fail("Could not create the tournament. Try again.");
  }

  // Prize structure row.
  const { error: psErr } = await supabase.from("prize_structures").insert({
    event_id: ev.id,
    entry_fee_paise: entryFee,
    rank_prizes_paise: Object.fromEntries(
      Object.entries(rankPrizes).map(([k, v]) => [k, v as number]),
    ),
    per_kill_paise: structure.perKill,
    kill_budget_cap_paise: structure.killBudgetCap,
    admin_cut_paise: structure.adminCut,
    organizer_profit_paise: structure.organizerProfit,
    fill_policy: structure.fillPolicy,
    kill_surplus_policy: structure.killSurplusPolicy,
  });

  if (psErr) {
    // Roll back the event so we don't leave an event without economics.
    await supabase.from("events").delete().eq("id", ev.id);
    return fail("Could not save the prize structure. Try again.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/events");
  return ok(
    { id: ev.id, slug: ev.slug },
    opts.publish ? "Tournament published!" : "Draft saved.",
  );
}

/** Set room credentials (revealed to paid players via RPC) + notify them. */
export async function setRoomCredentials(input: {
  event_id: string;
  room_id: string;
  room_password: string;
}): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const supabase = await createSupabaseServerClient();
  const { data: ev, error } = await supabase
    .from("events")
    .update({
      room_id: input.room_id,
      room_password: input.room_password,
      room_released_at: new Date().toISOString(),
    })
    .eq("id", input.event_id)
    .eq("organizer_id", user.id) // RLS also enforces this
    .select("id, title, slug")
    .single();

  if (error || !ev) return fail("Could not save room credentials.");

  // Notify paid participants (in-app notification + email). Best-effort.
  void notifyRoomReleased(ev.id, ev.title, ev.slug, input.room_id, input.room_password);

  revalidatePath("/dashboard");
  return ok(undefined, "Room credentials released to paid players.");
}

/**
 * Fan out room-release notifications: an in-app notification row per paid
 * participant, plus an email with the creds. WhatsApp in v1 is a share link the
 * player triggers from the UI. Runs best-effort (never blocks the action).
 */
async function notifyRoomReleased(
  eventId: string,
  title: string,
  slug: string,
  roomId: string,
  roomPassword: string,
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: regs } = await supabase
      .from("registrations")
      .select("user_id")
      .eq("event_id", eventId)
      .in("status", ["paid", "confirmed"]);

    const userIds = (regs ?? []).map((r) => r.user_id);
    if (userIds.length === 0) return;

    // In-app notifications.
    const notes = userIds.map((uid) => ({
      user_id: uid,
      kind: "room_released",
      title: `Room is live: ${title}`,
      body: "Your match room credentials are ready.",
      link: `/events/${slug}`,
    }));
    await supabase.from("notifications").insert(notes);

    // Emails (need each player's email from profiles).
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", userIds);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { sendEmail, roomCredentialEmail } = await import("@/lib/email");
    await Promise.allSettled(
      (profiles ?? [])
        .filter((p) => p.email)
        .map((p) => {
          const tpl = roomCredentialEmail({
            playerName: p.display_name ?? "Player",
            eventTitle: title,
            roomId,
            roomPassword,
            eventUrl: `${appUrl}/events/${slug}`,
          });
          return sendEmail({ to: p.email as string, subject: tpl.subject, html: tpl.html });
        }),
    );
  } catch {
    // best-effort; never throw from a notification fan-out
  }
}

/** Publish a draft (re-validates paid splits). */
export async function publishEvent(eventId: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const supabase = await createSupabaseServerClient();
  // Load event + structure to re-validate before publishing.
  const { data: ev } = await supabase
    .from("events")
    .select("id, entry_fee_paise, max_slots, organizer_id, status")
    .eq("id", eventId)
    .single();

  if (!ev || ev.organizer_id !== user.id) return fail("Not found.");

  if (Number(ev.entry_fee_paise) > 0) {
    const { data: ps } = await supabase
      .from("prize_structures")
      .select("*")
      .eq("event_id", eventId)
      .single();
    if (ps) {
      const structure: PrizeStructure = {
        entryFee: paise(Number(ev.entry_fee_paise)),
        rankPrizes: Object.fromEntries(
          Object.entries((ps.rank_prizes_paise ?? {}) as Record<string, number>).map(
            ([k, v]) => [Number(k), paise(Number(v))],
          ),
        ),
        perKill: paise(Number(ps.per_kill_paise)),
        killBudgetCap: paise(Number(ps.kill_budget_cap_paise)),
        adminCut: paise(Number(ps.admin_cut_paise)),
        organizerProfit: paise(Number(ps.organizer_profit_paise)),
        fillPolicy: ps.fill_policy,
        killSurplusPolicy: ps.kill_surplus_policy,
        maxSlots: Number(ev.max_slots),
      };
      const v = validateStructure(structure);
      if (!v.ok) {
        return fail(
          `Cannot publish: prize split is off by ₹${(v.deltaPaise / 100).toFixed(2)}.`,
        );
      }
    }
  }

  const { error } = await supabase
    .from("events")
    .update({ status: "upcoming" })
    .eq("id", eventId);
  if (error) return fail("Could not publish.");
  revalidatePath("/events");
  return ok(undefined, "Tournament published!");
}
