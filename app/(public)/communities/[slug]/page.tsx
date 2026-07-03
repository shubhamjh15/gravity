import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Users, MapPin, ScrollText, Calendar } from "lucide-react";
import { getCommunityBySlug } from "@/lib/data/communities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { formatPaise, paise } from "@/lib/money";
import { publicEnv } from "@/lib/env";
import { JoinButton } from "@/components/gravity/community/join-button";
import { CommunityChat } from "@/components/gravity/community/community-chat";
import { CommunityFeed } from "@/components/gravity/community/community-feed";
import { Spotlight } from "@/components/gravity/spotlight";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCommunityBySlug(slug);
  return { title: data?.community.name ?? "Community" };
}

function url(bucket: string, path: string | null): string | null {
  if (!path || !publicEnv.supabaseUrl) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

export default async function CommunityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getCommunityBySlug(slug);
  if (!data) notFound();

  const { community, members, posts, events } = data;
  const user = await getUser();

  // Membership + name map.
  let membershipStatus: string | undefined;
  if (user) {
    const supabase = await createSupabaseServerClient();
    const { data: m } = await supabase
      .from("community_members")
      .select("status")
      .eq("community_id", community.id)
      .eq("user_id", user.id)
      .maybeSingle();
    membershipStatus = m?.status;
  }

  const memberIds = [...new Set([...members.map((m) => m.user_id), ...posts.map((p) => p.author_id)])];
  const supabase = await createSupabaseServerClient();
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, display_name, avatar_path").in("id", memberIds)
    : { data: [] };
  const nameMap: Record<string, string> = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.display_name ?? "Player"]),
  );

  const banner = url("banners", community.banner_path);
  const pic = url("avatars", community.profile_pic_path);
  const isMember = membershipStatus === "active";
  const isOwner = user?.id === community.owner_id;

  return (
    <article className="pb-24">
      {/* hero */}
      <div className="relative h-52 w-full overflow-hidden sm:h-72">
        {banner ? (
          <Image src={banner} alt="" fill priority className="object-cover" sizes="100vw" unoptimized />
        ) : (
          <div className="absolute inset-0 gv-grid-bg opacity-50" />
        )}
        <Spotlight />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="-mt-16 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="size-28 shrink-0 overflow-hidden rounded-2xl border-2 border-background bg-surface-2 shadow-glow sm:size-32">
            {pic ? (
              <Image src={pic} alt="" width={128} height={128} className="size-full object-cover" unoptimized />
            ) : (
              <div className="grid size-full place-items-center font-display text-5xl text-crimson-300">
                {community.name[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 pb-2">
            <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{community.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-text-muted">
              <span className="flex items-center gap-1">
                <Users className="size-4" /> {members.length} members
              </span>
              {community.location ? (
                <span className="flex items-center gap-1">
                  <MapPin className="size-4" /> {community.location}
                </span>
              ) : null}
              <span className="font-mono font-semibold">
                {community.is_paid && Number(community.membership_cost_paise) > 0
                  ? `${formatPaise(paise(Number(community.membership_cost_paise)), { compactWhole: true })}/membership`
                  : "Free to join"}
              </span>
            </div>
          </div>
          <div className="w-full sm:w-56">
            {isOwner ? (
              <Link
                href={`/communities/${community.slug}/manage` as never}
                className="block w-full rounded-lg border border-line bg-surface-2 px-6 py-3 text-center font-semibold transition-colors hover:border-crimson-500"
              >
                Manage
              </Link>
            ) : user ? (
              <JoinButton
                communityId={community.id}
                membershipStatus={membershipStatus}
                displayName={user.user_metadata?.full_name ?? user.email ?? "Player"}
                email={user.email ?? ""}
              />
            ) : (
              <Link
                href={`/login?next=/communities/${community.slug}`}
                className="block w-full rounded-lg bg-[image:var(--gv-grad-accent)] px-6 py-3 text-center font-semibold text-white"
              >
                Log in to join
              </Link>
            )}
          </div>
        </div>

        {community.about ? (
          <p className="mt-6 max-w-3xl text-text-muted">{community.about}</p>
        ) : null}

        {/* tabs */}
        <div className="mt-8">
          <Tabs defaultValue="feed">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="feed">Feed</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="rules">Rules</TabsTrigger>
            </TabsList>

            <TabsContent value="feed" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                <CommunityFeed
                  communityId={community.id}
                  posts={posts}
                  nameMap={nameMap}
                  canPost={isMember || isOwner}
                />
                <MembersList members={members} nameMap={nameMap} />
              </div>
            </TabsContent>

            <TabsContent value="events" className="mt-6">
              {events.length === 0 ? (
                <p className="text-sm text-text-muted">No tournaments yet.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {events.map((e) => (
                    <Link
                      key={e.id}
                      href={`/events/${e.slug}` as never}
                      className="gv-card-accent p-4"
                    >
                      <p className="font-display text-base">{e.title}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                        <Calendar className="size-3" />
                        {e.starts_at
                          ? new Date(e.starts_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })
                          : "TBA"}
                        <span className="font-mono">
                          {Number(e.entry_fee_paise) === 0
                            ? "Free"
                            : formatPaise(paise(Number(e.entry_fee_paise)), { compactWhole: true })}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="chat" className="mt-6">
              {user ? (
                <CommunityChat
                  communityId={community.id}
                  currentUserId={user.id}
                  isMember={isMember || isOwner}
                  nameMap={nameMap}
                />
              ) : (
                <p className="text-sm text-text-muted">Log in and join to chat.</p>
              )}
            </TabsContent>

            <TabsContent value="rules" className="mt-6">
              <div className="gv-panel p-6">
                <h2 className="flex items-center gap-2 font-display text-xl">
                  <ScrollText className="size-5 text-crimson-400" />
                  Community rules
                </h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-text-muted">
                  {community.rules ?? "No rules set yet."}
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </article>
  );
}

function MembersList({
  members,
  nameMap,
}: {
  members: { user_id: string; role: string }[];
  nameMap: Record<string, string>;
}) {
  return (
    <div className="gv-panel h-fit p-5">
      <h3 className="font-display text-lg">Members</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {members.slice(0, 20).map((m) => (
          <li key={m.user_id} className="flex items-center justify-between text-sm">
            <Link href={`/u/${m.user_id}` as never} className="hover:text-crimson-300">
              {nameMap[m.user_id] ?? "Player"}
            </Link>
            {m.role !== "member" ? (
              <span className="rounded-full border border-crimson-700/40 bg-crimson-500/10 px-2 py-0.5 text-[10px] text-crimson-300 capitalize">
                {m.role}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
