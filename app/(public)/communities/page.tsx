import type { Metadata } from "next";
import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { listCommunities } from "@/lib/data/communities";
import { getAuthContext } from "@/lib/auth";
import { CommunityCard } from "@/components/gravity/community/community-card";
import { SectionHeading } from "@/components/gravity/section-heading";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Communities",
  description: "Join gaming communities, compete together, and climb the ranks.",
};

export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { communities } = await listCommunities({
    q: sp.q,
    page: sp.page ? Number(sp.page) : 1,
  });
  const { isOrganizer, isSuperadmin } = await getAuthContext();

  return (
    <div className="mx-auto max-w-7xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="Find your crew"
          title={
            <>
              Gaming <span className="gv-text-gradient">communities</span>
            </>
          }
          lead="Join a community to compete together, chat, and unlock member-only tournaments."
          as="h1"
        />
        {isOrganizer || isSuperadmin ? (
          <Button asChild variant="gradient" size="lg">
            <Link href={"/communities/create" as never}>
              <Plus className="size-4" /> Create community
            </Link>
          </Button>
        ) : null}
      </div>

      {communities.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-4 rounded-xl border border-dashed border-line py-20 text-center">
          <Users className="size-8 text-text-dim" />
          <p className="font-display text-2xl">No communities yet</p>
          <p className="max-w-sm text-sm text-text-muted">
            Be the first to build one — organizers can create communities and
            grow their following.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {communities.map((c) => (
            <CommunityCard key={c.id} community={c} />
          ))}
        </div>
      )}
    </div>
  );
}
