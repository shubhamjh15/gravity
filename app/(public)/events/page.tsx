import type { Metadata } from "next";
import Link from "next/link";
import { Swords } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listEvents, type EventFilters } from "@/lib/data/events";
import { EventCard } from "@/components/gravity/events/event-card";
import { EventsFilter } from "@/components/gravity/events/events-filter";
import { SectionHeading } from "@/components/gravity/section-heading";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Tournaments",
  description: "Discover and register for Free Fire, BGMI and PUBG tournaments.",
};

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: games } = await supabase
    .from("games")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");

  const statusParam = sp.status;
  const filters: EventFilters = {
    q: sp.q,
    gameId: sp.game,
    free: sp.free === "1",
    page: sp.page ? Number(sp.page) : 1,
    status:
      statusParam && statusParam !== "live"
        ? (statusParam as EventFilters["status"])
        : undefined,
  };

  const { events, total } = await listEvents(filters);
  const pageSize = 12;
  const page = filters.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-7xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Compete for cash"
        title={
          <>
            Find your <span className="gv-text-gradient">tournament</span>
          </>
        }
        lead="Browse upcoming and live tournaments. Filter by game, entry fee, and status."
        as="h1"
      />

      <div className="mt-8">
        <EventsFilter games={games ?? []} />
      </div>

      {events.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>

          {totalPages > 1 ? (
            <Pagination page={page} totalPages={totalPages} searchParams={sp} />
          ) : null}
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-16 flex flex-col items-center gap-4 rounded-xl border border-dashed border-line py-20 text-center">
      <span className="grid size-14 place-items-center rounded-full border border-crimson-700/40 bg-crimson-500/10 text-crimson-300">
        <Swords className="size-6" />
      </span>
      <div>
        <p className="font-display text-2xl">No tournaments found</p>
        <p className="mt-1 max-w-sm text-sm text-text-muted">
          Try clearing your filters, or check back soon — organizers add new
          tournaments every day.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href={"/events" as never}>Clear filters</Link>
      </Button>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}) {
  const make = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") sp.set(k, v);
    }
    sp.set("page", String(p));
    return `/events?${sp.toString()}`;
  };

  return (
    <div className="mt-10 flex items-center justify-center gap-2">
      <Button asChild variant="outline" size="sm" disabled={page <= 1}>
        <Link href={make(Math.max(1, page - 1)) as never}>Previous</Link>
      </Button>
      <span className="px-4 font-mono text-sm text-text-muted">
        {page} / {totalPages}
      </span>
      <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
        <Link href={make(Math.min(totalPages, page + 1)) as never}>Next</Link>
      </Button>
    </div>
  );
}
