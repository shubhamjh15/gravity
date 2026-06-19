"use client";

/**
 * GSAP + ScrollTrigger registration — client only.
 *
 * ScrollTrigger touches `window`, so it must never be imported in a server
 * component. Every scroll wrapper imports `gsap` and `ScrollTrigger` from HERE
 * so registration happens exactly once.
 *
 * We also honour `prefers-reduced-motion`: when set, callers should skip the
 * scrubbed animation and render content in its final state (handled in the
 * wrapper components via `useReducedMotion`).
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export { gsap, ScrollTrigger };

/** True when the user asked the OS to reduce motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
