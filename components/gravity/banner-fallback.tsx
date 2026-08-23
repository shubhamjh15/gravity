/**
 * The stand-in shown when a community, tournament or product has no banner.
 *
 * The previous fallback was `gv-grid-bg opacity-50` — a 3.5%-white grid at half
 * opacity, so roughly 1.75% contrast — and on the detail pages the readability
 * gradient layered over it erased even that. The result was a 288px black void
 * that read as a failed image load rather than a design decision.
 *
 * This is deliberately branded instead: a crimson→void wash in the locked accent
 * family, the grid at usable contrast, and an optional initial so a missing
 * banner still identifies its subject. All from tokens — no hardcoded hex.
 */
import { cn } from "@/lib/utils";

export function BannerFallback({
  seed,
  className,
  showInitial = false,
}: {
  /** Used to pick one of a few gradient angles so every card isn't identical. */
  seed?: string;
  className?: string;
  showInitial?: boolean;
}) {
  // A stable, cheap hash — the same community always gets the same treatment,
  // which matters because these render in lists next to each other.
  const variant =
    seed && seed.length > 0
      ? seed.charCodeAt(0) % 3
      : 0;

  const wash = [
    "bg-gradient-to-br from-crimson-950 via-surface-2 to-void",
    "bg-gradient-to-tr from-void via-surface-2 to-crimson-950",
    "bg-gradient-to-r from-surface-2 via-crimson-950 to-void",
  ][variant];

  return (
    <div className={cn("absolute inset-0 overflow-hidden", wash, className)}>
      <div className="gv-grid-bg absolute inset-0 opacity-80" />

      {/* A single soft ember bloom, so the surface isn't flat. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/3 left-1/2 size-[60%] -translate-x-1/2 rounded-full bg-crimson-600/20 blur-3xl"
      />

      {showInitial && seed ? (
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center font-display text-6xl text-crimson-500/15 select-none sm:text-7xl"
        >
          {seed.trim().charAt(0).toUpperCase()}
        </span>
      ) : null}
    </div>
  );
}
