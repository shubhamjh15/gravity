import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

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
      payload: event as unknown as Record<string, unknown>,
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

      const { data: ledgerId } = await supabase.rpc("write_ledger_entry", {
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
      });

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
        await supabase
          .from("store_orders")
          .update({ status: "paid" })
          .eq("id", notes.store_order_id);
      }
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
