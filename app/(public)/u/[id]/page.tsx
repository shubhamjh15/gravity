import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Trophy, Target, Swords, Wallet } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { formatPaise, paise } from "@/lib/money";

/**
 * Public player profile. Reads ONLY public-safe data — profiles +
 * player_game_profiles + player_stats. profiles_private (phone/upi/gov-id) is
 * never queried and is unreachable here by RLS (#6). Sensitive fields hidden by
 * construction, not just by UI.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", id)
    .single();
  return { title: data?.display_name ? `${data.display_name}` : "Player" };
}

function publicUrlFor(bucket: string, path: string | null): string | null {
  if (!path || !publicEnv.supabaseUrl) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [profileRes, gamesRes, gameProfilesRes, statsRes, earningsRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, avatar_path, banner_path, created_at")
        .eq("id", id)
        .is("deleted_at", null)
        .single(),
      supabase.from("games").select("id, name").eq("is_active", true),
      supabase.from("player_game_profiles").select("*").eq("user_id", id),
      supabase.from("player_stats").select("*").eq("user_id", id).single(),
      supabase
        .from("ledger_entries")
        .select("amount_paise")
        .eq("user_id", id)
        .eq("source_type", "prize")
        .in("status", ["captured", "settled"]),
    ]);

  const profile = profileRes.data;
  if (!profile) notFound();

  const gameName = (gid: string) =>
    (gamesRes.data ?? []).find((g) => g.id === gid)?.name ?? "Game";
  const gameProfiles = gameProfilesRes.data ?? [];
  const stats = statsRes.data;
  const earnings = (earningsRes.data ?? []).reduce(
    (s, r) => s + Number(r.amount_paise ?? 0),
    0,
  );

  const avatar = publicUrlFor("avatars", profile.avatar_path);
  const banner = publicUrlFor("banners", profile.banner_path);
  const initials = (profile.display_name ?? "GG")
    .split(" ")
    .map((s: string) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-5xl px-4 pt-20 pb-24 sm:px-6 lg:px-8">
      <div className="gv-panel overflow-hidden">
        <div className="relative h-40 sm:h-56">
          {banner ? (
            <Image
              src={banner}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width:768px) 100vw, 960px"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 gv-grid-bg opacity-60" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
        </div>

        <div className="flex flex-col items-center gap-3 px-6 pb-8 text-center sm:-mt-16 -mt-14">
          <div className="size-28 overflow-hidden rounded-2xl border-2 border-background bg-surface-2 shadow-glow sm:size-32">
            {avatar ? (
              <Image
                src={avatar}
                alt={profile.display_name ?? "Player"}
                width={128}
                height={128}
                className="size-full object-cover"
                unoptimized
              />
            ) : (
              <div className="grid size-full place-items-center font-display text-4xl text-crimson-300">
                {initials}
              </div>
            )}
          </div>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
            {profile.display_name ?? "Player"}
          </h1>
        </div>
      </div>

      {/* stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PublicStat
          icon={<Wallet className="size-4" />}
          label="Earnings"
          value={formatPaise(paise(Math.max(0, earnings)), { compactWhole: true })}
        />
        <PublicStat icon={<Trophy className="size-4" />} label="Wins" value={String(stats?.total_wins ?? 0)} />
        <PublicStat icon={<Swords className="size-4" />} label="Matches" value={String(stats?.total_matches ?? 0)} />
        <PublicStat icon={<Target className="size-4" />} label="Kills" value={String(stats?.total_kills ?? 0)} />
      </div>

      {/* games */}
      {gameProfiles.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl tracking-tight">Games</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {gameProfiles.map((gp) => (
              <div key={gp.id} className="gv-card-accent p-5">
                <p className="font-display text-lg">{gameName(gp.game_id)}</p>
                <p className="mt-1 font-mono text-sm text-text-muted">
                  {gp.ign ?? "—"}
                  {gp.ranking ? ` · ${gp.ranking}` : ""}
                </p>
                <div className="mt-3 flex gap-4 font-mono text-xs text-text-dim">
                  {gp.kill_ratio != null ? <span>K/D {gp.kill_ratio}</span> : null}
                  {gp.win_ratio != null ? <span>Win {gp.win_ratio}%</span> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PublicStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="gv-panel flex items-center gap-3 p-4">
      <span className="grid size-9 place-items-center rounded-md border border-crimson-700/40 bg-crimson-500/10 text-crimson-300">
        {icon}
      </span>
      <div>
        <p className="font-mono text-[10px] tracking-widest text-text-dim uppercase">{label}</p>
        <p className="font-display text-lg leading-tight">{value}</p>
      </div>
    </div>
  );
}
