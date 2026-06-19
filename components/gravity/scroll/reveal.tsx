"use client";

/**
 * <Reveal> — clean scroll-triggered entrance.
 *
 * Fades + slides its children into place as they enter the viewport. Uses
 * `useGSAP` for automatic cleanup (React-19 / Next-16 safe). Respects reduced
 * motion by rendering the final state immediately.
 *
 * Usage:
 *   <Reveal y={32} delay={0.1}><Card/></Reveal>
 *   <Reveal as="ul" stagger={0.08}>{items.map(...)}</Reveal>  // staggers children
 */
import { useRef, type ElementType, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "./gsap";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** vertical offset to animate from (px). */
  y?: number;
  /** horizontal offset to animate from (px). */
  x?: number;
  delay?: number;
  duration?: number;
  /** when > 0, animates *direct children* with this stagger instead of the container. */
  stagger?: number;
  /** ScrollTrigger start, default "top 85%". */
  start?: string;
  /** render element, default "div". */
  as?: ElementType;
  /** play once (default) or replay every time it scrolls into view. */
  once?: boolean;
};

export function Reveal({
  children,
  className,
  y = 28,
  x = 0,
  delay = 0,
  duration = 0.9,
  stagger = 0,
  start = "top 85%",
  as,
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const Tag = (as ?? "div") as ElementType;

  useGSAP(
    () => {
      if (!ref.current) return;

      // Reduced motion: show final state, no animation.
      if (prefersReducedMotion()) {
        gsap.set(stagger > 0 ? ref.current.children : ref.current, {
          opacity: 1,
          x: 0,
          y: 0,
        });
        return;
      }

      const targets =
        stagger > 0 ? (ref.current.children as unknown as Element[]) : ref.current;

      gsap.fromTo(
        targets,
        { opacity: 0, y, x },
        {
          opacity: 1,
          y: 0,
          x: 0,
          duration,
          delay,
          stagger: stagger > 0 ? stagger : undefined,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ref.current,
            start,
            toggleActions: once
              ? "play none none none"
              : "play none none reverse",
          },
        },
      );
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} className={cn(className)}>
      {children}
    </Tag>
  );
}
