import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { paiseToRupees, paise } from "@/lib/money";
import { toCsv, csvResponse, dateStamp } from "@/lib/csv";

/**
 * Organizer transaction export (the "download reports" acceptance criterion).
 *
 * Deliberately NOT filtered by a client-supplied organizer id: the query runs
 * as the logged-in user and RLS returns exactly the rows they own (migration
 * 0019). Passing an id would invite someone to try another organizer's.
 *
 * Amounts are written twice — paise for machine reconciliation, rupees for
 * humans opening it in a spreadsheet — so nobody has to guess the unit (#1).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = [
  "Date",
  "Type",
  "Category",
  "Direction",
  "Status",
  "Amount (paise)",
  "Amount (INR)",
  "Event ID",
  "Community ID",
  "Ledger entry ID",
] as const;

export async function GET() {
  const user = await getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ledger_entries")
    .select(
      "id, entry_type, source_type, direction, amount_paise, status, created_at, event_id, community_id",
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    return new Response("Could not build the report.", { status: 500 });
  }

  const rows = (data ?? []).map((r) => [
    new Date(r.created_at).toISOString(),
    r.entry_type,
    r.source_type,
    r.direction,
    r.status,
    Number(r.amount_paise),
    paiseToRupees(paise(Number(r.amount_paise))).toFixed(2),
    r.event_id ?? "",
    r.community_id ?? "",
    r.id,
  ]);

  return csvResponse(
    `gravity-transactions-${dateStamp()}.csv`,
    toCsv(HEADERS, rows),
  );
}
