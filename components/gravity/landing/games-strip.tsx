"use client";

/**
 * "Games we support" strip — bold game badges that reveal on scroll. Each badge
 * sits in a glowing tile that lifts + glows on hover. If a real game artwork
 * file exists at public/games/<slug>.webp it's used as the tile background;
 * otherwise the stylized badge stands alone (safe default, no trademark issues).
 *
 * A "not affiliated" line keeps it honest. Marquee-free, premium, alive.
 */
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/components/gravity/scroll/gsap";
import { SUPPORTED_GAMES } from "@/components/gravity/game-badges";
import { GameLogo } from "@/components/gravity/game-logo";

export function GamesStrip() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!root.current || prefersReducedMotion()) return;
      const tiles = gsap.utils.toArray<HTMLElement>("[data-game]");
      gsap.from(tiles, {
        opacity: 0,
        y: 50,
        scale: 0.9,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: { trigger: root.current, start: "top 85%" },
      });
      ScrollTrigger.refresh();
    },
    { scope: root },
  );

  return (
    <section className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
      <p className="text-center font-mono text-xs tracking-[0.3em] text-text-dim uppercase">
        Built for the games you grind
      </p>

      <div ref={root} className="mt-8 grid grid-cols-3 gap-4 sm:gap-6">
        {SUPPORTED_GAMES.map((g) => (
          <div key={g.slug} data-game className="group/glow [perspective:800px]">
            <div className="relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl border border-line bg-[image:var(--gv-grad-surface)] p-6 transition-all duration-300 group-hover/glow:-translate-y-1.5 group-hover/glow:border-crimson-700/50 group-hover/glow:shadow-glow sm:p-8">
              {/* glow wash in the game's own color */}
              <div
                className="pointer-events-none absolute -top-16 left-1/2 size-40 -translate-x-1/2 rounded-full opacity-30 blur-3xl transition-opacity duration-500 group-hover/glow:opacity-70"
                style={{ background: `radial-gradient(circle, ${g.from}, transparent 70%)` }}
              />
              {/* real logo from public/games/<slug>.(svg|png|webp) if present, else stylized badge */}
              <div className="relative size-16 transition-transform duration-500 group-hover/glow:scale-110 sm:size-20">
                <GameLogo slug={g.slug} name={g.name} from={g.from} to={g.to} />
              </div>
              <span className="relative font-display text-base tracking-tight sm:text-lg">
                {g.name}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-[11px] text-text-dim">
        GRAVITY is an independent platform and is not affiliated with or endorsed
        by the game publishers.
      </p>
    </section>
  );
}
