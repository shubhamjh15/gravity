import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise, paise, type Paise } from "@/lib/money";

export const metadata: Metadata = { title: "Store Admin", robots: { index: false } };

export default async function AdminStorePage() {
  const supabase = await createSupabaseServerClient();
  const [productsRes, ordersRes] = await Promise.all([
    supabase
      .from("store_products")
      .select("id, name, mrp_paise, sale_price_paise, is_active")
      .order("created_at", { ascending: false }),
    supabase
      .from("store_orders")
      .select("id, status, delivery_status, total_paise, amount_paid_paise, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const products = productsRes.data ?? [];
  const orders = ordersRes.data ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl tracking-tight">Store</h1>
      <p className="mt-1 text-sm text-text-muted">
        Catalog and orders. Manual delivery status updates.
      </p>

      {/* products */}
      <section className="mt-8">
        <h2 className="font-mono text-xs tracking-widest text-text-dim uppercase">
          Products ({products.length})
        </h2>
        {products.length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-line py-12 text-center">
            <ShoppingBag className="size-7 text-text-dim" />
            <p className="text-sm text-text-muted">No products yet. Seed the catalog to begin.</p>
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-left font-mono text-[10px] tracking-widest text-text-dim uppercase">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Active</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-line/50 last:border-0">
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 font-mono">
                      {formatPaise(paise(Number(p.sale_price_paise || p.mrp_paise)) as Paise, { compactWhole: true })}
                    </td>
                    <td className="px-4 py-2.5">{p.is_active ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* orders */}
      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-widest text-text-dim uppercase">
          Recent orders ({orders.length})
        </h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No orders yet.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-left font-mono text-[10px] tracking-widest text-text-dim uppercase">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Delivery</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-line/50 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-text-dim">
                      {new Date(o.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </td>
                    <td className="px-4 py-2.5 capitalize">{o.status.replace("_", " ")}</td>
                    <td className="px-4 py-2.5 capitalize">{o.delivery_status}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {formatPaise(paise(Number(o.total_paise)) as Paise, { compactWhole: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
