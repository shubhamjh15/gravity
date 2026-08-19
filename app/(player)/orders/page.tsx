import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { SectionHeading } from "@/components/gravity/section-heading";
import {
  OrderCard,
  type Instalment,
  type OrderLine,
} from "@/components/gravity/store/order-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "My Orders" };

/**
 * The buyer's order history (ROADMAP 5.5) — previously missing entirely: a
 * player could check out but had nowhere to see the order, its installment
 * plan, or its delivery state, and no way to pay a remaining balance.
 *
 * RLS restricts every table below to the owner; the explicit user filter keeps
 * the query narrow rather than relying on the policy alone.
 */
export default async function OrdersPage() {
  const user = await requireUser("/orders");
  const supabase = await createSupabaseServerClient();

  const { data: orders } = await supabase
    .from("store_orders")
    .select(
      "id, status, delivery_status, total_paise, amount_paid_paise, is_partial, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const orderIds = (orders ?? []).map((o) => o.id);

  // Fetch lines + schedules for all orders at once rather than per card.
  const [itemsRes, scheduleRes, profileRes] = await Promise.all([
    orderIds.length
      ? supabase
          .from("store_order_items")
          .select("order_id, variant_id, qty, unit_price_paise")
          .in("order_id", orderIds)
      : Promise.resolve({ data: [] as Array<Record<string, never>> }),
    orderIds.length
      ? supabase
          .from("store_payment_schedule")
          .select("id, order_id, due_paise, due_at, status")
          .in("order_id", orderIds)
          .order("due_at", { ascending: true, nullsFirst: true })
      : Promise.resolve({ data: [] as Array<Record<string, never>> }),
    supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const items = (itemsRes.data ?? []) as {
    order_id: string;
    variant_id: string;
    qty: number;
    unit_price_paise: number;
  }[];

  // Resolve variant + product names for the line items.
  const variantIds = [...new Set(items.map((i) => i.variant_id))];
  const { data: variants } = variantIds.length
    ? await supabase
        .from("store_variants")
        .select("id, name, product_id")
        .in("id", variantIds)
    : { data: [] };

  const productIds = [...new Set((variants ?? []).map((v) => v.product_id))];
  const { data: products } = productIds.length
    ? await supabase.from("store_products").select("id, name").in("id", productIds)
    : { data: [] };

  const productName = new Map((products ?? []).map((p) => [p.id, p.name]));
  const variantInfo = new Map(
    (variants ?? []).map((v) => [
      v.id,
      { name: v.name, product: productName.get(v.product_id) ?? "Item" },
    ]),
  );

  const linesByOrder = new Map<string, OrderLine[]>();
  for (const i of items) {
    const info = variantInfo.get(i.variant_id);
    const list = linesByOrder.get(i.order_id) ?? [];
    list.push({
      name: info?.name ?? "Variant",
      product_name: info?.product ?? "Item",
      qty: Number(i.qty),
      unit_price_paise: Number(i.unit_price_paise),
    });
    linesByOrder.set(i.order_id, list);
  }

  const schedules = (scheduleRes.data ?? []) as {
    id: string;
    order_id: string;
    due_paise: number;
    due_at: string | null;
    status: Instalment["status"];
  }[];
  const scheduleByOrder = new Map<string, Instalment[]>();
  for (const s of schedules) {
    const list = scheduleByOrder.get(s.order_id) ?? [];
    list.push({
      id: s.id,
      due_paise: Number(s.due_paise),
      due_at: s.due_at,
      status: s.status,
    });
    scheduleByOrder.set(s.order_id, list);
  }

  const buyerName = profileRes.data?.display_name ?? "";
  const buyerEmail = profileRes.data?.email ?? "";

  return (
    <div className="mx-auto max-w-3xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Store"
        title="My orders"
        lead="Your purchases, payment plans and delivery status."
        as="h1"
      />

      {(orders ?? []).length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-line py-16 text-center">
          <PackageSearch className="mx-auto size-8 text-text-dim" />
          <p className="mt-3 font-display text-xl">No orders yet</p>
          <p className="mt-1 text-sm text-text-muted">
            Anything you buy from the store shows up here.
          </p>
          <Button asChild variant="gradient" className="mt-5">
            <Link href={"/store" as never}>Browse the store</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {(orders ?? []).map((o) => (
            <OrderCard
              key={o.id}
              id={o.id}
              status={o.status}
              deliveryStatus={o.delivery_status as "pending"}
              totalPaise={Number(o.total_paise)}
              amountPaidPaise={Number(o.amount_paid_paise)}
              createdAt={o.created_at}
              lines={linesByOrder.get(o.id) ?? []}
              instalments={scheduleByOrder.get(o.id) ?? []}
              buyerName={buyerName}
              buyerEmail={buyerEmail}
            />
          ))}
        </div>
      )}
    </div>
  );
}
