import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Admin/revenue data helpers. Everything money is one GROUP BY on
 * ledger_entries (the whole point of the unified ledger). Reads run as the
 * superadmin (RLS allows superadmin to read all ledger rows).
 */

export type RevenueSummary = {
  grossPaise: number;
  byCategory: { source_type: string; amount: number; fractionBps: number }[];
  payoutsPaise: number;
  refundsPaise: number;
  netPaise: number;
};

export async function getRevenueSummary(): Promise<RevenueSummary> {
  const supabase = await createSupabaseServerClient();

  // Pull captured/settled rows; aggregate in memory (fine at MVP scale; matview
  // in Phase 7 for scale).
  const { data: rows } = await supabase
    .from("ledger_entries")
    .select("source_type, direction, entry_type, amount_paise, status");

  const captured = (rows ?? []).filter((r) =>
    ["captured", "settled"].includes(r.status),
  );

  // Gross = money IN (excludes 'internal' re-slices).
  const inflow = captured.filter((r) => r.direction === "in");
  const grossPaise = inflow.reduce((s, r) => s + Number(r.amount_paise), 0);

  const byCategoryMap = new Map<string, number>();
  for (const r of inflow) {
    byCategoryMap.set(
      r.source_type,
      (byCategoryMap.get(r.source_type) ?? 0) + Number(r.amount_paise),
    );
  }
  const byCategory = [...byCategoryMap.entries()]
    .map(([source_type, amount]) => ({
      source_type,
      amount,
      fractionBps: grossPaise > 0 ? Math.round((amount / grossPaise) * 10000) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const payoutsPaise = captured
    .filter((r) => r.entry_type === "payout")
    .reduce((s, r) => s + Number(r.amount_paise), 0);
  const refundsPaise = captured
    .filter((r) => r.entry_type === "refund")
    .reduce((s, r) => s + Number(r.amount_paise), 0);

  return {
    grossPaise,
    byCategory,
    payoutsPaise,
    refundsPaise,
    netPaise: grossPaise - payoutsPaise - refundsPaise,
  };
}

export async function getPlatformCounts() {
  const supabase = await createSupabaseServerClient();
  const [users, organizers, events, communities, orders, sponsorReqs] =
    await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "organizer"),
      supabase.from("events").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("communities").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("store_orders").select("id", { count: "exact", head: true }),
      supabase.from("sponsorship_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
  return {
    users: users.count ?? 0,
    organizers: organizers.count ?? 0,
    events: events.count ?? 0,
    communities: communities.count ?? 0,
    orders: orders.count ?? 0,
    pendingSponsorships: sponsorReqs.count ?? 0,
  };
}
