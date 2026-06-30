import { Medal, Crosshair } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise, paise } from "@/lib/money";

/**
 * Published results table for an event. Server component — reads event_results
 * (RLS allows public read only when status='published'). Renders nothing if no
 * published results exist yet.
 */
export async function EventResults({ eventId }: { eventId: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: results } = await supabase
    .from("event_results")
    .select("user_id, rank, kills, amount_paid_paise, status")
    .eq("event_id", eventId)
    .eq("status", "published")
    .order("rank", { ascending: true, nullsFirst: false });

  if (!results || results.length === 0) return null;

  // Resolve display names (public profiles).
  const userIds = results.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);
  const nameFor = (id: string) =>
    profiles?.find((p) => p.id === id)?.display_name ?? "Player";

  const rankColor = (rank: number | null) => {
    if (rank === 1) return "text-amber-300";
    if (rank === 2) return "text-zinc-300";
    if (rank === 3) return "text-orange-400";
    return "text-text-muted";
  };

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 font-display text-2xl tracking-tight">
        <span className="text-crimson-400">
          <Medal className="size-5" />
        </span>
        Results
      </h2>

      <div className="mt-3 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-left font-mono text-[10px] tracking-widest text-text-dim uppercase">
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3 text-center">Kills</th>
              <th className="px-4 py-3 text-right">Won</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.user_id} className="border-b border-line/50 last:border-0">
                <td className={`px-4 py-3 font-display text-lg ${rankColor(r.rank)}`}>
                  {r.rank ? `#${r.rank}` : "—"}
                </td>
                <td className="px-4 py-3 font-medium">{nameFor(r.user_id)}</td>
                <td className="px-4 py-3 text-center font-mono text-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Crosshair className="size-3" />
                    {r.kills}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold">
                  {Number(r.amount_paid_paise) > 0
                    ? formatPaise(paise(Number(r.amount_paid_paise)))
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
