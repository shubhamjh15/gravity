"use client";

/**
 * Add-to-cart with variant + quantity selection. Calls the addToCart action.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart, Minus, Plus } from "lucide-react";
import { addToCart } from "@/app/(public)/store/actions";
import { formatPaise, paise } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Variant = { id: string; name: string; price_paise: number; in_stock: boolean };

export function AddToCart({
  variants,
  loggedIn,
}: {
  variants: Variant[];
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string>(
    variants.find((v) => v.in_stock)?.id ?? variants[0]?.id ?? "",
  );
  const [qty, setQty] = useState(1);

  const variant = variants.find((v) => v.id === selected);

  function add() {
    if (!loggedIn) {
      router.push("/login?next=/store" as never);
      return;
    }
    if (!variant) return;
    startTransition(async () => {
      const res = await addToCart({ variant_id: variant.id, qty });
      if (res.success) {
        toast.success(res.message, {
          action: { label: "View cart", onClick: () => router.push("/store/cart" as never) },
        });
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {variants.length > 1 ? (
        <div>
          <p className="mb-2 font-mono text-xs tracking-widest text-text-dim uppercase">Options</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={!v.in_stock}
                onClick={() => setSelected(v.id)}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm transition-colors disabled:opacity-40",
                  selected === v.id
                    ? "border-crimson-500 bg-crimson-500/10 text-crimson-300"
                    : "border-line hover:border-line-strong",
                )}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-lg border border-line">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="grid size-9 place-items-center text-text-muted hover:text-foreground"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-10 text-center font-mono">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className="grid size-9 place-items-center text-text-muted hover:text-foreground"
          >
            <Plus className="size-4" />
          </button>
        </div>
        {variant ? (
          <span className="font-display text-2xl">
            {formatPaise(paise(variant.price_paise * qty), { compactWhole: true })}
          </span>
        ) : null}
      </div>

      <Button
        onClick={add}
        disabled={pending || !variant?.in_stock}
        variant="gradient"
        size="xl"
        className="w-full"
      >
        <ShoppingCart className="size-4" />
        {variant?.in_stock ? "Add to cart" : "Out of stock"}
      </Button>
    </div>
  );
}
