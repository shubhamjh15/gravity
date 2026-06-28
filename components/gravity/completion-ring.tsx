"use client";

/**
 * <CompletionRing> — an animated SVG progress ring for profile completion.
 * The stroke is the crimson->ember gradient; it animates from 0 to `value` on
 * mount. Center shows the percentage. Used on the profile + dashboard.
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function CompletionRing({
  value,
  size = 96,
  stroke = 8,
  className,
  label,
}: {
  value: number; // 0..100
  size?: number;
  stroke?: number;
  className?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  // Start at 0 so the CSS transition animates up to `clamped` after mount.
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Defer to the next frame so the 0 -> clamped transition runs (not on the
    // synchronous mount pass — avoids the cascading-render warning).
    const apply = () => setShown(clamped);
    if (reduce) {
      // still async to satisfy the "no setState in effect body" rule
      const t = setTimeout(apply, 0);
      return () => clearTimeout(t);
    }
    const id = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (shown / 100) * circumference;

  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="gv-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--gv-crimson-500)" />
            <stop offset="100%" stopColor="var(--gv-ember-500)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--gv-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#gv-ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <span className="font-display text-xl leading-none">{clamped}%</span>
        {label ? (
          <span className="mt-0.5 font-mono text-[9px] tracking-widest text-text-dim uppercase">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
