"use client";

/**
 * Landing hero — the GRAVITY moment.
 *
 * Layered: aurora blobs + cursor spotlight + faint grid, a giant Anton wordmark
 * that scrubs up on scroll (GSAP), an eyebrow, a lead line that word-reveals,
 * dual CTAs, and a live-stats strip. Everything respects reduced motion.
 */
import { useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import { ArrowRight, Trophy, Users, Wallet } from "lucide-react";
import { gsap, prefersReducedMotion } from "@/components/gravity/scroll/gsap";
import { AuroraBackground } from "@/components/gravity/aurora-background";
import { Spotlight } from "@/components/gravity/spotlight";
import { StatCounter } from "@/components/gravity/stat-counter";
import { Button } from "@/components/ui/button";

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!root.current || prefersReducedMotion()) return;

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from("[data-hero-eyebrow]", { y: 20, opacity: 0, duration: 0.6 })
        .from(
          "[data-hero-word] > span",
          { yPercent: 120, opacity: 0, duration: 1, stagger: 0.08 },
          "-=0.2",
        )
        .from(
          "[data-hero-lead]",
          { y: 20, opacity: 0, duration: 0.7 },
          "-=0.4",
        )
        .from(
          "[data-hero-cta]",
          { y: 16, opacity: 0, duration: 0.6, stagger: 0.1 },
          "-=0.3",
        )
        .from(
          "[data-hero-stats]",
          { y: 16, opacity: 0, duration: 0.6 },
          "-=0.2",
        );

      // wordmark drifts up + fades slightly as you scroll away (parallax scrub)
      gsap.to("[data-hero-word]", {
        yPercent: -18,
        opacity: 0.4,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative flex min-h-[100svh] items-center overflow-hidden pt-16"
    >
      <AuroraBackground />
      <Spotlight />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <span
            data-hero-eyebrow
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/50 px-4 py-1.5 font-mono text-xs tracking-[0.2em] text-text-muted uppercase backdrop-blur"
          >
            <span className="size-1.5 animate-pulse-glow rounded-full bg-crimson-500" />
            Free Fire · BGMI · PUBG · India
          </span>

          <h1
            data-hero-word
            className="mt-6 font-display text-[18vw] leading-[0.82] tracking-tighter sm:text-[16vw] lg:text-[180px]"
          >
            <span className="inline-block overflow-hidden">
              <span className="gv-text-gradient inline-block">GRAVITY</span>
            </span>
          </h1>

          <p
            data-hero-lead
            className="mt-6 max-w-2xl text-lg text-text-muted text-balance sm:text-xl"
          >
            Run tournaments. Compete for real cash prize pools. Build your
            community. The complete arena for India&apos;s grassroots esports
            scene — entry fees in, winnings out, all in one place.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Button
              asChild
              variant="gradient"
              size="xl"
              data-hero-cta
              className="group"
            >
              <Link href={"/events" as never}>
                Browse Tournaments
                <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild variant="glow" size="xl" data-hero-cta>
              <Link href={"/login" as never}>Host a Tournament</Link>
            </Button>
          </div>

          <dl
            data-hero-stats
            className="mt-16 grid w-full max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line"
          >
            <HeroStat
              icon={<Wallet className="size-4" />}
              label="Paid out"
              value={<StatCounter value={250000} prefix="₹" />}
            />
            <HeroStat
              icon={<Trophy className="size-4" />}
              label="Tournaments"
              value={<StatCounter value={1200} suffix="+" />}
            />
            <HeroStat
              icon={<Users className="size-4" />}
              label="Players"
              value={<StatCounter value={12400} suffix="+" />}
            />
          </dl>
        </div>
      </div>

      {/* scroll cue */}
      <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
        <div className="flex h-9 w-5 items-start justify-center rounded-full border border-line/80 p-1">
          <span className="h-2 w-1 animate-float rounded-full bg-crimson-500" />
        </div>
      </div>
    </section>
  );
}

function HeroStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1 bg-surface px-4 py-5">
      <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-text-dim uppercase">
        {icon}
        {label}
      </span>
      <span className="font-display text-2xl text-foreground sm:text-3xl">
        {value}
      </span>
    </div>
  );
}
