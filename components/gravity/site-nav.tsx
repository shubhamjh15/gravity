"use client";

/**
 * <SiteNav> — the public top navigation.
 *
 * - Transparent over the hero, then condenses to a frosted bar on scroll.
 * - Mobile: a slide-in sheet.
 * - Auth-aware slot is passed in from a server component (so this stays a thin
 *   client shell). For Phase 0 the CTA is "Enter" → /login (wired in Phase 1).
 *
 * The nine surfaces from the plan map to these links; pages fill in per phase.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/events", label: "Events" },
  { href: "/communities", label: "Communities" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/store", label: "Store" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/about", label: "About" },
] as const;

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-line/80 bg-background/70 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        {/* desktop links */}
        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href as never}
                  className={cn(
                    "relative rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "text-foreground"
                      : "text-text-muted hover:text-foreground",
                  )}
                >
                  {link.label}
                  {active ? (
                    <span className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-crimson-500 to-transparent" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href={"/login" as never}>Log in</Link>
          </Button>
          <Button asChild variant="gradient" size="sm" className="hidden sm:inline-flex">
            <Link href={"/login" as never}>Enter the Arena</Link>
          </Button>

          {/* mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="size-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-72 border-line bg-background/95 backdrop-blur-xl"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex flex-col gap-1 px-2 pt-8">
                <Logo className="mb-6 px-2" />
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href as never}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-3 text-base font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="mt-4 flex flex-col gap-2 px-1">
                  <Button asChild variant="outline">
                    <Link href={"/login" as never}>Log in</Link>
                  </Button>
                  <Button asChild variant="gradient">
                    <Link href={"/login" as never}>Enter the Arena</Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
