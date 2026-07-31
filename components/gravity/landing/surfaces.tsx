"use client";

/**
 * "Everything in one arena" — nine BIG surfaces that reveal SIDEWAYS on scroll.
 *
 * Layout: large alternating rows (art left / text right, then flipped). Each row
 * slides in horizontally from its side as it enters the viewport (GSAP
 * ScrollTrigger), so the section unfolds one surface at a time rather than a
 * grid appearing all at once.
 *
 * Each card carries its OWN color theme (surface-art THEMES) and a 3D
 * cursor-tilt + SVG cursor-parallax. Smooth scroll (Lenis) drives ScrollTrigger.
 */
import { useRef, useCallback, type PointerEvent } from "react";
import { useGSAP } from "@gsap/react";
import { ArrowUpRight } from "lucide-react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/components/gravity/scroll/gsap";
import { SectionHeading } from "@/components/gravity/section-heading";
import { SURFACE_ART, THEMES } from "@/components/gravity/landing/surface-art";
import { cn } from "@/lib/utils";

const SURFACES = [
  { tag: "Compete", title: "Events & Registration", body: "Discover, filter, register and pay in a tap. The Room ID and password are revealed only to paid players, and pushed by email and WhatsApp the moment the organizer releases them." },
  { tag: "Win", title: "Prize Pools & Payouts", body: "Set an entry fee, rank prizes, per-kill bounties with caps, an admin cut and your profit. The prize engine validates the split equals the collected pool, to the paise, before it ever publishes." },
  { tag: "Verify", title: "Screenshot Results", body: "No fragile game API. Upload the final leaderboard screenshot, enter ranks and kills, and the engine computes every payout instantly, then posts the public results." },
  { tag: "Belong", title: "Communities", body: "Paid or free join with optional approval. Realtime member chat, small groups, 1-v-1 invites, elite tiers gated by gov-ID and kill-ratio, and a monthly earning dashboard." },
  { tag: "Climb", title: "Leaderboards", body: "Ranked by kill-ratio, win-ratio and net earnings, sliced by event, community, or globally, across daily, monthly, yearly and all-time periods." },
  { tag: "Shop", title: "The Store", body: "Jerseys, gear, passes and accessories. Full inventory management, partial-payment installments, manual delivery tracking and verified-purchase reviews." },
  { tag: "Partner", title: "Sponsors", body: "A public sponsor directory plus a request flow routed to the super-admin and the targeted community admin, who publish approved sponsors live." },
  { tag: "Identity", title: "Player Profiles", body: "Per-game in-game IDs, ranking, kill and win ratios, previous earnings, badges and verified gov-ID, the complete gaming identity behind every competitor." },
  { tag: "Trust", title: "One Secure Ledger", body: "Every rupee, entry fees, memberships, store orders, payouts and refunds, is a single immutable row. The entire revenue dashboard is one query on this table." },
] as const;

export function Surfaces() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!root.current || prefersReducedMotion()) return;
      const rows = gsap.utils.toArray<HTMLElement>("[data-row]");

      rows.forEach((row) => {
        const dir = row.dataset.dir === "left" ? -1 : 1;
        gsap.fromTo(
          row,
          { opacity: 0, x: 120 * dir, rotateY: 6 * dir },
          {
            opacity: 1,
            x: 0,
            rotateY: 0,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: { trigger: row, start: "top 82%", toggleActions: "play none none reverse" },
          },
        );
      });

      ScrollTrigger.refresh();
    },
    { scope: root },
  );

  return (
    <section className="relative mx-auto max-w-6xl px-4 py-28 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="One platform, nine surfaces"
        title={<>Everything a tournament needs, <span className="gv-text-gradient">in one arena</span></>}
        lead="Scroll through the whole stack, from the first registration to the final payout."
        align="center"
        className="mx-auto"
      />

      <div ref={root} className="mt-20 flex flex-col gap-20 [perspective:1400px] sm:gap-28">
        {SURFACES.map((s, i) => {
          const Art = SURFACE_ART[i];
          const theme = THEMES[i];
          const flip = i % 2 === 1;
          return (
            <div
              key={s.title}
              data-row
              data-dir={flip ? "right" : "left"}
              className="[transform-style:preserve-3d]"
            >
              <SurfaceRow index={i} tag={s.tag} title={s.title} body={s.body} flip={flip} theme={theme}>
                <Art gid={`s${i}`} theme={theme} />
              </SurfaceRow>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SurfaceRow({
  index,
  tag,
  title,
  body,
  flip,
  theme,
  children,
}: {
  index: number;
  tag: string;
  title: string;
  body: string;
  flip: boolean;
  theme: { from: string; to: string; accent: string };
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--px", `${px}`);
    el.style.setProperty("--py", `${py}`);
    el.style.setProperty("--rx", `${py * -6}deg`);
    el.style.setProperty("--ry", `${px * 6}deg`);
  }, []);

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    for (const k of ["--px", "--py", "--rx", "--ry"]) el.style.setProperty(k, "0");
  }, []);

  return (
    <div
      className={cn(
        "group/glow grid items-center gap-8 lg:grid-cols-2 lg:gap-14",
        flip && "lg:[direction:rtl]",
      )}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {/* BIG art panel */}
      <div
        ref={ref}
        className="relative aspect-square w-full overflow-hidden rounded-3xl border border-line [direction:ltr] [transform-style:preserve-3d] [transform:rotateX(var(--rx,0))_rotateY(var(--ry,0))] transition-transform duration-300 ease-out sm:aspect-[5/4]"
        style={{
          backgroundImage: `radial-gradient(120% 100% at 50% 0%, ${theme.from}14, transparent 60%), linear-gradient(180deg, var(--gv-surface-2), var(--gv-surface))`,
        }}
      >
        <div className="gv-grid-bg absolute inset-0 opacity-40" />
        <div className="absolute inset-0 grid place-items-center p-8 [transform:translateZ(60px)]">
          <div className="h-full max-h-72 w-full max-w-72">{children}</div>
        </div>
        {/* big ghost index */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-3 left-5 font-display text-7xl leading-none sm:text-8xl"
          style={{ color: `${theme.from}1a` }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      {/* text */}
      <div className="[direction:ltr]">
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] tracking-[0.2em] uppercase"
          style={{ borderColor: `${theme.from}55`, color: theme.accent }}
        >
          <span className="size-1.5 rounded-full" style={{ background: theme.from }} />
          {tag}
        </span>
        <h3 className="mt-4 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
          {title}
        </h3>
        <p className="mt-4 max-w-md text-base leading-relaxed text-text-muted">
          {body}
        </p>
        <span
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium transition-transform duration-300 group-hover/glow:translate-x-1"
          style={{ color: theme.accent }}
        >
          Explore <ArrowUpRight className="size-4" />
        </span>
      </div>
    </div>
  );
}
