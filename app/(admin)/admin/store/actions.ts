"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { ok, fail, zodErrors, type ActionResult } from "@/lib/action-result";
import { rupeesToPaise } from "@/lib/money";
import {
  productSchema,
  variantSchema,
  deliveryStatusSchema,
} from "@/lib/validators/store";

/**
 * Store administration (ROADMAP 5.2 + 5.5).
 *
 * The catalog was previously read-only in the console — there was no way to
 * create a product, add a variant, set stock, or advance a delivery. These are
 * the write paths.
 *
 * RLS already restricts every store_* write to superadmins; the explicit guard
 * here is defence in depth and gives a clean error message rather than an empty
 * result set.
 */
async function requireSuperadmin() {
  const { user, isSuperadmin } = await getAuthContext();
  if (!user || !isSuperadmin) return null;
  return user;
}

/** Create or update a product. Rupee inputs convert to paise via lib/money. */
export async function upsertProduct(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireSuperadmin();
  if (!admin) return fail("Not authorized.");

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the product.", zodErrors(parsed.error.issues));
  }
  const p = parsed.data;

  const supabase = await createSupabaseServerClient();
  const row = {
    name: p.name,
    slug: p.slug,
    description: p.description ?? null,
    category_id: p.category_id ?? null,
    mrp_paise: rupeesToPaise(p.mrp_rupees) as number,
    sale_price_paise: rupeesToPaise(p.sale_price_rupees) as number,
    is_active: p.is_active,
    allow_partial: p.allow_partial,
  };

  const query = p.id
    ? supabase.from("store_products").update(row).eq("id", p.id).select("id").single()
    : supabase.from("store_products").insert(row).select("id").single();

  const { data, error } = await query;
  if (error || !data) {
    // The only realistic constraint failure is the unique slug.
    return fail("Could not save the product. Is the slug already taken?", {
      slug: "This slug may already be in use.",
    });
  }

  await supabase.rpc("write_audit_log", {
    p_action: p.id ? "update_product" : "create_product",
    p_target_table: "store_products",
    p_target_id: data.id,
    p_after: row,
  });

  revalidatePath("/admin/store");
  revalidatePath("/store");
  return ok({ id: data.id }, p.id ? "Product updated." : "Product created.");
}

/** Soft-delete a product (never hard-delete business data). */
export async function archiveProduct(input: {
  product_id: string;
}): Promise<ActionResult> {
  const admin = await requireSuperadmin();
  if (!admin) return fail("Not authorized.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("store_products")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", input.product_id);
  if (error) return fail("Could not archive the product.");

  await supabase.rpc("write_audit_log", {
    p_action: "archive_product",
    p_target_table: "store_products",
    p_target_id: input.product_id,
  });

  revalidatePath("/admin/store");
  revalidatePath("/store");
  return ok(undefined, "Product archived.");
}

/**
 * Create or update a variant and its inventory row together.
 *
 * store_inventory is 1:1 with a variant (unique variant_id), so the two always
 * move as a pair — a variant without stock is invisible to the storefront's
 * availability check.
 */
export async function upsertVariant(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireSuperadmin();
  if (!admin) return fail("Not authorized.");

  const parsed = variantSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the variant.", zodErrors(parsed.error.issues));
  }
  const v = parsed.data;

  const supabase = await createSupabaseServerClient();
  const row = {
    product_id: v.product_id,
    sku: v.sku,
    name: v.name,
    price_paise: rupeesToPaise(v.price_rupees) as number,
  };

  const query = v.id
    ? supabase.from("store_variants").update(row).eq("id", v.id).select("id").single()
    : supabase.from("store_variants").insert(row).select("id").single();

  const { data, error } = await query;
  if (error || !data) {
    return fail("Could not save the variant. Is the SKU already taken?", {
      sku: "This SKU may already be in use.",
    });
  }

  const { error: invErr } = await supabase.from("store_inventory").upsert(
    {
      variant_id: data.id,
      stock: v.stock,
      low_stock_threshold: v.low_stock_threshold,
    },
    { onConflict: "variant_id" },
  );
  if (invErr) return fail("Variant saved, but stock could not be set.");

  await supabase.rpc("write_audit_log", {
    p_action: v.id ? "update_variant" : "create_variant",
    p_target_table: "store_variants",
    p_target_id: data.id,
    p_after: { ...row, stock: v.stock },
  });

  revalidatePath("/admin/store");
  revalidatePath("/store");
  return ok({ id: data.id }, v.id ? "Variant updated." : "Variant added.");
}

/** Adjust stock for a single variant without touching its price. */
export async function setStock(input: {
  variant_id: string;
  stock: number;
}): Promise<ActionResult> {
  const admin = await requireSuperadmin();
  if (!admin) return fail("Not authorized.");
  if (!Number.isInteger(input.stock) || input.stock < 0) {
    return fail("Stock must be a whole number of units, zero or more.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("store_inventory")
    .upsert(
      { variant_id: input.variant_id, stock: input.stock },
      { onConflict: "variant_id" },
    );
  if (error) return fail("Could not update stock.");

  await supabase.rpc("write_audit_log", {
    p_action: "set_stock",
    p_target_table: "store_inventory",
    p_target_id: input.variant_id,
    p_after: { stock: input.stock },
  });

  revalidatePath("/admin/store");
  return ok(undefined, "Stock updated.");
}

/**
 * Advance an order's delivery status (manual in v1, ROADMAP 5.5).
 *
 * Guarded on payment: nothing ships before money has landed. 'delivered' is
 * what unlocks a verified-purchase review, so it must not be reachable on an
 * unpaid order.
 */
export async function setDeliveryStatus(
  input: unknown,
): Promise<ActionResult> {
  const admin = await requireSuperadmin();
  if (!admin) return fail("Not authorized.");

  const parsed = deliveryStatusSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Invalid delivery update.", zodErrors(parsed.error.issues));
  }
  const { order_id, delivery_status } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase
    .from("store_orders")
    .select("id, status, total_paise, amount_paid_paise, delivery_status")
    .eq("id", order_id)
    .maybeSingle();
  if (!order) return fail("Order not found.");

  if (order.status === "cancelled") {
    return fail("This order was cancelled.");
  }
  if (
    delivery_status !== "pending" &&
    Number(order.amount_paid_paise) <= 0
  ) {
    return fail("Nothing has been paid on this order yet.");
  }
  if (
    delivery_status === "delivered" &&
    Number(order.amount_paid_paise) < Number(order.total_paise)
  ) {
    return fail("Settle the outstanding balance before marking it delivered.");
  }

  const { error } = await supabase
    .from("store_orders")
    .update({ delivery_status })
    .eq("id", order_id);
  if (error) return fail("Could not update the delivery status.");

  await supabase.rpc("write_audit_log", {
    p_action: "set_delivery_status",
    p_target_table: "store_orders",
    p_target_id: order_id,
    p_before: { delivery_status: order.delivery_status },
    p_after: { delivery_status },
  });

  revalidatePath("/admin/store");
  revalidatePath("/orders");
  return ok(undefined, `Marked ${delivery_status}.`);
}

// ---------------------------------------------------------------------------
// Product images (ROADMAP 5.2)
// ---------------------------------------------------------------------------

/**
 * Attach an uploaded image to a product.
 *
 * The file itself is uploaded straight from the browser to the `store-images`
 * bucket (public, superadmin-write by storage policy); this records the row so
 * the storefront can find it. Taking the path rather than the bytes keeps the
 * upload off the server action, which has a request-body limit and would make a
 * multi-megabyte photo a slow round trip.
 */
export async function addProductImage(input: {
  product_id: string;
  image_path: string;
}): Promise<ActionResult<{ id: string }>> {
  const admin = await requireSuperadmin();
  if (!admin) return fail("Not authorized.");

  if (!input.image_path || input.image_path.includes("..")) {
    return fail("Invalid image path.");
  }

  const supabase = await createSupabaseServerClient();

  // Append to the end of the existing order.
  const { data: last } = await supabase
    .from("store_product_images")
    .select("sort_order")
    .eq("product_id", input.product_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("store_product_images")
    .insert({
      product_id: input.product_id,
      image_path: input.image_path,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("id")
    .single();

  if (error || !data) return fail("Could not attach the image.");

  await supabase.rpc("write_audit_log", {
    p_action: "add_product_image",
    p_target_table: "store_product_images",
    p_target_id: data.id,
    p_after: { product_id: input.product_id, image_path: input.image_path },
  });

  revalidatePath("/admin/store");
  revalidatePath("/store");
  return ok({ id: data.id }, "Image added.");
}

/** Remove a product image (row + the stored object). */
export async function removeProductImage(input: {
  image_id: string;
}): Promise<ActionResult> {
  const admin = await requireSuperadmin();
  if (!admin) return fail("Not authorized.");

  const supabase = await createSupabaseServerClient();

  const { data: img } = await supabase
    .from("store_product_images")
    .select("id, image_path")
    .eq("id", input.image_id)
    .maybeSingle();
  if (!img) return fail("Image not found.");

  const { error } = await supabase
    .from("store_product_images")
    .delete()
    .eq("id", input.image_id);
  if (error) return fail("Could not remove the image.");

  // Best-effort object cleanup: the catalog row is the source of truth, and a
  // stranded file is far less harmful than a row pointing at nothing.
  await supabase.storage.from("store-images").remove([img.image_path]);

  await supabase.rpc("write_audit_log", {
    p_action: "remove_product_image",
    p_target_table: "store_product_images",
    p_target_id: input.image_id,
  });

  revalidatePath("/admin/store");
  revalidatePath("/store");
  return ok(undefined, "Image removed.");
}

/** Reorder — the lowest sort_order is the product's primary image. */
export async function setProductImageOrder(input: {
  image_id: string;
  sort_order: number;
}): Promise<ActionResult> {
  const admin = await requireSuperadmin();
  if (!admin) return fail("Not authorized.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("store_product_images")
    .update({ sort_order: Math.max(0, Math.trunc(input.sort_order)) })
    .eq("id", input.image_id);
  if (error) return fail("Could not reorder.");

  revalidatePath("/admin/store");
  revalidatePath("/store");
  return ok(undefined, "Order updated.");
}
