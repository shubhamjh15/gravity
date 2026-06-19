"use client";

/**
 * <Parallax> — scrubbed depth movement tied to scroll position.
 *
 * Moves its children along Y as the section scrolls through the viewport,
 * scrubbed (smoothly linked to scroll, not time). Negative `speed` moves
 * slower-than-scroll (recedes), positive moves faster (foreground).
 *
 * Clean by design: small offsets, scrub:true, reduced-motion aware.
 */
import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "./gsap";
import { cn } from "@/lib/utils";

type ParallaxProps = {
  children: ReactNode;
  className?: string;
  /** -1..1 — fraction of the scroll distance to offset by. */
  speed?: number;
};

export function Parallax({ children, className, speed = -0.2 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current || prefersReducedMotion()) return;

      const distance = ref.current.offsetHeight * speed;

      gsap.fromTo(
        ref.current,
        { y: -distance },
        {
          y: distance,
          ease: "none",
          scrollTrigger: {
            trigger: ref.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        },
      );
    },
    { scope: ref, dependencies: [speed] },
  );

  return (
    <div ref={ref} className={cn("will-change-transform", className)}>
      {children}
    </div>
  );
}
