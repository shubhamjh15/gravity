import Link from "next/link";
import Image from "next/image";
import { Users, MapPin, Crown } from "lucide-react";
import { GlowCard } from "@/components/gravity/glow-card";
import { formatPaise, paise } from "@/lib/money";
import { publicEnv } from "@/lib/env";

export type CommunityCardData = {
  id: string;
  slug: string;
  name: string;
  about: string | null;
  banner_path: string | null;
  profile_pic_path: string | null;
  location: string | null;
  is_paid: boolean;
  membership_cost_paise: number;
  is_featured: boolean;
  member_count: number;
};

function url(bucket: string, path: string | null): string | null {
  if (!path || !publicEnv.supabaseUrl) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

export function CommunityCard({ community }: { community: CommunityCardData }) {
  const banner = url("banners", community.banner_path);
  const pic = url("avatars", community.profile_pic_path);

  return (
    <GlowCard className="h-full">
      <Link href={`/communities/${community.slug}` as never} className="flex h-full flex-col">
        <div className="relative h-28 w-full overflow-hidden">
          {banner ? (
            <Image src={banner} alt="" fill className="object-cover" sizes="400px" unoptimized />
          ) : (
            <div className="absolute inset-0 gv-grid-bg opacity-50" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
          {community.is_featured ? (
            <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border border-crimson-700/50 bg-crimson-500/15 px-2 py-0.5 text-[10px] font-semibold text-crimson-300">
              <Crown className="size-3" /> Featured
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="-mt-10 flex items-end gap-3">
            <div className="size-16 overflow-hidden rounded-xl border-2 border-background bg-surface-2">
              {pic ? (
                <Image src={pic} alt="" width={64} height={64} className="size-full object-cover" unoptimized />
              ) : (
                <div className="grid size-full place-items-center font-display text-2xl text-crimson-300">
                  {community.name[0]?.toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="line-clamp-1 font-display text-lg tracking-tight">{community.name}</h3>
            {community.about ? (
              <p className="mt-1 line-clamp-2 text-sm text-text-muted">{community.about}</p>
            ) : null}
          </div>

          <div className="mt-auto flex items-center justify-between pt-2 text-xs">
            <div className="flex items-center gap-3 text-text-muted">
              <span className="flex items-center gap-1">
                <Users className="size-3.5" />
                {community.member_count}
              </span>
              {community.location ? (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {community.location}
                </span>
              ) : null}
            </div>
            <span className="font-mono font-semibold">
              {community.is_paid && community.membership_cost_paise > 0 ? (
                formatPaise(paise(community.membership_cost_paise), { compactWhole: true })
              ) : (
                <span className="text-success">FREE</span>
              )}
            </span>
          </div>
        </div>
      </Link>
    </GlowCard>
  );
}
