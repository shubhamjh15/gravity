"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { createRazorpayOrder } from "@/lib/razorpay";
import { paise } from "@/lib/money";
import { publicEnv } from "@/lib/env";

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
export async function checkout(input: {
  partial?: boolean;
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

  const total = items.reduce((s, i) => s + priceFor(i.variant_id) * i.qty, 0);
  if (total <= 0) return fail("Invalid cart total.");

  // Partial: charge 50% now (configurable later); else full.
  const firstAmount = input.partial ? Math.ceil(total / 2) : total;

  // Create the order.
  const { data: order } = await supabase
    .from("store_orders")
    .insert({
      user_id: user.id,
      status: "pending",
      total_paise: total,
      is_partial: Boolean(input.partial),
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

  // Payment schedule for partial.
  if (input.partial) {
    await supabase.from("store_payment_schedule").insert([
      { order_id: order.id, due_paise: firstAmount, status: "pending" },
      { order_id: order.id, due_paise: total - firstAmount, status: "pending" },
    ]);
  }

  // Razorpay order for the first amount.
  try {
    const rzpOrder = await createRazorpayOrder({
      amount: paise(firstAmount),
      receipt: `order_${order.id}`,
      notes: {
        source_type: "store",
        user_id: user.id,
        store_order_id: order.id,
      },
    });

    // Clear the cart.
    await supabase.from("store_cart_items").delete().eq("cart_id", cartId);

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
    await supabase.from("store_orders").delete().eq("id", order.id);
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
