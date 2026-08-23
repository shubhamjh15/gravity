import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Announcements + featured placements (SCHEMA.md §7).
 *
 * Both are read on hot public surfaces, so they are plain server-rendered
 * reads — never a per-visitor Realtime subscription (#7). The "live now"
 * window is filtered in SQL so an expired banner never reaches the client.
 *
 * These helpers fail soft: an unconfigured or unreachable backend renders no
 * banner rather than taking the page down.
 */

export type Announcement = {
  id: string;
  scope: "global" | "community" | "event";
  scope_id: string | null;
  title: string;
  body: string | null;
  level: "info" | "warning" | "critical";
  active_from: string;
  active_to: string | null;
};

/**
 * Announcements live right now for a scope. Global ones are always included,
 * so a community page shows platform-wide notices alongside its own.
 */
export async function getLiveAnnouncements(opts?: {
  scope?: "community" | "event";
  scopeId?: string;
  limit?: number;
}): Promise<Announcement[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const nowIso = new Date().toISOString();

    let query = supabase
      .from("announcements")
      .select("id, scope, scope_id, title, body, level, active_from, active_to")
      .is("deleted_at", null)
      .lte("active_from", nowIso)
      .or(`active_to.is.null,active_to.gt.${nowIso}`)
      .order("active_from", { ascending: false })
      .limit(opts?.limit ?? 3);

    query =
      opts?.scope && opts.scopeId
        ? query.or(`scope.eq.global,and(scope.eq.${opts.scope},scope_id.eq.${opts.scopeId})`)
        : query.eq("scope", "global");

    const { data, error } = await query;
    if (error) return [];
    return (data ?? []) as Announcement[];
  } catch {
    return [];
  }
}

/** Every announcement, for the admin management table (RLS lets admins see all). */
export async function listAllAnnouncements(): Promise<
  (Announcement & { deleted_at: string | null })[]
> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("announcements")
      .select(
        "id, scope, scope_id, title, body, level, active_from, active_to, deleted_at",
      )
      .order("active_from", { ascending: false })
      .limit(100);
    if (error) return [];
    return (data ?? []) as (Announcement & { deleted_at: string | null })[];
  } catch {
    return [];
  }
}

export type FeaturedPlacement = {
  id: string;
  kind: "event" | "community";
  target_id: string;
  reason: "hype" | "deal" | "partner";
  sort_order: number;
  active: boolean;
};

/** Active featured placements, lowest sort_order first. */
export async function getFeaturedPlacements(kind?: "event" | "community"): Promise<
  FeaturedPlacement[]
> {
  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("featured_placements")
      .select("id, kind, target_id, reason, sort_order, active")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (kind) query = query.eq("kind", kind);

    const { data, error } = await query;
    if (error) return [];
    return (data ?? []) as FeaturedPlacement[];
  } catch {
    return [];
  }
}

/** All placements including paused ones, for the admin surface. */
export async function listAllFeaturedPlacements(): Promise<FeaturedPlacement[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("featured_placements")
      .select("id, kind, target_id, reason, sort_order, active")
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) return [];
    return (data ?? []) as FeaturedPlacement[];
  } catch {
    return [];
  }
}
