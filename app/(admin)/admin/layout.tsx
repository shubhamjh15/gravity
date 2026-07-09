import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Users, Handshake, Receipt, FileText, ShoppingBag } from "lucide-react";
import { getAuthContext } from "@/lib/auth";
import { Logo } from "@/components/gravity/logo";

/**
 * Super-admin console layout. Lives at an obscure path; the REAL gate is the
 * superadmin RLS + this server-side check (#4 — hidden URL is cosmetic). Non-
 * superadmins are bounced to home with a 404-ish redirect so the area's
 * existence isn't confirmed.
 */
const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users & Roles", icon: Users },
  { href: "/admin/ledger", label: "Ledger", icon: Receipt },
  { href: "/admin/sponsors", label: "Sponsorships", icon: Handshake },
  { href: "/admin/store", label: "Store", icon: ShoppingBag },
  { href: "/admin/about", label: "About Editor", icon: FileText },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isSuperadmin } = await getAuthContext();
  if (!user || !isSuperadmin) {
    redirect("/");
  }

  return (
    <div className="flex min-h-dvh">
      {/* sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-void/60 p-4 lg:flex">
        <div className="px-2 py-3">
          <Logo size="sm" />
          <p className="mt-1 font-mono text-[10px] tracking-widest text-text-dim uppercase">
            Control room
          </p>
        </div>
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href as never}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <Icon className="size-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-2">
          <Link href={"/" as never} className="text-xs text-text-dim hover:text-crimson-300">
            ← Exit to site
          </Link>
        </div>
      </aside>

      {/* mobile top nav */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2 overflow-x-auto border-b border-line bg-void/60 px-4 py-3 lg:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href as never}
              className="rounded-md px-3 py-1.5 text-xs whitespace-nowrap text-text-muted hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </div>
        <main className="flex-1 p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
