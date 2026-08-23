import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { EventCardData } from "@/components/gravity/events/event-card";
import type { Database, Json } from "@/lib/supabase/types";

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

/**
 * Sum the advertised prize pool.
 *
 * `rank_prizes_paise` is a `jsonb` column, so it arrives as the generated `Json`
 * union rather than a keyed object — it could legitimately be a string, an
 * array, or null. Everything is coerced defensively and anything non-numeric
 * contributes zero, so a malformed row shows an understated pool instead of
 * rendering NaN across the listing.
 */
function poolFromStructure(ps: {
  rank_prizes_paise?: Json | null;
  per_kill_paise?: number | null;
  kill_budget_cap_paise?: number | null;
  entry_fee_paise?: number | null;
} | null): number {
  if (!ps) return 0;

  const prizes = ps.rank_prizes_paise;
  const ranks =
    prizes && typeof prizes === "object" && !Array.isArray(prizes)
      ? Object.values(prizes).reduce<number>((sum, v) => sum + toNumber(v), 0)
      : 0;

  const killCap = toNumber(ps.kill_budget_cap_paise);
  // Displayed "prize pool" = what players can win = ranks + kill budget.
  return ranks + killCap;
}

/**
 * Narrow a `rank_prizes_paise` jsonb value into a rank -> paise map.
 * Non-numeric or malformed entries are dropped rather than becoming NaN.
 */
export function rankPrizesFrom(value: Json | null | undefined): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [rank, amount] of Object.entries(value)) {
    const n = Number(amount ?? 0);
    if (Number.isFinite(n) && n > 0) out[rank] = n;
  }
  return out;
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * `public_events` is a VIEW, so Postgres reports every column as nullable even
 * though the underlying `events` columns are NOT NULL — the generated types
 * reflect that faithfully. This narrows a view row back to the shape the rest of
 * the app expects, dropping any row missing an identity column rather than
 * rendering a card that links nowhere.
 */
type PublicEventRow = Database["public"]["Views"]["public_events"]["Row"];

/** A view row with the identity columns the UI can't render without. */
export type RenderableEvent = PublicEventRow & {
  id: string;
  slug: string;
  title: string;
};

function isRenderable(row: PublicEventRow): row is RenderableEvent {
  return Boolean(row.id && row.slug && row.title);
}

export async function listEvents(filters: EventFilters = {}): Promise<{
  events: EventCardData[];
  total: number;
}> {
  if (!isSupabaseConfigured()) return { events: [], total: 0 };
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
  const events = ((rows ?? []) as PublicEventRow[]).filter(isRenderable);
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
    game_name: gameName(e.game_id ?? ""),
    entry_fee_paise: toNumber(e.entry_fee_paise),
    prize_pool_paise: poolFromStructure(structureFor(e.id)),
    max_slots: toNumber(e.max_slots),
    taken: takenFor(e.id),
    status: e.status ?? "upcoming",
    starts_at: e.starts_at,
  }));

  return { events: cards, total: count ?? cards.length };
}

export async function getEventBySlug(slug: string) {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data: raw } = await supabase
    .from("public_events")
    .select("*")
    .eq("slug", slug)
    .single();
  if (!raw) return null;

  // Same view-nullability narrowing as the listing: without an id there is
  // nothing to join against, so treat it as not found.
  const event = raw as PublicEventRow;
  if (!isRenderable(event)) return null;
  const eventId = event.id;

  const [gameRes, structureRes, regsRes] = await Promise.all([
    supabase
      .from("games")
      .select("id, name")
      .eq("id", event.game_id ?? "")
      .maybeSingle(),
    supabase
      .from("prize_structures")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle(),
    supabase
      .from("registrations")
      .select("status")
      .eq("event_id", eventId)
      .in("status", ["paid", "confirmed", "slot_held"]),
  ]);

  return {
    event,
    gameName: gameRes.data?.name ?? "Game",
    structure: structureRes.data,
    taken: (regsRes.data ?? []).length,
  };
}
