import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  listAllAnnouncements,
  listAllFeaturedPlacements,
} from "@/lib/data/announcements";
import { AnnouncementComposer } from "@/components/gravity/admin/announcement-composer";
import { AnnouncementRow } from "@/components/gravity/admin/announcement-row";
import {
  FeaturedManager,
  type PlacementView,
} from "@/components/gravity/admin/featured-manager";
import { CommunityFeatureToggles } from "@/components/gravity/admin/community-feature-toggles";

export const metadata: Metadata = {
  title: "Announcements",
  robots: { index: false },
};

/**
 * Announcements + featured placements console (ROADMAP 6.1).
 *
 * Both surfaces need the same lookup lists (communities, events) to resolve a
 * target uuid into a human name, so they're fetched once here and passed down.
 */
export default async function AdminAnnouncementsPage() {
  const supabase = await createSupabaseServerClient();

  const [announcements, placements, communitiesRes, eventsRes] =
    await Promise.all([
      listAllAnnouncements(),
      listAllFeaturedPlacements(),
      supabase
        .from("communities")
        .select("id, name, is_featured")
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("events")
        .select("id, title")
        .is("deleted_at", null)
        .in("status", ["upcoming", "ongoing"])
        .order("starts_at", { ascending: true })
        .limit(100),
    ]);

  const communities = communitiesRes.data ?? [];
  const events = eventsRes.data ?? [];

  const communityName = new Map(communities.map((c) => [c.id, c.name]));
  const eventTitle = new Map(events.map((e) => [e.id, e.title]));

  const placementViews: PlacementView[] = placements.map((p) => ({
    id: p.id,
    kind: p.kind,
    target_id: p.target_id,
    target_name:
      (p.kind === "event"
        ? eventTitle.get(p.target_id)
        : communityName.get(p.target_id)) ?? "Unknown or archived",
    reason: p.reason,
    sort_order: p.sort_order,
    active: p.active,
  }));

  const live = announcements.filter((a) => !a.deleted_at);
  const retired = announcements.filter((a) => a.deleted_at);

  function scopeLabel(scope: string, scopeId: string | null): string {
    if (scope === "global") return "Everyone";
    if (scope === "community") {
      return `Community · ${scopeId ? (communityName.get(scopeId) ?? "Unknown") : "Unknown"}`;
    }
    return `Tournament · ${scopeId ? (eventTitle.get(scopeId) ?? "Unknown") : "Unknown"}`;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl tracking-tight">Announcements</h1>
      <p className="mt-1 text-sm text-text-muted">
        Platform-wide notices and curated featured slots. Every publish is audited.
      </p>

      <div className="mt-8">
        <AnnouncementComposer communities={communities} />
      </div>

      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-widest text-text-dim uppercase">
          Published ({live.length})
        </h2>
        {live.length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-line py-12 text-center">
            <Megaphone className="size-7 text-text-dim" />
            <p className="text-sm text-text-muted">
              Nothing announced yet. Anything you publish appears at the top of
              every page.
            </p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {live.map((a) => (
              <AnnouncementRow
                key={a.id}
                id={a.id}
                title={a.title}
                body={a.body}
                scope={a.scope}
                scopeLabel={scopeLabel(a.scope, a.scope_id)}
                level={a.level}
                activeFrom={a.active_from}
                activeTo={a.active_to}
                retired={false}
              />
            ))}
          </div>
        )}
      </section>

      {retired.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-mono text-xs tracking-widest text-text-dim uppercase">
            Retired
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {retired.map((a) => (
              <AnnouncementRow
                key={a.id}
                id={a.id}
                title={a.title}
                body={a.body}
                scope={a.scope}
                scopeLabel={scopeLabel(a.scope, a.scope_id)}
                level={a.level}
                activeFrom={a.active_from}
                activeTo={a.active_to}
                retired
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-12">
        <CommunityFeatureToggles
          communities={communities.map((c) => ({
            id: c.id,
            name: c.name,
            is_featured: Boolean(c.is_featured),
          }))}
        />
      </section>

      <section className="mt-8">
        <FeaturedManager
          placements={placementViews}
          events={events}
          communities={communities}
        />
      </section>
    </div>
  );
}
