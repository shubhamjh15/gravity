import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Crosshair, Crown, Wallet, Medal } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise, paise } from "@/lib/money";
import { SectionHeading } from "@/components/gravity/section-heading";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Top players by earnings, kills and wins.",
};

const METRICS = [
  { key: "net_earnings", label: "Earnings", icon: Wallet },
  { key: "kills", label: "Kills", icon: Crosshair },
  { key: "wins", label: "Wins", icon: Trophy },
] as const;

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const metric = (sp.metric ?? "net_earnings") as (typeof METRICS)[number]["key"];

  const supabase = await createSupabaseServerClient();

  // Read precomputed snapshots; fall back to live player_stats if empty.
  let { data: rows } = await supabase
    .from("leaderboard_snapshots")
    .select("user_id, value, rank")
    .eq("metric", metric)
    .eq("scope", "global")
    .eq("period", "all_time")
    .order("rank", { ascending: true })
    .limit(100);

  if (!rows || rows.length === 0) {
    // Fallback: live aggregate (small scale before cron runs).
    const col =
      metric === "net_earnings"
        ? "net_earnings_paise"
        : metric === "kills"
          ? "total_kills"
          : "total_wins";
    const { data: stats } = await supabase
      .from("player_stats")
      .select(`user_id, ${col}`)
      .order(col, { ascending: false })
      .limit(100);
    rows = (stats ?? [])
      .map((s, i) => ({
        user_id: (s as Record<string, unknown>).user_id as string,
        value: Number((s as Record<string, unknown>)[col] ?? 0),
        rank: i + 1,
      }))
      .filter((r) => r.value > 0);
  }

  const ids = (rows ?? []).map((r) => r.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, display_name, avatar_path").in("id", ids)
    : { data: [] };
  const nameFor = (id: string) =>
    profiles?.find((p) => p.id === id)?.display_name ?? "Player";

  const fmt = (v: number) =>
    metric === "net_earnings"
      ? formatPaise(paise(Math.max(0, v)), { compactWhole: true })
      : v.toLocaleString("en-IN");

  return (
    <div className="mx-auto max-w-4xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Hall of fame"
        title={
          <>
            The <span className="gv-text-gradient">leaderboard</span>
          </>
        }
        lead="The best of the best — ranked by earnings, kills and wins across every tournament."
        as="h1"
        align="center"
        className="mx-auto"
      />

      {/* metric tabs */}
      <div className="mt-8 flex justify-center gap-2">
        {METRICS.map((m) => {
          const Icon = m.icon;
          const active = m.key === metric;
          return (
            <Link
              key={m.key}
              href={`/leaderboard?metric=${m.key}` as never}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-crimson-500 bg-crimson-500/10 text-crimson-300"
                  : "border-line text-text-muted hover:border-line-strong"
              }`}
            >
              <Icon className="size-4" />
              {m.label}
            </Link>
          );
        })}
      </div>

      {/* podium + list */}
      {(rows ?? []).length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-line py-16 text-center">
          <Medal className="mx-auto size-8 text-text-dim" />
          <p className="mt-3 font-display text-xl">No rankings yet</p>
          <p className="mt-1 text-sm text-text-muted">
            Play tournaments to climb the leaderboard.
          </p>
        </div>
      ) : (
        <div className="mt-10 overflow-hidden rounded-xl border border-line">
          {(rows ?? []).map((r, i) => (
            <Link
              key={r.user_id}
              href={`/u/${r.user_id}` as never}
              className="flex items-center gap-4 border-b border-line/50 px-4 py-3.5 transition-colors last:border-0 hover:bg-surface-2/50"
            >
              <RankBadge rank={r.rank ?? i + 1} />
              <span className="flex-1 truncate font-medium">{nameFor(r.user_id)}</span>
              <span className="gv-text-gradient font-mono font-semibold">
                {fmt(Number(r.value))}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const color =
      rank === 1 ? "text-amber-300" : rank === 2 ? "text-zinc-300" : "text-orange-400";
    return (
      <span className={`grid size-9 place-items-center font-display text-lg ${color}`}>
        <Crown className="size-5" />
      </span>
    );
  }
  return (
    <span className="grid size-9 place-items-center font-mono text-sm text-text-dim">
      {rank}
    </span>
  );
}
