import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag, ShoppingCart } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProductCard, type ProductCardData } from "@/components/gravity/store/product-card";
import { SectionHeading } from "@/components/gravity/section-heading";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Store",
  description: "Gaming gear, jerseys and accessories.",
};

export default async function StorePage() {
  const supabase = await createSupabaseServerClient();

  const { data: products } = await supabase
    .from("store_products")
    .select("id, slug, name, mrp_paise, sale_price_paise")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const ids = (products ?? []).map((p) => p.id);

  // First image + stock per product.
  const [imagesRes, variantsRes] = await Promise.all([
    ids.length
      ? supabase.from("store_product_images").select("product_id, image_path, sort_order").in("product_id", ids)
      : Promise.resolve({ data: [] as { product_id: string; image_path: string; sort_order: number }[] }),
    ids.length
      ? supabase.from("store_variants").select("id, product_id").in("product_id", ids)
      : Promise.resolve({ data: [] as { id: string; product_id: string }[] }),
  ]);

  const variantIds = (variantsRes.data ?? []).map((v) => v.id);
  const { data: inv } = variantIds.length
    ? await supabase.from("store_inventory").select("variant_id, stock").in("variant_id", variantIds)
    : { data: [] as { variant_id: string; stock: number }[] };

  const firstImage = (pid: string) =>
    (imagesRes.data ?? [])
      .filter((i) => i.product_id === pid)
      .sort((a, b) => a.sort_order - b.sort_order)[0]?.image_path ?? null;

  const inStock = (pid: string) => {
    const vids = (variantsRes.data ?? []).filter((v) => v.product_id === pid).map((v) => v.id);
    if (vids.length === 0) return true; // no variants tracked yet
    return (inv ?? []).some((i) => vids.includes(i.variant_id) && Number(i.stock) > 0);
  };

  const cards: ProductCardData[] = (products ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    image_path: firstImage(p.id),
    mrp_paise: Number(p.mrp_paise),
    sale_price_paise: Number(p.sale_price_paise),
    in_stock: inStock(p.id),
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="Gear up"
          title={
            <>
              The <span className="gv-text-gradient">store</span>
            </>
          }
          lead="Jerseys, gear and gaming accessories for the grind."
          as="h1"
        />
        <Button asChild variant="outline">
          <Link href={"/store/cart" as never}>
            <ShoppingCart className="size-4" /> Cart
          </Link>
        </Button>
      </div>

      {cards.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-3 rounded-xl border border-dashed border-line py-20 text-center">
          <ShoppingBag className="size-8 text-text-dim" />
          <p className="font-display text-2xl">Store opening soon</p>
          <p className="max-w-sm text-sm text-text-muted">
            We&apos;re stocking the shelves. Check back for jerseys and gear.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
