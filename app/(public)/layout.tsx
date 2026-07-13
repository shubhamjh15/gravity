import { SiteNavServer } from "@/components/gravity/site-nav-server";
import { SiteFooter } from "@/components/gravity/site-footer";

/**
 * Public-facing layout: top nav (transparent → frosted on scroll) + footer.
 * Pages render between them. Auth/role-gated areas use their own layouts.
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
