import { z } from "zod";

/**
 * Validators for the store domain.
 *
 * Prices arrive from the admin form in RUPEES (that's what a human types) and
 * are converted to paise by the server action via lib/money. They are declared
 * as `_rupees` here so a reader can never mistake the unit — the DB columns are
 * all `_paise` (#1).
 */

const slug = z
  .string()
  .trim()
  .min(2, "Slug is too short.")
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and hyphens only.",
  );

export const productSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2, "Name is too short.").max(120),
    slug,
    description: z.string().trim().max(4000).optional(),
    category_id: z.string().uuid().nullable().optional(),
    mrp_rupees: z.number().min(0, "MRP can't be negative.").max(10_000_000),
    sale_price_rupees: z
      .number()
      .min(0, "Price can't be negative.")
      .max(10_000_000),
    is_active: z.boolean().default(true),
    allow_partial: z.boolean().default(false),
  })
  .refine((v) => v.sale_price_rupees <= v.mrp_rupees, {
    message: "Sale price can't exceed the MRP.",
    path: ["sale_price_rupees"],
  });
export type ProductInput = z.infer<typeof productSchema>;

export const variantSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  sku: z
    .string()
    .trim()
    .min(2, "SKU is too short.")
    .max(60)
    .regex(/^[A-Za-z0-9._-]+$/, "SKU may use letters, numbers, . _ - only."),
  name: z.string().trim().min(1, "Give the variant a name.").max(80),
  price_rupees: z.number().min(0, "Price can't be negative.").max(10_000_000),
  stock: z.number().int().min(0, "Stock can't be negative.").max(1_000_000),
  low_stock_threshold: z.number().int().min(0).max(10_000).default(5),
});
export type VariantInput = z.infer<typeof variantSchema>;

export const deliveryStatusSchema = z.object({
  order_id: z.string().uuid(),
  delivery_status: z.enum(["pending", "processing", "shipped", "delivered"]),
});
export type DeliveryStatusInput = z.infer<typeof deliveryStatusSchema>;

export const reviewSchema = z.object({
  product_id: z.string().uuid(),
  rating: z.number().int().min(1, "Pick a rating.").max(5),
  body: z.string().trim().max(2000).optional(),
});
export type ReviewInput = z.infer<typeof reviewSchema>;
