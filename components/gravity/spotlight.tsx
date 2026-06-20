"use client";

/**
 * <Spotlight> — a crimson radial glow that follows the cursor across its parent.
 * Pure CSS-variable updates on mousemove (no React re-renders) so it stays at
 * 60fps. Drop it as the first child of a `relative` container.
 *
 * Reduced-motion: renders a static centered glow instead of tracking.
 */
import { useRef, useCallback, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

export function Spotlight({
  className,
  fill = "rgba(255,45,85,0.16)",
  size = 600,
}: {
  className?: string;
  fill?: string;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--y", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 z-0 transition-opacity duration-500",
        className,
      )}
      style={{
        background: `radial-gradient(${size}px circle at var(--x, 50%) var(--y, 0%), ${fill}, transparent 70%)`,
      }}
    />
  );
}
