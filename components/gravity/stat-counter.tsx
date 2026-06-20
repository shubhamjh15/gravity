"use client";

/**
 * <StatCounter> — counts a number up from 0 when it scrolls into view.
 * GSAP-driven (uses our ScrollTrigger registration). Supports a prefix/suffix
 * and Indian-grouping so it works for "12,400 players" or "₹2,50,000 paid".
 * Reduced-motion: shows the final value immediately.
 */
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "./scroll/gsap";
import { cn } from "@/lib/utils";

export function StatCounter({
  value,
  prefix = "",
  suffix = "",
  duration = 1.6,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const fmt = (n: number) =>
        `${prefix}${Math.round(n).toLocaleString("en-IN")}${suffix}`;

      if (prefersReducedMotion()) {
        el.textContent = fmt(value);
        return;
      }

      const obj = { n: 0 };
      gsap.to(obj, {
        n: value,
        duration,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
        onUpdate: () => {
          el.textContent = fmt(obj.n);
        },
      });
    },
    { scope: ref, dependencies: [value] },
  );

  return (
    <span ref={ref} className={cn("font-mono tabular-nums", className)}>
      {prefix}0{suffix}
    </span>
  );
}
