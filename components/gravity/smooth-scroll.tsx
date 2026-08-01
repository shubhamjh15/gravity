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
import "lenis/dist/lenis.css"; // REQUIRED — sets html.lenis height/scroll behaviour
import { gsap, ScrollTrigger } from "@/components/gravity/scroll/gsap";

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo-out
      smoothWheel: true,
      touchMultiplier: 1.6,
    });

    // Update ScrollTrigger on every Lenis scroll, then drive Lenis from GSAP's
    // ticker so animations + scroll share one RAF loop.
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Lenis must remeasure when ScrollTrigger refreshes (layout/resize).
    const onRefresh = () => lenis.resize();
    ScrollTrigger.addEventListener("refresh", onRefresh);

    // Defer the first refresh until after layout + fonts settle, so trigger
    // positions are correct (this is what makes triggers fire on the right
    // scroll positions instead of all-at-once).
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      cancelAnimationFrame(id);
      lenis.off("scroll", ScrollTrigger.update);
      ScrollTrigger.removeEventListener("refresh", onRefresh);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
