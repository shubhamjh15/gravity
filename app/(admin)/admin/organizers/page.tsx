import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  OrganizerReview,
  type OrganizerApplicationView,
} from "@/components/gravity/admin/organizer-review";

export const metadata: Metadata = {
  title: "Organizer Applications",
  robots: { index: false },
};

/**
 * Organizer verification queue (ROADMAP acceptance: "Super Admin: verify
 * organizers"). RLS restricts these rows to superadmins, so the read needs no
 * extra filter.
 */
export default async function AdminOrganizersPage() {
  const supabase = await createSupabaseServerClient();

  const { data: apps } = await supabase
    .from("organizer_applications")
    .select(
      "id, user_id, org_name, games, experience, audience_size, links, status, review_note, created_at",
    )
    // Pending first, then most recent.
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  const rows = apps ?? [];

  // Resolve applicant names in one round trip rather than per row.
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", userIds)
    : { data: [] };

  const profileFor = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      { name: p.display_name || "Unnamed player", email: p.email || "" },
    ]),
  );

  const views: OrganizerApplicationView[] = rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    applicant: profileFor.get(r.user_id)?.name ?? "Unknown player",
    email: profileFor.get(r.user_id)?.email ?? "",
    org_name: r.org_name,
    games: r.games,
    experience: r.experience,
    audience_size: r.audience_size,
    links: r.links,
    status: r.status as OrganizerApplicationView["status"],
    review_note: r.review_note,
    created_at: r.created_at,
  }));

  const pendingCount = views.filter((v) => v.status === "pending").length;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl tracking-tight">
        Organizer applications
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        {pendingCount > 0
          ? `${pendingCount} waiting on you. `
          : "Nothing waiting on you. "}
        Approving grants the organizer role in the same transaction as the
        decision, and both are audited.
      </p>

      <OrganizerReview applications={views} />
    </div>
  );
}
