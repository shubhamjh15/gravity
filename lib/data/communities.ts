import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { CommunityCardData } from "@/components/gravity/community/community-card";

/** Server data helpers for communities. */

export async function listCommunities(opts: {
  q?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ communities: CommunityCardData[]; total: number }> {
  if (!isSupabaseConfigured()) return { communities: [], total: 0 };
  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(48, opts.pageSize ?? 12);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("communities")
    .select(
      "id, slug, name, about, banner_path, profile_pic_path, location, is_paid, membership_cost_paise, is_featured",
      { count: "exact" },
    )
    .eq("visibility", "public")
    .is("deleted_at", null)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (opts.q?.trim()) query = query.ilike("name", `%${opts.q.trim()}%`);

  const { data: rows, count } = await query;
  const communities = rows ?? [];
  if (communities.length === 0) return { communities: [], total: count ?? 0 };

  // member counts
  const ids = communities.map((c) => c.id);
  const { data: members } = await supabase
    .from("community_members")
    .select("community_id, status")
    .in("community_id", ids)
    .eq("status", "active");

  const countFor = (cid: string) =>
    (members ?? []).filter((m) => m.community_id === cid).length;

  return {
    communities: communities.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      about: c.about,
      banner_path: c.banner_path,
      profile_pic_path: c.profile_pic_path,
      location: c.location,
      is_paid: c.is_paid,
      membership_cost_paise: Number(c.membership_cost_paise),
      is_featured: c.is_featured,
      member_count: countFor(c.id),
    })),
    total: count ?? communities.length,
  };
}

export async function getCommunityBySlug(slug: string) {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data: community } = await supabase
    .from("communities")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single();
  if (!community) return null;

  const [membersRes, postsRes, eventsRes, galleryRes] = await Promise.all([
    supabase
      .from("community_members")
      .select("user_id, role, status")
      .eq("community_id", community.id)
      .eq("status", "active"),
    supabase
      .from("community_posts")
      .select("id, author_id, body, event_id, pinned, created_at")
      .eq("community_id", community.id)
      .is("deleted_at", null)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("public_events")
      .select("id, slug, title, status, entry_fee_paise, starts_at")
      .eq("community_id", community.id)
      .order("starts_at", { ascending: true })
      .limit(12),
    supabase
      .from("community_gallery")
      .select("id, image_path, caption")
      .eq("community_id", community.id)
      .order("sort_order"),
  ]);

  return {
    community,
    members: membersRes.data ?? [],
    posts: postsRes.data ?? [],
    events: eventsRes.data ?? [],
    gallery: galleryRes.data ?? [],
  };
}
