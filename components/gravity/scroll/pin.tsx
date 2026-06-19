"use client";

/**
 * <Pin> — pins a section while its inner content scrubs through `steps`.
 *
 * The section sticks to the viewport for `heightVh` of scrolling; during that
 * time the active step (0..steps-1) advances. Children receive the active index
 * via a render prop, so you can drive any visual you like.
 *
 * Used for the cinematic "how a tournament works" sequence on the landing page
 * and the prize-flow explainer. Reduced-motion: renders unpinned, all steps
 * stacked normally.
 */
import { useRef, useState, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger, prefersReducedMotion } from "./gsap";
import { cn } from "@/lib/utils";

type PinProps = {
  steps: number;
  heightVh?: number;
  className?: string;
  children: (activeStep: number) => ReactNode;
};

export function Pin({ steps, heightVh = 300, className, children }: PinProps) {
  const ref = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      if (!ref.current || !innerRef.current) return;
      if (prefersReducedMotion()) return;

      const st = ScrollTrigger.create({
        trigger: ref.current,
        start: "top top",
        end: () => `+=${heightVh}%`,
        pin: innerRef.current,
        scrub: true,
        onUpdate: (self) => {
          const idx = Math.min(steps - 1, Math.floor(self.progress * steps));
          setActive((prev) => (prev === idx ? prev : idx));
        },
      });

      return () => st.kill();
    },
    { scope: ref, dependencies: [steps, heightVh] },
  );

  return (
    <div
      ref={ref}
      className={cn("relative", className)}
      style={{ minHeight: prefersReducedMotion() ? undefined : `${heightVh}vh` }}
    >
      <div
        ref={innerRef}
        className="flex min-h-dvh items-center justify-center"
      >
        {children(active)}
      </div>
    </div>
  );
}
