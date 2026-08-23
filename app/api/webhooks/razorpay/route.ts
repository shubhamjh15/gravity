import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { asJson } from "@/lib/json";

/**
 * THE ONE money ingestion path (NON-NEGOTIABLE #5).
 *
 * Razorpay POSTs payment events here. We:
 *  1. Read the RAW body (required for HMAC verification — do not parse first).
 *  2. Verify the X-Razorpay-Signature against RAZORPAY_WEBHOOK_SECRET.
 *  3. Dedupe on the event id (webhook_events.razorpay_event_id UNIQUE).
 *  4. Settle: on payment.captured, write/confirm the ledger entry via the
 *     write_ledger_entry RPC (idempotent on razorpay_payment_id).
 *
 * This route uses the service-role client (it has no user cookie) and is
 * excluded from proxy.ts. It must run on the Node runtime (crypto + raw body).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  // 1 + 2 — verify signature before trusting anything.
  let signatureValid = false;
  try {
    signatureValid = verifyWebhookSignature(rawBody, signature);
  } catch {
    // Missing secret in env, etc. Treat as invalid.
    signatureValid = false;
  }

  if (!signatureValid) {
    // Do not reveal details. 400 so Razorpay records a failure.
    return NextResponse.json(
      { success: false, message: "Invalid signature." },
      { status: 400 },
    );
  }

  // Parse only after the signature checks out.
  let event: RazorpayWebhook;
  try {
    event = JSON.parse(rawBody) as RazorpayWebhook;
  } catch {
    return NextResponse.json(
      { success: false, message: "Malformed payload." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();

  // 3 — idempotency. Razorpay sends `x-razorpay-event-id`; fall back to a
  // composite if absent. Insert the raw event; a duplicate id is a no-op.
  const eventId =
    request.headers.get("x-razorpay-event-id") ??
    `${event.event}:${event.payload?.payment?.entity?.id ?? "unknown"}`;

  const { data: inserted, error: insertErr } = await supabase
    .from("webhook_events")
    .insert({
      provider: "razorpay",
      razorpay_event_id: eventId,
      event_type: event.event,
      payload: asJson(event),
      signature_valid: true,
      processing_status: "received",
    })
    .select("id")
    .single();

  // Unique violation => we've already seen this event. Ack and stop.
  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json({ success: true, message: "Duplicate ignored." });
    }
    return NextResponse.json(
      { success: false, message: "Storage error." },
      { status: 500 },
    );
  }

  // 4 — settle supported events.
  try {
    await handleEvent(event, supabase);
    await supabase
      .from("webhook_events")
      .update({ processing_status: "processed", processed_at: new Date().toISOString() })
      .eq("id", inserted.id);
  } catch (err) {
    await supabase
      .from("webhook_events")
      .update({
        processing_status: "failed",
        error_detail: err instanceof Error ? err.message : String(err),
      })
      .eq("id", inserted.id);
    // Return 500 so Razorpay retries; idempotency makes the retry safe.
    return NextResponse.json(
      { success: false, message: "Processing failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, message: "ok" });
}

/**
 * Route the event to a settlement. In Phase 0 the plumbing is proven with a
 * captured payment that lands in the ledger; richer routing (registration
 * confirmation, store orders, memberships) arrives with those phases. The
 * `notes` we attach when creating orders carry the source_type + ids.
 */
async function handleEvent(
  event: RazorpayWebhook,
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
) {
  const payment = event.payload?.payment?.entity;

  switch (event.event) {
    case "payment.captured": {
      if (!payment) return;
      const notes = (payment.notes ?? {}) as Record<string, string>;

      // The order's notes tell us what this money is for. Defaults keep Phase-0
      // test charges valid even without notes.
      const sourceType = notes.source_type ?? "manual";

      const { data: ledgerId, error: ledgerErr } = await supabase.rpc(
        "write_ledger_entry",
        {
          p_entry_type: "charge",
          p_source_type: sourceType,
          p_direction: "in",
          p_amount_paise: payment.amount, // already paise
          p_status: "captured",
          p_currency: payment.currency ?? "INR",
          p_user_id: notes.user_id ?? null,
          p_community_id: notes.community_id ?? null,
          p_event_id: notes.event_id ?? null,
          p_registration_id: notes.registration_id ?? null,
          p_store_order_id: notes.store_order_id ?? null,
          p_membership_id: notes.membership_id ?? null,
          p_razorpay_payment_id: payment.id,
          p_meta: { order_id: payment.order_id, method: payment.method },
        },
      );

      // The ledger row IS the settlement. If it didn't land, fail loudly so the
      // webhook is marked failed and Razorpay retries — silently swallowing the
      // error would lose the rupee entirely (#3). The RPC is idempotent on
      // razorpay_payment_id, so the retry is safe.
      if (ledgerErr) {
        throw new Error(`write_ledger_entry failed: ${ledgerErr.message}`);
      }

      // Settlement side-effects by source type.
      if (sourceType === "event_entry" && notes.registration_id) {
        // Confirm the held slot: flip to 'paid' (or 'confirmed' if no approval).
        const { data: ev } = await supabase
          .from("events")
          .select("requires_approval")
          .eq("id", notes.event_id ?? "")
          .single();
        const newStatus = ev?.requires_approval ? "paid" : "confirmed";
        await supabase
          .from("registrations")
          .update({
            status: newStatus,
            slot_held_until: null,
            ledger_entry_id: (ledgerId as unknown as string) ?? null,
          })
          .eq("id", notes.registration_id)
          .in("status", ["slot_held", "paid"]);
      }

      if (sourceType === "membership" && notes.membership_id) {
        await supabase
          .from("memberships")
          .update({ status: "active", ledger_entry_id: (ledgerId as unknown as string) ?? null })
          .eq("id", notes.membership_id);
      }

      if (sourceType === "store" && notes.store_order_id) {
        // Records store_payments, marks the installment paid, and DERIVES
        // amount_paid + order status. Never blanket-marks the order 'paid' —
        // the first of two installments leaves it 'partially_paid'. Also
        // commits stock exactly once. Idempotent on the payment id.
        const { error: storeErr } = await supabase.rpc("settle_store_payment", {
          p_order_id: notes.store_order_id,
          p_razorpay_payment_id: payment.id,
          p_amount_paise: payment.amount,
          p_ledger_entry_id: (ledgerId as unknown as string) ?? null,
          p_schedule_id: notes.schedule_id ?? null,
        });
        if (storeErr) {
          throw new Error(`settle_store_payment failed: ${storeErr.message}`);
        }
      }

      // A discount code is consumed only once money has actually landed — a
      // player who abandons checkout must not burn their single use. The RPC
      // is idempotent on (code_id, user_id), so a webhook replay is a no-op.
      await redeemAppliedCode(supabase, sourceType, notes);
      return;
    }

    case "payment.failed": {
      // Failed payments must not reserve slots / create captured rows.
      // We simply record the webhook (already stored). Nothing to settle.
      return;
    }

    default:
      // Unhandled event types are acknowledged + stored, not settled.
      return;
  }
}

/**
 * Record the redemption of whatever discount code was applied to this purchase.
 *
 * The code id is read from the settled row, never from the webhook payload —
 * Razorpay notes are echoed back from what we sent, but reading our own record
 * keeps the redemption tied to what was actually charged.
 *
 * Best-effort: the money is already settled by this point, and failing the
 * whole webhook (triggering endless retries) over a usage counter would be a
 * worse outcome than an uncounted redemption.
 */
async function redeemAppliedCode(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  sourceType: string,
  notes: Record<string, string>,
): Promise<void> {
  try {
    let codeId: string | null = null;
    let userId: string | null = null;

    if (sourceType === "store" && notes.store_order_id) {
      const { data } = await supabase
        .from("store_orders")
        .select("referral_code_id, user_id")
        .eq("id", notes.store_order_id)
        .maybeSingle();
      codeId = data?.referral_code_id ?? null;
      userId = data?.user_id ?? null;
    } else if (sourceType === "event_entry" && notes.registration_id) {
      const { data } = await supabase
        .from("registrations")
        .select("referral_code_id, user_id")
        .eq("id", notes.registration_id)
        .maybeSingle();
      codeId = data?.referral_code_id ?? null;
      userId = data?.user_id ?? null;
    }

    if (codeId && userId) {
      await supabase.rpc("redeem_code_for_user", {
        p_code_id: codeId,
        p_user_id: userId,
      });
    }
  } catch (err) {
    console.error("redeemAppliedCode failed", err);
  }
}

// ---- Minimal typing of the Razorpay webhook envelope we consume ----
type RazorpayWebhook = {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id: string;
        amount: number; // paise
        currency?: string;
        order_id?: string;
        method?: string;
        notes?: Record<string, string>;
      };
    };
  };
};
