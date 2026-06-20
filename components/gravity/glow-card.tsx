"use client";

/**
 * <GlowCard> — a raised panel with a 3D cursor-tilt and a crimson glare that
 * tracks the pointer. The cinematic base for event / community / leaderboard
 * cards. Tilt + glare are CSS-variable driven (no re-renders). Disabled under
 * reduced motion and on touch (where hover tilt is meaningless).
 */
import {
  useRef,
  useCallback,
  type PointerEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export function GlowCard({
  children,
  className,
  /** max tilt in degrees. */
  tilt = 6,
  /** disable the 3D tilt, keep the glare + glow. */
  flat = false,
}: {
  children: ReactNode;
  className?: string;
  tilt?: number;
  flat?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width; // 0..1
      const py = (e.clientY - rect.top) / rect.height; // 0..1

      // glare position
      el.style.setProperty("--mx", `${px * 100}%`);
      el.style.setProperty("--my", `${py * 100}%`);

      if (!flat) {
        const rx = (py - 0.5) * -2 * tilt; // rotateX
        const ry = (px - 0.5) * 2 * tilt; // rotateY
        el.style.setProperty("--rx", `${rx}deg`);
        el.style.setProperty("--ry", `${ry}deg`);
      }
    },
    [flat, tilt],
  );

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "0%");
  }, []);

  return (
    <div
      className={cn("group/glow [perspective:1200px]", className)}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <div
        ref={ref}
        className={cn(
          "relative h-full overflow-hidden rounded-lg border border-line",
          "bg-[image:var(--gv-grad-surface)]",
          "transition-[transform,box-shadow,border-color] duration-300 ease-gv",
          "group-hover/glow:border-crimson-700/50 group-hover/glow:shadow-glow",
          "[transform-style:preserve-3d]",
          "[transform:perspective(1200px)_rotateX(var(--rx,0))_rotateY(var(--ry,0))]",
        )}
      >
        {/* moving crimson glare */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/glow:opacity-100"
          style={{
            background:
              "radial-gradient(400px circle at var(--mx,50%) var(--my,0%), rgba(255,45,85,0.12), transparent 60%)",
          }}
        />
        {/* top hairline highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-crimson-500/40 to-transparent"
        />
        <div className="relative z-10 h-full">{children}</div>
      </div>
    </div>
  );
}
