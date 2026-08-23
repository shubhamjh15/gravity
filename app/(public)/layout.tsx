import { SiteNavServer } from "@/components/gravity/site-nav-server";
import { SiteFooter } from "@/components/gravity/site-footer";
/**
 * Public-facing layout: top nav (transparent → frosted on scroll), the page,
 * then the footer. Auth/role-gated areas use their own layouts.
 *
 * Announcements are deliberately NOT here. A platform notice above the hero
 * reads as an error bar to someone still deciding whether to sign up, and it
 * pushed every marketing page's content below the fold. They belong where
 * people are actually using the product — see the community pages.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteNavServer />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
