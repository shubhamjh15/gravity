import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Star } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { formatPaise, paise } from "@/lib/money";
import { publicEnv } from "@/lib/env";
import { AddToCart } from "@/components/gravity/store/add-to-cart";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("store_products").select("name").eq("slug", slug).single();
  return { title: data?.name ?? "Product" };
}

function imageUrl(path: string): string | null {
  if (!publicEnv.supabaseUrl) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/store-images/${path}`;
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: product } = await supabase
    .from("store_products")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single();
  if (!product) notFound();

  const [imagesRes, variantsRes, reviewsRes] = await Promise.all([
    supabase.from("store_product_images").select("image_path, sort_order").eq("product_id", product.id).order("sort_order"),
    supabase.from("store_variants").select("id, name, price_paise").eq("product_id", product.id),
    supabase.from("store_reviews").select("rating, body, user_id, created_at").eq("product_id", product.id).order("created_at", { ascending: false }).limit(20),
  ]);

  const variantIds = (variantsRes.data ?? []).map((v) => v.id);
  const { data: inv } = variantIds.length
    ? await supabase.from("store_inventory").select("variant_id, stock").in("variant_id", variantIds)
    : { data: [] as { variant_id: string; stock: number }[] };

  const stockFor = (vid: string) =>
    Number((inv ?? []).find((i) => i.variant_id === vid)?.stock ?? 1) > 0;

  const variants = (variantsRes.data ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    price_paise: Number(v.price_paise),
    in_stock: stockFor(v.id),
  }));

  const images = (imagesRes.data ?? []).map((i) => imageUrl(i.image_path)).filter(Boolean) as string[];
  const reviews = reviewsRes.data ?? [];
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  const user = await getUser();
  const basePrice =
    Number(product.sale_price_paise) > 0 ? Number(product.sale_price_paise) : Number(product.mrp_paise);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-2">
        {/* gallery */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-2">
            {images[0] ? (
              <Image src={images[0]} alt={product.name} fill className="object-cover" sizes="(max-width:1024px) 100vw, 500px" unoptimized />
            ) : (
              <div className="absolute inset-0 gv-grid-bg opacity-40" />
            )}
          </div>
          {images.length > 1 ? (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {images.slice(0, 4).map((src, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-line">
                  <Image src={src} alt="" fill className="object-cover" sizes="120px" unoptimized />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* details */}
        <div>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{product.name}</h1>

          {reviews.length > 0 ? (
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`size-4 ${n <= Math.round(avgRating) ? "fill-amber-300 text-amber-300" : "text-line-strong"}`}
                />
              ))}
              <span className="ml-1 text-sm text-text-muted">({reviews.length})</span>
            </div>
          ) : null}

          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-display text-3xl">
              {formatPaise(paise(Math.max(0, basePrice)), { compactWhole: true })}
            </span>
            {Number(product.sale_price_paise) > 0 &&
            Number(product.sale_price_paise) < Number(product.mrp_paise) ? (
              <span className="font-mono text-text-dim line-through">
                {formatPaise(paise(Number(product.mrp_paise)), { compactWhole: true })}
              </span>
            ) : null}
          </div>

          {product.description ? (
            <p className="mt-4 whitespace-pre-line leading-relaxed text-text-muted">
              {product.description}
            </p>
          ) : null}

          <div className="mt-8">
            {variants.length > 0 ? (
              <AddToCart variants={variants} loggedIn={Boolean(user)} />
            ) : (
              <p className="text-sm text-text-muted">This product has no options configured yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* reviews */}
      {reviews.length > 0 ? (
        <section className="mt-16">
          <h2 className="font-display text-2xl tracking-tight">Reviews</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {reviews.map((r, i) => (
              <div key={i} className="gv-panel p-4">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`size-3.5 ${n <= r.rating ? "fill-amber-300 text-amber-300" : "text-line-strong"}`} />
                  ))}
                </div>
                {r.body ? <p className="mt-2 text-sm text-text-muted">{r.body}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
