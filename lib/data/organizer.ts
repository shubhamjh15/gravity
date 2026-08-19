import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Organizer finance helpers (ROADMAP 2.10 + 3.4).
 *
 * Everything here reads ledger_entries, scoped by RLS to rows the caller
 * legitimately owns — their own events, their own communities (policy widened
 * in migration 0019). No service-role client, no trust in a client-supplied id:
 * the database decides what this organizer may see.
 */

export type OrganizerTxn = {
  id: string;
  entry_type: string;
  source_type: string;
  direction: string;
  amount_paise: number;
  status: string;
  created_at: string;
  event_id: string | null;
  community_id: string | null;
};

export type OrganizerFinance = {
  /** Entry fees + memberships collected across the organizer's scopes. */
  grossPaise: number;
  /** The organizer's own take, recorded at result-lock. */
  profitPaise: number;
  /** Prize money paid out to players from their events. */
  prizesPaise: number;
  /** The platform's cut on their events. */
  platformFeePaise: number;
  /** Membership income, split out for the community dashboard (3.4). */
  membershipPaise: number;
  byMonth: { month: string; grossPaise: number; profitPaise: number }[];
  transactions: OrganizerTxn[];
};

const SETTLED = ["captured", "settled"];

export async function getOrganizerFinance(): Promise<OrganizerFinance> {
  const empty: OrganizerFinance = {
    grossPaise: 0,
    profitPaise: 0,
    prizesPaise: 0,
    platformFeePaise: 0,
    membershipPaise: 0,
    byMonth: [],
    transactions: [],
  };

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("ledger_entries")
      .select(
        "id, entry_type, source_type, direction, amount_paise, status, created_at, event_id, community_id",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) return empty;

    const rows = (data ?? []) as OrganizerTxn[];
    const settled = rows.filter((r) => SETTLED.includes(r.status));

    const sum = (predicate: (r: OrganizerTxn) => boolean) =>
      settled.filter(predicate).reduce((s, r) => s + Number(r.amount_paise), 0);

    // Gross counts real inflow only — 'internal' rows are a re-slice of money
    // already counted and would double it (SCHEMA.md §8).
    const grossPaise = sum((r) => r.direction === "in");
    const profitPaise = sum((r) => r.source_type === "organizer_profit");
    const prizesPaise = sum(
      (r) => r.entry_type === "payout" && r.source_type === "prize",
    );
    const platformFeePaise = sum((r) => r.source_type === "platform_fee");
    const membershipPaise = sum(
      (r) => r.source_type === "membership" && r.direction === "in",
    );

    // Month buckets, newest first, for the earning trend (3.4).
    const months = new Map<string, { grossPaise: number; profitPaise: number }>();
    for (const r of settled) {
      const month = r.created_at.slice(0, 7); // YYYY-MM
      const bucket = months.get(month) ?? { grossPaise: 0, profitPaise: 0 };
      if (r.direction === "in") bucket.grossPaise += Number(r.amount_paise);
      if (r.source_type === "organizer_profit") {
        bucket.profitPaise += Number(r.amount_paise);
      }
      months.set(month, bucket);
    }

    const byMonth = [...months.entries()]
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12);

    return {
      grossPaise,
      profitPaise,
      prizesPaise,
      platformFeePaise,
      membershipPaise,
      byMonth,
      transactions: rows.slice(0, 100),
    };
  } catch {
    return empty;
  }
}
