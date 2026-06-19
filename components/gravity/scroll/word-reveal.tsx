"use client";

/**
 * <WordReveal> — splits text into words and reveals them with a clean stagger
 * as the line scrolls into view. No SplitText plugin needed (we split in JSX),
 * so it works on the free GSAP tier and is SSR-safe.
 *
 * Great for hero sub-lines and section intros. For the giant "GRAVITY" wordmark
 * we use a dedicated treatment in the hero; this is for prose lines.
 */
import { useRef, type ElementType } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "./gsap";
import { cn } from "@/lib/utils";

type WordRevealProps = {
  text: string;
  className?: string;
  as?: ElementType;
  start?: string;
  stagger?: number;
};

export function WordReveal({
  text,
  className,
  as,
  start = "top 85%",
  stagger = 0.05,
}: WordRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const Tag = (as ?? "p") as ElementType;
  const words = text.split(" ");

  useGSAP(
    () => {
      if (!ref.current) return;
      const spans = ref.current.querySelectorAll("[data-word]");

      if (prefersReducedMotion()) {
        gsap.set(spans, { opacity: 1, y: 0 });
        return;
      }

      gsap.fromTo(
        spans,
        { opacity: 0, y: "0.6em" },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          stagger,
          ease: "power3.out",
          scrollTrigger: { trigger: ref.current, start },
        },
      );
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} className={cn(className)}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="inline-block overflow-hidden align-bottom"
        >
          <span data-word className="inline-block">
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        </span>
      ))}
    </Tag>
  );
}
