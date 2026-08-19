"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { createRazorpayOrder } from "@/lib/razorpay";
import {
  formatPaise,
  isPositive,
  paise,
  splitEvenly,
  subPaise,
  type Paise,
} from "@/lib/money";
import { publicEnv } from "@/lib/env";

/** Gap between partial-payment installments: 30 days. */
const INSTALMENT_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

/** Human wording for the reason codes preview_code returns. */
const CODE_MESSAGES: Record<string, string> = {
  INVALID_CODE: "That code isn't valid.",
  CODE_NOT_STARTED: "That code isn't active yet.",
  CODE_EXPIRED: "That code has expired.",
  CODE_EXHAUSTED: "That code has been fully claimed.",
  CODE_ALREADY_USED: "You've already used that code.",
  CODE_WRONG_SCOPE: "That code doesn't apply to these items.",
  INVALID_BASE: "That code can't be applied to this total.",
};

/** Sum a user's cart in paise. Shared by the preview and the checkout. */
async function cartTotalPaise(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<Paise> {
  const { data: cart } = await supabase
    .from("store_carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!cart) return paise(0);

  const { data: items } = await supabase
    .from("store_cart_items")
    .select("variant_id, qty")
    .eq("cart_id", cart.id);
  if (!items || items.length === 0) return paise(0);

  const { data: variants } = await supabase
    .from("store_variants")
    .select("id, price_paise")
    .in(
      "id",
      items.map((i) => i.variant_id),
    );

  return paise(
    items.reduce((sum, i) => {
      const price = Number(
        variants?.find((v) => v.id === i.variant_id)?.price_paise ?? 0,
      );
      return sum + price * i.qty;
    }, 0),
  );
}

/** Get (or create) the user's cart id. */
async function getCartId(userId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("store_carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created } = await supabase
    .from("store_carts")
    .insert({ user_id: userId })
    .select("id")
    .single();
  return created?.id ?? null;
}

export async function addToCart(input: {
  variant_id: string;
  qty?: number;
}): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("Please log in to shop.");

  const supabase = await createSupabaseServerClient();
  const cartId = await getCartId(user.id);
  if (!cartId) return fail("Could not open your cart.");

  // Stock check.
  const { data: inv } = await supabase
    .from("store_inventory")
    .select("stock")
    .eq("variant_id", input.variant_id)
    .maybeSingle();
  if (inv && Number(inv.stock) <= 0) return fail("Out of stock.");

  // Upsert item (increment qty).
  const { data: existing } = await supabase
    .from("store_cart_items")
    .select("id, qty")
    .eq("cart_id", cartId)
    .eq("variant_id", input.variant_id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("store_cart_items")
      .update({ qty: existing.qty + (input.qty ?? 1) })
      .eq("id", existing.id);
  } else {
    await supabase.from("store_cart_items").insert({
      cart_id: cartId,
      variant_id: input.variant_id,
      qty: input.qty ?? 1,
    });
  }

  revalidatePath("/store/cart");
  return ok(undefined, "Added to cart.");
}

export async function updateCartItem(input: {
  item_id: string;
  qty: number;
}): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");
  const supabase = await createSupabaseServerClient();
  if (input.qty <= 0) {
    await supabase.from("store_cart_items").delete().eq("id", input.item_id);
  } else {
    await supabase.from("store_cart_items").update({ qty: input.qty }).eq("id", input.item_id);
  }
  revalidatePath("/store/cart");
  return ok(undefined, "Cart updated.");
}

/**
 * Checkout: build an order from the cart, optionally as a partial payment
 * (first installment), and create a Razorpay order. Settled by the webhook.
 */
/**
 * Validate a discount/referral code against the caller's cart total.
 * Read-only — the code is not consumed until payment settles.
 */
export async function previewDiscount(input: {
  code: string;
}): Promise<ActionResult<{ discountPaise: number; reason: string }>> {
  const user = await getUser();
  if (!user) return fail("Please log in to use a code.");

  const code = input.code.trim();
  if (!code) return fail("Enter a code.");

  const supabase = await createSupabaseServerClient();
  const total = await cartTotalPaise(supabase, user.id);
  if (!isPositive(total)) return fail("Your cart is empty.");

  const { data, error } = (await supabase.rpc("preview_code", {
    p_code: code,
    p_base_paise: total as number,
    p_scope: "store",
  })) as {
    data: { discount_paise: number; code_id: string | null; reason: string }[] | null;
    error: { message: string } | null;
  };

  const row = error ? null : data?.[0];
  if (!row || row.reason !== "OK") {
    return fail(CODE_MESSAGES[row?.reason ?? "INVALID_CODE"] ?? "That code isn't valid.");
  }

  return ok(
    { discountPaise: Number(row.discount_paise), reason: row.reason },
    `Code applied — ${formatPaise(paise(Number(row.discount_paise)), { compactWhole: true })} off.`,
  );
}

export async function checkout(input: {
  partial?: boolean;
  code?: string;
  shipping_address?: Record<string, string>;
}): Promise<
  ActionResult<{
    order?: { id: string; amount: number; currency: string; keyId: string };
  }>
> {
  const user = await getUser();
  if (!user) return fail("Please log in to checkout.");

  const supabase = await createSupabaseServerClient();
  const cartId = await getCartId(user.id);
  if (!cartId) return fail("Your cart is empty.");

  // Load cart items + variant prices.
  const { data: items } = await supabase
    .from("store_cart_items")
    .select("variant_id, qty")
    .eq("cart_id", cartId);
  if (!items || items.length === 0) return fail("Your cart is empty.");

  const variantIds = items.map((i) => i.variant_id);
  const { data: variants } = await supabase
    .from("store_variants")
    .select("id, price_paise, product_id")
    .in("id", variantIds);

  const priceFor = (vid: string) =>
    Number(variants?.find((v) => v.id === vid)?.price_paise ?? 0);

  const subtotal = paise(
    items.reduce((s, i) => s + priceFor(i.variant_id) * i.qty, 0),
  );
  if (!isPositive(subtotal)) return fail("Invalid cart total.");

  // Re-validate the code SERVER-SIDE against the real cart. The browser's
  // preview is a hint; never trust a client-supplied discount amount.
  let discount = paise(0);
  let codeId: string | null = null;
  if (input.code?.trim()) {
    const { data: previewRows } = (await supabase.rpc("preview_code", {
      p_code: input.code.trim(),
      p_base_paise: subtotal as number,
      p_scope: "store",
    })) as {
      data:
        | { discount_paise: number; code_id: string | null; reason: string }[]
        | null;
    };

    const preview = previewRows?.[0];
    if (!preview || preview.reason !== "OK") {
      return fail(
        CODE_MESSAGES[preview?.reason ?? "INVALID_CODE"] ??
          "That code isn't valid.",
      );
    }
    discount = paise(Number(preview.discount_paise));
    codeId = preview.code_id;
  }

  const total = subPaise(subtotal, discount);
  if (!isPositive(total)) {
    // A 100%-off code would create a ₹0 Razorpay order, which the gateway
    // rejects. Free checkouts need their own flow — refuse rather than fail
    // opaquely at the gateway.
    return fail("This code covers the whole order — please contact support.");
  }

  // Partial payment is a per-product privilege — every line must allow it, or
  // a buyer could part-pay for something the admin marked full-payment-only.
  let partial = Boolean(input.partial);
  if (partial) {
    const productIds = [
      ...new Set(
        variantIds
          .map((vid) => variants?.find((v) => v.id === vid)?.product_id)
          .filter((p): p is string => Boolean(p)),
      ),
    ];
    const { data: products } = await supabase
      .from("store_products")
      .select("id, allow_partial")
      .in("id", productIds);
    if (!products || products.some((p) => !p.allow_partial)) {
      return fail("One or more items must be paid in full.");
    }
  }

  // Two equal installments via splitEvenly, which is exact to the paise —
  // Math.ceil(total / 2) could leave the schedule summing to more than the
  // order total on an odd amount (#1: no ad-hoc money math outside lib/money).
  const instalments = partial ? splitEvenly(total, 2) : [total];
  const firstAmount = instalments[0];

  // Create the order.
  const { data: order } = await supabase
    .from("store_orders")
    .insert({
      user_id: user.id,
      status: "pending",
      total_paise: total as number,
      is_partial: partial,
      referral_code_id: codeId,
      discount_paise: discount as number,
      shipping_address: input.shipping_address ?? null,
    })
    .select("id")
    .single();
  if (!order) return fail("Could not create the order.");

  // Order items.
  await supabase.from("store_order_items").insert(
    items.map((i) => ({
      order_id: order.id,
      variant_id: i.variant_id,
      qty: i.qty,
      unit_price_paise: priceFor(i.variant_id),
    })),
  );

  // Payment schedule for partial. Due dates: now, then +30 days.
  let firstScheduleId: string | null = null;
  if (partial) {
    const now = Date.now();
    const { data: schedule } = await supabase
      .from("store_payment_schedule")
      .insert(
        instalments.map((amount, idx) => ({
          order_id: order.id,
          due_paise: amount as number,
          due_at: new Date(now + idx * INSTALMENT_INTERVAL_MS).toISOString(),
          status: "pending",
        })),
      )
      .select("id, due_at")
      .order("due_at", { ascending: true });
    firstScheduleId = schedule?.[0]?.id ?? null;
  }

  // Razorpay order for the first amount.
  try {
    const rzpOrder = await createRazorpayOrder({
      amount: firstAmount,
      receipt: `order_${order.id}`,
      notes: {
        source_type: "store",
        user_id: user.id,
        store_order_id: order.id,
        // Tells the webhook WHICH installment this settles.
        ...(firstScheduleId ? { schedule_id: firstScheduleId } : {}),
      },
    });

    // NOTE: the cart is deliberately NOT cleared here. It is cleared by
    // settle_store_payment() once payment actually lands, so abandoning
    // checkout doesn't wipe the buyer's cart.
    return ok(
      {
        order: {
          id: rzpOrder.id,
          amount: Number(rzpOrder.amount),
          currency: rzpOrder.currency,
          keyId: publicEnv.razorpayKeyId,
        },
      },
      "Complete payment to place your order.",
    );
  } catch {
    await supabase.from("store_order_items").delete().eq("order_id", order.id);
    await supabase.from("store_payment_schedule").delete().eq("order_id", order.id);
    await supabase.from("store_orders").delete().eq("id", order.id);
    return fail("Could not start payment.");
  }
}

/**
 * Pay the next outstanding installment on a partial-payment order. Creates a
 * Razorpay order for exactly that schedule row and tags it with the schedule id
 * so the webhook settles the right one. Money still lands only via the webhook.
 */
export async function payInstallment(input: {
  order_id: string;
}): Promise<
  ActionResult<{
    order?: { id: string; amount: number; currency: string; keyId: string };
  }>
> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const supabase = await createSupabaseServerClient();

  // RLS already restricts to the owner; check explicitly so we return a clean
  // message rather than an empty result.
  const { data: order } = await supabase
    .from("store_orders")
    .select("id, user_id, status, total_paise, amount_paid_paise")
    .eq("id", input.order_id)
    .maybeSingle();
  if (!order || order.user_id !== user.id) return fail("Order not found.");
  if (order.status === "cancelled") return fail("This order was cancelled.");
  if (Number(order.amount_paid_paise) >= Number(order.total_paise)) {
    return fail("This order is already paid in full.");
  }

  const { data: due } = await supabase
    .from("store_payment_schedule")
    .select("id, due_paise, status")
    .eq("order_id", order.id)
    .in("status", ["pending", "overdue"])
    .order("due_at", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  if (!due) return fail("Nothing left to pay on this order.");

  try {
    const rzpOrder = await createRazorpayOrder({
      amount: paise(Number(due.due_paise)),
      receipt: `order_${order.id}_sch_${due.id}`,
      notes: {
        source_type: "store",
        user_id: user.id,
        store_order_id: order.id,
        schedule_id: due.id,
      },
    });
    return ok(
      {
        order: {
          id: rzpOrder.id,
          amount: Number(rzpOrder.amount),
          currency: rzpOrder.currency,
          keyId: publicEnv.razorpayKeyId,
        },
      },
      "Complete payment to clear this installment.",
    );
  } catch {
    return fail("Could not start payment.");
  }
}

/** Add a verified-purchase review. */
export async function addReview(input: {
  product_id: string;
  rating: number;
  body?: string;
}): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");
  if (input.rating < 1 || input.rating > 5) return fail("Rating must be 1-5.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("store_reviews").upsert(
    {
      product_id: input.product_id,
      user_id: user.id,
      rating: input.rating,
      body: input.body ?? null,
    },
    { onConflict: "product_id,user_id" },
  );
  // RLS enforces verified-purchase; a policy failure surfaces as error.
  if (error) return fail("Only verified buyers can review this product.");
  revalidatePath("/store");
  return ok(undefined, "Thanks for your review!");
}
