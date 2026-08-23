import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaiseCompact, paise } from "@/lib/money";

/**
 * Real platform figures for the landing page.
 *
 * These replaced hardcoded marketing numbers (₹2,50,000 paid out, 1,200+
 * tournaments, 12,400+ players) that were invented — on a platform that had
 * paid out nothing. Fabricated payout figures are a bad look anywhere and a
 * genuinely dishonest one on a product that handles other people's prize money.
 *
 * `paidOutPaise` comes from the ledger (#3): settled prize payouts only, not
 * money merely won. Everything falls back to zero rather than throwing, so an
 * unreachable backend renders a quiet hero instead of a 500.
 */
export type PlatformStats = {
  paidOutPaise: number;
  /**
   * Pre-formatted on the server.
   *
   * Intl.NumberFormat's compact notation does NOT agree between Node's ICU and
   * a browser's — the same zero renders "₹0" on the server and "₹0.0" in the
   * client, which is a hydration mismatch. Formatting once here and shipping
   * the string means the client never reformats it.
   */
  paidOutLabel: string;
  tournaments: number;
  players: number;
  /** True when there is genuinely nothing to boast about yet. */
  isEmpty: boolean;
};

export async function getPlatformStats(): Promise<PlatformStats> {
  const empty: PlatformStats = {
    paidOutPaise: 0,
    paidOutLabel: formatPaiseCompact(paise(0)),
    tournaments: 0,
    players: 0,
    isEmpty: true,
  };

  try {
    const supabase = await createSupabaseServerClient();

    const [payoutsRes, eventsRes, playersRes] = await Promise.all([
      supabase
        .from("ledger_entries")
        .select("amount_paise")
        .eq("entry_type", "payout")
        .eq("source_type", "prize")
        .in("status", ["captured", "settled"]),
      supabase
        .from("public_events")
        .select("id", { count: "exact", head: true })
        .in("status", ["upcoming", "ongoing", "completed", "archived"]),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
    ]);

    const paidOutPaise = (payoutsRes.data ?? []).reduce(
      (sum, r) => sum + Number(r.amount_paise ?? 0),
      0,
    );
    const tournaments = eventsRes.count ?? 0;
    const players = playersRes.count ?? 0;

    return {
      paidOutPaise,
      paidOutLabel: formatPaiseCompact(paise(paidOutPaise)),
      tournaments,
      players,
      // A brand-new platform shows its promise instead of three zeros.
      isEmpty: paidOutPaise === 0 && tournaments === 0,
    };
  } catch {
    return empty;
  }
}
