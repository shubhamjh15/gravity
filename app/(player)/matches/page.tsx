import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { SectionHeading } from "@/components/gravity/section-heading";
import {
  MatchInvites,
  type InviteView,
} from "@/components/gravity/community/match-invites";

export const metadata: Metadata = { title: "Challenges" };

/**
 * 1-v-1 challenges (ROADMAP 3.6).
 *
 * RLS on match_invites already scopes rows to the two parties, so the
 * `.or(from_user, to_user)` filter here is about fetching the right set, not
 * about security.
 */
export default async function MatchesPage() {
  const user = await requireUser("/matches");
  const supabase = await createSupabaseServerClient();

  const { data: invites } = await supabase
    .from("match_invites")
    .select("id, from_user, to_user, game_id, status, message, created_at")
    .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = invites ?? [];

  // Resolve the other party's name and the game title in one round trip each.
  const counterpartIds = [
    ...new Set(
      rows.map((r) => (r.from_user === user.id ? r.to_user : r.from_user)),
    ),
  ];
  const gameIds = [...new Set(rows.map((r) => r.game_id).filter(Boolean))];

  const [profilesRes, gamesRes] = await Promise.all([
    counterpartIds.length
      ? supabase.from("profiles").select("id, display_name").in("id", counterpartIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
    gameIds.length
      ? supabase.from("games").select("id, name").in("id", gameIds as string[])
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const nameFor = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p.display_name || "A player"]),
  );
  const gameFor = new Map((gamesRes.data ?? []).map((g) => [g.id, g.name]));

  const views: InviteView[] = rows.map((r) => {
    const outgoing = r.from_user === user.id;
    const counterpartId = outgoing ? r.to_user : r.from_user;
    return {
      id: r.id,
      status: r.status as InviteView["status"],
      message: r.message,
      game_name: r.game_id ? (gameFor.get(r.game_id) ?? null) : null,
      counterpart_name: nameFor.get(counterpartId) ?? "A player",
      counterpart_id: counterpartId,
      created_at: r.created_at,
      direction: outgoing ? "outgoing" : "incoming",
    };
  });

  return (
    <div className="mx-auto max-w-3xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Head to head"
        title="Challenges"
        lead="1-v-1 invites you've sent and received. Coordination only — no stakes are held."
        as="h1"
      />
      <div className="mt-8">
        <MatchInvites invites={views} />
      </div>
    </div>
  );
}
