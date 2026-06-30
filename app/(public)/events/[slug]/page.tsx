import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import {
  Calendar,
  Users,
  Trophy,
  Coins,
  Crosshair,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { getEventBySlug } from "@/lib/data/events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { formatPaise, paise } from "@/lib/money";
import { publicEnv } from "@/lib/env";
import { RegisterButton } from "@/components/gravity/events/register-button";
import { RoomCredentials } from "@/components/gravity/events/room-credentials";
import { EventResults } from "@/components/gravity/events/event-results";
import { Spotlight } from "@/components/gravity/spotlight";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getEventBySlug(slug);
  return { title: data?.event.title ?? "Tournament" };
}

function bannerUrl(path: string | null): string | null {
  if (!path || !publicEnv.supabaseUrl) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/banners/${path}`;
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getEventBySlug(slug);
  if (!data) notFound();

  const { event, gameName, structure, taken } = data;
  const user = await getUser();

  // Is the current user registered? (own row visible by RLS)
  let myRegistration: { status: string } | null = null;
  if (user) {
    const supabase = await createSupabaseServerClient();
    const { data: reg } = await supabase
      .from("registrations")
      .select("status")
      .eq("event_id", event.id)
      .eq("user_id", user.id)
      .maybeSingle();
    myRegistration = reg ?? null;
  }

  const banner = bannerUrl(event.banner_path);
  const free = Number(event.entry_fee_paise) === 0;
  const full = taken >= Number(event.max_slots);
  const closed =
    !["upcoming", "ongoing"].includes(event.status) ||
    (event.registration_closes_at &&
      new Date(event.registration_closes_at) < new Date());

  const rankPrizes: Record<string, number> = structure?.rank_prizes_paise ?? {};
  const prizePool =
    Object.values(rankPrizes).reduce((s, v) => s + Number(v ?? 0), 0) +
    Number(structure?.kill_budget_cap_paise ?? 0);

  const isParticipant =
    myRegistration?.status === "paid" || myRegistration?.status === "confirmed";

  return (
    <article className="pb-24">
      {/* Hero banner */}
      <div className="relative h-64 w-full overflow-hidden sm:h-80 lg:h-96">
        {banner ? (
          <Image
            src={banner}
            alt=""
            fill
            priority
            className="object-cover"
            sizes="100vw"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 gv-grid-bg opacity-50" />
        )}
        <Spotlight />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute right-0 bottom-0 left-0">
          <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-line bg-background/70 px-3 py-1 font-mono text-xs backdrop-blur">
                {gameName}
              </span>
              <span className="rounded-full border border-crimson-700/50 bg-crimson-500/10 px-3 py-1 text-xs font-semibold text-crimson-300 uppercase">
                {event.status}
              </span>
            </div>
            <h1 className="mt-3 max-w-3xl font-display text-4xl leading-[0.95] tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {event.title}
            </h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Main */}
          <div className="order-2 lg:order-1">
            {/* quick stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon={<Trophy className="size-4" />} label="Prize pool">
                <span className="gv-text-gradient">
                  {formatPaise(paise(Math.max(0, prizePool)), { compactWhole: true })}
                </span>
              </Stat>
              <Stat icon={<Coins className="size-4" />} label="Entry">
                {free ? "FREE" : formatPaise(paise(Number(event.entry_fee_paise)), { compactWhole: true })}
              </Stat>
              <Stat icon={<Users className="size-4" />} label="Slots">
                {taken}/{event.max_slots}
              </Stat>
              <Stat icon={<Calendar className="size-4" />} label="Starts">
                {event.starts_at
                  ? new Date(event.starts_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })
                  : "TBA"}
              </Stat>
            </div>

            {/* prize breakdown */}
            {structure ? (
              <Section icon={<Trophy className="size-5" />} title="Prize breakdown">
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(rankPrizes)
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([rank, amt]) => (
                      <PrizeRow
                        key={rank}
                        label={`${ordinal(Number(rank))} place`}
                        value={formatPaise(paise(Number(amt)))}
                      />
                    ))}
                  {Number(structure.per_kill_paise) > 0 ? (
                    <PrizeRow
                      label="Per kill"
                      value={`${formatPaise(paise(Number(structure.per_kill_paise)))} (cap ${formatPaise(paise(Number(structure.kill_budget_cap_paise)), { compactWhole: true })})`}
                      icon={<Crosshair className="size-3.5" />}
                    />
                  ) : null}
                </div>
              </Section>
            ) : null}

            {event.description ? (
              <Section icon={<ScrollText className="size-5" />} title="About">
                <p className="whitespace-pre-line text-sm leading-relaxed text-text-muted">
                  {event.description}
                </p>
              </Section>
            ) : null}

            {event.rules ? (
              <Section icon={<ShieldCheck className="size-5" />} title="Rules">
                <p className="whitespace-pre-line text-sm leading-relaxed text-text-muted">
                  {event.rules}
                </p>
              </Section>
            ) : null}

            {event.dos_and_donts ? (
              <Section title="Do's & Don'ts">
                <p className="whitespace-pre-line text-sm leading-relaxed text-text-muted">
                  {event.dos_and_donts}
                </p>
              </Section>
            ) : null}

            {/* results (published) */}
            <EventResults eventId={event.id} />
          </div>

          {/* Sidebar: register + room */}
          <aside className="order-1 lg:order-2">
            <div className="lg:sticky lg:top-24 lg:-mt-24">
              <div className="gv-panel p-5">
                <div className="mb-4 text-center">
                  <p className="font-mono text-xs tracking-widest text-text-dim uppercase">
                    {free ? "Free entry" : "Entry fee"}
                  </p>
                  <p className="font-display text-3xl">
                    {free ? (
                      <span className="text-success">FREE</span>
                    ) : (
                      formatPaise(paise(Number(event.entry_fee_paise)), { compactWhole: true })
                    )}
                  </p>
                </div>
                {user ? (
                  <RegisterButton
                    eventId={event.id}
                    free={free}
                    alreadyRegistered={Boolean(myRegistration)}
                    registrationStatus={myRegistration?.status}
                    full={full}
                    closed={Boolean(closed)}
                    displayName={user.user_metadata?.full_name ?? user.email ?? "Player"}
                    email={user.email ?? ""}
                  />
                ) : (
                  <a
                    href={`/login?next=/events/${event.slug}`}
                    className="block w-full rounded-lg bg-[image:var(--gv-grad-accent)] px-6 py-3 text-center font-semibold text-white"
                  >
                    Log in to register
                  </a>
                )}

                {event.requires_approval ? (
                  <p className="mt-3 text-center text-xs text-text-dim">
                    Organizer approval required after payment.
                  </p>
                ) : null}
              </div>

              {/* room credentials (only meaningful for participants) */}
              {isParticipant ? (
                <div className="mt-4">
                  <RoomCredentials
                    eventId={event.id}
                    eventTitle={event.title}
                    released={Boolean(event.room_released_at)}
                  />
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </article>
  );
}

function Stat({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="gv-panel p-3 text-center sm:p-4">
      <div className="flex items-center justify-center gap-1 text-text-dim">
        {icon}
        <span className="font-mono text-[10px] tracking-widest uppercase">{label}</span>
      </div>
      <p className="mt-1 font-display text-lg">{children}</p>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 font-display text-2xl tracking-tight">
        {icon ? <span className="text-crimson-400">{icon}</span> : null}
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function PrizeRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-line bg-surface-2/40 px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-sm text-text-muted">
        {icon}
        {label}
      </span>
      <span className="font-mono text-sm font-semibold">{value}</span>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
