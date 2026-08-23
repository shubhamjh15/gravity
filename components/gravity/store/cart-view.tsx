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
import {
  updateCartItem,
  checkout,
  previewDiscount,
} from "@/app/(public)/store/actions";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { formatPaise, paise, splitEvenly } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [checkingCode, setCheckingCode] = useState(false);

  const subtotal = items.reduce((s, i) => s + i.price_paise * i.qty, 0);
  // The server re-validates and recomputes this; the figure here is display only.
  const total = Math.max(0, subtotal - discount);
  const allowPartial = items.length > 0 && items.every((i) => i.allow_partial);

  async function applyCode() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setCheckingCode(true);
    const res = await previewDiscount({ code: trimmed });
    if (res.success) {
      setDiscount(res.data.discountPaise);
      setAppliedCode(trimmed);
      toast.success(res.message);
    } else {
      setDiscount(0);
      setAppliedCode(null);
      toast.error(res.message);
    }
    setCheckingCode(false);
  }

  function clearCode() {
    setCode("");
    setAppliedCode(null);
    setDiscount(0);
  }

  function setQty(itemId: string, qty: number) {
    startTransition(async () => {
      await updateCartItem({ item_id: itemId, qty });
      router.refresh();
    });
  }

  async function doCheckout(partial: boolean) {
    setCheckingOut(true);
    const res = await checkout({ partial, code: appliedCode ?? undefined });
    if (!res.success || !res.data.order) {
      toast.error(res.success ? "Could not start checkout." : res.message);
      setCheckingOut(false);
      return;
    }
    const opened = await openRazorpayCheckout({
      order: res.data.order,
      name: "GRAVITY Store",
      description: partial ? "Order (first installment)" : "Order",
      prefill: { name: displayName, email },
      onPaid: () => {
        // Settlement is the webhook's job (#5); send them to their orders so
        // they see the confirmed state rather than a claim we can't back yet.
        toast.success("Payment received! Confirming your order…");
        setTimeout(() => router.push("/orders" as never), 2500);
      },
      onDismiss: () => setCheckingOut(false),
    });

    if (!opened) {
      toast.error("Could not open payment.");
    }
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
            <span className="font-mono">{formatPaise(paise(subtotal))}</span>
          </div>

          {discount > 0 ? (
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-success">
                Discount
                {appliedCode ? (
                  <span className="ml-1 font-mono text-xs text-text-dim">
                    ({appliedCode})
                  </span>
                ) : null}
              </span>
              <span className="font-mono text-success">
                −{formatPaise(paise(discount))}
              </span>
            </div>
          ) : null}

          {/* Discount / referral code */}
          <div className="mt-4">
            <Label htmlFor="cart-code" className="text-xs text-text-muted">
              Discount or referral code
            </Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                id="cart-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void applyCode();
                  }
                }}
                placeholder="GRAVITY10"
                autoCapitalize="characters"
                spellCheck={false}
                className="h-9 flex-1"
                disabled={checkingCode || appliedCode !== null}
              />
              {appliedCode ? (
                <Button variant="ghost" size="sm" onClick={clearCode}>
                  Remove
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={applyCode}
                  disabled={checkingCode || !code.trim()}
                >
                  {checkingCode ? "…" : "Apply"}
                </Button>
              )}
            </div>
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
              {/* splitEvenly matches the server's split exactly — Math.ceil
                  here would quote a first installment the server never charges
                  on an odd total. */}
              Pay half now ({formatPaise(splitEvenly(paise(total), 2)[0], { compactWhole: true })})
            </Button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
