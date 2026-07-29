"use client";

/**
 * <SmoothScroll> — Lenis smooth scrolling wired into GSAP ScrollTrigger.
 *
 * This is also the fix for "ScrollTrigger not firing": we drive ScrollTrigger
 * from Lenis's scroll event and run GSAP's ticker as the RAF loop, so triggers
 * recalculate against the smoothed scroll position. Disabled under reduced
 * motion (native scroll). Mounted once in the root layout.
 */
import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/components/gravity/scroll/gsap";

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo-out
      smoothWheel: true,
      touchMultiplier: 1.5,
    });

    // Update ScrollTrigger on every Lenis scroll.
    lenis.on("scroll", ScrollTrigger.update);

    // Drive Lenis from GSAP's ticker (single RAF loop, in sync with animations).
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Recalculate trigger positions once everything is laid out.
    const onRefresh = () => lenis.resize();
    ScrollTrigger.addEventListener("refresh", onRefresh);
    ScrollTrigger.refresh();

    return () => {
      lenis.off("scroll", ScrollTrigger.update);
      ScrollTrigger.removeEventListener("refresh", onRefresh);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
