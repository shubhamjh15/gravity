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
  toFillPolicy,
  toKillSurplusPolicy,
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
    fillPolicy: toFillPolicy(ps.fill_policy),
    killSurplusPolicy: toKillSurplusPolicy(ps.kill_surplus_policy),
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
    .select("id, organizer_id, entry_fee_paise, max_slots")
    .eq("id", eventId)
    .single();
  if (!ev || ev.organizer_id !== user.id) return fail("Not your tournament.");

  // Flip results to published. This also fires the DB triggers that recompute
  // player_stats and rebuild the leaderboard (migration 0016).
  const { error: pubErr } = await supabase
    .from("event_results")
    .update({ status: "published" })
    .eq("event_id", eventId);
  if (pubErr) return fail("Could not publish results.");

  // Record the platform cut + organizer profit against this event. Both are
  // 'internal' ledger rows — a re-slice of entry fees already counted as gross,
  // never new income (#3). settle_event_split is idempotent, so re-publishing
  // can't double the books.
  await recordEventSplit(supabase, eventId, ev);

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
 * Resolve the winner's UPI id so the organizer can actually send the money.
 *
 * publishResults creates payout rows without a upi_id on purpose: UPI lives in
 * profiles_private, which RLS restricts to the owner and superadmins (#6), so
 * an organizer cannot select it. The audited get_payout_upi RPC re-checks
 * ownership in the database and logs the access, so the number is available at
 * the moment of transfer without opening PII more broadly.
 */
export async function revealPayoutUpi(input: {
  payout_id: string;
}): Promise<ActionResult<{ upi_id: string | null }>> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = (await supabase.rpc("get_payout_upi", {
    p_payout_id: input.payout_id,
  })) as { data: string | null; error: { message: string } | null };

  if (error) return fail("Not authorized to view this payout's UPI.");
  if (!data) {
    return fail("This player hasn't added a UPI ID yet — ask them to add one.");
  }

  return ok({ upi_id: data }, "UPI revealed. This access has been logged.");
}

/**
 * Recompute this event's admin cut + organizer profit from the prize structure
 * and the actual paid count, then record them in the ledger.
 *
 * The amounts must come from the engine rather than straight off
 * prize_structures, because under-fill scaling and kill-surplus routing both
 * change them — the configured ₹110 admin cut is not what a half-full event
 * actually yields.
 *
 * Failure here is logged, not surfaced: the results ARE published by this
 * point, and blocking the organizer on a bookkeeping row would be worse than a
 * missing one that can be reconciled. The RPC is idempotent, so a later
 * re-publish repairs it.
 */
async function recordEventSplit(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  eventId: string,
  ev: { entry_fee_paise: number | string; max_slots: number | string },
): Promise<void> {
  try {
    const { data: ps } = await supabase
      .from("prize_structures")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();
    if (!ps) return;

    const { data: rows } = await supabase
      .from("event_results")
      .select("user_id, rank, kills")
      .eq("event_id", eventId)
      .eq("status", "published");

    const { count: paidCount } = await supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
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
      fillPolicy: toFillPolicy(ps.fill_policy),
      killSurplusPolicy: toKillSurplusPolicy(ps.kill_surplus_policy),
      maxSlots: Number(ev.max_slots),
    };

    const resultRows: ResultRow[] = (rows ?? []).map((r) => ({
      userId: r.user_id,
      rank: r.rank,
      kills: r.kills,
    }));

    const computation = computePayouts(
      structure,
      resultRows,
      paidCount ?? resultRows.length,
    );

    await supabase.rpc("settle_event_split", {
      p_event_id: eventId,
      p_admin_cut_paise: computation.adminCut as number,
      p_organizer_profit_paise: computation.organizerProfit as number,
    });
  } catch (err) {
    console.error("recordEventSplit failed for event", eventId, err);
  }
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
