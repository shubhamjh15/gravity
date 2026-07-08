import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { CartView } from "@/components/gravity/store/cart-view";
import { SectionHeading } from "@/components/gravity/section-heading";

export const metadata: Metadata = { title: "Cart" };

function imageUrl(path: string | null): string | null {
  if (!path || !publicEnv.supabaseUrl) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/store-images/${path}`;
}

export default async function CartPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/store/cart");

  const supabase = await createSupabaseServerClient();
  const { data: cart } = await supabase
    .from("store_carts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  let items: Parameters<typeof CartView>[0]["items"] = [];

  if (cart) {
    const { data: cartItems } = await supabase
      .from("store_cart_items")
      .select("id, variant_id, qty")
      .eq("cart_id", cart.id);

    const variantIds = (cartItems ?? []).map((i) => i.variant_id);
    if (variantIds.length) {
      const { data: variants } = await supabase
        .from("store_variants")
        .select("id, name, price_paise, product_id")
        .in("id", variantIds);
      const productIds = [...new Set((variants ?? []).map((v) => v.product_id))];
      const [productsRes, imagesRes] = await Promise.all([
        supabase.from("store_products").select("id, name, allow_partial").in("id", productIds),
        supabase.from("store_product_images").select("product_id, image_path, sort_order").in("product_id", productIds),
      ]);

      const variantById = (id: string) => (variants ?? []).find((v) => v.id === id);
      const productById = (id: string) => (productsRes.data ?? []).find((p) => p.id === id);
      const firstImage = (pid: string) =>
        (imagesRes.data ?? []).filter((i) => i.product_id === pid).sort((a, b) => a.sort_order - b.sort_order)[0]?.image_path ?? null;

      items = (cartItems ?? []).map((ci) => {
        const v = variantById(ci.variant_id);
        const p = v ? productById(v.product_id) : undefined;
        return {
          id: ci.id,
          variant_id: ci.variant_id,
          qty: ci.qty,
          name: v?.name ?? "",
          product_name: p?.name ?? "Product",
          price_paise: Number(v?.price_paise ?? 0),
          image: imageUrl(v ? firstImage(v.product_id) : null),
          allow_partial: Boolean(p?.allow_partial),
        };
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <SectionHeading eyebrow="Almost yours" title="Your cart" as="h1" />
      <div className="mt-8">
        <CartView
          items={items}
          displayName={user.user_metadata?.full_name ?? user.email ?? "Player"}
          email={user.email ?? ""}
        />
      </div>
    </div>
  );
}
