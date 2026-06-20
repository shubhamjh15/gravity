import { cn } from "@/lib/utils";

/**
 * <AuroraBackground> — slow-drifting crimson/ember light blobs behind a hero.
 * Pure CSS (uses the `aurora` keyframe + blur), GPU-friendly, no JS. Place as an
 * absolutely-positioned layer; the `gv-grid-bg` overlay adds a faint tech grid.
 */
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      {/* crimson blob */}
      <div className="animate-aurora absolute -top-1/3 left-1/4 h-[60vmax] w-[60vmax] -translate-x-1/2 rounded-full bg-crimson-600/20 blur-[120px]" />
      {/* ember blob */}
      <div
        className="animate-aurora absolute top-0 right-0 h-[45vmax] w-[45vmax] rounded-full bg-ember-500/15 blur-[120px]"
        style={{ animationDelay: "-6s" }}
      />
      {/* deep garnet blob */}
      <div
        className="animate-aurora absolute -bottom-1/4 left-1/2 h-[50vmax] w-[50vmax] -translate-x-1/2 rounded-full bg-crimson-900/30 blur-[140px]"
        style={{ animationDelay: "-12s" }}
      />
      {/* faint tech grid + top vignette */}
      <div className="gv-grid-bg absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
    </div>
  );
}
