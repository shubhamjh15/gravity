"use client";

/**
 * Orders table with manual delivery progression (ROADMAP 5.5).
 *
 * The status ladder is pending → processing → shipped → delivered, and the
 * server refuses to advance an unpaid order or to mark a part-paid one
 * delivered. That rule is enforced server-side; here we simply don't offer the
 * control, so the UI and the server agree.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Truck, PackageCheck, Clock, Boxes } from "lucide-react";
import { setDeliveryStatus } from "@/app/(admin)/admin/store/actions";
import { formatPaise, paise } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Delivery = "pending" | "processing" | "shipped" | "delivered";

export type OrderView = {
  id: string;
  buyer: string;
  status: string;
  delivery_status: Delivery;
  total_paise: number;
  amount_paid_paise: number;
  is_partial: boolean;
  created_at: string;
};

const LADDER: Delivery[] = ["pending", "processing", "shipped", "delivered"];

const DELIVERY_ICON = {
  pending: Clock,
  processing: Boxes,
  shipped: Truck,
  delivered: PackageCheck,
} as const;

export function OrderManager({ orders }: { orders: OrderView[] }) {
  if (orders.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-line py-14 text-center">
        <Truck className="size-7 text-text-dim" />
        <p className="text-sm text-text-muted">No orders yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      {orders.map((o) => (
        <OrderRow key={o.id} order={o} />
      ))}
    </div>
  );
}

function OrderRow({ order }: { order: OrderView }) {
  const router = useRouter();
  const [delivery, setDelivery] = useState<Delivery>(order.delivery_status);
  const [pending, startTransition] = useTransition();

  const paid = order.amount_paid_paise;
  const outstanding = Math.max(order.total_paise - paid, 0);
  const fullyPaid = outstanding === 0 && paid > 0;
  const Icon = DELIVERY_ICON[delivery];

  const currentIndex = LADDER.indexOf(delivery);
  const next = LADDER[currentIndex + 1];

  // Mirror the server guards so we never offer an action that will be refused.
  const canAdvance =
    Boolean(next) &&
    order.status !== "cancelled" &&
    paid > 0 &&
    (next !== "delivered" || fullyPaid);

  function advance() {
    if (!next) return;
    startTransition(async () => {
      const res = await setDeliveryStatus({
        order_id: order.id,
        delivery_status: next,
      });
      if (res.success) {
        setDelivery(next);
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface/40 px-4 py-3">
      <Icon
        className={cn(
          "size-4 shrink-0",
          delivery === "delivered" ? "text-success" : "text-text-dim",
        )}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{order.buyer}</p>
        <p className="font-mono text-[11px] text-text-dim">
          {new Date(order.created_at).toLocaleDateString("en-IN")} ·{" "}
          {order.id.slice(0, 8)}
        </p>
      </div>

      <div className="text-right">
        <p className="font-mono text-sm">
          {formatPaise(paise(paid), { compactWhole: true })}
          <span className="text-text-dim">
            {" / "}
            {formatPaise(paise(order.total_paise), { compactWhole: true })}
          </span>
        </p>
        {outstanding > 0 ? (
          <p className="font-mono text-[11px] text-warning">
            {formatPaise(paise(outstanding), { compactWhole: true })} due
          </p>
        ) : null}
      </div>

      <span
        className={cn(
          "rounded-full border px-2 py-0.5 text-[10px] capitalize",
          delivery === "delivered"
            ? "border-success/40 bg-success/10 text-success"
            : "border-line text-text-muted",
        )}
      >
        {delivery}
      </span>

      {next ? (
        <Button size="xs" variant="glow" disabled={pending || !canAdvance} onClick={advance}>
          Mark {next}
        </Button>
      ) : null}
    </div>
  );
}
