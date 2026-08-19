import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ProductManager,
  type ProductView,
  type VariantView,
} from "@/components/gravity/admin/product-manager";
import {
  OrderManager,
  type OrderView,
} from "@/components/gravity/admin/order-manager";

export const metadata: Metadata = { title: "Store Admin", robots: { index: false } };

/**
 * Store console — catalog CRUD (5.2) and manual delivery progression (5.5).
 *
 * Products, variants and inventory are fetched separately and stitched here so
 * the client component receives one already-shaped tree rather than doing joins
 * in the browser.
 */
export default async function AdminStorePage() {
  const supabase = await createSupabaseServerClient();

  const [productsRes, variantsRes, inventoryRes, ordersRes] = await Promise.all([
    supabase
      .from("store_products")
      .select("id, name, slug, description, mrp_paise, sale_price_paise, is_active, allow_partial")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("store_variants")
      .select("id, product_id, sku, name, price_paise")
      .order("name", { ascending: true }),
    supabase
      .from("store_inventory")
      .select("variant_id, stock, low_stock_threshold"),
    supabase
      .from("store_orders")
      .select(
        "id, user_id, status, delivery_status, total_paise, amount_paid_paise, is_partial, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const variants = variantsRes.data ?? [];
  const inventory = inventoryRes.data ?? [];
  const orders = ordersRes.data ?? [];

  const stockFor = new Map(
    inventory.map((i) => [
      i.variant_id,
      { stock: Number(i.stock), low: Number(i.low_stock_threshold) },
    ]),
  );

  const variantsByProduct = new Map<string, VariantView[]>();
  for (const v of variants) {
    const inv = stockFor.get(v.id);
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push({
      id: v.id,
      sku: v.sku,
      name: v.name,
      price_paise: Number(v.price_paise),
      stock: inv?.stock ?? 0,
      low_stock_threshold: inv?.low ?? 5,
    });
    variantsByProduct.set(v.product_id, list);
  }

  const products: ProductView[] = (productsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    mrp_paise: Number(p.mrp_paise),
    sale_price_paise: Number(p.sale_price_paise),
    is_active: p.is_active,
    allow_partial: p.allow_partial,
    variants: variantsByProduct.get(p.id) ?? [],
  }));

  // Resolve buyer names in one round trip rather than per row.
  const buyerIds = [...new Set(orders.map((o) => o.user_id))];
  const { data: buyers } = buyerIds.length
    ? await supabase.from("profiles").select("id, display_name, email").in("id", buyerIds)
    : { data: [] };
  const buyerLabel = new Map(
    (buyers ?? []).map((b) => [b.id, b.display_name || b.email || "Unknown player"]),
  );

  const orderViews: OrderView[] = orders.map((o) => ({
    id: o.id,
    buyer: buyerLabel.get(o.user_id) ?? "Unknown player",
    status: o.status,
    delivery_status: o.delivery_status as OrderView["delivery_status"],
    total_paise: Number(o.total_paise),
    amount_paid_paise: Number(o.amount_paid_paise),
    is_partial: o.is_partial,
    created_at: o.created_at,
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl tracking-tight">Store</h1>
      <p className="mt-1 text-sm text-text-muted">
        Catalog, inventory and fulfilment. Every change is audited.
      </p>

      <div className="mt-8">
        <ProductManager products={products} />
      </div>

      <section className="mt-12">
        <h2 className="font-mono text-xs tracking-widest text-text-dim uppercase">
          Orders ({orderViews.length})
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Amounts paid are derived from captured payments — an order can&apos;t be
          marked delivered while a balance is outstanding.
        </p>
        <OrderManager orders={orderViews} />
      </section>
    </div>
  );
}
