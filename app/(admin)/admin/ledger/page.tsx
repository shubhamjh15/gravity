import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise, paise, type Paise } from "@/lib/money";

export const metadata: Metadata = { title: "Ledger", robots: { index: false } };

const DIRECTION_STYLE: Record<string, string> = {
  in: "text-success",
  out: "text-danger",
  internal: "text-text-dim",
};

export default async function AdminLedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 50;
  const from = (page - 1) * pageSize;

  const supabase = await createSupabaseServerClient();
  const { data: rows, count } = await supabase
    .from("ledger_entries")
    .select("id, entry_type, source_type, direction, amount_paise, status, created_at, user_id", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl tracking-tight">Ledger</h1>
      <p className="mt-1 text-sm text-text-muted">
        Every rupee that has moved through the platform. Immutable, append-only.
      </p>

      <div className="mt-8 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-left font-mono text-[10px] tracking-widest text-text-dim uppercase">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-text-muted">
                  No transactions yet.
                </td>
              </tr>
            ) : (
              (rows ?? []).map((r) => (
                <tr key={r.id} className="border-b border-line/50 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs text-text-dim">
                    {new Date(r.created_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2.5 capitalize">{r.entry_type}</td>
                  <td className="px-4 py-2.5 text-text-muted">{r.source_type}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full border border-line px-2 py-0.5 text-[11px] capitalize">
                      {r.status}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono ${DIRECTION_STYLE[r.direction]}`}>
                    {r.direction === "out" ? "−" : r.direction === "in" ? "+" : ""}
                    {formatPaise(paise(Number(r.amount_paise)) as Paise)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-center font-mono text-sm text-text-dim">
        Page {page} / {totalPages} · {count ?? 0} entries
      </p>
    </div>
  );
}
