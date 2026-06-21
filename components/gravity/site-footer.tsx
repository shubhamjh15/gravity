import Link from "next/link";
import { Logo } from "./logo";

const FOOTER_SECTIONS = [
  {
    title: "Compete",
    links: [
      { href: "/events", label: "Tournaments" },
      { href: "/leaderboard", label: "Leaderboard" },
      { href: "/communities", label: "Communities" },
    ],
  },
  {
    title: "Platform",
    links: [
      { href: "/store", label: "Store" },
      { href: "/sponsors", label: "Sponsors" },
      { href: "/about", label: "About" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/login", label: "Become an organizer" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative mt-24 border-t border-line/80">
      <div className="gv-grid-bg pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2">
            <Logo size="lg" />
            <p className="mt-4 max-w-xs text-sm text-text-muted">
              The arena for the Indian Free Fire, BGMI & PUBG scene. Run
              tournaments, win cash pools, build your crew.
            </p>
          </div>
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="font-mono text-xs font-semibold tracking-[0.18em] text-text-dim uppercase">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {section.links.map((link, i) => (
                  <li key={`${link.href}-${i}`}>
                    <Link
                      href={link.href as never}
                      className="text-sm text-text-muted transition-colors hover:text-crimson-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="gv-rule mt-12" />
        <div className="mt-6 flex flex-col items-center justify-between gap-4 text-xs text-text-dim sm:flex-row">
          <p>© {new Date().getFullYear()} GRAVITY. All rights reserved.</p>
          <p className="font-mono">
            Built for the grind · Free Fire · BGMI · PUBG
          </p>
        </div>
      </div>
    </footer>
  );
}
