"use client";

/**
 * Closing CTA — two paths (compete / host) on a glowing slab. Reveals on scroll.
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/gravity/scroll/reveal";
import { Spotlight } from "@/components/gravity/spotlight";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <Reveal y={40}>
        <div className="gv-panel relative overflow-hidden px-6 py-16 text-center sm:px-12 sm:py-20">
          <Spotlight fill="rgba(255,45,85,0.20)" size={700} />
          <div className="pointer-events-none absolute inset-0 gv-grid-bg opacity-50" />

          <div className="relative z-10 mx-auto max-w-2xl">
            <h2 className="font-display text-4xl leading-tight tracking-tight text-balance sm:text-6xl">
              The arena is{" "}
              <span className="gv-text-gradient">open</span>.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-text-muted">
              Drop in to compete for cash, or stand up your own tournaments and
              build a community around them. Zero setup, real payouts.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="gradient" size="xl" className="group">
                <Link href={"/events" as never}>
                  Compete now
                  <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="xl">
                <Link href={"/login" as never}>Become an organizer</Link>
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
