import Link from "next/link";
import Image from "next/image";
import { Calendar, Users, Coins, Trophy } from "lucide-react";
import { GlowCard } from "@/components/gravity/glow-card";
import { formatPaise, paise } from "@/lib/money";
import { publicEnv } from "@/lib/env";

export type EventCardData = {
  id: string;
  slug: string;
  title: string;
  banner_path: string | null;
  game_name: string;
  entry_fee_paise: number;
  prize_pool_paise: number;
  max_slots: number;
  taken: number;
  status: string;
  starts_at: string | null;
};

function bannerUrl(path: string | null): string | null {
  if (!path || !publicEnv.supabaseUrl) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/banners/${path}`;
}

const STATUS_STYLE: Record<string, string> = {
  upcoming: "border-crimson-700/50 bg-crimson-500/10 text-crimson-300",
  ongoing: "border-success/50 bg-success/10 text-success",
  completed: "border-line text-text-muted",
  archived: "border-line text-text-dim",
};

export function EventCard({ event }: { event: EventCardData }) {
  const banner = bannerUrl(event.banner_path);
  const free = event.entry_fee_paise === 0;
  const fillPct = Math.min(
    100,
    Math.round((event.taken / Math.max(1, event.max_slots)) * 100),
  );

  return (
    <GlowCard className="h-full">
      <Link href={`/events/${event.slug}` as never} className="flex h-full flex-col">
        {/* banner */}
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          {banner ? (
            <Image
              src={banner}
              alt=""
              fill
              className="object-cover transition-transform duration-500 group-hover/glow:scale-105"
              sizes="(max-width:768px) 100vw, 400px"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 gv-grid-bg opacity-50" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
          <span
            className={`absolute top-3 left-3 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase ${STATUS_STYLE[event.status] ?? STATUS_STYLE.completed}`}
          >
            {event.status}
          </span>
          <span className="absolute top-3 right-3 rounded-full border border-line bg-background/70 px-2.5 py-1 text-[10px] font-mono backdrop-blur">
            {event.game_name}
          </span>
        </div>

        {/* body */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          <h3 className="line-clamp-2 font-display text-lg leading-tight tracking-tight">
            {event.title}
          </h3>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Meta icon={<Trophy className="size-3.5" />} label="Prize pool">
              <span className="gv-text-gradient font-semibold">
                {formatPaise(paise(Math.max(0, event.prize_pool_paise)), {
                  compactWhole: true,
                })}
              </span>
            </Meta>
            <Meta icon={<Coins className="size-3.5" />} label="Entry">
              {free ? (
                <span className="font-semibold text-success">FREE</span>
              ) : (
                <span className="font-semibold">
                  {formatPaise(paise(event.entry_fee_paise), { compactWhole: true })}
                </span>
              )}
            </Meta>
          </div>

          <div className="mt-auto flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Users className="size-3.5" />
              <span className="font-mono">
                {event.taken}/{event.max_slots}
              </span>
            </div>
            {event.starts_at ? (
              <div className="flex items-center gap-1.5 text-xs text-text-dim">
                <Calendar className="size-3.5" />
                <time dateTime={event.starts_at}>
                  {new Date(event.starts_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </time>
              </div>
            ) : null}
          </div>

          {/* fill bar */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-[image:var(--gv-grad-accent)]"
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>
      </Link>
    </GlowCard>
  );
}

function Meta({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-line bg-surface-2/40 p-2">
      <div className="flex items-center gap-1 text-[10px] tracking-wide text-text-dim uppercase">
        {icon}
        {label}
      </div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
