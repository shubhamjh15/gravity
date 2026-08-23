"use client";

/**
 * One order in the player's order history — payment progress, the installment
 * schedule, delivery state, and a "pay the balance" action for partial orders.
 *
 * The paid figure comes from store_orders.amount_paid_paise, which the
 * settlement RPC derives from captured payments — it is never computed here.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Boxes, Truck, PackageCheck, CircleCheck, CircleDashed } from "lucide-react";
import { payInstallment } from "@/app/(public)/store/actions";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { formatPaise, paise } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Delivery = "pending" | "processing" | "shipped" | "delivered";

export type OrderLine = {
  name: string;
  product_name: string;
  qty: number;
  unit_price_paise: number;
};

export type Instalment = {
  id: string;
  due_paise: number;
  due_at: string | null;
  status: "pending" | "paid" | "overdue";
};

const DELIVERY_STEPS: { key: Delivery; label: string; Icon: typeof Clock }[] = [
  { key: "pending", label: "Placed", Icon: Clock },
  { key: "processing", label: "Packing", Icon: Boxes },
  { key: "shipped", label: "Shipped", Icon: Truck },
  { key: "delivered", label: "Delivered", Icon: PackageCheck },
];

export function OrderCard({
  id,
  status,
  deliveryStatus,
  totalPaise,
  amountPaidPaise,
  createdAt,
  lines,
  instalments,
  buyerName,
  buyerEmail,
}: {
  id: string;
  status: string;
  deliveryStatus: Delivery;
  totalPaise: number;
  amountPaidPaise: number;
  createdAt: string;
  lines: OrderLine[];
  instalments: Instalment[];
  buyerName: string;
  buyerEmail: string;
}) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);

  const outstanding = Math.max(totalPaise - amountPaidPaise, 0);
  const progressPct =
    totalPaise > 0 ? Math.min(100, Math.round((amountPaidPaise / totalPaise) * 100)) : 0;
  const currentStep = DELIVERY_STEPS.findIndex((s) => s.key === deliveryStatus);
  const cancelled = status === "cancelled";

  async function payBalance() {
    setPaying(true);
    const res = await payInstallment({ order_id: id });
    if (!res.success || !res.data.order) {
      toast.error(res.success ? "Could not start payment." : res.message);
      setPaying(false);
      return;
    }

    const opened = await openRazorpayCheckout({
      order: res.data.order,
      name: "GRAVITY Store",
      description: "Installment payment",
      prefill: { name: buyerName, email: buyerEmail },
      onPaid: () => {
        // Confirmation is the webhook's job; refresh to pick it up.
        toast.success("Payment received! Updating your order…");
        setTimeout(() => router.refresh(), 2500);
      },
      onDismiss: () => setPaying(false),
    });

    if (!opened) {
      toast.error("Could not open payment.");
      setPaying(false);
    }
  }

  return (
    <article className="gv-panel p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-widest text-text-dim uppercase">
            Order {id.slice(0, 8)}
          </p>
          <p className="mt-0.5 text-sm text-text-muted">
            {new Date(createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl">
            {formatPaise(paise(totalPaise), { compactWhole: true })}
          </p>
          {outstanding > 0 && !cancelled ? (
            <p className="font-mono text-xs text-warning">
              {formatPaise(paise(outstanding), { compactWhole: true })} outstanding
            </p>
          ) : (
            <p className="font-mono text-xs text-success">Paid in full</p>
          )}
        </div>
      </header>

      {/* items */}
      <ul className="mt-4 flex flex-col gap-1.5">
        {lines.map((l, idx) => (
          <li key={idx} className="flex items-center justify-between text-sm">
            <span className="min-w-0 truncate text-text-muted">
              {l.product_name}
              <span className="text-text-dim"> · {l.name}</span>
              <span className="text-text-dim"> × {l.qty}</span>
            </span>
            <span className="ml-3 shrink-0 font-mono">
              {formatPaise(paise(l.unit_price_paise * l.qty), { compactWhole: true })}
            </span>
          </li>
        ))}
      </ul>

      {/* payment progress — only meaningful when part-paid */}
      {instalments.length > 0 && !cancelled ? (
        <section className="mt-5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono tracking-widest text-text-dim uppercase">
              Payment plan
            </span>
            <span className="font-mono text-text-muted">{progressPct}%</span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Payment progress"
          >
            <div
              className="h-full rounded-full [background-image:var(--gv-grad-accent)]"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <ul className="mt-3 flex flex-col gap-1.5">
            {instalments.map((inst, idx) => (
              <li key={inst.id} className="flex items-center gap-2 text-sm">
                {inst.status === "paid" ? (
                  <CircleCheck className="size-3.5 shrink-0 text-success" />
                ) : (
                  <CircleDashed
                    className={cn(
                      "size-3.5 shrink-0",
                      inst.status === "overdue" ? "text-danger" : "text-text-dim",
                    )}
                  />
                )}
                <span className="text-text-muted">Installment {idx + 1}</span>
                <span className="font-mono">
                  {formatPaise(paise(inst.due_paise), { compactWhole: true })}
                </span>
                {inst.due_at && inst.status !== "paid" ? (
                  <span
                    className={cn(
                      "font-mono text-[11px]",
                      inst.status === "overdue" ? "text-danger" : "text-text-dim",
                    )}
                  >
                    due {new Date(inst.due_at).toLocaleDateString("en-IN")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* delivery ladder */}
      {!cancelled ? (
        <section className="mt-5">
          <div className="flex items-center gap-1">
            {DELIVERY_STEPS.map((step, idx) => {
              const done = idx <= currentStep;
              const Icon = step.Icon;
              return (
                <div key={step.key} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full items-center">
                    <div
                      className={cn(
                        "h-px flex-1",
                        idx === 0 ? "bg-transparent" : done ? "bg-crimson-600" : "bg-line",
                      )}
                    />
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        done ? "text-crimson-400" : "text-text-dim",
                      )}
                    />
                    <div
                      className={cn(
                        "h-px flex-1",
                        idx === DELIVERY_STEPS.length - 1
                          ? "bg-transparent"
                          : idx < currentStep
                            ? "bg-crimson-600"
                            : "bg-line",
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px]",
                      done ? "text-text-muted" : "text-text-dim",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="mt-4 text-sm text-danger">This order was cancelled.</p>
      )}

      {outstanding > 0 && !cancelled ? (
        <Button
          variant="gradient"
          className="mt-5 w-full"
          disabled={paying}
          onClick={payBalance}
        >
          {paying
            ? "Opening payment…"
            : `Pay ${formatPaise(paise(outstanding), { compactWhole: true })} now`}
        </Button>
      ) : null}
    </article>
  );
}
