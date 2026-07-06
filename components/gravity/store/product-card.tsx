import Link from "next/link";
import Image from "next/image";
import { GlowCard } from "@/components/gravity/glow-card";
import { formatPaise, paise } from "@/lib/money";
import { publicEnv } from "@/lib/env";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  image_path: string | null;
  mrp_paise: number;
  sale_price_paise: number;
  in_stock: boolean;
};

function imageUrl(path: string | null): string | null {
  if (!path || !publicEnv.supabaseUrl) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/store-images/${path}`;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const img = imageUrl(product.image_path);
  const onSale =
    product.sale_price_paise > 0 && product.sale_price_paise < product.mrp_paise;
  const price = onSale ? product.sale_price_paise : product.mrp_paise;
  const discount = onSale
    ? Math.round((1 - product.sale_price_paise / product.mrp_paise) * 100)
    : 0;

  return (
    <GlowCard className="h-full">
      <Link href={`/store/${product.slug}` as never} className="flex h-full flex-col">
        <div className="relative aspect-square w-full overflow-hidden bg-surface-2">
          {img ? (
            <Image
              src={img}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover/glow:scale-105"
              sizes="300px"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 gv-grid-bg opacity-40" />
          )}
          {onSale ? (
            <span className="absolute top-3 left-3 rounded-full bg-[image:var(--gv-grad-accent)] px-2.5 py-1 text-[10px] font-bold text-white">
              -{discount}%
            </span>
          ) : null}
          {!product.in_stock ? (
            <span className="absolute inset-0 grid place-items-center bg-background/70 font-display text-lg text-text-muted">
              Sold out
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-4">
          <h3 className="line-clamp-2 text-sm font-medium">{product.name}</h3>
          <div className="mt-auto flex items-baseline gap-2 pt-2">
            <span className="font-mono font-semibold">
              {formatPaise(paise(Math.max(0, price)), { compactWhole: true })}
            </span>
            {onSale ? (
              <span className="font-mono text-xs text-text-dim line-through">
                {formatPaise(paise(product.mrp_paise), { compactWhole: true })}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </GlowCard>
  );
}
