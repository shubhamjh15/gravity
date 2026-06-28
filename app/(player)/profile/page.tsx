import type { Metadata } from "next";
import { Wallet, Trophy, Target, Swords } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatPaise, paise } from "@/lib/money";
import { CompletionRing } from "@/components/gravity/completion-ring";
import { ProfileForm } from "@/components/gravity/profile/profile-form";
import { PrivateForm } from "@/components/gravity/profile/private-form";
import { GameProfiles } from "@/components/gravity/profile/game-profiles";
import { DocumentUpload } from "@/components/gravity/profile/document-upload";
import { AvatarBanner } from "@/components/gravity/profile/avatar-banner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export const metadata: Metadata = { title: "Your Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const supabase = await createSupabaseServerClient();

  // Fetch everything the profile needs in parallel.
  const [profileRes, privateRes, gamesRes, gameProfilesRes, statsRes, earningsRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("profiles_private").select("*").eq("user_id", user.id).single(),
      supabase.from("games").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("player_game_profiles").select("*").eq("user_id", user.id),
      supabase.from("player_stats").select("*").eq("user_id", user.id).single(),
      supabase
        .from("ledger_entries")
        .select("amount_paise")
        .eq("user_id", user.id)
        .eq("source_type", "prize")
        .in("status", ["captured", "settled"]),
    ]);

  const profile = profileRes.data;
  const priv = privateRes.data;
  const games = (gamesRes.data ?? []).map((g) => ({
    id: g.id as string,
    slug: g.slug as string,
    name: g.name as string,
  }));
  const gameProfiles = (gameProfilesRes.data ?? []).map((gp) => ({
    id: gp.id as string,
    game_id: gp.game_id as string,
    in_game_id: (gp.in_game_id ?? null) as string | null,
    ign: (gp.ign ?? null) as string | null,
    ranking: (gp.ranking ?? null) as string | null,
    kill_ratio: (gp.kill_ratio ?? null) as number | null,
    win_ratio: (gp.win_ratio ?? null) as number | null,
  }));
  const stats = statsRes.data;

  const earningsPaise = (earningsRes.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount_paise ?? 0),
    0,
  );

  const completion = profile?.profile_completion_pct ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
      {/* hero band: banner + avatar */}
      <AvatarBanner
        userId={user.id}
        displayName={profile?.display_name ?? user.email ?? "Player"}
        email={profile?.email ?? user.email ?? ""}
        avatarPath={profile?.avatar_path ?? null}
        bannerPath={profile?.banner_path ?? null}
      />

      {/* stats strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={<Wallet className="size-4" />}
          label="Earnings"
          value={formatPaise(paise(Math.max(0, earningsPaise)), { compactWhole: true })}
        />
        <StatTile
          icon={<Trophy className="size-4" />}
          label="Wins"
          value={String(stats?.total_wins ?? 0)}
        />
        <StatTile
          icon={<Swords className="size-4" />}
          label="Matches"
          value={String(stats?.total_matches ?? 0)}
        />
        <StatTile
          icon={<Target className="size-4" />}
          label="Kills"
          value={String(stats?.total_kills ?? 0)}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* left: editable sections */}
        <div className="order-2 lg:order-1">
          <Tabs defaultValue="identity">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="identity">Identity</TabsTrigger>
              <TabsTrigger value="games">Games</TabsTrigger>
              <TabsTrigger value="private">Private</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="identity" className="mt-5">
              <div className="gv-panel p-5 sm:p-6">
                <ProfileForm
                  initial={{
                    display_name: profile?.display_name ?? null,
                    age: profile?.age ?? null,
                    gender: profile?.gender ?? null,
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="games" className="mt-5">
              <div className="gv-panel p-5 sm:p-6">
                <GameProfiles games={games} existing={gameProfiles} />
              </div>
            </TabsContent>

            <TabsContent value="private" className="mt-5">
              <div className="gv-panel p-5 sm:p-6">
                <PrivateForm
                  initial={{
                    phone: priv?.phone ?? null,
                    upi_id: priv?.upi_id ?? null,
                    gov_id_type: priv?.gov_id_type ?? null,
                    kyc_status: priv?.kyc_status ?? "pending",
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="documents" className="mt-5">
              <div className="gv-panel p-5 sm:p-6">
                <DocumentUpload userId={user.id} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* right: completion + summary */}
        <aside className="order-1 lg:order-2">
          <div className="gv-panel flex flex-col items-center gap-4 p-6 text-center">
            <CompletionRing value={completion} size={120} label="complete" />
            <div>
              <p className="font-display text-lg">Profile strength</p>
              <p className="mt-1 text-sm text-text-muted">
                {completion >= 100
                  ? "Fully set up — you're tournament-ready."
                  : "Complete your profile to unlock the full experience and get paid faster."}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatTile({
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
        <p className="font-mono text-[10px] tracking-widest text-text-dim uppercase">
          {label}
        </p>
        <p className="font-display text-lg leading-tight">{value}</p>
      </div>
    </div>
  );
}
