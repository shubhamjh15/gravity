import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EventCardData } from "@/components/gravity/events/event-card";

/**
 * Server data helpers for events. Reads go through the public_events view (no
 * room creds) and join the prize pool + a live taken-count. Listing supports
 * filter/search/status with pagination.
 */

export type EventFilters = {
  q?: string;
  gameId?: string;
  status?: "upcoming" | "ongoing" | "completed" | "archived";
  free?: boolean;
  page?: number;
  pageSize?: number;
};

function poolFromStructure(ps: {
  rank_prizes_paise?: Record<string, number> | null;
  per_kill_paise?: number | null;
  kill_budget_cap_paise?: number | null;
  entry_fee_paise?: number | null;
} | null): number {
  if (!ps) return 0;
  const ranks = Object.values(ps.rank_prizes_paise ?? {}).reduce(
    (s, v) => s + Number(v ?? 0),
    0,
  );
  const killCap = Number(ps.kill_budget_cap_paise ?? 0);
  // Displayed "prize pool" = what players can win = ranks + kill budget.
  return ranks + killCap;
}

export async function listEvents(filters: EventFilters = {}): Promise<{
  events: EventCardData[];
  total: number;
}> {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(48, filters.pageSize ?? 12);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("public_events")
    .select(
      "id, slug, title, banner_path, game_id, entry_fee_paise, max_slots, status, starts_at",
      { count: "exact" },
    )
    .order("starts_at", { ascending: true, nullsFirst: false })
    .range(from, to);

  if (filters.status) query = query.eq("status", filters.status);
  else query = query.in("status", ["upcoming", "ongoing"]);

  if (filters.gameId) query = query.eq("game_id", filters.gameId);
  if (filters.free) query = query.eq("entry_fee_paise", 0);
  if (filters.q && filters.q.trim()) {
    query = query.ilike("title", `%${filters.q.trim()}%`);
  }

  const { data: rows, count } = await query;
  const events = rows ?? [];
  if (events.length === 0) return { events: [], total: count ?? 0 };

  const ids = events.map((e) => e.id);

  // Fetch games, prize structures, and taken counts in parallel.
  const [gamesRes, structuresRes, regsRes] = await Promise.all([
    supabase.from("games").select("id, name"),
    supabase
      .from("prize_structures")
      .select("event_id, rank_prizes_paise, per_kill_paise, kill_budget_cap_paise, entry_fee_paise")
      .in("event_id", ids),
    supabase
      .from("registrations")
      .select("event_id, status")
      .in("event_id", ids)
      .in("status", ["paid", "confirmed", "slot_held"]),
  ]);

  const gameName = (gid: string) =>
    (gamesRes.data ?? []).find((g) => g.id === gid)?.name ?? "Game";
  const structureFor = (eid: string) =>
    (structuresRes.data ?? []).find((s) => s.event_id === eid) ?? null;
  const takenFor = (eid: string) =>
    (regsRes.data ?? []).filter((r) => r.event_id === eid).length;

  const cards: EventCardData[] = events.map((e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    banner_path: e.banner_path,
    game_name: gameName(e.game_id),
    entry_fee_paise: Number(e.entry_fee_paise),
    prize_pool_paise: poolFromStructure(structureFor(e.id)),
    max_slots: Number(e.max_slots),
    taken: takenFor(e.id),
    status: e.status,
    starts_at: e.starts_at,
  }));

  return { events: cards, total: count ?? cards.length };
}

export async function getEventBySlug(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data: event } = await supabase
    .from("public_events")
    .select("*")
    .eq("slug", slug)
    .single();
  if (!event) return null;

  const [gameRes, structureRes, regsRes] = await Promise.all([
    supabase.from("games").select("id, name").eq("id", event.game_id).single(),
    supabase.from("prize_structures").select("*").eq("event_id", event.id).single(),
    supabase
      .from("registrations")
      .select("status")
      .eq("event_id", event.id)
      .in("status", ["paid", "confirmed", "slot_held"]),
  ]);

  return {
    event,
    gameName: gameRes.data?.name ?? "Game",
    structure: structureRes.data,
    taken: (regsRes.data ?? []).length,
  };
}
