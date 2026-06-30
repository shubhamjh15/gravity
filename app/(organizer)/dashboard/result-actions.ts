"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { resultsUploadSchema } from "@/lib/validators/event";
import { ok, fail, zodErrors, type ActionResult } from "@/lib/action-result";
import { paise } from "@/lib/money";
import {
  computePayouts,
  type PrizeStructure,
  type ResultRow,
} from "@/lib/prize";

/**
 * Upload results -> compute payouts via the prize engine -> store event_results
 * (provisional). Publishing is a separate step. The organizer enters rank+kills
 * per participant; the engine computes the money. This NEVER pays out money —
 * payout is the manual worklist step (records to ledger).
 */
export async function uploadResults(input: unknown): Promise<
  ActionResult<{ computed: { userId: string; total: number }[] }>
> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const parsed = resultsUploadSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the result rows.", zodErrors(parsed.error.issues));
  }
  const { event_id, screenshot_path, rows } = parsed.data;

  const supabase = await createSupabaseServerClient();

  // Verify ownership + load event + structure.
  const { data: ev } = await supabase
    .from("events")
    .select("id, organizer_id, entry_fee_paise, max_slots, status")
    .eq("id", event_id)
    .single();
  if (!ev || ev.organizer_id !== user.id) return fail("Not your tournament.");

  const { data: ps } = await supabase
    .from("prize_structures")
    .select("*")
    .eq("event_id", event_id)
    .single();
  if (!ps) return fail("Prize structure missing.");

  // Count actual paid participants for the pool.
  const { count: paidCount } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event_id)
    .in("status", ["paid", "confirmed"]);

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

  const resultRows: ResultRow[] = rows.map((r) => ({
    userId: r.user_id,
    rank: r.rank,
    kills: r.kills,
  }));

  let computation;
  try {
    computation = computePayouts(structure, resultRows, paidCount ?? rows.length);
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Prize computation failed.",
    );
  }

  // Upsert provisional result rows with the computed amounts.
  const resultUpserts = computation.payouts.map((p) => ({
    event_id,
    user_id: p.userId,
    rank: p.rank,
    kills: p.kills,
    amount_paid_paise: p.total as number,
    leaderboard_screenshot_path: screenshot_path,
    status: "provisional" as const,
  }));

  const { error: upErr } = await supabase
    .from("event_results")
    .upsert(resultUpserts, { onConflict: "event_id,user_id" });
  if (upErr) return fail("Could not save results. Try again.");

  // Mark the event completed (results pending publish).
  await supabase.from("events").update({ status: "completed" }).eq("id", event_id);

  revalidatePath(`/dashboard`);
  return ok(
    {
      computed: computation.payouts.map((p) => ({
        userId: p.userId,
        total: p.total as number,
      })),
    },
    "Results computed. Review, then publish.",
  );
}

/** Publish provisional results -> public + create pending payouts for winners. */
export async function publishResults(eventId: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const supabase = await createSupabaseServerClient();
  const { data: ev } = await supabase
    .from("events")
    .select("id, organizer_id")
    .eq("id", eventId)
    .single();
  if (!ev || ev.organizer_id !== user.id) return fail("Not your tournament.");

  // Flip results to published.
  const { error: pubErr } = await supabase
    .from("event_results")
    .update({ status: "published" })
    .eq("event_id", eventId);
  if (pubErr) return fail("Could not publish results.");

  // Create pending payout rows for winners (amount > 0), resolving their UPI.
  const { data: winners } = await supabase
    .from("event_results")
    .select("user_id, amount_paid_paise")
    .eq("event_id", eventId)
    .gt("amount_paid_paise", 0);

  for (const w of winners ?? []) {
    // UPI lives in profiles_private; superadmin/owner reads. Organizer can't see
    // it directly, so payout UPI is resolved at payout time by an admin. Here we
    // just create the pending payout record with the amount.
    await supabase
      .from("payouts")
      .upsert(
        {
          event_id: eventId,
          user_id: w.user_id,
          amount_paise: Number(w.amount_paid_paise),
          status: "pending",
        },
        { onConflict: "event_id,user_id", ignoreDuplicates: true },
      );
  }

  revalidatePath(`/dashboard`);
  revalidatePath(`/events`);
  return ok(undefined, "Results published! Payouts queued.");
}

/**
 * Mark a payout as paid (manual UPI transfer in v1). Records the ledger 'out'
 * entry and the UTR. Dup-guard: the unique index blocks a second PAID row.
 */
export async function markPayoutPaid(input: {
  payout_id: string;
  utr: string;
}): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const supabase = await createSupabaseServerClient();

  const { data: payout } = await supabase
    .from("payouts")
    .select("id, event_id, user_id, amount_paise, status")
    .eq("id", input.payout_id)
    .single();
  if (!payout) return fail("Payout not found.");
  if (payout.status === "paid") return fail("Already paid.");

  // Write the ledger 'payout' out-entry.
  const { data: ledgerId } = await supabase.rpc("write_ledger_entry", {
    p_entry_type: "payout",
    p_source_type: "prize",
    p_direction: "out",
    p_amount_paise: Number(payout.amount_paise),
    p_status: "settled",
    p_user_id: payout.user_id,
    p_event_id: payout.event_id,
    p_meta: { utr: input.utr },
  });

  const { error } = await supabase
    .from("payouts")
    .update({
      status: "paid",
      utr: input.utr,
      approved_by: user.id,
      ledger_entry_id: (ledgerId as unknown as string) ?? null,
    })
    .eq("id", input.payout_id)
    .neq("status", "paid"); // dup-guard at the app layer too

  if (error) return fail("Could not record payout (possibly already paid).");

  // Bump the winner's stats/earnings shell.
  revalidatePath("/dashboard");
  return ok(undefined, "Payout recorded.");
}
