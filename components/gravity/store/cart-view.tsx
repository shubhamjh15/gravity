"use client";

/**
 * Cart view + checkout. Quantity edit, line totals, and checkout with full or
 * partial (50% now) payment via Razorpay. Webhook settles the order.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { updateCartItem, checkout } from "@/app/(public)/store/actions";
import { formatPaise, paise } from "@/lib/money";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

type CartItem = {
  id: string;
  variant_id: string;
  qty: number;
  name: string;
  product_name: string;
  price_paise: number;
  image: string | null;
  allow_partial: boolean;
};

export function CartView({
  items,
  displayName,
  email,
}: {
  items: CartItem[];
  displayName: string;
  email: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checkingOut, setCheckingOut] = useState(false);

  const total = items.reduce((s, i) => s + i.price_paise * i.qty, 0);
  const allowPartial = items.length > 0 && items.every((i) => i.allow_partial);

  function setQty(itemId: string, qty: number) {
    startTransition(async () => {
      await updateCartItem({ item_id: itemId, qty });
      router.refresh();
    });
  }

  async function doCheckout(partial: boolean) {
    setCheckingOut(true);
    const res = await checkout({ partial });
    if (!res.success || !res.data.order) {
      toast.error(res.success ? "Could not start checkout." : res.message);
      setCheckingOut(false);
      return;
    }
    const order = res.data.order;
    if (!(await loadRazorpay()) || !window.Razorpay) {
      toast.error("Could not open payment.");
      setCheckingOut(false);
      return;
    }
    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "GRAVITY Store",
      description: partial ? "Order (partial payment)" : "Order",
      order_id: order.id,
      prefill: { name: displayName, email },
      theme: { color: "#ff2d55" },
      handler: () => {
        toast.success("Payment received! Confirming your order…");
        setTimeout(() => router.push("/store" as never), 2500);
      },
      modal: { ondismiss: () => setCheckingOut(false) },
    });
    rzp.open();
    setCheckingOut(false);
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line py-20 text-center">
        <ShoppingCart className="size-8 text-text-dim" />
        <p className="font-display text-xl">Your cart is empty</p>
        <Button onClick={() => router.push("/store" as never)} variant="gradient" className="mt-2">
          Browse the store
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-3">
        {items.map((i) => (
          <div key={i.id} className="gv-panel flex gap-4 p-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-2">
              {i.image ? (
                <Image src={i.image} alt="" fill className="object-cover" sizes="80px" unoptimized />
              ) : null}
            </div>
            <div className="flex flex-1 flex-col">
              <p className="font-medium">{i.product_name}</p>
              <p className="text-xs text-text-muted">{i.name}</p>
              <div className="mt-auto flex items-center justify-between">
                <div className="flex items-center rounded-lg border border-line">
                  <button onClick={() => setQty(i.id, i.qty - 1)} disabled={pending} className="grid size-8 place-items-center text-text-muted hover:text-foreground">
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-8 text-center font-mono text-sm">{i.qty}</span>
                  <button onClick={() => setQty(i.id, i.qty + 1)} disabled={pending} className="grid size-8 place-items-center text-text-muted hover:text-foreground">
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold">
                    {formatPaise(paise(i.price_paise * i.qty), { compactWhole: true })}
                  </span>
                  <button onClick={() => setQty(i.id, 0)} disabled={pending} className="text-text-dim hover:text-danger">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* summary */}
      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <div className="gv-panel p-6">
          <h2 className="font-display text-xl">Summary</h2>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-text-muted">Subtotal</span>
            <span className="font-mono">{formatPaise(paise(total))}</span>
          </div>
          <div className="gv-rule my-4" />
          <div className="flex items-center justify-between">
            <span className="font-medium">Total</span>
            <span className="font-display text-xl">{formatPaise(paise(total), { compactWhole: true })}</span>
          </div>

          <Button onClick={() => doCheckout(false)} disabled={checkingOut} variant="gradient" size="xl" className="mt-5 w-full">
            {checkingOut ? "Processing…" : "Checkout"}
          </Button>
          {allowPartial ? (
            <Button onClick={() => doCheckout(true)} disabled={checkingOut} variant="outline" className="mt-2 w-full">
              Pay 50% now ({formatPaise(paise(Math.ceil(total / 2)), { compactWhole: true })})
            </Button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
