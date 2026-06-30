import { redirect } from "next/navigation";
import { SiteNavServer } from "@/components/gravity/site-nav-server";
import { SiteFooter } from "@/components/gravity/site-footer";
import { getAuthContext } from "@/lib/auth";

/**
 * Organizer area. Requires the organizer role; non-organizers are sent to a
 * page where they can apply (we route to /dashboard/become for now -> home).
 * RLS still backs every query.
 */
export default async function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isOrganizer, isSuperadmin } = await getAuthContext();
  if (!user) redirect("/login?next=/dashboard");
  if (!isOrganizer && !isSuperadmin) {
    // Not an organizer yet — send home (an "apply" flow can live here later).
    redirect("/?organizer=apply");
  }

  return (
    <>
      <SiteNavServer />
      <main className="flex-1 pt-16">{children}</main>
      <SiteFooter />
    </>
  );
}
