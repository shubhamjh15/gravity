import { SiteNavServer } from "@/components/gravity/site-nav-server";
import { SiteFooter } from "@/components/gravity/site-footer";
import { AnnouncementBanner } from "@/components/gravity/announcement-banner";
import { getLiveAnnouncements } from "@/lib/data/announcements";

/**
 * Public-facing layout: top nav (transparent → frosted on scroll), any live
 * admin announcement, then the page, then the footer. Auth/role-gated areas
 * use their own layouts.
 *
 * The announcement read is a plain server fetch — deliberately NOT Realtime
 * (#7: no per-visitor subscription on hot public pages).
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const announcements = await getLiveAnnouncements();

  return (
    <>
      <SiteNavServer />
      {announcements.length > 0 ? (
        <AnnouncementBanner announcements={announcements} />
      ) : null}
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
