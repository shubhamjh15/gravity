import { SiteNavServer } from "@/components/gravity/site-nav-server";
import { SiteFooter } from "@/components/gravity/site-footer";
import { requireUser } from "@/lib/auth";

/**
 * Authenticated player area. requireUser() bounces logged-out visitors to
 * /login (RLS is still the real backstop on every query). Reuses the public
 * chrome so the experience is continuous.
 */
export default async function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser("/profile");

  return (
    <>
      <SiteNavServer />
      <main className="flex-1 pt-16">{children}</main>
      <SiteFooter />
    </>
  );
}
